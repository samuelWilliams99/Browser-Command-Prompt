var scrollOffset = 0;

var lineCounter = 0;
var initPrintCounter = 0;
var linesPerPage = 40;
var ver;
var initPrintText = [
	"-----------########---######--########------------",
	"-----------##-----##-##----##-##-----##-----------",
	"-----------##-----##-##-------##-----##-----------",
	"-----------########--##-------########------------",
	"-----------##-----##-##-------##------------------",
	"-----------##-----##-##----##-##------------------",
	"-----------########---######--##------------------",
	"Browser Command Prompt initialized",
	"Type help for list of commands"
];

var underscoreToggle = false;
var inputStr = ""
var cmdLog = [];
var cmdLogIdx = 0;
var curCmd = "";

var commands = []

var filePath;

var readingInput;

var active = false;

var initReq = {key: false, delay: false, ver:false, modules:false, file:false, lua:false};
var initStrs = {key:"Got private key", delay:"Loaded css", ver:"Got version", modules:"Loaded modules", file:"Connected to file database", lua:"Loaded fengari (lua)"}
var initFinished = false

var cmd;

var lineStr = "";

var textCol = "rgb(255,255,255,255)";
var textBgCol = "rgb(0,0,0,0)";
var clearOnEnd = false

//Shitty emitters
var emitter = {
	emit: function(event, ...args) {
		if(emitter.events[event]) {
			for(let cb of emitter.events[event]) {
				cb(...args);
			}
		}
	},
	on: function(event, cb) {
		if(!emitter.events[event]){
			emitter.events[event] = [];
		}
		emitter.events[event].push(cb)
	},
	events: {}
}

function clamp(num, min, max) {
	return num <= min ? min : num >= max ? max : num;
}

function getLinesPerPage() {
	return linesPerPage
}

function getCharsPerLine() {
	return Math.floor(window.innerWidth / 10.6); // Cancer magic number cuz I can't find anything to work out the character width accurately
}

function doGetCaretPosition(id) {
	var ctrl = document.getElementById(id);
	if(!ctrl){return false}
	var CaretPos = 0;

	if (ctrl.selectionStart || ctrl.selectionStart == 0) {// Standard.
		CaretPos = ctrl.selectionStart;
	} else if (document.selection) {// Legacy IE
		ctrl.focus();
		var Sel = document.selection.createRange ();
		Sel.moveStart ('character', -ctrl.value.length);
		CaretPos = Sel.text.length;
	}

	return (CaretPos);
}

document.addEventListener("wheel", function (e) {
	var variation = parseInt(e.deltaY);
	variation = variation > 0 ? 1 : -1;
	scrollOffset = clamp(scrollOffset - variation, 0, Math.max(0, lineCounter-linesPerPage + 1));
	updateScroll();
	return false;
}, true);

var mouseDown = 0;

$(document).ready(function(){
	document.body.onmousedown = function() { 
	  ++mouseDown;
	}
	document.body.onmouseup = function() {
	  --mouseDown;
	}
});

function updateScroll(){
	for(var i=0; i<=lineCounter; i++){
		var el = $("#line"+i);
		if(i <= (lineCounter-scrollOffset) && i > (lineCounter-scrollOffset) - linesPerPage){
			el.prop('hidden', false);
		} else {
			el.prop('hidden', true);
		}
	}
}


function setCaretPosition(id,pos) {
	var ctrl = document.getElementById(id);
	if (ctrl.setSelectionRange) {
		ctrl.focus();
		ctrl.setSelectionRange(pos,pos);
	} else if (ctrl.createTextRange) {
		var range = ctrl.createTextRange();
		range.collapse(true);
		range.moveEnd('character', pos);
		range.moveStart('character', pos);
		range.select();
	}
}

var escape = document.createElement('textarea');
function escapeHTML(html) {
    escape.textContent = html;
    return escape.innerHTML;
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    var items = location.search.substr(1).split("&");
    for (var index = 0; index < items.length; index++) {
        tmp = items[index].split("=");
        if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
    }
    return result;
}

//END

$(document).ready(function() {
	clearTerminal(true);
	writeLine("Initializing...");
});

function setTextColor(r, g, b, a){
	r = clamp(Math.round(r), 0, 255);
	g = clamp(Math.round(g), 0, 255);
	b = clamp(Math.round(b), 0, 255);
	a = a ? clamp(Math.round(a), 0, 255) : 255
	textCol = "rgb("+r+","+g+","+b+","+a+")";
}

