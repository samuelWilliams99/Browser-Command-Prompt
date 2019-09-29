shared.dirPos = shared.dirPos || {};
globalVars.file = globalVars.file || {};

var forbiddenCharacters = ["\\", "/", ":", "*", "?", "\"", "<", ">", "|", " "];

var hasData = false;
var gotReq = false;

var filesLoaded = Object.keys(fileStruct).length != 0;
if(filesLoaded){gotData();}
emitter.on("gotFileData", function() {
    if(!filesLoaded){
        filesLoaded = true; 
        gotData();
    }
});

var localDirData = {};
var localFiles = {};

function gotData(){
    if(gotReq){
        sendData();
    } else {
        hasData = true;
    }
}

function sendData(){
    setTimeout(function(){
        shared.dirPos[socket.id] = "C:/";
        socket.emit("gotFileData", shared.dirPos[socket.id]);
        socket.on("getDir", function(){
            socket.emit("sendDir", shared.dirPos[socket.id]);
        });
    }, 100);
}

socket.on("fileReqData", function(){
    if(hasData){
        sendData();
    } else {
        gotReq = true;
    }
})


socket.on("fileCd", function(path){
    var ret = setDirPos(path);
    if(ret.err){
        socket.emit("fileCdResponse", 400, ret.err);
    } else {
        socket.emit("fileCdResponse", 200, ret.newDir);
    }
})

socket.on("fileDir", function(){
    var path = shared.dirPos[socket.id];
    var ret = getDir(path);
    if(ret.err || ret.pathPos.isFile){
        socket.emit("getDirResponse", 400, ret.err || "Navigation error");
    } else {
        var info = [
            {
                name: ".",
                type: "folder"
            },
            {
                name: "..",
                type: "folder"
            }
        ];
        var keys = Object.keys(ret.pathPos);
        for(var i=0; i<keys.length; i++){
            info.push({
                name: keys[i],
                type: ret.pathPos[keys[i]].isFile ? "file" : "folder"
            })
        }
        info.sort(function(a,b){
            if(a.type == b.type){
                return (a.name > b.name) ? 1 : -1;
            } else {
                return (a.type != "folder") ? 1 : -1;
            }
        })
        socket.emit("getDirResponse", 200, info);
    }
});

socket.on("fileMakeDir", function(dirName, move){
    if(contains(dirName, forbiddenCharacters)){
        socket.emit("fileMakeDirResponse", 400, "Illegal character(s) in directory name");
        return;
    }
    var path = shared.dirPos[socket.id];
    var ret = getDir(path);
    if(ret.err || ret.pathPos.isFile){
        socket.emit("fileMakeDirResponse", 400, ret.err || "Navigation error");
    } else {
        if(ret.pathPos[dirName]){
            socket.emit("fileMakeDirResponse", 400, "File/directory already exists with that name");
        } else {
            switch(ret.drive){
                case "G":
                    if(!utils.hasPerm(user, "editFile")){
                        socket.emit("fileMakeDirResponse", 400, "ERROR, you do not have permission to run this command in G drive");
                        return;
                    }
                break;
                case "C":

                break;
            }
            ret.pathPos[dirName] = {};
            var newPath = shared.dirPos[socket.id];
            if(newPath.length != 3){ newPath += "/"}
            newPath += dirName;
            if(move){
                var ret = setDirPos(dirName);
                socket.emit("fileMakeDirResponse", 201, ret.newDir);
            } else {
                socket.emit("fileMakeDirResponse", 200, newPath);
            }
            if(ret.drive == "G"){
                updateDirDb();
            }

        }
    }
});

socket.on("makeFile", function(fileName){
    makeFile(fileName).then((ret) => {
        var data;
        [...data] = ret.data;
        socket.emit("makeFileResponse", ret.code, ...data);
    });
});

