var timers = {};

define(["helper"], function (helper) {
	var timer = {
		create: function(id, delay, reps, f) {
			var didReplace = false;
			if (timers[id]) {
				timer.remove(id);
				didReplace = true;
			}
			timers[id] = {name: id, index: 0, repsLeft: reps, delay: delay, func: f};
			var self = timers[id];
			timers[id].interval = setInterval(function() { 
				self.repsLeft--;
				self.func(self.index);
				self.index++;
				if(self.repsLeft < 0) { return; }
				if(self.repsLeft < 1) {
					timer.remove(self.name);
				}
			}, delay * 1000);
			return didReplace;
		},
		stop: function(id) {timer.remove(id); },
		remove: function(id) {
			if(timers[id]) {
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
			this._timers[id] = {name: id, delay: delay, reps: reps, func: f};
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

		enable() {
			if(this._prevTimers) {
				this._timers = this._prevTimers;
			}
			for(let id in this._timers) {
				var self = this._timers[id];
				timer.create(id, self.delay, self.reps, self.func);
			}

			this._prevTimers = helper.clone(this._timers);
		}

		disable() {
			for(let id in this._timers) {
				timer.remove(id);
			}
		}
	}

	timer.TimerProxy = TimerProxy;

	return timer;
});