js = require("js")
window = js.global
local shellJS, hookJS, timerJS = window.shellJS, window.hookJS, window.timerJS
unpack = table.unpack

-- Coroutines suppress errors, but I still want them, so this just grabs the error from resume and throws it
local function handle(success, err)
	if not success then error(err) end
end

local w = function (f, ...) 
	local co = coroutine.create(f)
	handle(coroutine.resume(co, ...))
end -- Run shit in a coroutine so I can yield for long JS calls (file)

local function runExternal(f, ...)
	local co = assert(coroutine.running(), "Should be run in a coroutine")
	local out = {}
	local dontYield = false

	shellJS.resume = function(_, ...)
		table.add(out, {...})
		if coroutine.status(co) == "suspended" then
        	handle(coroutine.resume(co))
        else
        	dontYield = true -- Incase resume is called in "f" without any delay
        end
    end
    f(nil, ...) -- First arg seems to just disappear, idk why but a "nil" gets around the issue

    if not dontYield then
    	coroutine.yield()
    end

    return unpack(out)
end

-- String stuff

require("extensions/string")
string.split = string.Split
string.replace = string.Replace
string.trim = string.Trim
string.trimRight = string.TrimRight
string.trimLeft = string.TrimLeft
string.endsWith = string.EndsWith
string.comma = string.Comma
string.explode = string.Explode
string.getChar = string.GetChar
string.setChar = string.SetChar
string.implode = string.Implode
string.javascriptSafe = string.JavascriptSafe
string.left = string.Left
string.right = string.Right
string.startsWith = string.StartsWith
string.toTable = string.ToTable 

getmetatable('').__pairs = function(s)
    local i,n = 0,#s
    return function()
        i = i + 1
        if i <= n then
            return i,s[i]
        end
    end
end
getmetatable('').__ipairs = getmetatable('').__pairs

-- Math stuff
require("extensions/math")
math.round = math.Round
math.log10 = function(val)
	return math.log(val, 10)
end

_G.shell = {}
vc = {file={}, programs={}, activeProgram=nil}

consoleRunHere = true
MAX_LINES = window:getLinesPerPage() -- Grab this from window

-- Call VC_KeyDown, VC_KeyUp, VC_KeyPress

-- Hook lib
hook = {events={}}
function hook.add(event, id, cb)
	hook.events[event] = hook.events[event] or {}
	hook.events[event][id] = cb
end
function hook.remove(event, id)
	if hook.events[event] then
		hook.events[event][id] = nil
	end
end
function hook.getTable()
	return hook.events
end
function hook.run(event, ...)
	if hook.events[event] then
		for k, v in pairs(hook.events[event]) do
			w(v, ...)
		end
	end
end

-- Generic lib
function _G.Color(r,g,b)
	return {r=r, g=g, b=b}
end

function _G.printTable(tab, indent, done)
	if not tab then return end
    done = done or {tab}
    indent = indent or 0
    local indentStr = string.rep("\t", indent)
    for k, v in pairs(tab) do
        if type(v) == "table" and not table.HasValue(done, v) then
            table.insert(done, v)
            print(indentStr .. tostring(k) .. ":")
            _G.printTable(v, indent + 1, done)
        else
            print(indentStr .. tostring(k) .. "\t=\t" .. tostring(v))
        end
    end
end
_G.PrintTable = _G.printTable

function _G.printConsole(txt)
	window.console:log(txt)
end

-- Timer lib
timer = {timers={}}
function timer.create(name, delay, reps, f)
	local t = timer.timers[name]
	if t then
		window:clearInterval(t.interval)
		t.delay = delay
		t.repsleft = reps
		t.func = f
	else
		timer.timers[name] = {delay=delay, repsleft=reps, func=f}
		t = timer.timers[name]
	end
	t.interval = window:setInterval(function()
		w(t.func)
		if t.repsleft > 0 then
			t.repsleft = t.repsleft - 1
			if t.repsleft < 1 then
				window:clearInterval(t.interval)
				timer.timers[name] = nil
			end
		end
	end, delay*1000)