function setTextBackgroundColor(r, g, b, a) {
	r = clamp(Math.round(r), 0, 255);
	g = clamp(Math.round(g), 0, 255);
	b = clamp(Math.round(b), 0, 255);
	a = a ? clamp(Math.round(a), 0, 255) : 255
	textBgCol = "rgb("+r+","+g+","+b+","+a+")";
}

var modulesLoading = {};
function addModule(name){
	modulesLoading[name] = false;
	var head = document.head;
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'js/modules/'+name+'.js';
    script.onload = function(){
    	writeLine("Module "+name+" loaded");
    	modulesLoading[name] = true;
    	var allLoaded = true
    	for(var modName in modulesLoading){
    		if(!modulesLoading[modName]){allLoaded = false}
    	}
    	if(allLoaded){
    		setTimeout(function(){
    			ready("modules");
    		}, 500);
    	}
    }
    head.appendChild(script);
}

socket.on("connect_timeout", function(){
	writeLine("ERROR: Server shutdown");
	pause();
});

socket.on("ver", function(version){
	ver = version
	ready("ver");
});

socket.on("modules", function(modules){
	for(var i=0; i<modules.length; i++){
		addModule(modules[i]);
	}
	writeLine("Loading modules...");
})

socket.on("reconnect_attempt", function(){
	location.reload();
})

function getVer(){ return ver; }

function ready(type){
	if(initFinished) return;
	initReq[type] = true;
	writeLine(initStrs[type]);
	allValid = true;
	for(var key in initReq){
		if(!initReq[key]){
			allValid = false;
		}
	}
	if(allValid){
		initFinished = true
		writeLine("Complete!");
		setTimeout(function(){
			clearTerminal();
			initPrint();
		}, 400);
	}
}

function addInitReq(type, text) {
	if(initFinished) return false;
	initReq[type] = false;
	initStrs[type] = text;
}

function writeLine(text, allowSpecialCharacters, settings) { // TODO: Move allowSpecialCharacters into settings table
	text = text || " ";
	settings = settings || {};
	var oldLineCounter;
	if(settings.appendLine || settings.replaceLine) {
		oldLineCounter = lineCounter;
		lineCounter = settings.appendLine;
		if(settings.replaceLine){
			var line = $("#line"+lineCounter);
			line.html("");
		}
		text = text.split("\n").join("");
	}
	if(allowSpecialCharacters){
		write(text);
	} else {
		writeRaw(text);
	}
	if(settings.appendLine || settings.replaceLine) {
		lineCounter = oldLineCounter;
	} else {
		newLine();
	}
}

function writeRaw(text){
	text = text || ""
	text = text.split("\n").join("");
	var line = $("#line"+lineCounter);
	text = escapeHTML(text);
	text = "<pre style='color: "+textCol+"; background-color: "+textBgCol+"'>" + text + "</pre>"
	lineStr = lineStr + text
	line.html(lineStr)
}

function newLine(){
	writeRaw();
	lineStr = ""
	var id = ++lineCounter;
	var hidden = false
	if(scrollOffset != 0){
		hidden = true
		scrollOffset += 1;
	}
	var line = createLineDiv(id, hidden)
	if(lineCounter>(linesPerPage - 1)){
		var el = $("#line"+(lineCounter-linesPerPage));
		if( el ) {
			el.prop('hidden', true);
		}
	}
}

function createLineDiv(l, hidden) {
	hidden = hidden ? " hidden" : ""
	var line = $("<div style='height:1.43em' class='line' id=line"+l+hidden+" lineNum="+l+"></div>");
	$("#mainText").append(line);
	return line
}

function removeLastLine(){
	if(lineStr != ""){lineStr = ""; return;}
	document.getElementById("line"+lineCounter).remove();
	lineCounter--;
}

function findNextColor(t, idx) {
	var m = t.match( new RegExp("(?:.|\n){"+ (idx+1) +",}?(\\[#|\\[~)", "m") )
	if (m && m.length == 2) return [t.indexOf(m[1]), m[1]]
	else return [-1, ""]
}

function extractColors(text){
	var d = [-1, ""];
	var out = []
	while((d = findNextColor(text, d[0]))[0] != -1){
		var idx = d[0]
		if(idx + 8 < text.length && text.charAt(idx+8) == "]"){
			var hex = text.substring(idx+2, idx+8)
			hex = hexToRgb(hex);
			if(!hex){continue}
			var str = text.substring(0, idx);
			if(str){
				out.push(str);
			}
			if(d[1] == "[~") {
				hex.bg = true
			}
			out.push(hex);
			text = text.substring(9+str.length);
			d[0] = -1
		}
	}
	if(text){
		out.push(text);
	}
	return out;
}

