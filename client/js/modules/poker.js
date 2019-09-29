/*
plan

poker - runs poker
	asks to join, create, list (j/c/l)
	join/create:
		asks for name
		asks for pass (empty if none)
		creates/joins game into lobby
			game name
			player count / max
			list of players (with id)

			owner gets settings using txt
				kick id
				pass newPass
				moneyStart num - start amount
				moneyBig num - big blind
				moneySmall num - small blind

			clients get cmd to exit, with "waiting for owner"


game structure:


*/


titleText = [
	" .----------------.  .----------------.  .----------------.  .----------------.  .----------------.",
	"| .--------------. || .--------------. || .--------------. || .--------------. || .--------------. |",
	"| |   ______     | || |     ____     | || |  ___  ____   | || |  _________   | || |  _______     | |",
	"| |  |_   __ \\   | || |   .'    '.   | || | |_  ||_  _|  | || | |_   ___  |  | || | |_   __ \\    | |",
	"| |    | |__) |  | || |  /  .--.  \\  | || |   | |_/ /    | || |   | |_  \\_|  | || |   | |__) |   | |",
	"| |    |  ___/   | || |  | |    | |  | || |   |  __'.    | || |   |  _|  _   | || |   |  __ /    | |",
	"| |   _| |_      | || |  \\  `--'  /  | || |  _| |  \\ \\_  | || |  _| |___/ |  | || |  _| |  \\ \\_  | |",
	"| |  |_____|     | || |   '.____.'   | || | |____||____| | || | |_________|  | || | |____| |___| | |",
	"| |              | || |              | || |              | || |              | || |              | |",
	"| '--------------' || '--------------' || '--------------' || '--------------' || '--------------' |",
	" '----------------'  '----------------'  '----------------'  '----------------'  '----------------' ",
	"",
	"=====================================================================================================",
	"",
	"		   _______                   _           _     _   _                ",
 	"		  |__   __|                 | |         | |   | | ( )               ",
 	"		     | | _____  ____ _ ___  | |__   ___ | | __| | |/  ___ _ __ ___  ",
 	"		     | |/ _ \\ \\/ / _` / __| | '_ \\ / _ \\| |/ _` |    / _ \\ '_ ` _ \\ ",
 	"		     | |  __/>  < (_| \\__ \\ | | | | (_) | | (_| |   |  __/ | | | | |",
 	"		     |_|\\___/_/\\_\\__,_|___/ |_| |_|\\___/|_|\\__,_|    \\___|_| |_| |_|",
 	"",
 	"",
 	""
];
listText = [
	"                                                                                                  ",
	"                                                                                                  ",
	"                                                  Poker rooms:                                    ",
	"                                                                                                  ",
	"                       ID | Room name               | start/big/small | Ply count | Public        ",
	"                     - - -|- - - - - - - - - - - - -|- - - - - - - - -|- - - - - -|- - - - -      ",
	"                          |                         |                 |           |               ",
	"",
	"",
];
//lengths: 2 : 23 : 15 : 9 : 1
listRoomTextLengths = [23,15,9];
listRoomText = [
	"                      ____|_________________________|_________________|___________|________",
	"                     /                                                                     \\",
	"                    <  id : name : monInfo : plycnt :   state     >",
	"                     \\_____________________________________________________________________/"
];
titleTextIndex = 0;
titleInterval = 0;
strIndent = 68;
state = "main";
roomData = [];
plyName = "";
roomPageNo = 0;
roomsPerPage = 6;
cardFront = [
	" _________ ",
	"|CC       |",
	"|S        |",
	"|         |",
	"|    S    |",
	"|         |",
	"|        S|",
	"|_______CC|"
];
cardBack = [
	" _________ ",
	"|  _____  |",
	"| |♠   [#ff0000]♥[#ffffff]| |",
	"| | ♣ [#ff0000]♦[#ffffff] | |",
	"| |     | |",
	"| | [#ff0000]♥[#ffffff] ♠ | |",
	"| |[#ff0000]♦[#ffffff]___♣| |",
	"|_________|"
];
cardGone = [
	"           ",
	"           ",
	"           ",
	"           ",
	"           ",
	"           ",
	"           ",
	"           "
];

