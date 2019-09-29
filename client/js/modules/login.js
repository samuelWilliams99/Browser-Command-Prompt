let key = "";

var username;

var waitingOnLoginResponse = false;
var waitingOnRegResponse = false;
var waitingOnChangePassResponse = false;

var pendingUsername = null;

var regUsername;
var regPword;

socket.emit("getKey");

function getKey(){return key};

registerCommand("login", "Login for access rights", {
	flags:{
		name:"",
		pass:"",
	}
}, function(args, options){
	if(args.length > 0){
		endCommand(-2)
		return
	}
	var flags = options.flags
	if(username){
		writeLine("Already logged in as "+username+", run logout to change account");
		endCommand(0);
		return
	}

	var pword;

	function nameCb(val) {
		username = val;
		if(flags.pass){
			pwordCb(flags.pass);
		} else {
			writeRaw("Password: ");
			readInput("*", pwordCb);
		}
	}

	function pwordCb(val2){
		pword = val2;
		var dataTab = {name:username, password:pword};
		var data = JSON.stringify(dataTab);
		var encryptedData = CryptoJS.AES.encrypt(data, key).toString();
		socket.emit("loginData", encryptedData);
		waitingOnLoginResponse = true;
	}

	if(flags.name){
		nameCb(flags.name)
	} else {
		writeRaw("Name: ");
		readInput("", nameCb)
	}
});

registerCommand("gethash", "Gets the hash of a string", function(args){
	if(args.length!=1){
		endCommand(-2)
		return
	}
	var str = args[0]
	var dataTab = {password:str};
	var data = JSON.stringify(dataTab);
	var encryptedData = CryptoJS.AES.encrypt(data, key).toString();
	socket.emit("gethash", encryptedData)
});

registerCommand("logout", "Logout of user account", function(args){
	if(args.length > 0){
		endCommand(-2)
		return
	}
	if(username){
		writeLine("Logging out...")
		socket.emit("logout")
	} else {
		writeLine("Not currently logged into any account")
		endCommand(0);
	}
});

registerCommand("account", "Get user account data", {
	usage: "account\n"+
	"account [name]:String"
},function(args) {
	if(args.length > 1){
		endCommand(-2)
		return
	}
	var name = args[0] || username
	if(!name){
		writeLine("Cannot get own account info when not logged in");
		endCommand(0);
		return;
	}
	socket.emit("getAccount", name);
});

registerCommand("accounts", "List all user account names", function(args){
	if(args.length>0){
		endCommand(-2);
		return;
	}
	socket.emit("getAccounts");
})

registerCommand("enablereg", "Allows registration for a given username (admin only)", {
	usage:"enablereg [name]:String"
}, function(args){
	if(args.length != 1){
		endCommand(-2)
		return
	}
	var name = args[0]
	pendingUsername = name;
	socket.emit("enableReg", name);
});

registerCommand("register", "Register an account", {
	flags:{
		name:""
	}
}, function(args, options){
	if(args.length > 0){
		endCommand(-2)
		return
	}
	var flags = options.flags
	if(username){
		writeLine("Already logged in as "+username+", run logout to change account");
		endCommand(0);
		return
	}

	var regPword;

	function nameCb(val){
		regUsername = val;
		writeRaw("Password: ");
		readInput("*", function(val2) {
			regPword = val2;
			writeRaw("Retype password: ")
			readInput("*", function(val3) {
				if(val3 != regPword){
					writeLine("Passwords do not match");
					endCommand(0);
					return
				}
				var dataTab = {name:regUsername, password:regPword};
				var data = JSON.stringify(dataTab);
				var encryptedData = CryptoJS.AES.encrypt(data, key).toString();
				socket.emit("regData", encryptedData);
				waitingOnRegResponse = true;
			});
		});
	}

	if(flags.name){
		nameCb(flags.name)
	} else {
		writeRaw("Name: ");
		readInput("", nameCb)
	}
	
});

registerCommand("changepass", "Change current account password", {
	flags:{
		pass:""
	},
}, function(args, options){
	if(args.length > 0){
		endCommand(-2)
		return
	}
	var flags = options.flags

	var oldPass;
	var newPass;

	function passCb(val){
		oldPass = val;
		writeRaw("Password: ");
		readInput("*", function(val2) {
			newPass = val2;
			writeRaw("Retype password: ")
			readInput("*", function(val3) {
				if(val3 != newPass){
					writeLine("Passwords do not match");
					endCommand(0);
					return
				}
				var dataTab = {oldPass:oldPass, newPass:newPass};
				var data = JSON.stringify(dataTab);
				var encryptedData = CryptoJS.AES.encrypt(data, key).toString();
				socket.emit("changePassData", encryptedData);
				waitingOnChangePassResponse = true;
			});
		});
	}

	if(flags.pass){
		passCb(flags.pass)
	} else {
		writeRaw("Old Password: ");
		readInput("*", passCb)
	}
});

$(document).ready(function() {
	socket.on("sendKey", function(data){
		key = data;
		username = null;
		ready("key");
	});

	socket.on("enableRegResponse", function(status){
		if(status == 403){
			writeLine("ERROR, you do not have permission to run this command");
			endCommand(0);
		} else if(status == 409) {
			writeLine("ERROR, username conflict, this username is already taken");
			endCommand(0);
		} else if(status == 200) {
			writeLine("Successfully added username "+pendingUsername+" to authorized account names");
			endCommand(1);
		} else if(status == 500) {
			writeLine("ERROR, unknown internal server error");
			endCommand(0);
		}
	});

	socket.on("loginResponse", function(success){
		if(waitingOnLoginResponse){
			if(success){
				writeLine("Successfully logged in as "+username);
				endCommand(1);
			} else {
				writeLine("Login fail, incorrect name/password");
				username = null;
				endCommand(0);
			}
		}
	});

	socket.on("gethashres", function(hash){
		writeLine("Hash: " + hash);
		endCommand(1);
	})

	socket.on("logoutResponse", function(success){
		username = null;
		if(success){
			writeLine("Successfully logged out")
			endCommand(1);
		} else {
			writeLine("An error occured.")
			endCommand(0);
		}
	});

	socket.on("getAccountResponse", function(status, dataStr){
		if(status == 404){
			writeLine("User could not be found");
			endCommand(0);
		} else {
			var data = JSON.parse(dataStr)
			if(data.id != undefined){
				writeLine("Account ID: "+data.id);
				writeLine("Account name: "+data.name);
				writeLine("Perms: "+data.perms);
				endCommand(1);
			} else {
				writeLine("Not currently logged in");
				endCommand(0);
			}
		}
	});

	socket.on("getAccountsResponse", function(data){
		writeLine("User accounts:");
		writeLine(data.join(", "))
		endCommand(1);
	})

	socket.on("regResponse", function(status, name){
		if(status == 403) {
			writeLine("This username has not been authorized, contact an administrator to authorize a username");
			endCommand(0);
		} else if(status == 409){
			writeLine("This username is already taken");
			endCommand(0);
		} else if(status == 500){
			writeLine("An unknown internal server error occured");
			endCommand(0);
		} else if(status == 200){
			writeLine("Successfully created account "+name+" and logged in.");
			endCommand(1);
			username = name;
		}
	});

	socket.on("changePassResponse", function(status){
		if(waitingOnChangePassResponse){
			if(status == 200){
				writeLine("Password successfully changed")
				endCommand(1);
			} else {
				if(status == 403){
					writeLine("Old password was incorrect");
				} else if(status == 404){
					writeLine("Not currently logged in");
				}
				endCommand(0);
			}
		}
	});
});