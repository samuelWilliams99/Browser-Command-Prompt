--@name Nano
--@author
--@shared

if not consoleRunHere then return end

local nano = {}

nano.fileConverters = {}

-- page up and down

nano.shortcuts = {
    {"X", "Exit",      function() 
        if nano.modified and (timer.curtime() - nano.lastExit) > 2 then
            nano.showMessage("Unsaved changes, exit again to discard")
            nano.lastExit = timer.curtime()
        else
            nano.exit()
        end
    end},
    {"S", "Save",      function() 
        local data, dErr = nano.tableToContent(nano.curFile.content)
        if not data then
            nano.showMessage("Error: " .. dErr)
            return
        end
        local status, err = vc.file.saveFile(nano.fullPath, data)
        
        if status > 0 then
            nano.originalFile = table.copy(nano.curFile)
            nano.showMessage("Wrote " .. nano.getDataCount())
            nano.checkModified()
        else
            nano.showMessage("Error: " .. err)
        end
    end},
    {"R", "Reload",    function()
        local f, err = vc.file.getFile(nano.fullPath)
        
        if type(f) == "number" then
            nano.showMessage("Error: " .. err)
        else
            f.content = nano.contentToTable(f.content)
            nano.curFile = f
            
            if nano.caret.line > #nano.curFile.content then nano.caret.line = #nano.curFile.content end
            if nano.caret.pos > #nano.curFile.content[nano.caret.line] + 1 then nano.caret.pos = #nano.curFile.content[nano.caret.line] + 1 end
            
            nano.drawScreen()
            nano.showMessage("Read " .. nano.getDataCount())
            nano.checkModified()
        end
    end},
    {"I", "Page Up",   function() end},
    {"U", "Page Down", function() end},
}

function nano.registerFileConverter(ext, toTable, toData, dataCount)
    nano.fileConverters[ext] = {toTable=toTable, toData=toData, dataCount=dataCount}
end

function nano.getDataCount()
    if not nano.fileConverters[nano.fileExt] or not nano.fileConverters[nano.fileExt].dataCount then
        return #nano.curFile.content .. (#nano.curFile.content == 1 and " line" or " lines")
    else
        return nano.fileConverters[nano.fileExt].dataCount(nano.curFile.content)
    end
end

function nano.contentToTable(content)
    local out
    if not nano.fileConverters[nano.fileExt] then
        out = string.Split(content, "\n")
    else
        out = nano.fileConverters[nano.fileExt].toTable(content)
    end
    return #out == 0 and {""} or out
end

function nano.tableToContent(tab)
    if not nano.fileConverters[nano.fileExt] then
        return table.concat(tab, "\n")
    else
        return nano.fileConverters[nano.fileExt].toData(tab)

    end
end

