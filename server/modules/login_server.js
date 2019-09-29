shared.pendingNames = shared.pendingNames || [];



socket.on("loginData", function(encryptedData){
	var data = CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
	data = JSON.parse(data);
	var name = data.name
	var pword = data.password;

	userDb.findOne({name:name}, function(err, result){
		if(err) throw err;

		if(result == null){
			socket.emit("loginResponse", false);
		} else {
			bcrypt.compare(pword, result.hash, function(err, res) {
			    if(res){
			    	utils.setTab(user, result);
			    	console.log("Login to "+result.name)
			    }
			    socket.emit("loginResponse", res);
			});
		}

	});
	
});

socket.on("gethash", function(encryptedData){
	var data = CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
	data = JSON.parse(data);
	var pword = data.password;
	bcrypt.hash(pword, saltRounds, function(err, hash) {
		socket.emit("gethashres", hash);
	});
});

socket.on("logout", function(){
	if(utils.signedIn(user)){
		console.log("Logout as "+user.name)
		emitter.emit("logout", {socket:socket, user:user})
		socket.emit("logoutResponse", true);
	} else {
		socket.emit("logoutResponse", false);
	}
	utils.setTab(user, {});
});

socket.on("getAccount", function(name){
	var data = {};
	if(user && user.name == name){
		data.name = name;
		data.id = user._id;
		data.perms = ["none"];
		if(user.perms && user.perms.length > 0){
			data.perms = user.perms
		}
		data.perms = data.perms.join(',');
		socket.emit("getAccountResponse", 200, JSON.stringify(data));
	} else {
		userDb.findOne({name:name}, function(err, result){
			if(err) throw err;
			if(result == null){
				socket.emit("getAccountResponse", 404)
			} else {
				data.name = result.name;
				data.id = result._id;
				data.perms = ["none"];
				if(result.perms && result.perms.length > 0){
					data.perms = result.perms
				}
				data.perms = data.perms.join(',');
				socket.emit("getAccountResponse", 200, JSON.stringify(data));
			}
		});
	}
	
});

socket.on("getAccounts", function(){
	userDb.distinct('name', function(err, result){
		socket.emit("getAccountsResponse", result);
	})
});

socket.on("enableReg", function(name){
	if(utils.hasPerm(user, "enableReg")) {
		userDb.findOne({name:name}, function(err, result){
			if(err) throw err;
			if(result){
				socket.emit("enableRegResponse", 409);
			} else {
				if(shared.pendingNames.indexOf(name) == -1){
					shared.pendingNames.push(name);
				}
				socket.emit("enableRegResponse", 200);
			}
		});
	} else {
		socket.emit("enableRegResponse", 403);
	}
});

socket.on("regData", function(encryptedData){
	var data = CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
	data = JSON.parse(data);
	var name = data.name
	var pword = data.password;

	var idx = shared.pendingNames.indexOf(name)
	if(idx != -1) {
		shared.pendingNames.splice(idx, 1)
		bcrypt.hash(pword, saltRounds, function(err, hash) {
			var newUser = {name:name, hash:hash}
			userDb.insertOne(newUser, function(err, res){
				if(err) throw err;
				utils.setTab(user, newUser);
				console.log("Registration and login of "+user.name);
				socket.emit("regResponse", 200, user.name);
				

			});
		});
	} else {
		socket.emit("regResponse", 403);
	}
	
});

socket.on("changePassData", function(encryptedData){
	var data = CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
	data = JSON.parse(data);
	var oldPass = data.oldPass
	var newPass = data.newPass

	if(user != null){
		bcrypt.compare(oldPass, user.hash, function(err, res) {
		    if(res){
		    	bcrypt.hash(newPass, saltRounds, function(err, hash) {
		    		if(err) throw err;
		    		user.hash = hash
		    		userDb.updateOne({_id:user._id}, {
						$set: {"hash": hash}
					}, function(err, res) {
						socket.emit("changePassResponse", 200)
					});
		    	});
		    } else {
		    	socket.emit("changePassResponse", 403);
		    }
		});
	} else {
		socket.emit("changePassResponse", 404)
	}
	
	
})

