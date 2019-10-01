var events = {};
var eventNames = [];

function eventExists(event) {
	return eventNames.indexOf(event) != -1;
}

define(["helper"], function(helper) {
	return {
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
			eventNames.removeByValue(event);
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
})