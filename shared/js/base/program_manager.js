var socket;
var processIDCounter = 0;
var programs = [];
var processes = [];

var STATE_RUNNING = "Running";
var STATE_SUSPENDED = "Suspended";

define(["emitter", "timer", "helper"], function(emitter, timer, helper) {

	emitter.registerEvent("PM.programLoadSuccess");
	emitter.registerEvent("PM.programLoadFail");
	emitter.registerEvent("PM.programsLoaded");

	class Process {
		#id = -1;
		#instance = null;
		#timeCreated = -1;
		#state = STATE_RUNNING;
		constructor(program, ...args) {
			this.#id = getProcessID();
			this.#instance = new program(this.#id);
			this.#instance.doStart(...args);
			this.#timeCreated = Date.now();
		}

		suspend() {
			this.#state = STATE_SUSPENDED;
			this.#instance.emitter.disable();
			this.#instance.timer.disable();
		}

		resume() {
			this.#state = STATE_RUNNING;
			this.#instance.emitter.enable();
			this.#instance.timer.enable();
		}

		// Make all the private field getters (using private+getter to protect the members)
		get id() {
			return this.#id;
		}

		get instance() {
			return this.#intance;
		}

		get timeCreated() {
			return this.#timeCreated;
		}
	}

	class Program {
		#emitter = null;
		#timer = null;
		#useServer = false;

		#name = "Unnamed";
		#aliases = [];
		#desc = "";
		#usage = "";

		constructor(name, aliases = [], desc = "Unknown", usage = "Unknown") {
			this.#name = name;
			this.#aliases = aliases;
			this.#desc = desc;
			this.#usage = usage;

			this.#emitter = new emitter.EmitterProxy(name);
			this.#timer = new timer.TimerProxy(name);
		}
		setUseServer(use) {
			this.#useServer = use;
		}
		doStart(...args) {
			if(this.start) {
				this.start(...args);
			}
			this.emitter.enable();
			this.timer.enable();
		}
		doStop(errCode) {
			if(this.stop) {
				this.stop(errCode);
			}
			this.emitter.disable();
			this.timer.disable();
		}

		get name() {
			return this.#name;
		}
		get emitter() {
			return this.#emitter;
		}
		get timer() {
			return this.#timer;
		}
	}

	function setSocket(s) {
		if(!socket) {
			s.once("PM.getPrograms", function(ps) {
				registerPrograms(ps);
			});
			s.emit("PM.requestPrograms");
		}
		socket = s;
	}

	function getProcessID() {
		return processIDCounter++;
	}

	function getProgram(name) {
		for(let program of programs) {
			if(program.Name == name || (program.Aliases && program.Aliases.indexOf(name) != -1)) {
				return program;
			}
		}
		return null;
	}

	function getProcess(id) {
		for(let p of processes) {
			if(p.id == id) {
				return p;
			}
		}
		return null;
	}

	function getProcessesByName(name) {
		var out = [];
		for(let p of processes) {
			if(p.instance.name == name) {
				out.push(p);
			}
		}
		return out;
	}

	function runProgram(name, ...args) {
		var program = getProgram(name);
		if(program){
			var p = new Process(program, ...args);
			processes.push(p);
			return p.id;
		}
		return -1;
		
	}

	function registerProgram(program) {
		programs.push(program);
	}

	function registerPrograms(programNames) {
		programDirs = programNames.map(f => "optional!programs/" + f);
		requirejs(programDirs, function(...files) {
			for(let k in files) {
				var progs = files[k];
				if(!Array.isArray(progs)) {progs = [progs];}
				for(let prog of progs) {
					if(prog && prog.prototype instanceof Program && prog.Name) {
						registerProgram(prog);
						emitter.emit("PM.programLoadSuccess", prog.Name);
					} else {
						emitter.emit("PM.programLoadFail", programNames[k]);
					}
				}
			}
			emitter.emit("PM.programsLoaded", programNames);
		});
	}

	return {
		Program: Program,
		setSocket: setSocket,
		getPrograms: function() {
			return helper.clone(programs);
		},
		getProgram: getProgram,
		getProcess: getProcess,
		getProcessesByName: getProcessesByName
	}
});