function makeFile(fileName, content) {
    return new Promise(function(accept, deny) {
        var ret = getDir(fileName);
        if(ret.err) {
            if(ret.errNo == -2 && ret.remaining == 1){
                var nameSplit = fileName.split(/[/\\]/)
                var filePath = fileName
                fileName = nameSplit[nameSplit.length-1]
                if(/^[\w_-]+\.[\w_-]+$/.test(fileName)) {
                    switch(ret.drive){
                        case "G":
                            if(!utils.hasPerm(user, "editFile")){
                                accept({code: 400, data: ["ERROR, you do not have permission to run this command in G drive"]});
                                return;
                            }

                            fileDb.insert({content: content || ""}, function(err, record){
                                ret.pathPos[fileName] = {isFile:true, id:record.insertedIds['0']}
                                updateDirDb();
                                accept({code: 200, data: [fileName]});
                            })
                        break;
                        case "C":
                            var id;
                            do {
                                id = makeid();
                            } while(localFiles[id] != null);
                            localFiles[id] = {content: content || ""}
                            ret.pathPos[fileName] = {isFile:true, id:id};
                            accept({code: 200, data: [fileName]});
                        break;
                    }
                } else {
                    accept({code: 400, data: ["Invalid file name"]});
                    return;
                }
            } else {
                accept({code: 400, data: [ret.err || "Navigation error"]});
                return;
            }
        } else {
            if(ret.pathPos.isFile) {
                accept({code: 400, data: ["File already exists with that name"]});
            } else {
                accept({code: 400, data: ["Directory already exists with that name"]});
            }
        }
    });
}
globalVars.file.makeFile = makeFile;

function saveFile(fileName, content) {
    return new Promise(function(accept, deny) {
        var ret = getDir(fileName);
        if(ret.err) {
            if(ret.errNo == -2 && ret.remaining == 1){
                makeFile(fileName, content).then((ret) => {
                    if(ret.code == 200) {
                        accept({code: 201, data:ret.data});
                    } else {
                        accept(ret);
                    }
                });
            } else {
                accept({code: 400, data: [ret.err || "Navigation error"]});
                return;
            }
        } else {
            if(ret.pathPos.isFile){
                switch(ret.drive) {
                    case "G":
                        if(!utils.hasPerm(user, "editFile")){
                            accept({code: 400, data: ["ERROR, you do not have permission to run this command in G drive"]});
                            return;
                        }
                        fileDb.updateOne({ "_id": mongodb.ObjectId(ret.pathPos.id)}, {$set: {"content": content}}).then((ret) => {
                            if(ret.matchedCount == 1){
                                accept({code: 200, data: []});
                            } else {
                                accept({code: 400, data: ["Internal navigation error"]});
                            }
                        });
                    break;
                    case "C":
                        localFiles[ret.pathPos.id].content = content;
                        accept({code: 200, data: []});
                    break;
                }
            } else {
                accept({code: 400, data: ["Invalid file"]});
                return;
            }
        }
    });
}
globalVars.file.saveFile = saveFile;

socket.on("fileRemoveDir", function(dirName, force){
    if(contains(dirName, forbiddenCharacters)){
        socket.emit("fileRemoveDirResponse", 400, "Illegal character(s) in directory name");
        return;
    }
    var path = shared.dirPos[socket.id];
    var oPath = path;
    if(path.length != 3){ path += "/"}
    path += dirName;
    var ret = getDir(path);
    if(ret.err || ret.pathPos.isFile){
        socket.emit("fileRemoveDirResponse", 400, ret.err || "Navigation error");
    } else {
        var path = ret.drive + ":/" + ret.path;

        if(ret.drive == "G"){
            if(!utils.hasPerm(user, "editFile")){
                socket.emit("fileRemoveDirResponse", 400, "ERROR, you do not have permission to run this command in G drive");
                return;
            }
            for(var sId in shared.dirPos){
                if(sId == socket.id){continue;}
                if(shared.dirPos[sId].indexOf(path) == 0){
                    if(!force){
                        socket.emit("fileRemoveDirResponse", 400, "Cannot remove, other client in this directory");
                        return;
                    } else {
                        emitter.emit("moveDir", {path:oPath, socket:sId});
                    }
                }
            }

            delete fileStruct[dirName];
            updateDirDb();
            socket.emit("fileRemoveDirResponse", 200);

        } else {

            delete localDirData[dirName];
            socket.emit("fileRemoveDirResponse", 200);
        }

        
        
    }
});

socket.on("removeFile", function(fileName){
    
})

emitter.on("moveDir", function(data){
    if(data.socket == socket.id){
        setDirPos(data.path);
        socket.emit("dirForceChanged", data.path);
    }
})



function contains(str, chars){
    for(var i=0; i<str.length; i++){
        if(chars.indexOf(str[i]) >= 0){
            return true;
        }
    }
    return false;
}

