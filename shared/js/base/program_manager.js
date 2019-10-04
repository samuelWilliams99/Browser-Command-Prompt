var socket;

define(["emitter", "timer", "helper"], function(emitter, timer, helper) {

	emitter.registerEvent("PM.programLoadSuccess");
	emitter.registerEvent("PM.programLoadFail");
	emitter.registerEvent("PM.programsLoaded");

	class Program {
		constructor(name, aliases = [], desc = "Unknown", usage = "Unknown") {
			this._name = name;
			this._aliases = aliases;
			this._desc = desc;
			this._usage = usage;
			this.emitter = new emitter.EmitterProxy(name);
			this.timer = new timer.TimerProxy(name);
		}
		onStart(f) {
			this._start = f;
		}
		onStop(f) {
			this._stop = f;
		}
		setUseServer(use) {
			this._useServer = use;
		}

		start(...args) {
			if(this._start) {
				this._start(...args);
			}
			this.emitter.enable();
			this.timer.enable();
		}

		stop(errCode) {
			if(this._stop) {
				this._stop(errCode);
			}
			this.emitter.disable();
			this.timer.disable();
		}

		get name() {
			return this._name;
		}

		set name(whocares) {
			throw "Cannot rename program after creation";
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

	function registerPrograms(programNames) {
		programDirs = programNames.map(f => "optional!programs/" + f);
		requirejs(programDirs, function(...progs) {
			for(let k in progs) {
				var prog = progs[k];
				if(prog) {
					emitter.emit("PM.programLoadSuccess", programNames[k]);
				} else {
					emitter.emit("PM.programLoadFail", programNames[k]);
				}
			}
			emitter.emit("PM.programsLoaded", programNames);
		});
	}

	return {
		Program: Program,
		setSocket: setSocket
	}
});
