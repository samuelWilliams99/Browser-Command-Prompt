/*
Timer library that calls a function every x seconds, reps times
timer.create(uniqueID, delay, reps, f)
if reps 0, runs infinite times
delay in seconds
f takes in rep number

timer.remove/timer.stop(uniqueID)

timer.repsLeft(uniqueID) -- repititions left

timer.exists


TimerProxy, sam as timer lib, but adds enable and disable, acts same as EmitterProxy
*/


var timers = {};

define(["helper"], function (helper) {
	var timer = {
		create: function(id, delay, reps, f, startIndex) {
			// Remove old if it exists
			var didReplace = false;
			if (timers[id]) {
				timer.remove(id);
				didReplace = true;
			}

			// create table entry
			timers[id] = {name: id, index: (startIndex === undefined) ? 0 : startIndex, repsLeft: reps, delay: delay, func: f};
			var self = timers[id];
			// create interval itself
			timers[id].interval = setInterval(function() { 
				self.repsLeft--;
				self.func(self.index);
				self.index++;
				// If negative, must have started at 0 to not be caught by if below, so run infinitely
				if(self.repsLeft < 0) { return; }
				// If less than 1 (0), its done, remove the timer
				if(self.repsLeft < 1) {
					timer.remove(self.name);
				}
			}, delay * 1000);
			return didReplace;
		},
		// Other name for remove
		stop: function(id) {timer.remove(id); },
		remove: function(id) {
			if(timers[id]) {
				// Clear and delete
				clearInterval(timers[id].interval);
				delete timers[id];
				return true;
			} else {
				return false;
			}
		},
		exists: function(id) {
			return timers[id] ? timers[id].repsLeft > 0 : false;
		},
		// if delay passed in, replace and recreate interval. If reps pass in as well, replace as well
		update: function(id, delay, reps) {
			if(timers[id]) {
				if(delay) {
					timers[id].delay = delay;
					clearInterval(timers[id].interval);
					setInterval(timers[id].func, delay);
				}

				if(reps) {
					timers[id].repsLeft = reps;
				}

				return true;
			} else {
				return false;
			}
		},
		repsLeft: function(id) {
			if(timers[id]) { return timers[id].repsLeft; }
			return false;
		},
		curIndex: function(id) {
			if(timers[id]) { return timers[id].index; }
			return false;
		}
	}

	class TimerProxy {
		constructor(name) {
			this._name = name;
			this._timers = {};
			this.enabled = false;
		}

		localName(id) {
			return this._name + "." + id;
		}

		create(id, delay, reps, f) {
			id = this.localName(id);
			this._timers[id] = {name: id, delay: delay, reps: reps, func: f, index: 0};
			if(this.enabled) {
				timer.create(id, delay, reps, f);
			}
		}

		remove(id) {
			id = this.localName(id);
			delete this._timers[id];
			if(this.enabled) {
				timer.remove(id);
			}
		}

		exists(id) {
			return timer.exists(this.localName(id));
		}

		repsLeft(id) {
			return timer.repsLeft(this.localName(id));
		}

		update(id, delay, reps) {
			if(this._timers[id]) {
				if(delay) {this._timers[id].delay = delay}
				if(reps) {this._timers[id].repsLeft = reps}
				if(this.enabled) {
					timer.update(id, reps, delay);
				}
			}
		}

		// Create all timers in local table
		enable() {
			for(let id in this._timers) {
				var self = this._timers[id];
				timer.create(id, self.delay, self.reps, self.func, self.index);
			}
		}

		// remove all timers in local table
		disable() {
			for(let id in this._timers) {
				if(timer.exists(id)) {
					this._timers[id].reps = timer.repsLeft(id);
					this._timers[id].index = timer.curIndex(id);
				}
				timer.remove(id);
			}
		}
	}

	timer.TimerProxy = TimerProxy;

	return timer;
});
