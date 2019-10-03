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


var events = {};
var eventNames = [];

function eventExists(event) {
	return eventNames.indexOf(event) != -1;
}

define(["helper"], function(helper) {

	var emitter = {
		registerEvent: function(event) {
			if(eventExists(event)) {
				throw "Event " + event + " already exists";
			}
			eventNames.push(event);
			events[event] = {};
		},
		unregisterEvent: function(event) {
			if(!eventExists(event)) {
				throw "Event " + event + " does not exist";
			}
			helper.removeByValue(eventNames, event);
			delete events[event];
		},
		emit: function(event, ...args) {
			if(eventExists(event)) {
				for(let key in events[event]) {
					events[event][key](...args);
				}
			} else {
				throw "Event " + event + " does not exist";
			}
		},
		on: function(event, id, cb) {
			console.log(event, id, cb);
			if(eventExists(event)) {
				events[event][id] = cb;
			} else {
				throw "Event " + event + " does not exist";
			}	
		},
		remove: function(event, id) {
			if(eventExists(event)) {
				delete events[event][id]
			} else {
				throw "Event " + event + " does not exist";
			}
		},
		getTable: function() { return {events: helper.clone(events), eventNames: eventNames.slice()}; }
	}

	class EmitterProxy {
		constructor(name) {
			this._name = name;
			this._eventNames = [];
			this._events = {};
			this.enabled = false;
		}

		registerEvent(event) {
			this._eventNames.push(event);
			if(this.enabled) {
				emitter.registerEvent(event);
			}
		}

		unregisterEvent(event) {
			helper.removeByValue(this._eventNames, event);
			if(this.enabled) {
				emitter.unregisterEvent(event);
			}
		}

		emit(event, ...args) {
			if(!helper.hasValue(this._eventNames, event)) {
				throw "Event " + event + " does not exist or is inaccessible";
			}
			emitter.emit(event, ...args);
  		}

		on(event, id, f) {
			id = this._name + "." + id;
			if(!this._events[event]) this._events[event] = {};
			this._events[event][id] = f;
			if(this.enabled) {
				emitter.on(event, id, f);
			}
		}

		remove(event, id) {
			id = this._name + "." + id;
			if(this._events[event]) {
				delete this._events[event][id];
			}
			if(this.enabled) {
				emitter.remove(event, id, f);
			}
		}

		getTable() {
			return {events: helper.clone(this._events), eventNames: this._eventNames.slice()};
		}

		registerAll() {
			for(let e of this._eventNames) {
				emitter.registerEvent(e);
			}
		}

		unregisterAll() {
			for(var e of this._eventNames) {
				emitter.unregisterEvent(e);
			}
		}

		onAll() {
			for(var event in this._events) {
				for(var id in this._events[event]) {
					emitter.on(event, id, this._events[event][id]);
				}
			}
		}

		removeAll() {
			for(var event in this._events) {
				for(var id in this._events[event]) {
					emitter.remove(event, id);
				}
			}
		}

		enable() {
			if(this.enabled) return;
			if(this._prevEvents) {
				this._events = this._prevEvents;
				this._eventNames = this._prevEventNames;
			}
			this._prevEvents = helper.clone(this._events);
			this._prevEventNames = helper.clone(this._eventNames);
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

	emitter.EmitterProxy = EmitterProxy;

	return emitter;
})