function getDir(path){
    if(path.length == 2 && path[1] == ":"){
        path = path[0] + ":/";
    }
    var idx = path.indexOf(":/");

    if(idx == -1){
        path = shared.dirPos[socket.id] + (shared.dirPos[socket.id].length == 3 ? "" : "/") + path;
        idx = path.indexOf(":/");
    }

    var pathPos;
    var drive;
    if(idx != -1 ){
        drive = path.substring(0, idx);
        path = path.substring(idx+2);
        if(drive.length == 1){
            switch(drive){
                case "G":
                    pathPos = fileStruct;
                break;
                case "C":
                    pathPos = localDirData;
                break;
                default:
                    return {err: "Drive '"+drive+"' does not exist", errNo: -2, drive:drive};
                    
                break
            }
        } else {
            return {err: "Invalid drive '"+drive+"'", errNo: -3, drive:drive};
        }
    } else {
        return {err: "Internal pathing error", errNo:-5};
    }

    var pathSplit = path.split("/");

    for(var i = 0; i<pathSplit.length; i++) {
        var cur = pathSplit[i];
        if(cur == "."){
            pathSplit.splice(i--, 1);
        } else if(cur == ".."){
            pathSplit.splice(Math.max(0, --i), 2);
            if(i) {
                i--;
            }
        }
    }

    if(pathSplit.length == 1 && pathSplit[0] == ""){pathSplit = []}

    path = pathSplit.join("/");

    for(var i = 0; i<pathSplit.length; i++) {
        var cur = pathSplit[i];
        if(!cur){
            return {err: "Empty folder name", errNo:-3, drive:drive, path:path}
        }
        if(contains(cur, forbiddenCharacters)){
            return {err: "Forbidden characters in path", errNo:-3, drive:drive, path:path};
        }
        if(pathPos[cur] && (!pathPos[cur].isFile || i == pathSplit.length-1)) {
            pathPos = pathPos[cur];
        } else {
            return {err: "Cannot find the path specified", errNo:-2, drive:drive, path:path, pathPos: pathPos, remaining: (pathSplit.length - i)}
        }
    }
    if(pathPos.isFile && !(/^[\w_-]+\.[\w_-]+$/.test(pathSplit[pathSplit.length-1])) ){
        return {err: "Invalid file name", errNo:-3, drive:drive, path:path};
    }
    return {pathPos: pathPos, drive:drive, path:path};

}

globalVars.file.getDir = getDir

function setDirPos(path){
    var ret = getDir(path);
    if(ret.err){
        return {err: ret.err}
    } else if(ret.pathPos.isFile){
        return {err: "Cannot find the path specified"}
    } else {
        var newDir =  ret.drive + ":/" + ret.path;
        shared.dirPos[socket.id] = newDir;
        return {newDir: newDir}
    }
}

function fetchFile(path) {
    return new Promise(function(accept, deny){

        var pathSplit = path.split(/[/\\]/)

        if(!(/^[\w_-]+\.[\w_-]+$/.test(pathSplit[pathSplit.length-1])) ){
            accept({err: "Invalid file name", errNo:-3});
            return;
        }

        var ret = getDir(path);
        if(ret.err || !ret.pathPos.isFile){
            if(!ret.err || ret.errNo == -2){ // If dir is not file, or couldnt get to dir
                accept({err: "No such file at '"+ret.drive+":/"+ret.path+"'", errNo: -4, remaining: ret.remaining});
            } else { // Else, things like bad string, etc.
                accept({err: ret.err, errNo: ret.errNo, remaining: ret.remaining});
            }
        } else {
            var pathPos = ret.pathPos
            switch(ret.drive){
                case "G":
                    fileDb.findOne({_id: mongodb.ObjectId(pathPos.id)}, function(err, result){
                        if(err) throw err;
                        if(!result){
                            console.log("ERROR: File structure data mismatch, when looking for file with id "+pathPos.fileId);
                            accept({err: "Internal file structure data mismatch", errNo: -5});
                        } else {
                            accept({content: result.content});
                        }
                    })
                break;
                case "C":
                    if(localFiles[pathPos.id]){
                        accept({content: localFiles[pathPos.id].content});
                    } else {
                        accept({err: "Internal file structure data mismatch", errNo: -5});
                    }
                break;
            }
        }
    });

}

globalVars.file.fetchFile = fetchFile

function updateDirDb(){
    metaDb.updateOne(
        {type:"fileStructure"},
        {$set: {"structure": JSON.stringify(fileStruct)}}
    );
}

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}