end
function timer.exists(name)
	return timer.timers[name] and true or false
end
function timer.remove(name)
	if timer.timers[name] then
		window:clearInterval(timer.timers[name].interval)
	end
	timer.timers[name] = nil
end
function timer.repsleft(name)
	if timer.timers[name] then
		return timer.timers[name].repsleft
	end
	return nil
end
function timer.simple(delay, f)
	window:setTimeout(function() w(f) end, delay*1000)
end
function timer.curtime()
	return timerJS:curtime()
end

function hookJS:callHook(event, ...)
	hook.run(event, ...)
end

-- Table lib
require("extensions/table")
table.add = table.Add
table.clearKeys = table.ClearKeys
table.collapseKeyValue = table.CollapseKeyValue
table.copyFromTo = table.CopyFromTo
table.count = table.Count
table.empty = table.Empty
table.findNext = table.FindNext
table.findPrev = table.FindPrev
table.forceInsert = table.ForceInsert
table.forEach = table.ForEach
table.foreachi = table.foreachi
table.getFirstKey = table.GetFirstKey
table.getFirstValue = table.GetFirstValue
table.getKeys = table.GetKeys
table.getLastKey = table.GetLastKey
table.getLastValue = table.GetLastValue
table.getWinningKey = table.GetWinningKey
table.hasValue = table.HasValue
table.inherit = table.Inherit
table.isSequential = table.IsSequential
table.keyFromValue = table.KeyFromValue
table.keysFromValue = table.KeysFromValue
table.lowerKeyNames = table.LowerKeyNames
table.merge = table.Merge
table.random = table.Random
table.removeByValue = table.RemoveByValue
table.reverse = table.Reverse
table.sortByKey = table.SortByKey
table.sortByMember = table.SortByMember
table.sortDesc = table.SortDesc
table.toString = table.ToString
table.copy = table.Copy
table.maxn = function(tab)
	local maxn = 0
	for k, v in pairs(tab) do
		if type(k) == "number" and (k%1) == 0 and k >= 1 then
			if k > maxn then maxn = k end
		end
	end
	return maxn
end


table.sub = function(tab, s, e)
    local out = {}
    e = e or #tab
    for k = s, e do
        out[k-s + 1] = tab[k]
    end
    return out
end

-- Shell
function shell.print(...)
	shellJS:print(...)
end

function shell.printLines(data)
	for k, v in ipairs(data) do
		shell.print(unpack(v))
	end
end

function shell.clear()
	window:clearTerminal(true)
end

shell.filePath = {partition="C", path={}}

function shellJS:setShellPos(part, path)
	shell.filePath = {partition=part, path=path}
end

-- Console
function vc.setLineText(line, ...)
	shellJS:setLineText(line-1, true, ...)
end

function vc.addLineText(line, ...)
	shellJS:setLineText(line-1, false, ...)
end

function vc.setMultipleLines(data)
	for k, v in pairs(data) do
		vc.setLineText(k, unpack(v))
	end
end

function vc.clear()
	shell.clear()
end

function vc.keyDown(key) -- using normal ascii codes
	return hookJS:isKeyDown(key)
end

function vc.inGmod() -- Tells scripts not to run any gmod stuff
	return false
end

