/*
cmds:
	cd [complete]
	dir [complete]
	mkdir [complete]
	touch [complete]
	rmdir [complete]
	del  		for files
	copy		for files or directories
	paste 		"						"
	drives [complete]


*/

var driveInfo = {
	G: "Global drive, permission required to edit",
	C: "Client drive, wiped upon refresh/leaving page"
}

function setFilePath(newPath) {
	filePath = newPath;
	var drive = filePath[0].toUpperCase();
	var path = filePath.split(/[/\\]+/);
	path.shift(); // removes C:
	if(path[path.length-1] == ""){
		path.pop();
	}
	emitter.emit("ChangeShellPos", drive, path);
}

socket.on("gotFileData", function(curDir){
	setFilePath(curDir);
	ready("file");
})

registerCommand(["changedir", "chdir", "cd"], "Change directory", {
	usage: "changedir [dir]:String"
}, function(args, options){
	if(args.length != 1){
		endCommand(-2);
		return;
	}
	socket.emit("fileCd", args[0]);
})

registerCommand(["dir", "ls"], "Get current directory information", {}, function(args, options){
	if(args.length != 0){
		endCommand(-2);
		return;
	}
	socket.emit("fileDir")
});

registerCommand(["makedir", "mkdir"], "Make directory in current directory", {
	usage:"makedir [dirname]:String",
	switches: {
		move: false
	}
}, function(args, options){
	if(args.length != 1){
		endCommand(-2);
		return;
	}
	socket.emit("fileMakeDir", args[0], options.switches.move);
});

registerCommand(["touch", "makefile"], "Create an empty file in current directory", {
	usage:"touch [filename]:String"
}, function(args, options){
	if(args.length != 1){
		endCommand(-2);
		return;
	}
	socket.emit("makeFile", args[0]);
})

registerCommand(["removedir", "rmdir"], "Remove directory", {
	usage:"removedir [dirname]:String",
	switches: {
		force: false
	}
}, function(args, options){
	if(args.length != 1){
		endCommand(-2);
		return;
	}
	socket.emit("fileRemoveDir", args[0], options.switches.force);
});

registerCommand(["del", "rmfile", "removefile"], "Remove file", {
	usage:"removedir [dirname]:String",
}, function(args, options){
	if(args.length != 1){
		endCommand(-2);
		return;
	}
	socket.emit("removeFile", args[0]);
});

registerCommand("drives", "List all drives", function(args){
	if(args.length != 0){
		endCommand(-2);
		return;
	}
	var keys = Object.keys(driveInfo)
	for(var i=0; i<keys.length; i++){
		writeLine("    " + keys[i] + ": " + driveInfo[keys[i]]);
	}
	endCommand(1);
});

socket.on("fileCdResponse", function(status, data){
	if(status == 400){
		writeLine("ERROR: "+data);
		endCommand(0);
	} else {
		setFilePath(data);
		writeLine(" ");
		endCommand(1);
	}
})

socket.on("fileMakeDirResponse", function(status, data){
	if(status == 400) {
		writeLine("ERROR: "+data);
		endCommand(0);
	} else if(status == 200) {
		writeLine("Directory "+data+" created");
		endCommand(1);
	} else {
		setFilePath(data);
		writeLine(" ");
		endCommand(1);
	}
});

socket.on("makeFileResponse", function(status, data){
	if(status == 400) {
		writeLine("ERROR: "+data);
		endCommand(0);
	} else if(status == 200) {
		writeLine("File "+data+" created");
		endCommand(1);
	}
})

socket.on("getDirResponse", function(status, data){
	if(status == 400){
		writeLine("ERROR: "+data);
		endCommand(0);
	} else {
		var dirCount = 0;
		var fileCount = 0;
		for(var i=0; i<data.length; i++){
			var cur = data[i];
			var str;
			if(cur.type == "folder"){
				str = "    <DIR>"+(" ".repeat(12)) + cur.name;
				dirCount++;
			} else {
				str = (" ".repeat(21)) + cur.name;
				fileCount++;
			}
			writeLine(str);
		}
		writeLine( (" ".repeat(8)) + fileCount + " File(s)" );
		writeLine( (" ".repeat(8)) + dirCount + " Dir(s)" );
		endCommand(1);
	}
});

socket.on("fileRemoveDirResponse", function(status, data){
	if(status == 400){
		writeLine("ERROR: "+data);
		endCommand(1);
	} else {
		writeLine("Directory removed");
		endCommand(0);
	}
});

socket.on("dirForceChanged", function(path){
	setFilePath(path);
	setTextColor(255,0,0);
	writeLine("Force moved by directory removal");
	setTextColor(255,255,255);
});

socket.emit("fileReqData");