/*
Emitters are used for event handling.
An event must be registered in order to be triggered, or to add a handler to it
Add handlers with:
emitter.on(eventName, uniqueID, handler)
Remove with:
emitter.remove(eventName, uniqueID)

events can be triggered with arguments, e.g. emitter.emit("keyPress", key)

EmitterProxy used to group a programs event handlers so they can be added/removed when a program starts/ends
EmitterProxy has all same funcs are emitter, along with EmitterProxy.enable() and EmitterProxy.disable().
Any events added to EmitterProxy while enabled are not saved.
Any events added while disabled are saved and added when EmitterProxy is enabled.
*/

define(["helper"], function(helper) {

	class Emitter {
		#events = {};
		#eventNames = [];
		registerEvent(event) {
			if(eventExists(this.#eventNames, event)) {
				throw "Event " + event + " already exists";
			}
			this.#eventNames.push(event);
			this.#events[event] = {};
		}
		unregisterEvent(event) {
			if(!eventExists(this.#eventNames, event)) {
				throw "Event " + event + " does not exist";
			}
			helper.removeByValue(this.#eventNames, event);
			delete this.#events[event];
		}
		emit(event, ...args) {
			if(eventExists(this.#eventNames, event)) {
				for(let key in this.#events[event]) {
					this.#events[event][key](...args);
				}
			} else {
				throw "Event " + event + " does not exist";
			}
		}
		on(event, id, cb) {
			if(eventExists(this.#eventNames, event)) {
				this.#events[event][id] = cb;
			} else {
				throw "Event " + event + " does not exist";
			}	
		}
		remove(event, id) {
			if(eventExists(this.#eventNames, event)) {
				delete this.#events[event][id]
			} else {
				throw "Event " + event + " does not exist";
			}
		}
		getTable() { 
			return {
				events: helper.clone(this.#events), 
				eventNames: this.#eventNames.slice()
			}; 
		}
		EmitterProxy(name) {
			return new EmitterProxy(name, this);
		}
	}

	function eventExists(eventNames, event) {
		return eventNames.indexOf(event) != -1;
	}

	class EmitterProxy {
		#emitter;
		constructor(name, emitter) {
			this._name = name;
			this._eventNames = [];
			this._events = {};
			this.enabled = false;
			this.#emitter = emitter;
		}

		registerEvent(event) {
			this._eventNames.push(event);
			if(this.enabled) {
				this.#emitter.registerEvent(event);
			}
		}

		unregisterEvent(event) {
			helper.removeByValue(this._eventNames, event);
			if(this.enabled) {
				this.#emitter.unregisterEvent(event);
			}
		}

		emit(event, ...args) {
			if(!helper.hasValue(this._eventNames, event)) {
				throw "Event " + event + " does not exist or is inaccessible";
			}
			this.#emitter.emit(event, ...args);
  		}

		on(event, id, f) {
			id = this._name + "." + id;
			if(!this._events[event]) this._events[event] = {};
			this._events[event][id] = f;
			if(this.enabled) {
				this.#emitter.on(event, id, f);
			}
		}

		remove(event, id) {
			id = this._name + "." + id;
			if(this._events[event]) {
				delete this._events[event][id];
			}
			if(this.enabled) {
				this.#emitter.remove(event, id, f);
			}
		}

		getTable() {
			return {events: helper.clone(this._events), eventNames: this._eventNames.slice()};
		}

		registerAll() {
			for(let e of this._eventNames) {
				this.#emitter.registerEvent(e);
			}
		}

		unregisterAll() {
			for(var e of this._eventNames) {
				this.#emitter.unregisterEvent(e);
			}
		}

		onAll() {
			for(var event in this._events) {
				for(var id in this._events[event]) {
					this.#emitter.on(event, id, this._events[event][id]);
				}
			}
		}

		removeAll() {
			for(var event in this._events) {
				for(var id in this._events[event]) {
					this.#emitter.remove(event, id);
				}
			}
		}

		enable() {
			if(this.enabled) return;
			this.enabled = true;
			this.registerAll();
			this.onAll();
		}

		disable() {
			if(!this.enabled) return;
			this.enabled = false;
			this.removeAll();
			this.unregisterAll();
		}
	}

	return Emitter;
})
