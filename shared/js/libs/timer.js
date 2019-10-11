/*
Timer library that calls a function every x seconds, reps times
timer.create(uniqueID, delay, reps, f)
if reps 0, runs infinite times
delay in seconds
f takes in rep number

timer.remove/timer.stop(uniqueID)

timer.repsLeft(uniqueID) -- repititions left

timer.exists

TimerProxy, same as timer lib, but adds enable and disable, acts same as EmitterProxy
*/


var timers = {};

define(["helper"], function (helper) {
	class Timer {
		index = 0;
		func = null;
		id = -1;
		delay = 0;
		repsLeft = 0;
		interval = null;
		firstDelay = 1.5;
		nextCall = -1;
		constructor(id, delay, reps, f, startIndex) {
			if(startIndex) { this.index = startIndex; }
			this.id = id;
			this.delay = delay;
			this.repsLeft = reps;
			this.func = f;
			timers[id] = this;
			this.makeInterval();
		}

		remove() {
			this.clearInterval();
			delete timers[this.id];
		}

		clearInterval() {
			if(this.interval) {
				clearInterval(this.interval);
			}
		}

		makeInterval() {
			// create interval itself
			var self = this;
			// calculate time interval is next called for working out "time til next call" later
			this.nextCall = Date.now() + this.delay * 1000;
			// Can't use "this" in interval func, as it becomes "window", so store as a local var and pass it in
			// Kinda gross, but other option is anonymous func, which is gross
			// Take firstDelay if its defined, else just delay
			this.interval = setInterval(function() { 
				self.intervalFunc(self); 
			}, (this.firstDelay > 0 ? this.firstDelay : this.delay) * 1000);
		}

		restartInterval() {
			self.clearInterval();
			self.makeInterval();
		}

		intervalFunc(self) {
			self.repsLeft--;
			// Calc next interval call time
			self.nextCall = Date.now() + self.delay * 1000;

			self.func(self.index++);
			// If negative, must have started at 0 to not be caught by if below, so run infinitely

			// If firstDelay set, reset it and restart interval
			if( self.firstDelay > 0 ) {
				self.firstDelay = -1;
				if(self.repsLeft > 0) {
					self.restartInterval()
				}
			}

			if(self.repsLeft < 0) { return; }
			// If less than 1 (0), its done, remove the timer
			if(self.repsLeft < 1) {
				self.remove();
			}
		}

		// Update data and restart interval
		update(delay, reps) {
			if(delay) { this.delay = delay; }
			if(reps) { this.repsLeft = reps; }
			this.restartInterval();
		}

		// set firstDelay to time until next call, for when its enabled again
		disable() {
			this.clearInterval();
			this.firstDelay = (this.nextCall - Date.now()) / 1000;
		}
		enable() {
			this.makeInterval();
		}
	}

	var timer = {
		create: function(id, delay, reps, f, startIndex) {
			// Remove old if it exists
			if (timers[id]) {
				timers[id].remove();
			}

			// create table entry
			return new Timer(id, delay, reps, f, startIndex);
		},
		// Other name for remove
		stop: function(id) { timer.remove(id); },
		remove: function(id) {
			if(timers[id]) {
				// Clear and delete
				timers[id].remove();
				delete timers[id];
				return true;
			} else {
				return false;
			}
		},
		exists: function(id) {
			return timers[id] ? true : false
		},
		// if delay passed in, replace and recreate interval. If reps pass in as well, replace as well
		update: function(id, delay, reps) {
			if(timers[id]) {
				timers[id].update(delay, reps);
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
		},
		getTimer: function(id) {
			return timers[id];
		}
	}

	class TimerProxy {
		constructor(name) {
			this._name = name;
			this._timers = [];
			this.enabled = false;
		}

		localName(id) {
			return this._name + "." + id;
		}

		create(id, delay, reps, f) {
			if(!this.enabled) return;
			id = this.localName(id);
			this._timers.push(timer.create(id, delay, reps, f));
		}

		// Get timer, delete it then remove from this._timers
		remove(id) {
			if(!this.enabled) return;
			id = this.localName(id);
			var t = timer.getTimer(id);
			if(!t) return;
			t.remove();
			helper.removeByValue(this._timers, t);
		}

		exists(id) {
			return timer.exists(this.localName(id));
		}

		repsLeft(id) {
			return timer.repsLeft(this.localName(id));
		}

		// Get timer, check it belongs to this proxy, then update
		update(id, delay, reps) {
			if(!this.enabled) return;
			var t = timer.getTimer(this.localName(id));
			if(t && this._timers.indexOf(t) != -1) {
				timer.update(id, reps, delay);
			}
		}

		// Create all timers in local table
		enable() {
			this.enabled = true;
			for(let t of this._timers) {
				t.enable();
			}
		}

		// remove all timers in local table
		disable() {
			this.enabled = false;
			for(let t of this._timers) {
				t.disable();
			}
		}

		removeAll() {
			for(let t of this._timers) {
				timer.remove(t.id);
			}
			this._timers = [];
		}
	}

	timer.TimerProxy = TimerProxy;

	return timer;
});
