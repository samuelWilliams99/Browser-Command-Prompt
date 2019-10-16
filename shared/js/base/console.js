// Colour object for displaying consoles lines
class Col {
	constructor(isBg, r,g,b,a) {
		this.isBg = isBg;
		a = a === undefined ? 255 : a;
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	}
	asCSS() {
		return "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
	}
}

// Global convenience functions
function Color(r,g,b,a) {
	return new Col(false, r,g,b,a);
}

function BgColor(r,g,b,a) {
	return new Col(true, r,g,b,a);
}

var lines = {};

// Grab jquery
define(["jquery"], function($) {

	var emitter;

	var maxLines = 0;
	var maxChars = 0;

	var charHeight = 0;
	var charWidth = 0;

	var keysDown = {};

	function addEvents(el) {
		el.keydown(function(event) {
			if(!keysDown[event.which]) {
				emitter.emit("console.keyDown", event.which);
				keysDown[event.which] = true;
			};
			emitter.emit("console.keyPress", event.which)
		});
		el.keyup(function(event) {
			emitter.emit("console.keyUp", event.which);
			keysDown[event.which] = false;
		});
	}

	function updateMaxs() {
		// Get window size
		var viewportWidth = $(window).width();
		var viewportHeight = $(window).height();

		// Create p element with 1 character, and invisible
		var tmpChar = $("<p>a</p>");
		tmpChar.css("color", "rgb(0,0,0,0)");
		$("#container").append(tmpChar);

		// Grab its size (using getBoundingClientRect to get unrounded size)
		charWidth = tmpChar[0].getBoundingClientRect().width;
		charHeight = tmpChar[0].getBoundingClientRect().height;

		// Delete temporary element
		tmpChar.remove();

		// Define more globals
		maxLines = Math.floor( viewportHeight / charHeight );
		maxChars = Math.floor( viewportWidth / charWidth );
	}

	// Updates html from lines array between lines "lineFrom" and "lineTo", or just at line "lineFrom"
	function updateLines(lineFrom, lineTo) {
		if(!lineTo) lineTo = lineFrom;
		for(var l = lineFrom; l <= lineTo; l++) {
			var line = $("#line" + l);
			if(!lines[l]) {
				if(line.length) {
					line.html("");
				}
				continue;
			}

			// If line doesnt exist, create it
			if(!line.length) {
				line = $("<div class='line'></div>");
				line.attr("id", "line" + l);
				line.css("top", l*charHeight + "px");
				line.css("height", charHeight + "px");
				addEvents(line);
				$("#container").append(line);
			}

			// Clear the line
			line.html("");

			// Default colours
			var textCol = Color(255,255,255);
			var bgCol = BgColor(0,0,0,0);

			// Loop through line data
			for(var i=0; i<lines[l].length; i++) {
				var el = lines[l][i];
				// If is colour, update
				if(el instanceof Col) {
					if(el.isBg) {
						bgCol = el;
					} else {
						textCol = el;
					}
				} else {
					// If can't be converted to string, ignore
					if(!el.toString){ continue }
					var text = el.toString();

					var pre = $("<pre style='color: "+textCol.asCSS()+"; background-color: "+bgCol.asCSS()+"'></pre>");
					pre.text(text);
					addEvents(pre);
					line.append(pre);
				}
			}
		}
	}

	updateMaxs();

	// Trigger update on screen resize
	$(window).resize(updateMaxs);

	addEvents($("#container"));
	addEvents($(window));

	var c = {
		setLine: function(line, ...data) {
			lines[line] = [...data];
			updateLines(line);
		},
		addToLine: function(line, ...data) {
			if(!lines[line]) lines[line] = [];
			lines[line].concat([...data]);
			updateLines(line)
		},
		setLineMultiple: function(data) {
			// Separated from setLine to reduce calls to updateLines
			var min = Number.MAX_SAFE_INTEGER;
			var max = -1;
			for(let line in data) {
				lines[line] = data[line];
				if(line < min) min = line;
				if(line > max) max = line;
			}
			updateLines(min, max);
		},
		clear: function(){
			lines = {}
			updateLines(0, maxLines);
		},
		getMaxLines: function(){return maxLines},
		getMaxChars: function(){return maxChars},
		Color: Color,
		BgColor: BgColor,
		isKeyDown: function(key) { return keysDown[key]; },
		setEmitter: function(e) {
			emitter = e;
			emitter.registerEvent("console.keyDown");
			emitter.registerEvent("console.keyUp");
			emitter.registerEvent("console.keyPress");
			delete c.setEmitter;
		}
	}

	return c;
})