function toBaseN(val, n, cCount)
    n = n or 2
    local out = ""
    while val > 0 do
        local c = (val % n)
        if c > 9 then
            c = string.char((c-10) + string.byte("A"))
        end
        out = c .. out
        val = math.floor(val/n)
    end
    if cCount and #out < cCount then
        out = string.rep("0", cCount-#out) .. out
    end
    return out
end

-- Program manager
function vc.registerProgram(name, prog, desc)
    if not prog.start then
        error("Program " .. name .. " missing start function")
    end
    local aliases = {}
    if type(name) == "table" then
        aliases = name
        name = name[1]
        table.remove(aliases, 1) 
    end
    if vc.programs[name] then
        error("Program " .. name .. " already exists.")
    end
    vc.programs[name] = prog
    for k, v in pairs(aliases) do
        vc.programs[v] = name
    end

    local sKeys, sDefs
    if prog.switches then
	    sKeys = table.getKeys(prog.switches)
	    sDefs = {}
	    for k, key in ipairs(sKeys) do sDefs[k] = prog.switches[key] end
	end
    shellJS:registerLuaCommand(name, aliases, prog.flags, sKeys, sDefs, desc)

    prog.data = {name=name, hooks={}, timers={}, simpleTimerId=0, aliases=aliases, desc=desc, running=false}
    local self = prog
    self.exit = function(val)
        shellJS:stopProgram()
        window:endCommand(val)
    end
    self.hook = {}
    self.hook.add = function(event, id, func)
        table.insert(self.data.hooks, {event=event, id=id})
        hook.add(event, id, func)
    end
    self.hook.remove = function(event, id)
        for k, v in pairs(self.data.hooks) do
            if v.event == event and v.id == id then
                table.remove(self.data.hooks, k)
                hook.remove(event, id)
                break
            end
        end
    end
    self.timer = {}
    self.timer.create = function(name, delay, reps, func)
        if not table.hasValue(self.data.timers, name) then
            table.insert(self.data.timers, name)
        end
        if reps > 0 then
            timer.create(name, delay, reps, function()
                func()
                reps = reps - 1
                if reps == 0 then
                    table.removeByValue(self.data.timers, name)
                end
            end)
        else
            timer.create(name, delay, reps, func)
        end
    end
    self.timer.simple = function(delay, func)
        self.timer.create(self.data.name .. self.data.simpleTimerId, delay, 1, func)
        self.data.simpleTimerId = self.data.simpleTimerId + 1
    end
    self.timer.remove = function(name)
        table.removeByValue(self.data.timers, name)
        timer.remove(name)
    end
end

function shellJS:startProgram(prog, args, flags, switches)
	w(function()
		if vc.programs[prog] then
			vc.activeProgram = prog
			vc.programs[prog].data.running = true
			local ret = vc.programs[prog].start(args, flags, switches)
			if ret then
				vc.programs[prog].exit(ret)
			end
		else
			error("Program does not exist!")
		end
	end)
end

function shellJS:stopProgram()
	if vc.activeProgram then
		local prog = vc.programs[vc.activeProgram]
		prog.data.running = false
        if prog.stop then
        	prog.stop()
        end

        for k, v in pairs(prog.data.hooks) do
            hook.remove(v.event, v.id)
        end
        
        for k, v in pairs(prog.data.timers) do
            if timer.exists(v) then
                timer.remove(v)
            end
        end
        prog.data.timers = {}
        prog.data.simpleTimerId = 0
        prog.data.hooks = {}
		vc.activeProgram = nil
	end
end

function vc.getMaxChars()
	return window:getCharsPerLine()
end

-- File manager
-- Need to find a way to halt execution, could run everything in a coroutine using coroutine.wrap?
function vc.file.getDirectory(strPath)
	return runExternal(shellJS.runExternal, "GetDir", strPath)
end

function vc.file.getDirectoryRaw(part, path)
	return runExternal(shellJS.runExternal, "GetDirRaw", part, path)
end

function vc.file.getFile(strPath)
	return runExternal(shellJS.runExternal, "GetFile", strPath)
end

function vc.file.saveFile(strPath, content) -- Content here will be a string, just store it all on one line, or change BCP to use string content
	return runExternal(shellJS.runExternal, "SaveFile", strPath, content)
end

function vc.file.formatPath(part, path)
    local str = part .. ":/"
    for k, v in ipairs(path) do
        str = str .. v
        if k ~= #path then
            str = str .. "/"
        end
    end
    return str
end

function vc.file.registerExtension(ext, desc)
	-- This can do nothing lol
end

-- Starfall quota stuff, hardcoded as we have no limits here ;)

function quotaAverage()
	return 0
end

function quotaMax()
	return 100
end

function quotaUsed()
	return 0
end

require("nano");
require("arm");

window:ready("Lua-shellAPI")