define(["console", "emitter", "helper"], function(c, emitter, helper) {

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
			if(this._start) {
				this._start(...args);
			}
			this.emitter.enable();
		}

		stop(errCode) {
			if(this._stop) {
				this._stop(errCode);
			}
			this.emitter.disable();
		}
	}

	return {

	}
});