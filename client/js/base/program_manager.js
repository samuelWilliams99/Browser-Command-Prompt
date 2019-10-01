define(["console", "emitter"], function(console, emitter) {

	class EmitterProxy {
		constructor(name) {
			this._name = name;
			this._eventNames = [];
		}
		registerEvent(event) {
			emitter.registerEvent(event);

		}
	}

	class Program {
		constructor(name, aliases = [], desc = "Unknown", usage = "Unknown") {
			this._name = name;
			this._aliases = aliases;
			this._desc = desc;
			this._usage = usage;
			this.emitter = new EmitterProxy(name);
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
			this._start(...args);
		}

		stop(errCode) {
			this._stop(errCode);
			this.emitter.removeAll()
		}
	}


	return {

	}
});