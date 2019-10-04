local js = require("js")
local _G = _G
local load, pack, unpack, xpcall = load, table.pack, table.unpack, xpcall
local traceback = debug.traceback
local running = false
local history = {}
local historyIndex = nil
local historyCur = ""

local global = js.global
local repl = global.repl

_G.print = function(...)
	local toPrint = pack(...) -- Using pack not {} as {} removes nils
	local out = ""
	for k = 1, toPrint.n do
		local v = toPrint[k]
		if k ~= 1 then
			out = out .. "\t"
		end
		out = out .. tostring(v)
	end
	global:write(out .. "\n")
end

_G.printConsole = function(...)
	global.console:log(...)
end

_G.exit = function()
	running = false
	global:endCommand(1)
end

function math.clamp(x, min, max) 
	return (x > max) and max or ((x < min) and min or x)
end

function repl:start()
    repl:runRepl()
end

function repl:runRepl()
	running = true
	global:readInput("", repl.procInput, repl.luaReadOptions)
end

function repl:stop()
	running = false
end

function repl:keyPress(key)
	if not running then return end
	if key == "ArrowUp" or key == "Up" or key == "ArrowDown" or key == "Down" then
		local u = key == "ArrowUp" or key == "Up"

        if not historyIndex then
            if u and #history > 0 then
                historyIndex = 1
                historyCur = global:getInput()
            end
        else
            if not u and historyIndex == 1 then
                historyIndex = nil
                global:setInput(historyCur)
            else
                historyIndex = math.clamp(historyIndex + (u and 1 or -1), 1, #history)
            end
        end
        if historyIndex then
            global:setInput(history[historyIndex])
        end
	end
end

function repl:procInput(line)
    coroutine.wrap(function() 
    	historyIndex = nil
        historyCur = ""
        table.insert(history, 1, line)

    	local fn, err = load("return " .. line, "stdin")
        if not fn then
            fn, err = load(line, "stdin")
        end

        if fn then
            local results = pack(xpcall(fn, traceback))
            if not running then return end -- If fn takes too long, and the program is terminated, then fn finishes, just abort
            if results[1] then
                if results.n > 1 then
                    _G.print(unpack(results, 2, results.n))
                end
            else
                _G.print(results[2])
            end
        else
            _G.print(err)
        end
        if running then
        	repl:runRepl()
        end
    end)()
end

global:ready("Lua-repl")