/* usage:
	chat - lists chat rooms [complete]
	chat join - joins global room [complete]
	chat join name - joins group with name if exists [complete]
	chat create name - creates room with specified name and joins it [complete]
	chat leave - leaves all chats [complete]
	chat leave name - leaves chat [name] [complete]
			also leave all rooms on logout! [complete]

	/ban [username] [complete]
	/kick [username] [complete]

	chat talk [chatname] - chatname can be blank if only in 1 chat - this enters talk mode, constantly inputting
							while in this mode, use /leave to exit mode [complete]

	flags/switches:
		--talk - goes straight to talk when joining/creating [complete]
		-pass password - used for creating/joining rooms that need password to join [complete]


	upon join:
	 log: User [name] has joined the chat [complete]

	write usage info! [complete]
*/

var rooms = [];
var room = "";
var toTalk = false;

const ownColor = [135,206,250];
const otherColor = [200,200,200]


registerCommand("chat", "Online chat room system", {
	usage: "chat list\n"+
	"chat join\n"+
	"chat join [chatname]:String\n"+
	"chat leave\n"+
	"chat leave [chatname]:String\n"+
	"chat talk\n"+
	"chat talk [chatname]:String\n"+
	"chat create [chatname]:String\n",
	switches: {
		talk: false
	},
	flags: {
		pass: ""
	}
}, function(args, options){
	if(args.length < 1){
		endCommand(-2);
		return;
	}
	var type = args[0];
	switch(type){
		case "list":
			writeLine("Chat rooms open:");
			socket.emit("getChatRooms");
		break;
		case "join":
			var roomName = args[1] || "global";
			if(args.length > 2){
				endCommand(-2)
				return;
			}
			var pass = options.flags.pass || ""
			var dataTab = {name:roomName, pass:pass}
			var data = JSON.stringify(dataTab);
			toTalk = options.switches.talk;
			var encryptedData = CryptoJS.AES.encrypt(data, key).toString();
			socket.emit("joinChatRoom", encryptedData);
		break;
		case "talk":
			var roomName = args[1]
			if(rooms.length == 0){
				writeLine("You are not in any chat rooms");
				endCommand(0);
				return;
			}
			if(!roomName && rooms.length == 1){
				roomName = rooms[0]
			}
			if(!roomName){
				writeLine("No room specified");
				endCommand(0);
				return;
			}
			if(rooms.indexOf(roomName) == -1){
				writeLine("You are not in this room");
				endCommand(0);
				return;
			}
			room = roomName;
			writeLine("Type /leave to leave talk mode");
			chat();
		break
		case "leave":
			var roomName = args[1];
			if(rooms.length == 0){
				writeLine("You are not in any chat rooms");
				endCommand(0);
				return;
			}
			if(!roomName){
				roomName = "ALL"
			} else {
				if(rooms.indexOf(roomName) == -1){
					writeLine("You are not in this room");
					endCommand(0);
					return;
				}
			}

			socket.emit("leaveRoom", roomName);

		break;
		case "create":
			if(args.length!=2){
				endCommand(-2);
				return;
			}
			var roomName = args[1];
			toTalk = options.switches.talk;
			socket.emit("createRoom", {roomName:roomName, pass:options.flags.pass});
		break
		default:
			writeLine("Invalid mode, see 'help chat'")
			endCommand(0);
		break;
	}
});
var readingInput = false;
function chat(){
	setTextColor(...ownColor)
	readingInput = true;
	readInput("", function(msg) {
		readingInput = false;
		setTextColor(255,255,255)
		setTextBackgroundColor(0,0,0,0)
		if(msg == "/leave"){
			writeLine("No longer chatting, use 'chat leave' to leave the room.")
			endCommand(1);
		} else {
			var txt = "["+room+"] - "+username+": "+msg;
			socket.emit("sendChatMessage", {room:room, msg:msg});
			chat();
		}
	}, {prefix:"["+room+"] - "+username+": ", forbidEmpty:true, allowSpecialCharacters:true});
}

socket.on("getChatRoomsResponse", function(data){
	for(var roomName in data){
		writeLine("   "+roomName+": "+data[roomName] +" user(s) online");
	}
	endCommand(1);
});

socket.on("joinChatRoomResponse", function(status, roomName){
	if(status == 200){
		writeLine("Successfully joined chat room "+roomName);
		rooms.push(roomName);
		if(toTalk){
			room = roomName;
			writeLine("Type /leave to leave talk mode");
			chat();
		}
		endCommand(1);
	} else {
		if(status == 401){
			writeLine("Incorrect password.");
		} else if(status == 403){
			writeLine("You are banned from this chat room");
		} else if(status == 404){
			writeLine("This chat room does not exist");
		} else if(status == 402){
			writeLine("You must be signed in to join a chat room");
		}
		endCommand(0);
	}
});

socket.on("chatMessage", function(data){
	txt = data.msg;
	room = data.room
	setTextColor(...otherColor)
	writeLine(txt, true);
	if(readingInput){
		setTextColor(...ownColor)
	} else {
		setTextColor(255,255,255)
	}
	updateInput();
});

socket.on("leaveRoomResponse", function(status, roomName){
	setTextColor(255,255,255)
	setTextBackgroundColor(0,0,0,0)
	if(status == 200){
		writeLine("Successfully left room "+roomName);
		var idx = rooms.indexOf(roomName);
		if(idx > -1){
			rooms.splice(idx, 1);
		}
		endCommand(1);
	} else if(status == 201){
		writeLine("Successfully left all rooms");
		rooms = [];
		endCommand(1);
	} else if(status == 202){
		writeLine("You were kicked from room "+roomName);
		var idx = rooms.indexOf(roomName);
		if(idx > -1){
			rooms.splice(idx, 1);
		}
		if(room == roomName){
			stopRead();
		}
		endCommand(1);
	} else if(status == 404){
		writeLine("Room with that name could not be found");
		endCommand(0);
	}
});

socket.on("createRoomResponse", function(status, roomName){
	if(status == 200){
		writeLine("Chat room "+roomName+" created and joined");
		rooms.push(roomName);
		if(toTalk){
			room = roomName;
			writeLine("Type /leave to leave talk mode");
			chat();
		}
		endCommand(1);
	} else {
		if(status == 403){
			writeLine("ERROR, you do not have permission to run this command");
		} else if(status == 409){
			writeLine("A chat with this name already exists");
		}
		endCommand(0);
	}
});