const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const fs = require('fs');
const CryptoJS = require("crypto-js");
var bcrypt = require('bcrypt');
const saltRounds = 10;
const EventEmitter = require('events');
const emitter = new EventEmitter();
//var gitCommits = require('git-commits');
var path = require('path');
var repoPath = path.resolve(process.env.REPO || (__dirname + '/.git'));


const mongodb = require('mongodb');
var uri = 'mongodb://heroku_rdx4b4gf:ruq35nk93jso06tgg44n30rrgk@ds231090.mlab.com:31090/heroku_rdx4b4gf';
var dbName = 'heroku_rdx4b4gf';

const PORT = process.env.PORT || 5000

var dirData;

var keys = [];

var dbClient;
var db;
var userDb = {};
var metaDb = {};
var fileDb = {};

var procArgs = process.argv.slice(2);
var ver = "";
var fileStruct = {};

var globalVars = {}

//connect to db :)
mongodb.MongoClient.connect(uri, { useNewUrlParser: true }, function(err, client) {
	if(err) throw err;
	dbClient = client
	db = dbClient.db(dbName)
	utilFuncs.setTab(userDb, db.collection('userData'));
	utilFuncs.setTab(metaDb, db.collection('metadata'));
	utilFuncs.setTab(fileDb, db.collection('fileData'));
	emitter.emit("gotDbInfo");
	metaDb.findOne({type:"projectInfo"}, function(err, result){
		var segs = result.ver.split(".")
		for(var i=0; i<segs.length; i++){
			segs[i] = parseInt(segs[i]);
		}
		if(procArgs[0] == "push"){
			segs[2] = 0
			segs[1] += 1
		} else {
			segs[2] = segs[2] + 1
		}
		ver = segs.join(".");
		io.sockets.emit("ver", ver);

		metaDb.updateOne({}, {
			$set: {"ver": ver}
		}, function(err, res) {});

	});
	metaDb.findOne({type:"fileStructure"}, function(err, result){
		if(err) throw err;
		utilFuncs.setTab(fileStruct, JSON.parse(result.structure));
		emitter.emit("gotFileData");
	})

});

/*var commits = [];

gitCommits(repoPath, {}).on('data', function(commit) {
	commits.push(commit.title);
}).on('error', function(err) {
	throw err;
}).on('end', function() {
  	globalVars.commits = commits;
});*/


//NOT MINE:
function makeid(len) {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < len; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	return text;
}

//END



app.get('/', function(req, res){
	res.sendFile(__dirname + '/client/index.html');
	app.use(express.static(__dirname + '/client'));
});

app.get('/wakemydyno.txt', function(req, res){
	res.sendFile(__dirname + '/server/wakemydyno.txt');
});


function getRunnable(path, inputArgs, ...args){
	var extraArgs = [...args]
	return new Promise(function (fulfill, reject){
		fs.readFile(path, (err, data) => {
			if(err) {
				throw err;
				reject(err);
			} else {
				data = "function run("+inputArgs.join(", ")+"){" + data + "}";
				eval(data)
				fulfill({run:run, args:extraArgs});
			}
		});
	});
}

utilFuncs = {
	clearTab: function(tab){
		for(var prop in tab){
			delete tab[prop];
		}
	},
	setTab: function(dest, src){
		for(var prop in dest){
			delete dest[prop];
		}
		for(var prop in src){
			dest[prop] = src[prop];
		}
	},
	hasPerm: function(user, perm) {
		if(utilFuncs.signedIn(user)) {
			var clientPerms = user.perms
			if(clientPerms == undefined || clientPerms == null){return false;}
			return (clientPerms.indexOf("ALL") != -1) || (clientPerms.indexOf(perm) != -1);
		} else {
			return false;
		}
	},
	signedIn: function(user) {
		return Object.keys(user).length != 0;
	}
}

var filesToAdd = [];
var scripts = {};
var loaded = false;

fs.readdir("./server/modules", function(err, files){
	for(var i=0; i<files.length;i++){
		var filename = files[i];
		if(filename.indexOf("_server.js") != -1){
			var moduleName = filename.slice(0,-10)
			filesToAdd.push(moduleName);
		}
	}

	for(var i=0; i<filesToAdd.length; i++){
		var name = filesToAdd[i]
		getRunnable("server/modules/"+name+"_server.js", ["socket", "key", "user", "userDb", "shared", "utils", "io", "emitter", "fileStruct", "globalVars", "fileDb"], name).then(function(data){
			var run = data.run;
			var name = data.args[0];
			scripts[name] = {run:run, shared:{}};
			console.log("Loaded "+name);
			if(Object.keys(scripts).length == filesToAdd.length){
				console.log("All scripts loaded");
				loaded = true;
			}
		});
	}
});



io.on('connection', function(socket){
	if(!loaded){
		console.log("Rejected connection as still loading")
		return;
	}
	socket.emit("modules", filesToAdd);
	console.log("Connect id: "+socket.id);
	keys[socket.id] = makeid(20);

	

	var user = {};

	function hasPerm(perm) {return utilFuncs.hasPerm(user, perm)}
	function signedIn() {return utilFuncs.signedIn(user)}

	if(ver){
		socket.emit("ver", ver);
	}

	socket.on("getKey", function(){
		socket.emit("sendKey", keys[socket.id]);
	});


	for(var name in scripts){
		scripts[name].run(socket, keys[socket.id], user, userDb, scripts[name].shared, utilFuncs, io, emitter, fileStruct, globalVars, fileDb);
	}

	socket.on('disconnect', function() {
		keys[socket.id] = null;
		console.log("Disconnect id: "+socket.id);
	});



});


http.listen(PORT, function(){
  	console.log('listening on *:'+PORT);
});

process.stdin.resume();//so the program will not close instantly

function exitHandler(options, err) {
    if (options.cleanup) {closeConnection(); process.exit();}
    if (err) {console.log(err.stack); closeConnection(); process.exit();}
    if (options.exit) { closeConnection(); process.exit(); }
}

function closeConnection() {
	if(dbClient != undefined){
		dbClient.close(function (err) {
			if(err) throw err;
		});
	}
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));