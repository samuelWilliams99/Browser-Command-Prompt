define(["helper"], function(helper) {

	class NetHandler {
		id = "";
		#func = null;
		#callsLeft = -1;
		#enabled = true;
		constructor(id, f, calls) {

		}
	}

	var net = {
		on: function(name, id, cb) {

		},
		off: function(name, id) {

		},
		once: function(name, id, cb) {

		},
		times: function(name, id, calls, cb) {

		},
		emit: function(name, ...data) {

		}
	}

	class NetProxy {
		constructor(name) {

		}
		on(name, id, cb) {

		}
		off(name, id) {

		}
		once(name, id, cb) {

		}
		times(name, id, calls, cb) {

		}
		emit(name, ...data) {

		}
		enable() {

		}
		disable() {

		}
		removeAll() {

		}
	}

	net.NetProxy = NetProxy;

	return net;
});