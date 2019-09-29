var getPermsName;

var perms = ["ALL", "enableReg", "editPerm", "createChat", "editFile"];

var curEditPerm;

registerCommand("perms", "Configure perms settings", {
	switches: {
		exclude:false
	},
	usage: "perms get [name]:String\n"+
	"perms add [name1,...,nameN]:String [perm]:String\n"+
	"perms rem [name1,...,nameN]:String [perm]:String\n"+
	"perms clear [name1,...,nameN]:String\n"+
	"perms list"
}, function(args, options){
	if(args.length < 1){
		endCommand(-2)
		return
	}
	var mode = args[0]
	switch(mode){
		case "get":
			var name = args[1] || username;
			if(name == undefined){
				writeLine("Cannot get own account permissions when not logged in");
				endCommand(0);
				return;
			}
			socket.emit("getPerms", name);
			getPermsName = name;
		break;
		case "add":
		case "rem":
			if(args.length < 2){
				endCommand(-2)
				return
			}
			if(!username){
				writeLine("ERROR, you do not have permission to run this command");
				endCommand(0);
				return;
			}
			var names = args[1];
			var perm = args[2]
			if(!perm){
				perm = names
				names = username;
			}
			if(perms.indexOf(perm) == -1){
				writeLine("Invalid perm '"+perm+"'");
				endCommand(0);
				return;
			}
			if(!perm){
				endCommand(-2)
				return
			}
			curEditPerm = perm
			if(mode == "add"){curEditPerm += " added to"}
			if(mode == "rem"){curEditPerm += " removed from"}
			socket.emit("changePerm", {names:names, exclude:options.switches.exclude, mode:mode, perm:perm});
		break;
		case "clear":
			if(args.length != 2){
				endCommand(-2)
				return
			}
			if(!username){
				writeLine("ERROR, you do not have permission to run this command");
				endCommand(0);
				return;
			}
			var names = args[1];
			curEditPerm = "All permissions removed from"
			socket.emit("changePerm", {names:names, exclude:options.switches.exclude, mode:"clear"})
		break;
		case "list":
			writeLine("Permissions:");
			writeLine(perms.join(", "));
			endCommand(1);
		break;
		default:
			writeLine("Invalid mode, see 'help perms'")
			endCommand(0);
		break;
	}
});


$(document).ready(function() {
	socket.on("getPermsResponse", function(status, data){
		if(status == 404){
			writeLine("Account with name '"+getPermsName+"' does not exist");
			endCommand(0);
		} else if(status == 200){
			writeLine(getPermsName+"'s permissions:")
			writeLine(data.join(", "))
			endCommand(1);
		}
		getPermsName = null;
	});

	socket.on("changePermResponse", function(status, num){
		if(status == 403){
			writeLine("ERROR, you do not have permission to run this command");
			endCommand(0);
		} else if(status == 200){
			writeLine(curEditPerm + " " +num + " account(s)")
			curEditPerm = null;
			endCommand(1);
		}
	})
});