loadingInt = 0;
loadingVal = 0;

requestText = "";
errorText = "";
errorTextTimer = null;
canCheck = false;

function roundTo(val, to){
	var val = Math.round(val / Math.pow(10, to)) * Math.pow(10, to);
	return Number(val.toString().substring(0, 10));
}

function compactNum(val) {
	//val = roundTo(val, 4); this break things, idk why it was ever put here
	var types = ["", "K", "M", "B", "T", "Q"];
	var log = Math.log10(val || 1)
	var type = Math.floor(log/3);
	if(type > 5){
		return ">Q";
	}
	var res = val / Math.pow(10, type*3);
	return roundTo(res, -1) + types[type];
}

/* Disabled until finished :)
registerCommand("poker", "Launch poker game", {
	flags: {
		name: null
	}
}, function(args, options){
	titleTextIndex = 0;
	titleInterval = 0;
	if(options.flags.name){
		plyName = options.flags.name
	} else {
		plyName = username;
	}
	if(!plyName){
		getUsername();
	} else {
		writeLine("Launching Poker...");
		setTimeout(printTitlePage, 500);
	}
});
//*/

function getUsername(){
	writeRaw("Enter username: ");
	readInput("", function(name){
		plyName = name;
		if(name.length > 0){
			writeLine("Launching Poker...");
			setTimeout(printTitlePage, 500);
		} else {
			removeLastLine();
			getUsername();
		}
	});
}


cardNames = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
suitNames = ["♠","♥","♦","♣"];
cardOptions = {allowSpecialCharacters: true}
roomID = -1;

function isRed(suit){
	return (suit == 1 || suit == 2);
}

function cardStr(card, suit){
	newCard = cardFront.slice(0);
	for(var i=0; i<8; i++){
		var c = cardNames[card]; //horrible shit to deal with "10" being different length to others
		var a = ""
		if(c != "10"){
			if(i == 1){
				c += " "
			} else {
				a = "_"
			}
		}
		newCard[i] = newCard[i].split("CC").join(a + "[#ff" + (isRed(suit) ? "0000" : "ffff") + "]"+c+"[#ffffff]");
		newCard[i] = newCard[i].split("S").join("[#ff" + (isRed(suit) ? "0000" : "ffff") + "]"+suitNames[suit]+"[#ffffff]");
	}
	return newCard;
}

function getCard(card){
	if(card === 0){
		return cardGone;
	} else if(card){
		return cardStr(card[0], card[1]);
	} else {
		return cardBack;
	}
}


function printTitlePage(){
	clearTerminal(true);
	state = "main";
	roomData = [];
	titleInterval = setInterval(printTitleInt, 50);
}

function printTitleInt(){
	writeLine(titleText[titleTextIndex++]);
	if(titleTextIndex >= titleText.length){
		clearInterval(titleInterval);
		titleInterval = 0;
		titleTextIndex = 0;
		reqMenuOption();
	}
}

function reqMenuOption(){
	str = "Type create, join or exit: "
	writeRaw(" ".repeat(strIndent - str.length) + str);
	readInput("", menuOption);
}


function getNewRoomData(){
	str = "Name: "
	writeRaw(" ".repeat(strIndent - str.length) + str);
	readInput("", pGetPass);
}

function pGetPass(name){
	str = "Password: "
	writeRaw(" ".repeat(strIndent - str.length) + str);
	readInput("*", function(pass){
		pGetStartMon(name, pass);
	});
}

function pGetStartMon(name, pass){
	str = "Starting Money (1000): "
	writeRaw(" ".repeat(strIndent - str.length) + str);
	readInput("", function(amt){
		if(!isNaN(amt) && Number(amt) > 0 && Number(amt)%1 == 0){
			newLine();
			pGetBigBlind(name, pass, Number(amt));
		} else if(amt == ""){
			writeRaw("1000");
			newLine();
			pGetBigBlind(name, pass, 1000);
		} else {
			newLine();
			removeLastLine();
			pGetStartMon(name, pass);
		}
	}, {noNewLine: true});
}

