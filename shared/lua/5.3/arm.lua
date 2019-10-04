--@name ARM
--@author
--@shared

if not consoleRunHere then return end

vc.file.registerExtension("arm", "ARM Assembly")
vc.file.registerExtension("exe", "Executable")

local arm = {}
arm.switches = {
    ["dump"] = false
}
arm.flags = {
    "ram",
    "o"
}
arm.assembler = {}

function arm.start(args, flags, switches)
    if #args < 2 or (args[1] ~= "run" and args[1] ~= "assemble") then 
        shell.print("Usage: arm run [.exe path] OR arm assemble [.arm path]")
        return 0
    end
    
    local t = args[1]
    
    
    local filePath = args[2]
        
    local f, err = arm.getFile(filePath)
    
    if type(f) == "number" then
        shell.print("Error: " .. err)
        return 0
    end
    
    if t == "assemble" then
        if string.right(args[2], 4) ~= ".arm" then
            shell.print("Cannot assemble " .. args[2])
            return 0
        end
        
        if flags.o then
            arm.assembler.output = arm.getPath(flags.o)
        else
            arm.assembler.output = arm.getPath(string.sub(args[2], 1, #args[2] - 3) .. "exe")
        end
        
        arm.assembly = string.split(f.content, "\n")
        
        arm.memory = {}
        
        arm.assembler.shouldDump = switches.dump
        
        arm.assembleRoutine()
    elseif t == "run" then
        arm.memorySize = flags.ram or 64
        
        if string.right(args[2], 4) ~= ".exe" then
            shell.print("Cannot run " .. args[2])
            return 0
        end
        
        return 1
    end
end

function arm.getFile(filePath)
    return vc.file.getFile(arm.getPath(filePath))
end

function arm.getPath(filePath)
    local curDir = vc.file.formatPath(shell.filePath.partition, shell.filePath.path)
    if filePath[1] == "/" or filePath[1] == "\\" then
        filePath = string.sub(filePath, 2)
    end
    
    if not (curDir[#curDir] == "\\" or curDir[#curDir] == "/") then
        curDir = curDir .. "/"
    end
    return curDir .. filePath
end

-- Todo:
--[[
    LDR
    STR
    STMFD (= STMDB), just do all of STM
    LDMFD (= LDMDB), just do all of LDM
    MUL Rd, Rn, Rm => Rd = Rn * Rm
    MLA Rd, Rn, Rm, Ra => Rd = Rn * Rm + Ra, this is MUL with a flag set
    
    using [] in structions, e.g.
    STR R3, [R1, R0], cant remember what does xd
    Only ever used with STR and LDR, be be like [R1, R0 LSL #2] as well
]]

-- Error ENUMS
ERROR_BAD_ARG_TYPE = "Invalid argument type"
ERROR_OUT_OF_RANGE = "Argument [1] out of range"
ERROR_BAD_ARG = "Argument [1] invalid"
ERROR_WRONG_ARG = "Argument [1] incorrect for instruction [2]"
ERROR_INVALID_ARG_COUNT = "Incorrect number of arguments"
ERROR_INVALID_POSTFIX = "Invalid postfix on argument [1]"

function arm.error(e, line, ...)
    e = e or "Unknown error"

    local argNum = 1
    local args = {...}
    while string.find(e, "[" .. argNum .. "]", nil, true) do
        e = string.Replace(e, "[" .. argNum .. "]", args[argNum])
        argNum = argNum + 1
    end

    shell.print("Error: " .. e .. " on line ".. line)
    arm.exit(0)
end

arm.assembler.instructions = {
    ["B"] = function(data, memPos, args, line, link) -- reg/label
        local addr = args[1]
        if addr.type == "Register" then
            return arm.assembler.instructions["MOV"](data, memPos, {"PC", "R"..addr.value}, line)
        elseif addr.type == "Label" then
            data = arm.setBits(data, 4, "101" .. (link and "1" or "0"))
        
            arm.scheduleFillAddress(addr.value, memPos, "B", line, {string.sub(data, 1, 8)})
        end
        return 4
    end,
    ["BL"] = function(data, memPos, args, line) -- reg/label
        return arm.assembler.instructions(data, memPos, args, line, true)
    end,
    ["ADR"] = function(data, memPos, args, line, isADRL) -- reg, label
        -- creates a SUB or ADD from PC if offset can be encoded in op2, if number cant be made, throw error
        local out = args[1].value
        local label = args[2].value
        arm.scheduleFillAddress(label, memPos, isADRL and "ADRL" or "ADR", line, {data, out})
        return 4
    end,
    ["ADRL"] = function(data, memPos, args, line) -- reg, label
        arm.assembler.instructions["ADR"](data, memPos, args, line, true)
        return 8
    end,
    ["SWI"] = function(data, memPos, args, line) -- number
        local num = args[1].value
        if num < 2^24 then
            data = arm.setBits(data, 4, "1111" .. toBaseN(num, 2, 24))
            arm.saveWord(memPos, data)
        else
            arm.error(ERROR_OUT_OF_RANGE, line)
            return
        end
        return 4
    end,
    ["DataSaveLoad"] = function(data, memPos, args, line, isLoad, t)
    
        --[[
            pre/post for indexing
            W for writeback
            R for reg offset
        
            next arg can be
            1  [R0] 
            2  [R0, #10] --pre
            3  [R0, #10]! --pre W
            4  [R0, R1] --pre R
            5  [R0, R1 LSL #2] --pre R
            6  [R0, R1]! --pre W R
            7  [R0, R1 LSL #2]! --pre W R
            8  label
            
            if in form [R0], next args can be
            9  #offset --post W
            10 R1
            11 R1 LSL #2 --post W R
            
            else no next args
            
            
            the is no post indexing without writeback, as that is pointless
        ]]
    
        local destRegs = {table.remove(args, 1).value}
        if t == "D" then
            table.insert(destRegs, table.remove(args, 1).value)
        end
        
        local isSignedOrHalf = not (t == "-" or t == "B")
        
        local addr = table.remove(args, 1)
        local targReg, offset, offsetIsReg
        -- U flag set by a +- infront of reg, need to add that, for now just keep at 1
        local I, P, U, B, W, L = 0, 1, 1, t == "B" and 1 or 0, 0, isLoad and 1 or 0
        
        if addr.type == "Label" then
            if #args > 0 then
                arm.error(ERROR_INVALID_ARG_COUNT, line)
            end
            -- push pending label shit etc.
            -- Just have it call back to this mess with PC and offset
            return 4
        elseif addr.type == "Brackets" then
            local c = addr.content
            targReg = c[1] -- Arg type checking will ensure this is a register
            
            offset = c[2]
            
            if #args > 0 then
                if offset then
                    arm.error(ERROR_INVALID_ARG_COUNT, line)
                    return
                else
                    offset = args[1]
                    P = 0 -- We post indexing, baby!
                    W = 1 -- Posting indexing is useless without writeback, so becomes default
                    if addr.post == "!" then
                        --Meaningless ! on brackets, warn or error?
                        arm.error("Meaningless !, writeback enabled by default with post incrementation", line)
                        return
                    end
                end
            else
                if offset then
                    W = addr.post == "!"
                elseif addr.post == "!" then
                    -- Writeback when no offset, warn or error?
                    arm.error("Obsolete writeback when no offset", line)
                end
            end
            
        end
        
        offset = offset or {type="Constant", value=0}
        
        I = (offset.type == "Register" and 1 or 0)
        
        if isSignedOrHalf then
            if offset and offset.shift then
                arm.error(ERROR_WRONG_ARG, line, #destRegs + 1)
                return
            end
            if offset and offset.type == "Constant" and offset.value > 255 then
                arm.error(ERROR_OUT_OF_RANGE, line, #destRegs + 1)
                return
            end
        end
        
        local offsetBin = arm.assembler.dataArgToBinary(offset)
        
        if not offsetBin then
            arm.error(ERROR_OUT_OF_RANGE, line, #destRegs + 1)
            return
        end
        
        if #destRegs > 1 then
            -- This does 2 instructions, and is fukin wacky
            if offsetIsReg then
                arm.error(ERROR_WRONG_ARG, line, #destRegs + 1)
                return
            end
            arm.assembler.instructions.DataSaveLoad(data, memPos  , {
                destRegs[1], 
            }, line, isLoad, "-")
            arm.assembler.instructions.DataSaveLoad(data, memPos+4, {
                destRegs[2], 
            }, line, isLoad, "-")
            
            return 8
        else
            local destBin = toBaseN(destRegs[1], 2, 4)
            if not isSignedOrHalf then
                data = arm.setBits(data, 4, "01" .. I .. P .. U .. B .. W .. L .. toBaseN(targReg.value, 2, 4) .. destBin .. offsetBin)
                
            else
                local S, H = t[1] == "S", t[#t] == "H"
                if I == 0 then
                    local constBin = toBaseN(offset.value, 2, 8)
                    offsetBin = string.sub(constBin, 1, 4) .. "1" .. (S and 1 or 0) .. (H and 1 or 0) .. "1" .. string.sub(constBin, 5, 8)
                else
                    offsetBin = "00001" .. (S and 1 or 0) .. (H and 1 or 0) .. "1" .. offset.value
                end
                data = arm.setBits(data, 4, "000" .. P .. U .. I .. W .. L .. toBaseN(targReg.value, 2, 4) .. destBin .. offsetBin)
                
            end
        end
        arm.saveWord(memPos, data)
        return 4
    end,
    ["DataProc"] = function(data, memPos, args, line, opCode, ignoreOp1, hasOutput, setStatusReg, noError) -- Inaccessable as a real instruction, as not lowercase, used by other instructions internally
        local op1, op2, opD
        if hasOutput then
            opD = args[1].value
            table.remove(args, 1)
        end
        if not ignoreOp1 then
            op1 = args[1].value
            table.remove(args, 1)
        else
            op1 = 0
        end
        
        op2 = args[1]
        local op2Str = arm.assembler.dataArgToBinary(op2)
        if not op2Str then
            if not noError then
                arm.error(ERROR_OUT_OF_RANGE, line, 1 + (hasOutput and 1 or 0) + (ignoreOp1 and 0 or 1))
            end
            return
        end
        
        data = arm.setBits(data, 4, "00" .. (op2.isRegister and "0" or "1") .. opCode .. (setStatusReg and "1" or "0") .. toBaseN(op1, 2, 4) .. toBaseN(opD, 2, 4) .. op2Str)
        arm.saveWord(memPos, data)
        return 4
    end,
}

-- Argument syntax:
--[[
    {{arg1option1, arg1option2}, {arg2}}
    {{arg1option1optional, arg1option2optional, optional=true}}
    brackets example

    {{"Brackets", "Label", data1 = {post = {"!", ""}, content = {{"Register"}, {"RegisterS", "Constant", optional=true}}}}, {"RegisterS", "Constant", optional=true}}
]]

arm.assembler.instructionArguments = {
    ["B"] = {{"Register", "Label"}}, -- Reg/label
    ["BL"] = {{"Register", "Label"}},
    ["ADR"] = {{"Register"}, {"Label"}}, -- Reg, Label
    ["ADRL"] = {{"Register"}, {"Label"}},
    ["SWI"] = {{"Number"}}, -- Number
}

-- table args: opCode, noOp1, hasOpD, setStatus    (set Status is wrong atm)
arm.assembler.dataInstructions = {
    ["AND"] = {"0000", false, true, false},
    ["EOR"] = {"0001", false, true, false},
    ["SUB"] = {"0010", false, true, false},
    ["RSB"] = {"0011", false, true, false},
    ["ADD"] = {"0100", false, true, false},
    ["ADC"] = {"0101", false, true, false},
    ["SBC"] = {"0110", false, true, false},
    ["RSC"] = {"0111", false, true, false},
    ["TST"] = {"1000", false, false, false},
    ["TEQ"] = {"1001", false, false, false}, -- Needs specific test as EQ is a condition
    ["CMP"] = {"1010", false, false, false},
    ["CMN"] = {"1011", false, false, false},
    ["ORR"] = {"1100", false, true, false},
    ["MOV"] = {"1101", true, true, false},
    ["BIC"] = {"1110", false, true, false},
    ["MVN"] = {"1111", true, true, false},
}

--[[
    args for above
    if noOp1 and not hasOpD then
        regS/const
    elseif noOp1 == hasOpD then
        reg, regS/const
    else
        reg, reg, regS/const
    end
]]

-- table args: isLoad, type
arm.assembler.dataSaveLoadInstructions = {
    ["STR"] = {false, "-"},
    ["STRD"] = {false, "D"},
    ["STRB"] = {false, "B"},
    ["STRH"] = {false, "H"},
    ["LDR"] = {true, "-"},
    ["LDRD"] = {true, "D"},
    ["LDRB"] = {true, "B"},
    ["LDRSB"] = {true, "SB"},
    ["LDRH"] = {true, "H"},
    ["LDRSH"] = {true, "SH"}
}

--[[
    args for above
    if type == "D" then
        reg, reg, [reg, regS/const?]!?, regS/const
    else
        reg, [reg, regS/const?]!?, regS/const
    end
]]

arm.assembler.shifts = {
    ["LSL"] = "00",
    ["LSR"] = "01",
    ["ASR"] = "10",
    ["ROR"] = "11",
}

for k, v in pairs(arm.assembler.dataInstructions) do
    arm.assembler.instructions[k] = function(data, memPos, args, line, noError)
        if noError then v[5] = noError end
        return arm.assembler.instructions["DataProc"](data, memPos, args, line, unpack(v))
    end
    local args = {{"RegisterSR", "Constant"}}
    if not (v[2] and not v[3]) then
        table.insert(args, 1, {"Register"})
        if v[2] ~= v[3] then
            table.insert(args, 1, {"Register"})
        end
    end
    arm.assembler.instructionArguments[k] = args
end

for k, v in pairs(arm.assembler.dataSaveLoadInstructions) do
    arm.assembler.instructions[k] = function(data, memPos, args, line)
        return arm.assembler.instructions["DataSaveLoad"](data, memPos, args, line, unpack(v))
    end
    local args = {
        {"Register"}, -- Register
        {"Brackets", "Label", --Brackets or label
            data1 = { -- If brackets 
                post = {"!", ""}, -- Postfix must be nothing or !
                content = { -- Content must be Register followed by optional RegisterS or Constant
                    {"Register"}, 
                    {"RegisterS", "Constant", optional=true}
                }
            }
        }, 
        {"RegisterS", "Constant", optional=true} -- Last arg is optional RegisterS or Constant
    }

    if v[2] == "D" then
        table.insert(args, 2, {"Register"})
    end
    arm.assembler.instructionArguments[k] = args
end

function arm.assembler.regShiftToBinary(reg)
    local out = string.rep("0", 12)
    out = arm.setBits(out, 8, toBaseN(reg.value, 2, 4))
    if reg.shift then
        out = arm.setBits(out, 5, reg.shift.type)
        out = arm.setBits(out, 7, reg.shift.usingReg and "1" or "0")
        if reg.shift.usingReg then
            out = arm.setBits(out, 0, toBaseN(reg.shift.value, 2, 4))
        else
            if reg.shift.value < 2^5 then
                out = arm.setBits(out, 0, toBaseN(reg.shift.value, 2, 5))
            else
                return nil, ERROR_OUT_OF_RANGE
            end
        end
    end
    
    return out
end

function arm.assembler.dataArgToBinary(arg)
    if not arg then return string.rep("0", 12) end
    local out = ""
    if arg.type == "Constant" then
        if arg.value < 2^32 then
            -- put num into [rrrriiiiiiii], r = #rotate and i = immediate
            out = arm.calculateImmediate(arg.value)
        else
            return
        end
    elseif arg.type == "Register" then
        out = arm.assembler.regShiftToBinary(arg)
    end
    return out
end

function arm.assembler.processArgument(a)
    local out = {}
    a = string.trim(a)
    local content, postfix = string.match(a, "^%[(.+)%](.*)") -- If in the for [yeet, yoot]!
    if content then
        out.type = "Brackets"
        out.post = postfix
        out.content = {}
        local cE = string.split(content, ",")
        for k = 1, #cE do 
            local el = string.trim(cE[k]) 
            local elProcessed = arm.assembler.processArgument(el)
            if not elProcessed then return nil end
            table.insert(out.content, elProcessed)
        end
        out.len = #out.content
    elseif string.find(a, " ") then
        local aE = string.split(a, " ")
        local r1 = arm.isRegister(aE[1])
        local c = arm.isConst(aE[3])
        local r2 = arm.isRegister(aE[3])
        if #aE == 3 and r1 and arm.assembler.shifts[aE[2]] and ((c<=31) or r2) then
            out.type = "Register"
            out.value = r1
            out.hasShift = true
            out.shift = {type=arm.assembler.shifts[aE[2]], value=(c or r2), usingReg=(r2 and true)}
        else
            return nil
        end
    else
        local r = arm.isRegister(a)
        local c = arm.isConst(a)
        local l = arm.isLabel(a)
        local n = arm.isNumber(a)
        if r then
            out.type = "Register"
            out.value = r
        elseif c then
            out.type = "Constant"
            out.value = c
        elseif l then
            out.type = "Label"
            out.value = l
        elseif n then
            out.type = "Number"
            out.value = n
        else
            return nil
        end
    end
    return out
end

function arm.assembler.processArguments(args, line, instruction)
    local out = {}
    for k, v in ipairs(args) do
        local arg = arm.assembler.processArgument(v)
        if not arg then
            arm.error(ERROR_BAD_ARG, line, k)
            return
        end
        table.insert(out, arg)
    end
    return out
end

function arm.assembler.checkArguments(argFormat, args, instruction, extra)
    if not argFormat then argFormat = arm.assembler.instructionArguments[instruction] end
    if not argFormat then error("Missing argument format for instruction " .. instruction) end -- This is an error in writing ARM, just full error it
    extra = extra or ""
    local argFormatIndex = 1
    local argIndex = 1

    while argIndex <= #args do
        local arg = args[argIndex]

        local format = argFormat[argFormatIndex]

        if not format then
            -- Too many args
            return false, ERROR_INVALID_ARG_COUNT..extra
        end

        local argType = arg.type
        local foundMatch = false
        for optionIdx, option in ipairs(format) do -- Ipairs used so this wont iterate over "data" .. n or "optional"
            if argType == option or ((option == "RegisterS" or option == "RegisterSR") and argType == "Register") then -- Found a match
                if option == "Register" and arg.shift then
                    return false, ERROR_WRONG_ARG..extra, argIndex, instruction
                end
                if option ~= "RegisterSR" and arg.shift and arg.shift.usingReg then
                    return false, ERROR_WRONG_ARG..extra, argIndex, instruction
                end
                
                foundMatch = true
                -- Match
                if argType == "Brackets" then
                    local bData = format["data" .. optionIdx]
                    if not arg.post then arg.post = "" end
                    if not table.hasValue(bData.post, arg.post) then
                        -- Invalid postfix
                        return false, ERROR_INVALID_POSTFIX..extra, argIndex
                    else
                        -- now recurse
                        local ret = {arm.assembler.checkArguments(bData.content, arg.content, instruction, extra .. " in argument " .. argIndex)}
                        if not ret[1] then
                            table.remove(ret, 1)
                            return false, unpack(ret)
                        end
                    end
                end
                break
            end
        end

        if not foundMatch then
            if format.optional then
                argFormatIndex = argFormatIndex + 1
            else
                -- No match, error
                return false, ERROR_WRONG_ARG..extra, argIndex, instruction
            end
        else
            argIndex = argIndex + 1
            argFormatIndex = argFormatIndex + 1
        end
    end

    -- Check all remaing args in format are optional, if not, missing args
    for k = argFormatIndex, #argFormat do
        if not argFormat[k].optional then
            -- Missing arguments!
            return false, ERROR_INVALID_ARG_COUNT..extra
        end
    end

    return true

end

function arm.isRegister(txt)
    txt = string.lower(txt)
    if txt[1] == "r" then
        local n = tonumber(string.sub(txt, 2))
        if n and n >= 0 and n <= 15 and n%1 == 0 then
            return n
        else
            return nil
        end
    else
        local t = {fp=11, ip=12, sp=13, lr=14, pc=15}
        return t[txt]
    end
end

function arm.isConst(txt)
    if txt[1] == "#" then
        return arm.isNumber(string.sub(txt, 2))
    end
    return nil
end

function arm.isNumber(txt)
    local n = tonumber(txt)
    if n and n >= 0 and n%1 == 0 then
        return n
    else
        return nil
    end 
end

function arm.isLabel(txt)
    return string.match(txt, "^([a-zA-Z]+)$")
end

function arm.calculateImmediate(val)
    -- positive shift goes left
    -- so 0011 positive shift 1 (times 2) is 1100
    local shift = 0
    if val > 255 then
        smallest = val
        sShift = 0
        
        local lBit = 2^30
        for k = 1, 15 do
            local lastBits = val % 4
            val = lastBits * lBit + math.floor(val/4)
            if val < smallest then
                smallest = val
                sShift = k
            end
        end
        shift = 16 - sShift
        
        if smallest > 255 then
            return nil, smallest, shift
        end
        val = smallest
        
    end
    return toBaseN(shift, 2, 4) .. toBaseN(val, 2, 8)
end

arm.assembler.conditions = {
    ["EQ"] = "0000",
    ["NE"] = "0001",
    ["CS"] = "0010",
    ["HS"] = "0010",
    ["CC"] = "0011",
    ["LO"] = "0011",
    ["MI"] = "0100",
    ["PL"] = "0101",
    ["VS"] = "0110",
    ["VC"] = "0111",
    ["HI"] = "1000",
    ["LS"] = "1001",
    ["GE"] = "1010",
    ["LT"] = "1011",
    ["GT"] = "1100",
    ["LE"] = "1101",
    ["AL"] = "1110",
    ["NV"] = "1101"
}

arm.assembler.directives = {
    ["ALIGN"] = function(memPos, args)
        return math.ceil(memPos/4)*4
    end,
    ["DEFB"] = function(memPos, args, line)
        local data = {}
        for k, v in pairs(args) do
            local n = tonumber(v)
            if n and n%1 == 0 and n>=0 and n<=255 then
                table.insert(data, n)
            elseif v[1] == "\"" and v[#v] == "\"" then
                v = convertEscaped(v)
                for p = 2, #v-1 do
                    table.insert(data, string.byte(v[p]))
                end
            else
                shell.print("Error: Invalid constant in DEFB on line " .. line)
                arm.exit(0)
                return
            end
        end
        arm.setMemory(memPos, data)
        return memPos + #data
    end,
    ["DEFW"] = function(memPos, args, line)
        if #args == 1 then
            local n = tonumber(args[1]) 
            if n and n>0 and n<2^32 and n%1 == 0 then
                local b = toBaseN(n, 2, 32)
                arm.saveWord(memPos, b)
                return memPos + 4
            else
                shell.print("Error: Invalid constant in DEFW on line " .. line)
                arm.exit(0)
                return
            end
        else
            shell.print("Error: Invalid constant in DEFW on line " .. line)
            arm.exit(0)
            return
        end
    end
}

function arm.clearMemory()
    for k = 1, arm.memorySize do
        arm.memory[k] = 0
    end
end

function arm.setMemory(addr, data)
    if type(data) == "number" then
        data = {data}
    end
    for k = addr, addr + #data - 1 do
        arm.memory[k+1] = data[k - addr + 1]
    end
end

function arm.saveWord(addr, word)
    arm.setMemory(addr, {tonumber(string.sub(word, 25, 32), 2), tonumber(string.sub(word, 17, 24), 2), tonumber(string.sub(word, 9, 16),2 ), tonumber(string.sub(word, 1, 8), 2)})
end

function arm.getMemory(addr, len)
    local out = {}
    for k = addr, addr + len - 1 do
        table.insert(out, arm.memory[k+1])
    end
    return out
end

function arm.setBits(inp, pos, bits)
    pos = pos + 1
    return string.sub(inp, 1, pos-1) .. bits .. string.sub(inp, pos+#bits)
end

function arm.printMemory()
    local digits = #toBaseN(#arm.memory, 16)
    local bytesPerLine = 16
    local data = {}
    for k = 1, #arm.memory do
        local line = math.floor((k-1)/bytesPerLine) + 1
        data[line] = data[line] or (toBaseN(k-1, 16, digits) .. "| ")
        data[line] = data[line] .. toBaseN(arm.memory[k], 16, 2) .. " "
    end
    shell.printLines(data)
end

function arm.fillMemoryGaps()
    local m = table.maxn(arm.memory)
    for k = 1, m do
        if arm.memory[k] == nil then
            arm.memory[k] = 0
        end
    end
end

function arm.memoryAsString()
    local out = ""
    for k = 1, #arm.memory do
        out = out .. string.char(arm.memory[k])
    end
    return out
end

function arm.assemble()
    local co = coroutine.create(arm.assembleRoutine)
    
    local tName = "VC_ARM_Assemble"
    arm.timer.create(tName, 1/30, 0, function()
        if coroutine.status(co) ~= "dead" then
            if checkQ(0.8) then
                coroutine.resume(co)
            end
        else
            arm.timer.remove(tName)
        end
    end)    
end

function removeRepeatedSpaces(txt)
    return table.concat(string.Explode("%s+", txt), " ")
end

function splitArgs(txt)
    local out = {}
    local token = ""
    local inQuotes = false
    local inBrackets = false
    for k = 1, #txt do
        local c = txt[k]
        if inQuotes then
            if c == "\"" then
                inQuotes = false
            end
            token = token .. c
        elseif inBrackets then
            if c == "]" then
                inBrackets = false
            end
            token = token .. c
        else
            if c == "\"" then
                inQuotes = true
            end
            if c == "[" then
                inBrackets = true
            end
            if c == "," then
                table.insert(out, string.trim(token))
                token = ""
            else
                token = token .. c
            end

        end
    end
    if #token > 0 then
        table.insert(out, string.trim(token))
    end
    return out
end

function convertEscaped(txt)
    local k = 1
    local out = ""
    while k <= #txt do
        if txt[k] == "\\" then
            local nChar = "\\" .. txt[k+1]
            -- Convert nChar to its actual form, somehow?
            nChar = loadstring("return \""..nChar.."\"")()
            out = out .. nChar
            k = k + 1
        else
            out = out .. txt[k]
        end
        k = k + 1
    end
    return out
end

function arm.scheduleFillAddress(label, memPos, t, line, data)
    if arm.assembly.labels[label] then
        local addr = arm.assembly.labels[label]
        arm.fillAddress(memPos, addr, t, line, data)
    else
        arm.assembly.pendingLabels[label] = arm.assembly.pendingLabels[label] or {}
        table.insert(arm.assembly.pendingLabels[label], {pos=memPos, type=t, line=line, data=data})
    end
end

function arm.shiftBitsCarry(val, shift, bits)
    shift = -shift -- We want positive shift to be left, not right
    bits = bits or 32
    if shift < 0 then shift = bits + shift end

    local lostData = val % (2 ^ shift)
    local shiftR = math.floor(val / (2 ^ shift))
    local shiftL = lostData * (2 ^ (bits - shift))
    return shiftR + shiftL
end


function arm.fillAddress(memPos, addr, t, line, data)
    if t == "B" then
        local rel = addr - (memPos + 8)
        
        rel = math.floor(rel/4)
        
        if rel < 0 then
            rel = 256^3 + rel
        end
        
        local pre = tonumber(data[1], 2)
        
        arm.setMemory(memPos, {
            rel%256,
            math.floor(rel/256)%256,
            math.floor(rel/(256^2))%256,
            pre
        })
        
    elseif t == "ADR" or t == "ADRL" then
        local isADRL = t == "ADRL"
        local rel = addr - (memPos + 8)
        
        local op = "ADD"
        if rel < 0 then
            op = "SUB"
            rel = -rel
        end
        
        local d = data[1]
        local outReg = data[2]
        
        local ret = arm.assembler.instructions[op](d, memPos, {{type="Register", value=outReg}, {type="Register", value=15}, {type="Constant", value=rel}}, line, true)
        if isADRL then
            if not ret then
                
                -- Get the attempted shift value
                local ret, val, shift = arm.calculateImmediate(rel)
                -- If it somehow doesn't fail, this means ADR above failed for a different reason, which shouldn't ever happen, as the ADRL instruction does the error checking beforehand
                if ret then
                    error("ADR Failed in ADRL after passing ADRL checks, if this happens, fix ADRL instruction xd")
                end
                
                -- Remove the bits of val that make it out of range (AND with 11111111)
                local andedVal = bit.band(val, 0xFF)
                local firstVal = arm.shiftBitsCarry(andedVal, shift*2, 32) -- Shift this new val by shift returns from calculateImmediate
                local newRel = rel - firstVal -- Work out what the new offset will need to be to get from newVal to desired val
                
                if not arm.assembler.instructions[op](d, memPos, {{type="Register", value=outReg}, {type="Register", value=15}, {type="Constant", value=firstVal}}, line, true) then -- Create instruction to get newVal from PC
                    shell.print("Error: Unable to generate instruction binary on line " .. line)
                    shell.print("Rearrange instructions or move address label positions")
                    arm.exit(0)
                    return
                end
                
                if not arm.assembler.instructions[op](d, memPos+4, {{type="Register", value=outReg}, {type="Register", value=outReg}, {type="Constant", value=newRel}}, line, true) then -- Create instruction to get rel from newVal
                    shell.print("Error: Unable to generate instruction binary on line " .. line)
                    shell.print("Rearrange instructions or move address label positions")
                    arm.exit(0)
                    return
                end
                
            else
                arm.saveWord(memPos + 4, "11100110" .. string.rep("0", 24)) -- Could be done with ADR, fill next instruction with undefined instruction
            end
        else
            if not ret then
                shell.print("Error: Unable to generate instruction binary on line " .. line)
                shell.print("Rearrange instructions or use ADRL")
                arm.exit(0)
            end
        end
    end
end

function arm.assembleRoutine()
    local memPos = 0
    
    arm.assembly.labels = {}
    arm.assembly.pendingLabels = {}
    
    for k, v in ipairs(arm.assembly) do
        yieldCheck()
        if v[1] ~= ";" and string.trim(v[1]) ~= "" then
            if string.trimRight(v) ~= v then
                shell.print("Error: Trailing spaces on line " .. k)
                arm.exit(0)
                return
            end

            v = removeRepeatedSpaces(v)

            local label, instruction = string.match(v, "^([A-Za-z]+)%s([A-Za-z]+)%s.+$")
            if label then
                if not arm.assembly.labels[label] then
                    arm.assembly.labels[label] = memPos
                    if arm.assembly.pendingLabels[label] then
                        for k, v in pairs(arm.assembly.pendingLabels[label]) do
                            arm.fillAddress(v.pos, memPos, v.type, v.line, v.data)
                            if not arm.data.running then return end
                        end
                        arm.assembly.pendingLabels[label] = nil
                    end
                else
                    shell.print("Error: Repeat label on line " .. k)
                    arm.exit(0)
                    return
                end
                label = label .. " "
            else
                instruction = string.match(v .. " ", "^([A-Za-z]+)%s")
                label = ""
            end
            if not instruction then 
                shell.print("Error: Missing instruction on line " .. k)
                arm.exit(0)
                return
            end
            instruction = string.upper(instruction)

            local argsStr = string.sub(v, #label + #instruction+2)
            local args = splitArgs(argsStr)
            if arm.assembler.directives[instruction] then
                memPos = arm.assembler.directives[instruction](memPos, args, k) or memPos
                if not arm.data.running then return end
            else
                args = arm.assembler.processArguments(args, k, instruction)
                if not arm.data.running then return end
                local cond = string.right(instruction, 2)
                local condBits = arm.assembler.conditions[cond]
                if condBits then 
                    instruction = string.left(instruction, #instruction-2)
                else
                    condBits = arm.assembler.conditions["AL"]
                end

                local ret = {arm.assembler.checkArguments(nil, args, instruction)}

                if not ret[1] then
                    table.remove(ret, 1)
                    arm.error(table.remove(ret, 1), k, unpack(ret))
                    return
                end

                local proc = arm.assembler.instructions[instruction]

                if not proc then
                    shell.print("Error: Invalid instruction on line " .. k)
                    arm.exit(0)
                    return
                end

                local size = proc(condBits .. string.rep("0", 28), memPos, args, k)
                if not arm.data.running then return end
                memPos = memPos + size
            end
        end
    end
    
    for k, v in pairs(arm.assembly.pendingLabels) do
        shell.print("Error: Unknown label \"" .. k .. "\" on line " .. v[1].line)
        arm.exit(0)
        return
    end
    
    arm.fillMemoryGaps()
    local res, err = vc.file.saveFile(arm.assembler.output, arm.memoryAsString())
    if res < 0 then
        shell.print("Error: Invalid output path")
        arm.exit(0)
        return
    end
    
    if arm.assembler.shouldDump then
        arm.printMemory()
    end
    
    arm.exit(1)
end

-- Some functions for checking our quota usage.
function checkQ (n)
    return quotaAverage() < quotaMax()*n and quotaUsed() < quotaMax()
end

-- Check if we should yield
function yieldCheck ()
    if not checkQ(0.3) then
        coroutine.yield()
    end
end

vc.registerProgram("arm", arm, "Runs ARM assembly code")