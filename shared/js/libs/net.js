define(["helper"], function(helper) {

	var socket;
	var handlers = {};
	var callIDCounter = 0;

	function getCallID() {
		return callIDCounter++;
	}

	function netSend(name, callId, ...data) {
		socket.emit("BCP_NET", name, callId, ...data);
	}

	function netRecieve(name, callId, ...data) {
		var hs = handlers[name]; // Appropriate handlers
		if(!hs || Object.keys(hs).length == 0) return;

		var retVal = null;

		for(var id in hs) {
			var h = hs[id]; // Cur handler
			retVal = h.call(...data); // Use or-equals here to get first ret, currently gets last ret
			//if(retVal) break; // To enforce returning in a net is always exactly what is returned
		}

		[...ret] = retVal; // Unpack

		if(retVal && callId>=0) {
			netSend("response." + name + "." + callId, -1, ...ret);
		}

	}

	class NetHandler {
		id = "";
		name = "";
		#func = null;
		#callsLeft = -1;
		#enabled = true;
		constructor(name, id, f, calls) {
			this.name = name;
			this.id = id;
			this.#func = f;
			this.#callsLeft = calls || 0;
			if(!handlers[name]) handlers[name] = {};
			handlers[name][id] = this;
		}

		enable() {
			this.#enabled = true;
		}

		disable() {
			this.#enabled = false;
		}

		call(...data) {
			if(!this.#enabled) return;
			this.#callsLeft--;
			
			var ret = this.#func(...data);
			if(this.#callsLeft == 0) {
				delete handlers[this.name][this.id];
			}
			return ret;
		}
	}

	var net = {
		on: function(name, id, cb) {
			new NetHandler(name, id, cb);
		},
		off: function(name, id) {
			if(handlers[name] && handlers[name][id]) {
				delete handlers[name][id];
			}
		},
		once: function(name, id, cb) {
			new NetHandler(name, id, cb, 1);
		},
		times: function(name, id, calls, cb) {
			new NetHandler(name, id, cb, calls);
		},
		emit: function(name, ...data) {
			netSend(name, -1, ...data);
		},
		emitWithResponse: function(name, cb, ...data) {
			var id = getCallID()
			var resName = "response." + name + "." + id;
			net.once(resName, resName, cb);
			netSend(name, id, ...data)
		},
		setSocket: function(s) {
			socket = s;
			socket.on("BCP_NET", netRecieve);
			delete net.setSocket;
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