function pGetBigBlind(name, pass, startAmt){
	str = "Big blind (100): "
	writeRaw(" ".repeat(strIndent - str.length) + str);
	readInput("", function(amt){

		if(!isNaN(amt) && Number(amt) > 0 && Number(amt)%1 == 0){
			newLine();
			gotNewRoomData(name, pass, startAmt, Number(amt));
		} else if(amt == ""){
			writeRaw("100");
			newLine();
			gotNewRoomData(name, pass, startAmt, 100);
		} else {
			newLine();
			removeLastLine();
			pGetBigBlind(name, pass, startAmt);
		}
		
	}, {noNewLine: true});
}


function gotNewRoomData(name, pass, startAmt, bigBlind){
	name = name.split("\n").join("");
	socket.emit("pokerNewRoom", name, pass, startAmt, bigBlind, plyName);
}

function listScreen(){
	state = "list";
	clearTerminal(true);
	socket.emit("reqRoomData");
	for(var i=0; i<listText.length; i++){
		writeLine(listText[i]);
	}
}

function drawRoomsList(){
	roomPageNo = Math.min(roomPageNo, Math.max(Math.ceil(roomData.length/roomsPerPage), 1) - 1)
	for(var i=(roomPageNo * roomsPerPage); i<Math.min((roomPageNo+1)*roomsPerPage, roomData.length); i++){
		var room = roomData[i];
		var lines = listRoomText.slice(0);
		//id
		var id = i+1;
		lines[2] = lines[2].replace("id", (id > 9 ? "" : "0") + id );

		//name
		var name = room.name;
		if(name.length > listRoomTextLengths[0]){
			name = name.substring(0, listRoomTextLengths[0]-3);
			name = name + "...";
		}
		name = name + (" ".repeat(listRoomTextLengths[0] - name.length));
		lines[2] = lines[2].replace("name", name);

		//monInfo
		var monInfo = compactNum(room.moneyData[0]) + "/" + compactNum(room.moneyData[1]) + "/" + compactNum(room.moneyData[2]);
		monInfo = monInfo.substring(0, listRoomTextLengths[1]);

		var extraSpaces = listRoomTextLengths[1] - monInfo.length;
		monInfo = " ".repeat(Math.floor(extraSpaces/2)) + monInfo + " ".repeat(Math.floor(extraSpaces/2))
		if(extraSpaces % 2 == 1){
			monInfo += " ";
		}
		lines[2] = lines[2].replace("monInfo", monInfo);

		//plycnt
		var plycnt = room.plyData[0] + "/" + room.plyData[1]
		plycnt = plycnt.substring(0, listRoomTextLengths[2]);

		var extraSpaces = listRoomTextLengths[2] - plycnt.length;
		plycnt = " ".repeat(Math.floor(extraSpaces/2)) + plycnt + " ".repeat(Math.floor(extraSpaces/2))
		if(extraSpaces % 2 == 1){
			plycnt += " ";
		}
		lines[2] = lines[2].replace("plycnt", plycnt);

		if(room.public){
			lines[2] = lines[2].replace("state", "✓");
		} else {
			lines[2] = lines[2].replace("state", "✗");
		}

		for(var k=0; k<4; k++){
			writeLine(lines[k]);
		}
	}
	writeLine("                          |                         |                 |           |          ");
	writeLine("");
	writeLine("                                                    Page "+(roomPageNo+1)+"/"+( Math.max(Math.ceil(roomData.length/roomsPerPage), 1) ));
	reqListOption();
}

function reqJoinPass(roomName){
	writeRaw(" ".repeat(73 - 10) + "Password: ");
	readInput("*", function(val){
		if(val.length > 0){
			state = "joiningGame";
			socket.emit("pokerJoinRoom", roomName, plyName, val)
		} else {
			removeLastLine();
			reqJoinPass(roomName);
		}
	}, {noNewLine: true});
}