function nano.start(args)
    local filePath = args[1]
    if not filePath then
        shell.print("Usage: nano [path]", Color(255,0,0))
        return 0
    end
    local curDir = vc.file.formatPath(shell.filePath.partition, shell.filePath.path)
    if filePath[1] == "/" or filePath[1] == "\\" then
        filePath = string.sub(filePath, 2)
    end
    
    if not (curDir[#curDir] == "\\" or curDir[#curDir] == "/") then
        curDir = curDir .. "/"
    end

    local f, err, pos = vc.file.getFile(curDir .. filePath)
    if type(f) == "number" and f ~= -4 then
        shell.print("Error: " .. err)
        return 0
    end

    local showRead = true
    if f == -4 then -- Directory exists but file doesnt, create a blank one
        f = {isFile=true, content=""}
        showRead = false
    end
    if f.isFile and f.content then
        nano.filePath = filePath
        nano.fullPath = curDir .. filePath
        
        nano.caret = {line=1, pos=1, lastMove=0}
        nano.scroll = 1
        nano.modified = false
        nano.message = ""
        nano.lastExit = 0

        nano.fileExt = string.match(nano.fullPath, "%.([a-zA-Z]+)$")
        f.content = nano.contentToTable(f.content)
        nano.curFile = f
        nano.originalFile = table.copy(f)
 
        nano.hook.add("VC_KeyPress", "VC_Nano_KeyPress", nano.keyHook)
        nano.timer.create("VC_Nano_InputUpdate", 0.5, 0, nano.updateInput)
        nano.drawScreen()

        if showRead then
            nano.showMessage("Read " .. nano.getDataCount())
        end
    else
        shell.print("Error: Corrupt file")
        return 0
    end
end

function nano.stop()
    nano.curFile = nil
    nano.filePath = nil
end

function nano.keyHook(key)
    if not nano.curFile then return end
    local cLine = nano.curFile.content[nano.caret.line]
    
    if key >= 32 and key <= 126 then -- All typed keys
        local char = string.char(key)
        if vc.keyDown(158) and ((key>=65 and key<=90) or (key>=97 and key <= 122)) then -- ctrl and letter (a-zA-Z)
            for k, v in pairs(nano.shortcuts) do
                if v[1] == string.upper(char) then
                    v[3]()
                    break
                end
            end
            
            if not nano.data.running then return true end
        else
            local cPos = nano.caret.pos
            nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, cPos-1) .. char .. string.sub(cLine, cPos)
            nano.caret.pos = cPos + 1
        end
        
        
    elseif key == 19 or key == 20 then -- Left and Right
        local o = key == 19 and -1 or 1
        
        if vc.keyDown(158) then
            local nextSpace = key == 19 and 1 or #cLine+1
            local k = nano.caret.pos + o
            while k > 1 and k <= #cLine do
                if cLine[k] == " " then
                    nextSpace = k
                    break
                end
                k = k + o
            end
            nano.caret.pos = math.clamp(nextSpace, 1, #cLine+1)
        else
            nano.caret.pos = math.clamp(nano.caret.pos + o, 1, #cLine+1)
        end
    elseif key == 17 or key == 18 then -- Up and Down
        local o = key == 17 and -1 or 1
        if nano.curFile.content[nano.caret.line + o] then
            nano.changeLine(nano.caret.line + o)
        end
    elseif key == 149 then -- Home
        nano.caret.pos = 1
    elseif key == 150 then -- End
        nano.caret.pos = #cLine+1
    elseif key == 127 then -- Back
        if nano.caret.pos > 1 then
            if vc.keyDown(158) then
                local nextSpace = 1
                local k = nano.caret.pos
                while k > 1 do
                    if cLine[k] == " " then
                        nextSpace = k
                        break
                    end
                    k = k - 1
                end
                nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, nextSpace-1) .. string.sub(cLine, nano.caret.pos)
                nano.caret.pos = nextSpace
            else
                local pre = string.sub(cLine, 1, nano.caret.pos-1)
                
                if string.match(pre, "^(%s+)$") then
                    pre = string.rep(" ", math.floor((#pre-1)/4)*4)
                    nano.curFile.content[nano.caret.line] = pre .. string.sub(cLine, nano.caret.pos)
                    nano.caret.pos = #pre + 1
                else
                    nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, nano.caret.pos-2) .. string.sub(cLine, nano.caret.pos)
                    nano.caret.pos = nano.caret.pos - 1
                end
            end
        elseif nano.caret.line > 1 then
            
            local preLineCount = #nano.curFile.content
            local cLine = nano.curFile.content[nano.caret.line-1]
            nano.curFile.content[nano.caret.line] = cLine .. nano.curFile.content[nano.caret.line]
            table.remove(nano.curFile.content, nano.caret.line-1)
            local didRedraw = nano.changeLine(nano.caret.line-1, #cLine+1)
            if not didRedraw then
                if math.log10(#nano.curFile.content) ~= math.log10(preLineCount) then
                    nano.drawFileContent()
                else
                    nano.drawFileContent(nano.caret.line)
                end
            end
            
        end
    elseif key == 148 then -- delete
        if nano.caret.pos <= #cLine then
            nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, nano.caret.pos-1) .. string.sub(cLine, nano.caret.pos+1)
        elseif nano.caret.line < #nano.curFile.content then
            
            local preLineCount = #nano.curFile.content
            local cLine = nano.curFile.content[nano.caret.line+1]
            nano.curFile.content[nano.caret.line] = nano.curFile.content[nano.caret.line] .. cLine
            table.remove(nano.curFile.content, nano.caret.line+1)
            
            if math.log10(#nano.curFile.content) ~= math.log10(preLineCount) then
                nano.drawFileContent()
            else
                nano.drawFileContent(nano.caret.line)
            end
            
        end
    elseif key == 10 then -- enter
        local newText = ""
        if nano.caret.pos <= #cLine then
            newText = string.sub(cLine, nano.caret.pos)
            nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, nano.caret.pos-1)
        end
        local preSpaces = string.match(nano.curFile.content[nano.caret.line], "^([%s]*)") or ""
        newText = preSpaces .. newText
        
        local preLineCount = #nano.curFile.content
        table.insert(nano.curFile.content, nano.caret.line+1, newText)
        
        local didRedraw = nano.changeLine(nano.caret.line+1, #preSpaces + 1)
        if not didRedraw then
            if math.log10(#nano.curFile.content) ~= math.log10(preLineCount) then
                nano.drawFileContent()
            else
                nano.drawFileContent(nano.caret.line)
            end
            
        end
    elseif key == 9 then -- tab
        local spaces = 4 - ((nano.caret.pos-1) % 4)
        local cPos = nano.caret.pos
        nano.curFile.content[nano.caret.line] = string.sub(cLine, 1, cPos-1) .. string.rep(" ", spaces) .. string.sub(cLine, cPos)
        nano.caret.pos = cPos + spaces
    elseif key == 23 or key == 24 then --page up and down
        local u = key == 23
        
    else
        return
    end
    nano.caret.lastMove = timer.curtime()
    nano.updateInput()
    
    nano.checkModified()
        
end

function nano.checkModified()
    if #nano.curFile.content ~= #nano.originalFile.content then
        nano.setModified(true)
        return
    end
    for k, v in ipairs(nano.curFile.content) do
        if v ~= nano.originalFile.content[k] then
            nano.setModified(true)
            return
        end
    end
    
    nano.setModified(false)
end

function nano.setModified(m)
    if nano.modified == m then return end
    nano.modified = m
    vc.setLineText(1, unpack(nano.getTitleBar(m)))
end

function nano.getTitleBar(modified)
    local out = {Color(0,0,0), {bgCol=Color(255,255,255)}}
    local pathText = "File: " .. nano.filePath
    local maxChars = vc.getMaxChars()
    local mid = math.floor(maxChars/2)
    local preText = "  ShitOS nano"
    out[3] = preText .. string.rep(" ", mid - #preText - math.floor(#pathText/2)) .. pathText
    if modified then
        out[3] = out[3] .. string.rep(" ", maxChars - #out[3] - 2 - 8) .. "Modified  "
    else
        out[3] = out[3] .. string.rep(" ", maxChars - #out[3])
    end
    out[4] = Color(255,255,255)
    out[5] = {bgCol=Color(0,0,0)}
    return out
end

function nano.drawFileContent(s, e)
    
    local data = {}

    local c = nano.curFile.content
    s = s or nano.scroll
    local trueE = nano.scroll + MAX_LINES - 6
    e = e or trueE
    local eDigits = #tostring(math.min(trueE, #c - (nano.scroll-1)))
    
    for k=s, e do
        if c[k] then
            local line = {Color(150,150,150), k .. string.rep(" ", eDigits - #tostring(k)) .. "| ", Color(255,255,255), c[k]}
            data[k-nano.scroll + 3] = line
        else
            data[k-nano.scroll + 3] = {}
        end
    end
    vc.setMultipleLines(data)
end

function nano.drawScreen()
    vc.clear()
    vc.setLineText(1, unpack(nano.getTitleBar()))
    vc.setLineText(2, "")
    nano.drawFileContent()
    nano.drawFooter()
end

function nano.drawFooter()
    -- exit, save, reload, nextpage, prev page
    local data = {}
    local maxLen = 0
    for k, v in ipairs(nano.shortcuts) do
        if #v[2] > maxLen then maxLen = #v[2] end
    end
    maxLen = maxLen + 1
    local line = {}
    local lineIdx = MAX_LINES-1
    local totalLen = 0
    
    for k, v in ipairs(nano.shortcuts) do
        local txtLen = 4 + maxLen
        totalLen = totalLen + txtLen
        if totalLen > vc.getMaxChars() then
            data[lineIdx] = line
            line = {}
            lineIdx = lineIdx + 1
            totalLen = txtLen
        end    
        table.add(line, {Color(0,0,0), {bgCol=Color(255,255,255)}, "^"..v[1], Color(255,255,255), {bgCol=Color(0,0,0)}, " " .. v[2] .. string.rep(" ", maxLen-#v[2])})
    end
    data[lineIdx] = line
    
    vc.setMultipleLines(data)
end

function nano.updateInput()
    local showCursor = ((timer.curtime() - nano.caret.lastMove) % 1) < 0.5
    local l = nano.caret.line
    local realLine = (l - (nano.scroll - 1)) + 2

    local txt = nano.curFile.content[l]
    local p = nano.caret.pos
    
    local e = math.min(nano.scroll + MAX_LINES - 6, #nano.curFile.content - (nano.scroll-1))
    local eDigits = #tostring(e)
    
    local data = {Color(150,150,150), l .. string.rep(" ", eDigits - #tostring(l)) .. "| ", Color(255,255,255)}
    
    if showCursor then
        txt = txt .. " "
        table.add(data, {string.sub(txt, 1, p-1), {bgCol=Color(255,255,255)}, Color(0,0,0), txt[p], {bgCol=Color(0,0,0)}, Color(255,255,255), string.sub(txt, p+1, #txt-1)})
    else
        table.insert(data, txt)
    end
    vc.setLineText(realLine, unpack(data))
end

function nano.changeLine(new, pos)
    local oldScroll = nano.scroll
    local didRedraw = false
    while new > nano.scroll + MAX_LINES - 6 do
        nano.scroll = nano.scroll + 1    
    end
    
    while new < nano.scroll do
        nano.scroll = nano.scroll - 1
    end
    if oldScroll ~= nano.scroll then
        nano.drawFileContent()
        didRedraw = true
    else
        nano.drawFileContent(nano.caret.line, nano.caret.line)
    end
    nano.caret.line = new
    nano.caret.pos = pos or math.min(nano.caret.pos, #nano.curFile.content[new]+1)
    return didRedraw
end

function nano.showMessage(msg)
    nano.message = msg
    nano.drawMessage()
    nano.timer.create("VC_Nano_HideMessage", 2, 1, function()
        nano.message = ""
        nano.drawMessage()
    end)
end

function nano.drawMessage()
    if #nano.message > 0 then
        local offset = math.floor(vc.getMaxChars() / 2 - #nano.message / 2)
        vc.setLineText(MAX_LINES-2, string.rep(" ", offset-1), {bgCol=Color(255,255,255)}, Color(0,0,0), "[" .. nano.message .. "]", {bgCol=Color(0,0,0)}, Color(255,255,255))
    else
        vc.setLineText(MAX_LINES-2, "")
    end
end

local WORDS_PER_LINE = 4

nano.registerFileConverter("exe", 
    function(data) -- String to table
        local out = {}
        local wordSize = 4
        
        local word = ""
        local line = ""
        
        for i=1, #data do
            local val = string.byte(data[i])
            local hex = toBaseN(val, 16, 2)
            word = word .. hex
            
            if i%wordSize == 0 then
                line = line .. word .. " "
                word = ""
                if (i/wordSize)%WORDS_PER_LINE == 0 then
                    table.insert(out, string.trimRight(line))
                    line = ""
                end
            end
        end
        if #line > 0 then
            table.insert(out, string.trimRight(line))
        end
        return out
    end,
    function(content) -- table to string
        local out = ""
        for k, line in ipairs(content) do
            local words = string.split(line, " ")
            if k == #content then
                if #words > WORDS_PER_LINE or (#words == 1 and words[1] == "") then
                    return nil, "Incorrect number of words on line " .. k
                end
            else
                if #words ~= WORDS_PER_LINE then
                    return nil, "Incorrect number of words on line " .. k
                end
            end
            for i, word in ipairs(words) do
                local a,b,c,d = string.match(word, "^(%x%x)(%x%x)(%x%x)(%x%x)$")
                if a then
                    out = out .. string.char(tonumber(a, 16))
                    out = out .. string.char(tonumber(b, 16))
                    out = out .. string.char(tonumber(c, 16))
                    out = out .. string.char(tonumber(d, 16))
                else
                    return nil, "Word " .. i .. " is malformed on line " .. k
                end
            end
        end
        return out
    end,
    function(content) -- table to number
        local out = 0
        for k, line in ipairs(content) do
            local l = string.replace(line, " ", "")
            out = out + #l/2
        end
        return out .. " byte" .. (out ~= 1 and "s" or "")
    end
)

vc.registerProgram("nano", nano, "Simple text editor")