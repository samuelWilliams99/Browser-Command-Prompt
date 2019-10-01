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
		getTable: function() { return events; }
	}

	class EmitterProxy {
		constructor(name) {
			this._name = name;
			this._eventNames = [];
			this._events = [];
		}

		getCallbackIdx(event, id) {
			for(var i=0; i<this._events.length; i++) {
				var e = this._events[i];
				if(e.event == event && e.id == id) {
					return i;
				}
			}
			return null;
		}

		getCallback(event, id) {
			var idx = this.getCallbackIdx(event, id)
			if(!idx) return null;
			return this._events[idx];
		}

		registerEvent(event) {
			emitter.registerEvent(event);
			this._eventNames.push(event);
		}

		unregisterEvent(event) {
			emitter.unregisterEvent(event);
			helper.removeByValue(this._eventNames, event);
		}

		emit(event, ...args) {
			if(!helper.hasValue(this._eventNames, event)) {
				throw "Event " + event + " does not exist or is inaccessible";
			}
			emitter.emit(event, ...args);
  		}

		on(event, id, f) {
			id = this._name + "." + id;
			var dontPush = false;
			if(this.getCallback(event, id)) {
				dontPush = true;
			}
			emitter.on(event, id, f);
			if(!dontPush){
				this._events.push({event: event, id: id});
			}
		}

		remove(event, id) {
			id = this._name + "." + id;
			var i = this.getCallbackIdx(event, id);
			if(!i) return;
			delete this._events[i];
		}

		getTable() {
			return this._events;
		}

		removeAll() {
			for(var e of this._events) {
				emitter.remove(e.event, e.id);
			}
			this._events = [];
		}

		unregisterAll() {
			for(var e of this._eventNames) {
				emitter.unregisterEvent(e);
			}
			this._eventNames = [];
		}

		clear() {
			this.removeAll();
			this.unregisterAll();
		}
	}

	emitter.EmitterProxy = EmitterProxy;

	return emitter;
})