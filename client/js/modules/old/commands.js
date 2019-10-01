registerCommand(["clearscreen", "cls", "#"], "Clear the terminal", function(args){
	if(args.length > 0){
		endCommand(-2)
		return
	}
	clearTerminal();
	endCommand(1);
});

registerCommand("help", "Lists all commands", {
	usage:"help\n"+
	"help [page]:Int\n"+
	"help [command]:String"
}, function(args){
	if(args.length > 1){
		endCommand(-2)
		return
	}
	var elemsPerPage = 15
	var helpList = []

	commands.sort(function(a, b){
	    if(a.name < b.name) return -1;
	    if(a.name > b.name) return 1;
	    return 0;
	});

	for(var i=0; i<commands.length; i++){
		var command = commands[i];
		helpList.push(command.name + " - " + command.desc)
	}

	var maxPage = Math.ceil(helpList.length/elemsPerPage)
	var page = args[0];

	var helpCommand = false;
	if(page){
		var type = parseType(page)
		if(type == "Int"){
			page = parseInt(page);
		} else if(type == "String"){
			for(var i = 0; i<commands.length; i++){
				if(commands[i].name == page || commands[i].aliases.indexOf(page) != -1){
					helpCommand = commands[i];
				}
			}
			if(!helpCommand){
				writeLine("ERROR: Command '"+page+"' does not exist")
				endCommand(0)
				return
			}
		} else {
			writeLine("ERROR: Invalid usage, page must be an integer")
			endCommand(0);
			return
		}
	} else {
		page = 1
	}
	writeLine(" ")
	if(helpCommand){
		writeLine("----------[ "+helpCommand.name+" ]----------");
		writeLine(" ");
		writeLine(helpCommand.desc);
		writeLine(" ");
		if(helpCommand.aliases.length > 0){
			writeLine("ALIASES:");
			writeLine("    "+helpCommand.aliases.join(", "));
			writeLine(" ");
		}
		writeLine("USAGE:")


		if(helpCommand.options && helpCommand.options.usage){
			write(helpCommand.options.usage+"\n", "    ")
		} else {
			writeLine("    "+helpCommand.name)
		}
		
		writeLine(" ")
		if(helpCommand.options){
			if(helpCommand.options.flags){
				writeLine("FLAGS:")
				for(var flagName in helpCommand.options.flags) {
					var val = helpCommand.options.flags[flagName]
					if(val){
						val = val.toString();
					} else {
						val = "Null"
					}
					writeLine("    "+flagName+" = "+val)
				}
				writeLine(" ")
			}
			if(helpCommand.options.switches){
				writeLine("SWITCHES:")
				for(var switchName in helpCommand.options.switches) {
					writeLine("    "+switchName+" = "+helpCommand.options.switches[switchName].toString())
				}
				writeLine(" ")
			}
		}

	} else {
		page = clamp(page, 1, maxPage)
		writeLine("Help ("+page+"/"+maxPage+")");
		writeLine(" ")
		for(var i=(page-1)*elemsPerPage; i<clamp(page*elemsPerPage, 0, helpList.length); i++) {
			writeLine("    "+helpList[i]);
		}
		writeLine(" ");
	}
	writeLine("Use: help [page] for other pages or help [command] for more info")
	writeLine(" ")
	endCommand(1);
});
