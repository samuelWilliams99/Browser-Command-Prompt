socket.on("getPerms", function(name){
	userDb.findOne({name:name}, function(err, result){
		if(err) throw err;
		if(result){
			var data = ["none"];
			if(result.perms && result.perms.length > 0){
				data = result.perms
			}
			socket.emit("getPermsResponse", 200, data);
		} else {
			socket.emit("getPermsResponse", 404)
		}
	});
});
socket.on("changePerm", function(data){
	if(!utils.hasPerm(user, "editPerm")){
		socket.emit("changePermResponse", 403);
	} else {
		var perm = data.perm;
		var names = data.names.split(",");
		var mode = data.mode;
		var query;
		var action;
		var res = {};
		if(data.exclude){
			query = {name: {$nin: names}};
		} else {
			query = {name: {$in: names}};
		}
		if(mode == "add"){
			action = {$addToSet: {"perms": perm}}
		} else if(mode == "rem") {
			action = {$pull: {"perms": perm}}
		} else if(mode == "clear") {
			action = {$set: {"perms": []}}
		}
		userDb.updateMany(query, action, function(err, result){
			if(err) throw err;
			socket.emit("changePermResponse", 200, result.result.nModified);
		})
	}
});