function listOption(str){
	strSplit = str.toLowerCase().split(" ");
	switch(strSplit[0]) {
		case "back":
		case "b":
			printTitlePage();
		break;
		case "prev":
		case "p":
		case "previous":
			updateList(null, Math.max(0, roomPageNo-1));
		break;
		case "next":
		case "n":
			updateList(null, Math.min(Math.max(Math.ceil(roomData.length/roomsPerPage), 1)-1, roomPageNo+1));
		break;
		case "goto":
		case "g":
			var num = Number(strSplit[1])
			if(!isNaN(num)){
				updateList(null, Math.max(Math.min(Math.max(Math.ceil(roomData.length/roomsPerPage), 1)-1, num-1), 0));
			} else {
				removeLastLine();
				reqListOption();
			}
		break;
		case "join":
		case "j":
			strSplit.shift();
			var roomName = strSplit.join(" ");
			var roomIdx = 0;
			if(isNaN(roomName)){
				var findRes = "";
				for(var i=0; i<roomData.length; i++){
					if(roomData[i].name.toLowerCase().indexOf(roomName) != -1){
						if(findRes != ""){
							removeLastLine();
							reqListOption();
							return;
						}
						findRes = roomData[i].name;
						roomIdx = i;
					}
				}
				if(findRes == ""){
					removeLastLine();
					reqListOption();
					return;
				} else {
					roomName = findRes;
				}
			} else {
				roomName = Number(roomName);
				if(roomName > 0 && roomName <= roomData.length && roomName % 1 == 0) {
					roomIdx = roomName - 1
					roomName = roomData[roomIdx].name;
				} else {
					removeLastLine();
					reqListOption();
					return;
				}
			}
			if(roomData[roomIdx].public){
				socket.emit("pokerJoinRoom", roomName, plyName)
				state = "joiningGame";
			} else {
				reqJoinPass(roomName);
			}
		break;
		default:
			removeLastLine();
			reqListOption();
		break;
	}
}

function reqListOption(){
	if(state != "list"){return;}
	writeRaw("                          Type join [id/name], next, prev, goto or back: ");
	readInput("", listOption);
}

socket.on("pokerNewRoomRes", function(status, data){
	if(status == 400){
		writeLine(" ".repeat(strIndent) + data);
		setTimeout(function(){
			for(var i=0; i<6; i++){removeLastLine()}
			reqMenuOption();
		},1000);
	} else if(status == 200){
		roomID = data;
		waitForRound();
	}
});

socket.on("pokerJoinRoomRes", function(status, data){
	if(status == 400){
		newLine();
		writeLine(" ".repeat(73) + data);
		setTimeout(function(){
			for(var i=0; i<3; i++){
				removeLastLine();
			}
			state = "list";
			reqListOption();
		}, 1000)
	} else if(status == 200){
		roomID = data;
		waitForRound();
	}
})

function waitForRound(){
	state = "loadingGame"
	loadingVal = 1;
	clearTerminal(true);
	writeLine("Waiting for next round.");
	loadingInt = setInterval(function(){
		removeLastLine();
		writeLine("Waiting for next round" + ".".repeat((loadingVal++%3)+1))
	}, 500);
}

function updateList(newData, newPageNo){
	//for(var i=0; i< ( (Math.min(roomData.length - (roomPageNo*6), roomsPerPage) * 4) + 4 ); i++){
	while(lineCounter > 6) {
		removeLastLine();
	}
	if(newData){
		roomData = newData;
	}
	if(newPageNo || newPageNo == 0){
		roomPageNo = newPageNo;
	}
	drawRoomsList();
}

socket.on("pokerRoomData", function(data){
	if(state == "list"){
		updateList((JSON.parse(data)).data);
		return;
	}
	roomData = (JSON.parse(data)).data;
})

function menuOption(str){
	switch(str.toLowerCase()) {
		case "create":
		case "c":
			getNewRoomData();
		break;
		case "join":
		case "j":
			listScreen();
		break;
		case "exit":
		case "e":
			clearTerminal();
			writeLine("Thanks for playing!");
			endCommand(1);
		break;	
		default:
			removeLastLine();
			reqMenuOption();
		break;
	}
}

//texas holdem
var plyID = -1;
var plyData;
var pot = 0;
var midCards = [];
var decidingID = null;
var timer = 0;

setInterval(function(){
	if(decidingID !== null){
		plyData[decidingID].action = "DECIDING"+".".repeat((timer++%3)+1);
		drawGame();
		updateInput();
	}
}, 500);

