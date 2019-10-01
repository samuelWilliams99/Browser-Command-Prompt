var scripts = ["shellAPI", "repl"];

var repl = {}
var timerJS = {}
var hookJS = {}
var shellJS = {}

var a = {}

$(document).ready(function() {

	for(let name of scripts){
		if(!initFinished){
			addInitReq("Lua-" + name, "Loaded lua script: " + name + ".lua")
		}
	}

	var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'js/libs/fengari-web.js';
    script.onload = luaLoaded
    head.appendChild(script);
})

function luaLoaded() {
	ready("lua")
	var head = document.head;
	for(let name of scripts) {
	    var script = document.createElement('script');
	    script.type = 'application/lua';
	    script.src = 'lua/5.3/' + name + '.lua';
	    head.appendChild(script);
	}
}

repl.luaReadOptions = {prefix:"Lua>", forbidEmpty:true}

hookJS.keysDown = {}
hookJS.keyLookup = {
	32: 32, // space
    "s32": 32, // space
    13: 10, // enter
    38: 17, // up
    37: 19, // left
    40: 18, // down
    39: 20, // right
    36: 149, // home
    35: 150, // end
    8: 127, // back
    46: 148, // delete
    19: 145, // pause
    16: 154, // shift
    "s49": 33, // 1, 2, 4 - 9, 0 in shift
    "s50": 34,
    "s52": 36,
    "s53": 37,
    "s54": 94,
    "s55": 38,
    "s56": 42,
    "s57": 40,
    "s48": 41,
    189: 45, // -
    187: 61, // =
    219: 91, // [
    221: 93, // ]
    186: 59, // ;
    192: 39, // '
    188: 44, // ,
    190: 46, // .
    191: 47, // /
    "s189": 95, // _
    "s187": 43, // +
    "s219": 123, // {
    "s221": 125, // }
    "s186": 58, // :
    "s192": 64, // @
    "s188": 60, // <
    "s190": 62, // >
    "s191": 63, // ?
    220: 92, // \
    "s220": 124, // |
    18: 158, // ctrl on here is 17, but we're gonna make alt trigger it, to avoid other shortcuts
    9: 9 // tab
}

hookJS.translateKey = function(event) {
	var s = event.shiftKey
	var key = event.which
	if (key >= 65 && key <= 90) {
		if (s) 
			return key
		else
			return key + 32
	} else if (key >= 48 && key <= 57) {
		if (!s)
			return key 
	}
	if (s) key = "s" + key
	return hookJS.keyLookup[key]
}

emitter.on("KeyDown", function(key, e) {
	repl.keyPress(key)

	var k = hookJS.translateKey(e)
	if(!k) return;
	if(hookJS.keysDown[k]) {
		hookJS.callHook("VC_KeyDown", k)
	}
	hookJS.keysDown[k] = true
	hookJS.callHook("VC_KeyPress", k)
})

emitter.on("KeyUp", function(key, e) {
	var k = hookJS.translateKey(e)
	if(!k) return;
	hookJS.keysDown[k] = undefined
	hookJS.callHook("VC_KeyUp", k)
})

emitter.on("EndCommand", function(key) {
	repl.stop()
	shellJS.stopProgram()
})

emitter.on("ChangeShellPos", function(part, path) {
	if(shellJS.setShellPos){
		shellJS.setShellPos(part, jsArrayToLua(path));
	}
});

timerJS.curtime = function() {
	var d = new Date()
	return d.getTime()/1000
}

hookJS.isKeyDown = function(key) {
	return hookJS.keysDown[key] || false
}

var Color = function(r,g,b,a) { return {r: r, g: g, b: b, a:a} }
var BGColor = function(r,g,b,a) { return {r: r, g: g, b: b, a:a, bg: true} }

shellJS.print = function(...d) {
	var data = [...d];
	var out = shellJS.convertData(data);
	out.push(Color(255,255,255));
	out.push(BGColor(0,0,0,0));
	out.push("\n");
	write(out);
}

shellJS.setLineText = function(line, doReplace, ...d) {
	var data = [...d];
	var out = shellJS.convertData(data);
	out.push(Color(255,255,255));
	out.push(BGColor(0,0,0,0));
	writeAtLine(line, out, doReplace);
	setClearOnEnd(true);
}

shellJS.convertData = function(data) {
	var out = [];
	for(let el of data) {
		if(typeof el === "string") {
			out.push(el);
		} else {
			if(el.get("bgCol")) {
				var c = el.get("bgCol");
				out.push({
					r: c.get("r"),
					g: c.get("g"),
					b: c.get("b"),
					bg: true
				});
			} else {
				out.push({
					r: el.get("r"),
					g: el.get("g"),
					b: el.get("b")
				});
			}
		}
	}
	return out;
}

function luaArrayToJS(obj) {
	if(!obj) return null;
	var out = [];
	var idx = 1;
	while(obj.has(idx)) {
		out[idx-1] = obj.get(idx);
		idx++;
	}
	return out;
}

function jsArrayToLua(arrOrig) {
	var arr = arrOrig.slice();
	arr.unshift(null);
	delete arr[0];
	return arr;
}

shellJS.registerLuaCommand = function(name, aliases, flags, switches, switchesDefaults, desc) {
	aliases = luaArrayToJS(aliases) || []
	flags = luaArrayToJS(flags) || []
	switches = luaArrayToJS(switches) || []
	switchesDefaults = luaArrayToJS(switchesDefaults) || []
	aliases.unshift(name)

	flagsJS = {}
	for(let flag of flags) {
		flagsJS[flag] = ""
	}

	switchesJS = {}
	for(var k=0; k<switches.length; k++) {
		var s = switches[k]
		switchesJS[s] = switchesDefaults[k]
	}

	if(Object.keys(flagsJS).length === 0) {
		flagsJS = null;
	}
	if(Object.keys(switchesJS).length === 0) {
		switchesJS = null;
	}

	registerCommand(aliases, desc, {
		usage: name,
		flags: flagsJS,
		switches: switchesJS
	}, function(args, options) {
		for(let k in options.flags) {
			if(options.flags[k] == "") {
				delete options.flags[k]
			}
		}
		shellJS.startProgram(name, jsArrayToLua(args), options.flags, options.switches)
	})
}

// Finish integrating this, use shellJS.resume() when each call is complete
shellJS.runExternal = function(cmd, ...d) {
	var data = [...d];
	var args = [];
	switch(cmd) {
		case "GetDir":
			var path = data[0];
			args = [path];
		break
		case "GetDirRaw":
			var part = data[0];
			var path = luaArrayToJS(data[1]);
			args = [part, path];
		break
		case "GetFile":
			var path = data[0];
			args = [path];
		break
		case "SaveFile":
			var path = data[0];
			var content = data[1];
			args = [path, content];
		break;
	}
	socket.emit("Lua_" + cmd, args);
}

socket.on("Lua_Response", function(...a) {
	shellJS.resume(...a);
});

registerCommand("lua", "Enter lua REPL", {
	usage: "lua"
}, function(args, options){
	if(args.length > 0) {
		endCommand(-2);
		return;
	}
	writeLine("Lua 5.3 REPL, use exit() to exit.");
	repl.start();
})