function write(textPre, pre, post){
	pre = pre || "";
	post = post || "";
	var out = textPre
	if(typeof textPre == "string") 
		out = extractColors(textPre);
	writeExtracted(out, pre, post)
}

function writeAtLine(line, data, shouldReplace) {
	var out = data;
	if(typeof data == "string") 
		out = extractColors(data);

	var el = $("#line" + line)

	var oldLineCounter = lineCounter;
	var oldLineStr = lineStr;

	var lineDivs = $("#mainText").children()
	var last = lineDivs.eq(lineDivs.length-1)
	lineCounter = last.attr("linenum")
	lineStr = last.html()

	while(!el.length) {
		newLine();
	 	el = $("#line" + line);
	}
	if(shouldReplace) 
		lineStr = "";
	else
		lineStr = el.html();

	lineCounter = line;
	write(data);
	lineCounter = oldLineCounter;
	lineStr = oldLineStr;
}

function writeExtracted(out, pre, post) {
	var line = pre;
	for(var l=0; l<out.length; l++){
		text = out[l];
		if(typeof text == "string"){
			for(var i = 0; i<text.length; i++){
				if(text.charAt(i) == "\n"){
					if(line != pre){
						writeRaw(line+post);
					}
					line = pre;
					newLine();
				} else {
					line = line + text.charAt(i);
				}
			}
		} else {
			writeRaw(line)
			line = ""
			if(text.bg) {
				setTextBackgroundColor(text.r, text.g, text.b)
			} else {
				setTextColor(text.r, text.g, text.b);
			}
		}
	}
	if(line != pre){writeRaw(line+post)}
}

function clearTerminal(full) {
	lineCounter = -1;
	$("#mainText").html("");
	newLine();
	if(!full){
		writeLine("BCP V"+getVer());
	}
}

function resetInput(){
	$("#input").val("");
	updateInput();
}

function setInput(txt){
	$("#input").val(txt);
	setTimeout(function(){
		setCaretPosition("input", txt.length);
	}, 10);
	updateInput();
}

function getInput(){
	return $("#input").val();
}

function togUnderscore() {
	if(!active){return;}
	underscoreToggle = !underscoreToggle;
	if(!mouseDown){
		$("#input")[0].focus();
	}
    updateInput();
}

function updateInput(fromPrev) {
	if(!active){return;}
	if(fromPrev){
		cmdLogIdx = clamp(cmdLogIdx, -cmdLog.length, 0)

		if(cmdLogIdx == 0) {
			inputStr = curCmd; 
		} else {
			inputStr = cmdLog[cmdLog.length+cmdLogIdx]
		}

		$("#input").val(inputStr);
		setTimeout(function(){
			setCaretPosition("input", inputStr.length);
		}, 10);
		
	} else {
		inputStr = $("#input").val();
	}

	if(!inputStr){inputStr = ""}
	var caretPos = doGetCaretPosition("input");
	if(caretPos === false){caretPos = inputStr.length}
	var prefix = "";
	if(!readingInput){
		prefix = (filePath || "") + ">";
	} else {
		if(readingInput.prefix){
			prefix = readingInput.prefix;
		}
	}

	var txt = inputStr;

	if(readingInput && readingInput.char){
		txt = (readingInput.char).repeat(inputStr.length);
		caretPos *= readingInput.char.length
	}

	if(underscoreToggle) {
		txt = txt.substring(0, caretPos) + "_" + txt.substring(caretPos + 1, 1000000);
	}
	var col = "rgb(255,255,255)";
	if(readingInput){
		col = textCol;
	}
	$("#line" + lineCounter).html(lineStr + "<pre style='color: "+col+"'>" + escapeHTML(prefix + txt) + "</pre>")
	
}

setInterval(togUnderscore, 500);
togUnderscore();

setTimeout(function(){
	ready("delay");
}, 700);

function initPrint(){
	if(initPrintCounter < initPrintText.length) {
		writeLine(initPrintText[initPrintCounter++]);
		setTimeout(initPrint, 50);
	} else {
		active = true;
		updateInput();
		var run = findGetParameter("run");
		if(run){
			run = run.split("~").join(" ");
			runCommand(run);
		}
	}
}

$(document).ready(function() {
	$("#input").change(function(){updateInput()});
	$("#input").keydown(function(event) {
	    //IE uses this
	    if(window.event) {
	        event = window.event;
	    }
	    search(event, $("#input"));
	});
	$("#input").keyup(function(event) {
	    if(window.event) {
	        holder = window.event;
	    }

	    emitter.emit("KeyUp", event.key, event);
	});
});


