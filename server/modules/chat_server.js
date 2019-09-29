shared.chatRooms = shared.chatRooms || [ {name:"global", password:"", banned:[], admins:["Sam"], perm:true}, {name:"private", password:"pass", banned:[], admins:["Sam"], perm:true} ];

socket.on("getChatRooms", function(){
	var tab = {}
	for(var i=0; i<shared.chatRooms.length; i++){
		var roomName = shared.chatRooms[i].name;
		var room = io.sockets.adapter.rooms[roomName];
		if(room){
			tab[roomName] = room.length;
		} else {
			tab[roomName] = 0;
		}
	}
	socket.emit("getChatRoomsResponse", tab)
});

socket.on("joinChatRoom", function(encryptedData){
	var data = CryptoJS.AES.decrypt(encryptedData, key).toString(CryptoJS.enc.Utf8);
	data = JSON.parse(data);
	if(!utils.signedIn(user)){
		socket.emit("joinChatRoomResponse", 402);
		return;
	}
	var name = data.name;
	var pass = data.pass;
	for(var i=0; i<shared.chatRooms.length; i++){
		var room = shared.chatRooms[i];
		if(name == room.name){
			if(room.password == "" || pass == room.password){
				if(room.banned.indexOf(user.name) == -1){
					socket.join(room.name);
					socket.emit("joinChatRoomResponse", 200, room.name);
					io.to(room.name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has joined "+room.name, room:room.name});
				} else {
					socket.emit("joinChatRoomResponse", 403);
				}
			} else {
				socket.emit("joinChatRoomResponse", 401);
			}
			return;
		}
	}
	socket.emit("joinChatRoomResponse", 404);
});

socket.on("sendChatMessage", function(data){
	var msg = data.msg;
	var roomName = data.room;
	var room;
	for(var i=0; i<shared.chatRooms.length; i++){
		if(roomName == shared.chatRooms[i].name){
			room = shared.chatRooms[i]
		}
	}
	if(room){
		if(Object.keys(socket.rooms).indexOf(room.name) != -1){
			if(msg.substring(0, 6) == "/kick "){
				if(room.admins.indexOf(user.name) == -1){return;}
				var userName = msg.substring(6);
				emitter.emit("kick", room.name, userName);
			} else if(msg.substring(0, 5) == "/ban "){
				if(room.admins.indexOf(user.name) == -1){return;}
				var userName = msg.substring(5);
				room.banned.push(userName);
				emitter.emit("kick", room.name, userName);
			} else if(msg.substring(0, 7) == "/unban "){
				var userName = msg.substring(7);
				var idx = room.banned.indexOf(userName);
				if(idx > -1){room.banned.splice(idx, 1)}
			} else {
				var txt = "["+room.name+"] - "+user.name+": "+msg;
				socket.broadcast.to(room.name).emit("chatMessage", {msg:txt, room:room.name});
			}
		}
	}
	
});

function leaveRoom(roomName){
	socket.leave(roomName);
	var room = io.sockets.adapter.rooms[roomName];
	
	if(room == undefined || room.length == 0){
		for(var i=0; i<shared.chatRooms.length; i++){
			if(shared.chatRooms[i].name == roomName){
				if(!shared.chatRooms[i].perm){
					shared.chatRooms.splice(i, 1);
				}
				break;
			}
		}
	}

}

emitter.on("logout", function(e) { 
	if(e.socket.id == socket.id){
		var rooms = shared.chatRooms
		var leftRoom = false;
		for(var i=0; i<rooms.length; i++){
			if(socket.rooms[rooms[i].name]){
				io.to(rooms[i].name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has left "+rooms[i].name, room:rooms[i].name});
				leftRoom = true;
			}
			leaveRoom(rooms[i].name);

		}
		if(leftRoom){
			socket.emit("leaveRoomResponse", 201)
		}
	}
});

emitter.on("kick", function(roomName, name){
	if(user.name == name){
		var room;
		for(var i=0; i<shared.chatRooms.length; i++){
			if(roomName == shared.chatRooms[i].name){
				room = shared.chatRooms[i]
			}
		}
		if(room){
			if(Object.keys(socket.rooms).indexOf(room.name) != -1){
				leaveRoom(room.name);
				io.to(room.name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has left "+room.name, room:room.name});
				socket.emit("leaveRoomResponse", 202, room.name);
			}
		}
	}
});

socket.on("leaveRoom", function(roomName){
	if(roomName == "ALL"){
		var rooms = shared.chatRooms
		for(var i=0; i<rooms.length; i++){
			if(socket.rooms[rooms[i].name]){
				io.to(rooms[i].name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has left "+rooms[i].name, room:rooms[i].name});
			}
			leaveRoom(rooms[i].name);	
		}
		socket.emit("leaveRoomResponse", 201)
	} else {
		var room;
		for(var i=0; i<shared.chatRooms.length; i++){
			if(roomName == shared.chatRooms[i].name){
				room = shared.chatRooms[i]
			}
		}
		if(room){
			if(Object.keys(socket.rooms).indexOf(room.name) != -1){
				leaveRoom(room.name);
				io.to(room.name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has left "+room.name, room:room.name});
				socket.emit("leaveRoomResponse", 200, room.name);
			}
		} else {
			socket.emit("leaveRoomResponse", 404)
		}
	}
});

socket.on("createRoom", function(data){
	var roomName = data.roomName;
	var pass = data.pass;
	if(utils.hasPerm(user, "createChat")){
		var taken = false;
		for(var i=0; i<shared.chatRooms.length; i++){
			var room = shared.chatRooms[i];
			if(room.name == roomName){
				taken = true;
			}
		}
		if(!taken){
			shared.chatRooms.push({name:roomName, password:pass, banned:[], admins:[user.name], perm:false});
			var room = shared.chatRooms[shared.chatRooms.length-1];
			socket.join(room.name);
			io.to(room.name).emit("chatMessage", {msg:"[SERVER] - User "+user.name+" has joined "+room.name, room:room.name});
			socket.emit("createRoomResponse", 200, room.name)
		} else {
			socket.emit("createRoomResponse", 409);
		}
	} else {
		socket.emit("createRoomResponse", 403);
	}
});

socket.on("disconnecting", function(){
	for(var i=0; i<shared.chatRooms.length; i++){
		var room = shared.chatRooms[i];
		if(Object.keys(socket.rooms).indexOf(room.name) != -1){
			io.to(room.name).emit("chatMessage", {msg:"[#00ff00][SERVER] - User "+user.name+" has left "+room.name, room:room.name});
		}
		leaveRoom(room.name);
	}
})