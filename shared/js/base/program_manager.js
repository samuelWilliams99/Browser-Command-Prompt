define(["emitter", "timer", "net", "helper"], function(emitter, timer, net, helper) {
	var socket;
	var processIDCounter = 0;
	var programs = [];
	var processes = [];

	var STATE_RUNNING = "Running";
	var STATE_SUSPENDED = "Suspended";
	var STATE_STOPPED = "Stopped"

	var STOPCODE_EXTERNAL = -1;
	var STOPCODE_SUCCESS = 0;
	var STOPCODE_FAIL = 1;

	emitter.registerEvent("PM.programLoadSuccess");
	emitter.registerEvent("PM.programLoadFail");
	emitter.registerEvent("PM.programsLoaded");

	// Basically all self explanatory
	class Process {
		#id = -1;
		#instance = null;
		#timeCreated = -1;
		#state = STATE_RUNNING;
		constructor(program, args, flags, switches) {
			this.#id = getProcessID();
			this.#instance = new program(this.#id);
			[...data] = args;
			this.#instance.doStart(...data);
			this.#instance.flags = flags;
			this.#instance.switches = switches;
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

		stop(errCode) {
			this.#state = STATE_STOPPED;
			this.#instance.doStop(errCode);
		}

		getRunTime() {
			return Date.now() - this.#timeCreated;
		}

		// Make all the private field getters (using private+getter to protect the members)
		get id() {
			return this.#id;
		}

		get instance() {
			return this.#instance;
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
		#id = -1;

		constructor(id, name, aliases = [], desc = "Unknown", usage = "Unknown") {
			this.#name = name;
			this.#aliases = aliases;
			this.#desc = desc;
			this.#usage = usage;
			this.#id = id;
			// Proxies use name + id so they're unique per process
			this.#emitter = new emitter.EmitterProxy(name + id);
			this.#timer = new timer.TimerProxy(name + id);
		}
		setUseServer(use) {
			this.#useServer = use;
		}

		doStart(...args) {
			this.emitter.enable();
			this.timer.enable();
			if(this.start) {
				this.start(...args);
			}
		}

		doStop(errCode) {
			if(this.stop) {
				this.stop(errCode);
			}
			this.emitter.disable();
			this.timer.removeAll();
		}

		exit(errCode) {
			stopProcess(this.#id, errCode);
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

	// Socket Setter, if called for first time (socket not set beforehand), request programs and setup socket receiver
	function setSocket(s) {
		if(!socket) {
			if(__CLIENT) {
				s.once("PM.getPrograms", function(ps) {
					registerPrograms(ps);
				});
				s.emit("PM.requestPrograms");
			}
			net.setSocket(s);
			socket = s;
		}
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

	// Create process, push to processes stack
	// returns -1 if program doesnt exist
	function startProcess(name, args, flags, switches) {
		var program = getProgram(name);
		if(program){
			var p = new Process(program, args, flags, switches);
			processes.push(p);
			return p.id;
		}
		return -1;
		
	}

	function stopProcess(id, errCode) {
		errCode = errCode || STOPCODE_EXTERNAL;
		var p = getProcess(id);
		if(!p) return false;
		p.stop(errCode);
		helper.removeByValue(processes, p);
		return true;
	}

	function registerProgram(program) {
		programs.push(program);
	}

	// Takes list of program files
	// Includes each file 
	// Registers each program in each file, emits PM.programLoadSuccess on success, PM.programLoadFail on fail
	function registerPrograms(programNames) {
		programDirs = programNames.map(f => "optional!programs/" + f);
		requirejs(programDirs, function(...files) {
			for(let k in files) {
				var progs = files[k];
				if(!progs) {continue; }
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
		getProcessesByName: getProcessesByName,
		startProcess: startProcess,
		stopProcess: stopProcess
	}
});