function search(e, ele) {
	var key = e.key
	if(key == "Pause"){
		endCommand(-3);
	    writeLine("Terminated");
	    updateInput();
	    return;
	}
	
	emitter.emit("KeyDown", key, e);
	updateInput()
	if(!active){return;}
	scrollOffset = 0;
	updateScroll();
	switch(key){
  		case "Enter":
  			var val = ele.val();
  			resetInput();
  			if(readingInput) {
  				if(readingInput.forbidEmpty && val == ""){return;}
  				var txt = val;
  				if(readingInput.char){
  					txt = (readingInput.char).repeat(txt.length)
  				}
  				if(readingInput.prefix){
  					txt = readingInput.prefix + txt;
  				}
  				if(!readingInput.dontPrint){

  					if(readingInput.allowSpecialCharacters){
						write(txt);
					} else {
						writeRaw(txt);
					}
					if(!readingInput.noNewLine){
						newLine();
					}
  				}

  				var cb = readingInput.cb;
  				readingInput = null;
  				pause();
  				cb(val);
  				writeRaw();
  				updateScroll();
  			} else {
	    		runCommand(val);
	    	}
	        
	    break
	    case "ArrowUp":
	    	if(!readingInput){
		    	if(cmdLogIdx == 0){curCmd = inputStr}
		    	cmdLogIdx--;
		    	updateInput(true);
	    	}
	    break
	    case "ArrowDown":
	    	if(!readingInput){
				if(cmdLogIdx == 0){curCmd = inputStr}
				cmdLogIdx++;
				updateInput(true);
			}
	    break
	    case "ArrowLeft":
	    case "ArrowRight":
	    	updateInput();
	    break
	}
}

function splitCommand(str) {
	var token = "";
	var result = [];
	var inStr = false;
	for (var i = 0; i < str.length; i++) {
		var char = str.charAt(i);
		if(inStr){
			if(char == "\"") {
				inStr = false;
				result.push(token);
				if( i+1 < str.length) {
					if(str.charAt(i+1) != " "){return false}
					i++;
				}
				token = "";
			} else {
				token = token + char;
			}
		} else {
			if(char == " "){
				if(token != ""){
					result.push(token);
				}
				token = "";
			} else if(char == "\"") {
				if(token != ""){return false}
				inStr = true;
			} else {
				token = token + char;
			}
		}
	}
	if(token != ""){result.push(token);}
	return result;
}

function isNum(char) {
	return '0123456789'.indexOf(char) !== -1;
}

function pause(){
	active = false;
	$("#line" + lineCounter).text(lineStr);
}
function resume(){
	active = true;
	$("#input").val(inputStr);
	updateInput();
}

function parseType(str) {
	var onlyDigits = true;
	var float = false;

	for(var i=0; i<str.length; i++) {
		var char = str.charAt(i);
		if(!isNum(char)){
			if(char == "."){
				if(!float){
					float = true;
				} else {
					onlyDigits = false;
				}
			} else {
				onlyDigits = false;
			}
		}
	}
	if(onlyDigits){
		return float ? "Float" : "Int";
	} else {
		return "String";
	}
}

/*
registerCommand USAGE
name (or array of names), desciption, options=null, callback(args, options)

options format:
options = {
	flags:{
		flagName:defaultValue (any type)
	},
	switches:{
		switchName:defaultValue (boolean)
	}
}
*/

function registerCommand(name, desc, options, cb) {
	if(typeof cb == "undefined"){
		cb = options
		options = null;
	}
	var aliases = [];
	if(typeof name == "object"){
		aliases = name.slice(1);
		name = name[0];
	}
	commands.push({name:name, desc:desc, cb:cb, options:options, aliases:aliases})
	if(!initFinished) {
		writeLine("Adding program: " + name)
	}
}

var curCmds = [];
var cmdOps = ["&&", "||"];
	
function runCommand(str) {
	setTextColor(255,255,255);
	setTextBackgroundColor(0,0,0,0);
	if(str == ""){return;}
	writeLine((filePath || "") + ">"+str);
	cmdLog.push(str);
	cmdLogIdx = 0;
	curCmd = "";

	var cmdSplit = splitCommand(str);
	if(!cmdSplit){ writeLine("ERROR: Malformed command"); return;}

	var cmd = [];
	curCmds = [];
	for(var i=0;i<cmdSplit.length;i++){
		var word = cmdSplit[i];
		if(cmdOps.indexOf(word) != -1) {
			if(cmd.length > 0){
				curCmds.push(cmd);
			}
			cmd = [];
			curCmds.push(word);
		} else {
			cmd.push(word);
		}
	}

	if(cmd.length>0){
		curCmds.push(cmd);
	}

	//structure check:
	for(i=0; i<curCmds.length; i++) {
		if ( typeof curCmds[i] != ( (i%2 == 0) ? "object" : "string" ) ) {
			writeLine("Malformed command, incorrect use of operators");
			return;
		}
	}

	if(curCmds.length%2 != 1){
		writeLine("Malformed command, incorrect use of operators");
		return;
	}

	pause();
	executeCommand(curCmds.shift())		
		
}

