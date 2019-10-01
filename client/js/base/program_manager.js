define(["console", "emitter"], function(console, emitter) {

	class Program {
		constructor(name, aliases, desc, usage) {
			this._name = name;
			this._aliases = aliases;
			this._desc = desc;
			this._usage = usage;
		},
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
			this._start(...args);
		}

		stop(errCode) {
			this._stop(errCode);
			
		}

	}


	return {

	}
});