socket.on("pokerEvent", function(type, ...data){
	console.log(type, ...data);
	var data = [...data];
	decidingID = null;
	switch(type){
		case "newRound":
			plyID = data[0];
			plyData = data[1];
			clearInterval(loadingInt);
			clearTerminal(true);
			state = "inGameWaiting"
		break;
		case "getCards":
			plyData[plyID].cards = data[0];
		break;
		case "bet":
		case "raise":
		case "call":
			var idx = data[0];
			var amt = data[1];
			pot = data[2];
			var newMon = data[3];
			var allIn = data[4];
			plyData[idx].bet = amt;
			plyData[idx].money = newMon;
			plyData[idx].action = allIn ? "ALL IN" : type.toUpperCase();
		break;
		case "check":
			var idx = data[0];
			plyData[idx].action = "CHECK";
		break;
		case "fold":
			var idx = data[0];
			plyData[idx].cards = [0,0];
			plyData[idx].action = "FOLD";
		break;
		case "pokerRequest":
			var idx = data[0];
			plyData[idx].action = "DECIDING";
			decidingID = idx;
		break;
		case "showFlop":
			midCards[0] = data[0];
			midCards[1] = data[1];
			midCards[2] = data[2];
			resetBets();
		break;
		case "showTurn":
			midCards[3] = data[0];
			resetBets();
		break;
		case "showRiver":
			midCards[4] = data[0];
			resetBets();
		break;
	}
	drawGame();
})

socket.on("pokerRequest", function(...d){
	var data = [...d];
	setErrorText("");
	switch(data[0]){
		case "Check":
			requestText = "You can Check, Fold or Bet [amount]: "
			canCheck = true;
		break;
		case "Call":
			var amt = data[1]
			var ownMoney = plyData[plyID].money;
			if (amt >= ownMoney) {
				requestText = "You can Call (all in) or Fold: ";
			} else {
				requestText = "You can Call ("+amt+"), Fold or Raise [amount]: ";
			}
			canCheck = false;
		break;
	}
	state = "inGameDeciding";
	readInput("", handleGameDecision);
})

function setErrorText(text){
	errorText = text;
	if(errorTextTimer){
		clearTimeout(errorTextTimer);
	}
	if(errorText != ""){
		errorTextTimer = setTimeout(function() {
			errorText = "";
		}, 2000);
	}
}

socket.on("pokerRequestDeny", function(error){
	setErrorText(error);
	readInput("", handleGameDecision);
	drawGame();
})

socket.on("pokerRequestAccept", function(){
	setErrorText("");
	requestText = "";
	state = "inGameWaiting";
	stopRead();
});

function centerText(txt, len, txtLenOver){
	txtLenOver = txtLenOver || txt.length;
	if(txtLenOver > len){
		txt = txt.sub(0, len-3) + "...";
	}
	var sNum = len - txtLenOver;
	var l = Math.floor(sNum/2);
	var e = sNum%2;
	return " ".repeat(l) + txt + " ".repeat(l+e);
}

function alignText(txt, len, offset){
	txtLenOver = txt.length;
	if(txtLenOver > len){
		txt = txt.sub(0, len-3) + "...";
	}
	var sNum = len - txtLenOver;
	return " ".repeat(offset) + txt + " ".repeat(sNum - offset);
}

function resetBets(){
	for(var i = 0; i < plyData.length-1; i++){
		plyData[i].bet = null;
	}
}

