// Not yet used
socket.on("Lua_GetDir", function(args) {
	var path = args[0];
});

// Not yet used
socket.on("Lua_GetDirRaw", function(args) {
	var part = args[0];
	var path = args[1];
});

socket.on("Lua_GetFile", function(args) {
	var path = args[0];
	globalVars.file.fetchFile(path).then((ret) => {
		if(ret.errNo){
			if(ret.errNo == -4 && ret.remaining == 1) {
				socket.emit("Lua_Response", -4, "File/directory does not exist");
			} else {
				socket.emit("Lua_Response", -3, "Malformed file path");
			}
		} else {
			socket.emit("Lua_Response", {isFile:true, content:ret.content});
		}
	})
});

socket.on("Lua_SaveFile", function(args) {
	var path = args[0];
	var content = args[1];
	globalVars.file.saveFile(path, content).then((ret) => {
		if(ret.code == 200) {
			socket.emit("Lua_Response", 1);
		} else if(ret.code == 201) {
			socket.emit("Lua_Response", 2);
		} else {
			socket.emit("Lua_Response", -4, "Unknown error");
		}
	});
});