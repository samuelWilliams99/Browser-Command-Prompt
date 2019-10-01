define(["console", "emitter", "helper"], function(console, emitter, helper) {

	class Program {
		constructor(name, aliases = [], desc = "Unknown", usage = "Unknown") {
			this._name = name;
			this._aliases = aliases;
			this._desc = desc;
			this._usage = usage;
			this.emitter = new emitter.EmitterProxy(name);
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
			this.emitter.clear();
		}
	}


	return {

	}
});