function drawGame(){
	clearTerminal(true);
	//section 1 other players
	//plysize = 23, 3 space gap
	var colSize = 23;
	var lineSize = 179;
	var lines = ["","","","","","","","","","","","",""];
	for(var i = 0; i < plyData.length-1; i++){
		var plyIdx = (i + plyID + 1)%plyData.length;
		var ply = plyData[plyIdx];
		lines[0] += alignText(ply.name, colSize, 7);
		lines[1] += alignText("£" + ply.money, colSize, 7);
		lines[2] += alignText(ply.role || "", colSize, 7);

		var cards = ply.cards || [];

		var card1 = getCard(cards[0]);
		var card2 = getCard(cards[1]);

		for(var l=3; l<11; l++){
			lines[l] += card1[l-3] + " " + card2[l-3];
		}

		lines[11] += alignText(ply.action || "", colSize, 9);
		lines[12] += alignText(ply.bet ? "£"+ply.bet : "", colSize, 9);

		if(i != plyData.length-2){
			for(l=0; l<13; l++){
				lines[l] += "   ";
			}
		}
	}
	for(var l = 0; l < 3; l++){
		writeLine(centerText(lines[l], lineSize));
	}
	for(var l = 3; l < 11; l++){
		writeLine(centerText(lines[l], lineSize, ( (plyData.length-2) * (colSize + 3) ) + colSize), cardOptions);
	}
	for(var l = 11; l < 13; l++){
		writeLine(centerText(lines[l], lineSize));
	}

	//section 2 pot and mid cards
	writeLine("= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =");
	writeLine(centerText("POT", lineSize));
	writeLine(centerText("£" + pot, lineSize));

	var cards = [getCard(midCards[0]), getCard(midCards[1]), getCard(midCards[2]), getCard(midCards[3]), getCard(midCards[4])];
	for(var i = 0; i < 8; i++){
		var line = "";
		for(var l=0; l<5; l++){
			line += " " + cards[l][i] + " "
		}
		writeLine(centerText(line, lineSize, 65), cardOptions);
	}

	//section 3 client cards
	writeLine("= = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =");
	var lines = ["","","","","","","","","","","","",""];

	var ply = plyData[plyID];

	lines[0] += alignText(ply.action || "", colSize+4, 11);
	lines[1] += alignText(ply.bet ? "£"+ply.bet : "", colSize+4, 11);

	var cards = ply.cards || [];
	var card1 = getCard(cards[0]);
	var card2 = getCard(cards[1]);
	for(var l=2; l<10; l++){
		lines[l] += card1[l-2] + "     " + card2[l-2];
	}

	lines[10] += alignText(ply.name + " (You)", colSize+4, 9);
	lines[11] += alignText("£" + ply.money, colSize+4, 9);
	lines[12] += alignText(ply.role || "", colSize+4, 9);


	for(var l = 0; l < 2; l++){
		writeLine(centerText(lines[l], lineSize));
	}
	for(var l = 2; l < 10; l++){
		writeLine(centerText(lines[l], lineSize, 27), cardOptions);
	}
	for(var l = 10; l < 13; l++){
		writeLine(centerText(lines[l], lineSize));
	}

	//section 4 client input
	if(state == "inGameDeciding"){
		write(" ".repeat(10) + "[#ff0000]" + errorText + "[#ffffff]");
		writeRaw(" ".repeat((lineSize/2 - requestText.length/2) - (errorText.length + 10)) + requestText);
	}

}

function handleGameDecision(val){
	val = val.toLowerCase();
	var data = val.split(" ");
	var input = data[0];
	var sendData = [roomID];
	while(true){ //allows for pseudo jumping to different cases
		switch(input){
			case "c":
				if(canCheck){
					input = "check"; //jump to check
				} else {
					input = "call"; //jump to call
				}
				continue;
			break;
			case "call":
				sendData[1] = "call";
			break;
			case "check":
				sendData[1] = "check";
			break;
			case "f":
			case "fold":
				sendData[1] = "fold";
			break;
			case "b":
			case "bet":
				var amt = data[1];
				if(!isNaN(amt) && Number(amt) > 0 && Number(amt)%1 == 0){
					sendData[1] = "bet";
					sendData[2] = Number(amt);
				} else {
					setErrorText("Invalid bet amount.")
					readInput("", handleGameDecision);
				}
				
			break;
			case "r":
			case "raise":
				var amt = data[1];
				if(!isNaN(amt) && Number(amt) > 0 && Number(amt)%1 == 0){
					sendData[1] = "raise";
					sendData[2] = Number(amt);
				} else {
					setErrorText("Invalid bet amount.");
					readInput("", handleGameDecision);
				}
			break;
			default:
				setErrorText("Invalid action.");
				readInput("", handleGameDecision);
				return;
			break;

		}
		break;
	}
	socket.emit("nextTurn", ...sendData);
}