function endCommand(retVal) {
	
	emitter.emit("EndCommand")

	if(clearOnEnd) {
		clearTerminal()
	}

	if(retVal == -1 || retVal == -3){resume(); cmd = null; readingInput = null; return;}
	if(retVal == -2){
		writeLine("Incorrect usage, see 'help "+cmd+"'")
		resume();
		cmd = null;
		return;
	}
	if(curCmds.length == 0) {resume(); cmd = null; return;}

	var op = curCmds.shift();
	if(op == "&&") {
		if(retVal == 1){
			executeCommand(curCmds.shift())	
		} else {
			curCmds = [];
			resume();
			cmd = null; 
		}
	} else if(op == "||") {
		if(retVal == 0){
			executeCommand(curCmds.shift())	
		} else {
			curCmds = [];
			resume();
			cmd = null; 
		}
	}
}

function readInput(charOverride, cb, options) {
	resume();
	var dontPrint = null;
	var prefix = null;
	var forbidEmpty = null;
	var allowSpecialCharacters = false;
	var noNewLine = false;
	if(options){
		dontPrint = options.dontPrint;
		prefix = options.prefix
		forbidEmpty = options.forbidEmpty
		allowSpecialCharacters = options.allowSpecialCharacters
		noNewLine = options.noNewLine
	}
	readingInput = {char:(charOverride == "" ? null : charOverride), cb:cb, dontPrint:dontPrint, prefix:prefix, forbidEmpty:forbidEmpty, allowSpecialCharacters:allowSpecialCharacters, noNewLine:noNewLine}
	updateInput();
}

function stopRead(){
	if(readingInput){
		resetInput();
		readingInput = null;
		pause();
	}
}

function executeCommand(cmdSplitPreProc) {
	if(cmdSplitPreProc == undefined || cmdSplitPreProc.length == 0){
		resume();
		return;
	}
	cmd = cmdSplitPreProc[0];
	cmd = cmd.toLowerCase();

	var foundCmd = false
	commands.forEach(function(command) {
		if(foundCmd){return;}
		if(command.name == cmd || command.aliases.indexOf(cmd) != -1){
			foundCmd = true;
			var cmdSplit = [];
			cmd = command.name;

			var flags = {};
			var switches = {};
			clearOnEnd = false
			//copying stuff
			if(command.options){
				for(var k in (command.options.flags || {})) {
					flags[k] = command.options.flags[k]
				}
				for(var k in (command.options.switches || {})) {
					switches[k] = command.options.switches[k]
				}
				if(command.options.clearOnEnd){
					clearOnEnd = true
				}
			}
			for(var i=1; i<cmdSplitPreProc.length; i++){
				var arg = cmdSplitPreProc[i];
				if(arg.charAt(0) == "-"){
					if(arg.charAt(1) == "-"){
						var switchName = arg.substring(2);
						var val = true;
						if(switchName.substring(0, 3) == "no-"){
							val = false;
							switchName = switchName.substring(3)
						}
						if(typeof switches[switchName] == "undefined") {
							writeLine("Switch '"+switchName+"' not defined for command '"+cmd+"'")
							endCommand(-1);
							return;
						}
						switches[switchName] = val;
					} else {
						var flagName = arg.substring(1)
						if(typeof flags[flagName] == "undefined") {
							writeLine("Flag '"+flagName+"' not defined for command '"+cmd+"'")
							endCommand(-1);
							return;
						}
						if(i+1 >= cmdSplitPreProc.length) {
							writeLine("No value specified for flag '"+flagName+"'")
							endCommand(-1)
							return
						}
						flags[flagName] = cmdSplitPreProc[++i];
					}
				} else {
					cmdSplit.push(arg);
				}
			}
			command.cb(cmdSplit, {flags:flags, switches:switches});
		}
	})

	if(!foundCmd){
		writeLine("ERROR: '" + cmd + "' is not recognised as a BCP command");
		endCommand(-1);
	}
	
	
}

function setClearOnEnd(val) {
	clearOnEnd = val
}