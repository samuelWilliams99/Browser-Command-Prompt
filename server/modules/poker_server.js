//TODO
//Create response to getDecision on "nextTurn" event, passing in check, bet, raise, call, or fold
// 																		bet and raise include amount arg

//Add way to edit line (or even line substr) to main, then change the "DECIDING" text to not refresh whole screen
//Add/test smaller width screens
//deal with disconnect


shared.rooms = shared.rooms || [];
shared.first = shared.first==undefined ? true : shared.first; // Does nothing rn, remove??

rooms = shared.rooms;

Array.prototype.clone = function() {
    return this.slice(0);
};

Array.prototype.removeMany = function(args){
    for(var i=0; i<args.length; i++){
        var idx = this.indexOf(args[i]);
        if(idx >= 0){
            this.splice(idx, 1);
        }
    }
}

Number.prototype.mod = function(n) {
    return ((this%n)+n)%n;
};

class Poker_room {
    constructor(name, pass, startAmt, bigBlind, owner, ownerName){
        this.name = name;
        this.pass = pass;
        this.owner = owner;
        this.players = [{socket: owner, name: ownerName, money: startAmt}];
        this.dealer = this.players[0];

        this.startMoney = startAmt;
        this.bigBlind = bigBlind;
        this.smallBlind = bigBlind/2;

        this.maxPlayers = 8;

        this.game = 0;
    }

    get numPlayers() {
        return this.players.length;
    }

    addPlayer(ply, name) {
        if(this.numPlayers < this.maxPlayers){
            this.players.push({socket: ply, name: name, money: this.startMoney});
            emitter.emit("roomDataChange");
            if(this.numPlayers == 3){
                this.nextRound();
            }
            return true;
        } else {
            return false;
        }
    }

    nextRound(){
        var room = this;
        setTimeout(function(){
            room.game = new TH_game(room, room.players);
        }, 2000);
        
    }

    removePlayer(ply) {
        var idx = -1;
        for(var i=0; i<this.numPlayers; i++){
            if(this.players[i].socket == ply){
                idx = i;
                break;
            }
        }
        if(idx < 0) {return false;}
        this.players.splice(idx, 1);
        if(ply == this.owner){
            if(this.numPlayers > 0){
                this.owner = this.players[0].socket;
            } else {
                rooms.splice(rooms.indexOf(this), 1);
            }
        }
        return true;
    }
}

function arrayOf(val, size){
    return Array.apply(null, Array(size)).map(Number.prototype.valueOf,val);
}
function randomBetween(min, max){
    return min + Math.round(Math.random() * (max - min));
}
function shuffleDeck(deck){
    for (var i = deck.length - 1; i > 0; i--){
        var n = randomBetween(0, i);
        var temp = deck[i];
        deck[i] = deck[n];
        deck[n] = temp;
    }
}


cardNames = ["A","2","3","4","5","6","7","8","9","J","Q","K"];
suitNames = ["♠","♥","♦","♣"];
handNames = ["High Card", "Pair", "2 Pair", "3 of a Kind", "Straight", "Flush", "Full House", "4 of a Kind", "Straight Flush", "Royal Flush"];

TH_stages = ["Preflop","Flop","Turn","River"]
TH_games = [];
class TH_game {
    constructor(room, players) {
        TH_games.push(this);
        this.idx = TH_games.length - 1;
        this.room = room;
        this.players = players.clone();
        
        this.stage = 0
        this.pot = 0;
        this.roundBets = arrayOf(0, this.numPlayers);
        this.plyCards = arrayOf(0, this.numPlayers);
        this.totalBets = arrayOf(0, this.numPlayers);

        this.lastRaiser = 0;

        this.plyTurn = this.room.players.indexOf(this.room.dealer);
        this.plyOutRound = new Array(this.numPlayers);
        

        this.maxBet = 0;
        this.deck = [];

        for(var suit=0; suit < 4; suit++){
            for(var card = 0; card < 13; card ++){
                this.deck.push([card, suit]);
            }
        }
            
        shuffleDeck(this.deck);
        
        var sendData = [];
        for(var i=0; i<this.numPlayers; i++){
            sendData.push({id: i, name: this.players[i].name, money: this.players[i].money});
            if(this.plyTurn == i){
                sendData[i].role = "DEALER";
            }
            if((this.plyTurn - 1).mod( this.numPlayers ) == i){
                sendData[i].role = "BIG BLIND"
            }
            if((this.plyTurn - 2).mod( this.numPlayers ) == i){
                sendData[i].role = "SMALL BLIND"
            }
        }

        for(var i=0; i < this.numPlayers; i++){
            this.players[i].socket.emit("pokerEvent", "newRound", i, sendData);

            this.plyCards[i] = [this.getCard(), this.getCard()];
            console.log(this.players[i].name + " given cards: "+JSON.stringify(this.plyCards[i]));
            this.players[i].socket.emit("pokerEvent", "getCards", this.plyCards[i])
        }
        this.burnCards = [];
        this.midCards = [this.getCard(), this.getCard(), this.getCard()];

        this.burnCards.push(this.getCard());
        this.midCards.push(this.getCard());
        this.burnCards.push(this.getCard());
        this.midCards.push(this.getCard());

        console.log("Mid cards: " + JSON.stringify(this.midCards));

        this.pushMoney( (this.plyTurn - 2).mod( this.numPlayers ), this.room.smallBlind);
        this.pushMoney( (this.plyTurn - 1).mod( this.numPlayers ), this.room.bigBlind);
        this.lastRaiser = this.plyTurn;

        this.beginRound();
    }

    get plyInRound(){
        var plys = [];
        for(var i=0; i<this.numPlayers; i++){
            if(!this.plyOutRound[i]){
                plys.push(i);
            }
        }
        return plys;
    }

    get numPlayers(){
        return this.players.length;
    }

    beginRound(){
        
        this.getDecision(this.plyTurn);
        //this.nextTurn("call");
        //this.nextTurn("fold");

        /*this.nextTurn("bet", 1900);
        this.nextTurn("call");

        this.nextTurn("check");
        this.nextTurn("check");

        this.nextTurn("check");
        this.nextTurn("check"); */
    }

    nextTurn(decision, ...data){
        if(!decision){return;}
        console.log(this.players[this.plyTurn].name + ": " + decision);
        var canCheck = (this.roundBets[this.plyTurn] == this.maxBet);
        data = [...data];
        switch(decision){
            case "check":
                if(canCheck){
                    this.informPlayers("check", this.plyTurn);
                    this.incTurn();
                } else {
                    this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Cannot check when someone has placed a bet");
                    console.log("Cannot check when someone has placed a bet");
                }
            break;
            case "bet":
                if(canCheck){
                	if( typeof data[0] != "number" ) {
                		throw "BET AMOUNT NOT A NUMBER";
                	}
                    if(data[0] >= this.room.smallBlind){
                        if(this.pushMoney(this.plyTurn, data[0])){
                            this.incTurn();
                        } else {
                            this.players[this.plyTurn].socket.emit("pokerRequestDeny", "You cannot afford this bet");
                            console.log("You cannot afford this bet");
                        }
                        
                    } else {
                        this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Bet must be >= Small Blind (" + this.room.smallBlind + ")");
                        console.log("Bet must be >= Small Blind (" + this.room.smallBlind + ")");
                    }
                } else {
                    this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Cannot bet when a bet has already been placed");
                    console.log("Cannot bet when a bet has already been placed");
                }
            break;
            case "raise":
                if(!canCheck){
                	if( typeof data[0] != "number" ) {
                		throw "RAISE AMOUNT NOT A NUMBER";
                	}
                    if(data[0] >= this.room.smallBlind + this.maxBet){
                        if(this.pushMoney(this.plyTurn, data[0] - this.roundBets[this.plyTurn])){
                            this.incTurn();
                        } else {
                            this.players[this.plyTurn].socket.emit("pokerRequestDeny", "You cannot afford this bet");
                            console.log("You cannot afford this bet");
                        }
                        
                    } else {
                        this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Must raise by amount >= small blind (" + this.room.smallBlind + ")");
                        console.log("Must raise by amount >= small blind (" + this.room.smallBlind + ")");
                    }
                } else {
                    this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Cannot raise when there is no bet");
                    console.log("Cannot raise when there is no bet");
                }
            break;
            case "call":
                if(!canCheck){
                    this.pushMoney(this.plyTurn, Math.min(this.maxBet - this.roundBets[this.plyTurn], this.players[this.plyTurn].money));
                    this.incTurn();
                } else {
                    this.players[this.plyTurn].socket.emit("pokerRequestDeny", "Cannot call with no bet placed");
                    console.log("Cannot call with no bet placed");
                }
            break;
            case "fold":
                this.plyOutRound[this.plyTurn] = 1;
                this.informPlayers("fold", this.plyTurn);
                this.incTurn();
            break;
        }
    }

    incTurn(){
        this.players[this.plyTurn].socket.emit("pokerRequestAccept");
        var plys = this.plyInRound;
        console.log(plys.length);
        if(plys.length == 1){
            this.players[plys[0]].money += this.pot;
            this.room.nextRound();
            return;
        }
        
        do {
            this.plyTurn = (this.plyTurn + 1).mod( this.numPlayers );
            if(this.plyTurn == this.lastRaiser){
                this.nextRound();
                return;
            }
        } while(this.plyOutRound[this.plyTurn]);
        console.log(this.plyOutRound[this.plyTurn]);
        this.getDecision(this.plyTurn);
    }

    nextRound(){
        this.stage++;
        for(var i=0; i<this.numPlayers; i++){
            this.pot += this.roundBets[i];
            this.roundBets[i] = 0;
        }
        this.maxBet = 0;
        switch(this.stage){
            case 1:
                this.informPlayers("showFlop", this.midCards[0], this.midCards[1], this.midCards[2]);
                console.log("flop")
                this.getDecision(this.plyTurn);
            break;
            case 2:
                this.informPlayers("showTurn", this.midCards[3]);
                console.log("turn");
                this.getDecision(this.plyTurn);
            break;
            case 3:
                this.informPlayers("showRiver", this.midCards[4]);
                console.log("river");
                this.getDecision(this.plyTurn);
            break;
            case 4:
                this.checkCards();
            break;
        }
    }

    checkCards(){
        /*
        pseudo code:
        top better refunded (topbet - secondbet)
        while players have bet > 0
            bestHands = bestHand(players with bet > 0) //needs to return in order of bets, 
            winner = {money = 0, bet = bestHands[0].bet}
            for ply in players
                winner.money += min(winner.bet, ply.bet)
                ply.bet = max(0, ply.bet - winner.bet)
            split winner.money accross bestHands using bet ratio
        */

        function doPlayerHaveBet(){
            for(var i=0; i<betsSorted.length; i++){
                if(betsSorted[i].bet > 0){
                    return true;
                }
            }
            return false;
        }

        function getPlayersWithBet(){ //gets all with bet >0
            var plys = [];
            for(var i=0; i<betsSorted.length; i++){
                if(betsSorted[i].bet > 0){
                    plys.push(betsSorted[i]);
                }
            } 
            return plys
        }

        var betsSorted = [];
        for(var i=0; i<this.numPlayers; i++){
            betsSorted.push({idx: i, bet: this.totalBets[i]});
        }
        betsSorted.sort(function(a,b){
            return (a.bet < b.bet) ? 1 : (a.bet == b.bet ? 0 : -1);
        })
        if(betsSorted[0].bet > betsSorted[1].bet){ //refund top better
            var mon = betsSorted[0].bet - betsSorted[1].bet
            console.log("Giving player " + this.players[betsSorted[0].idx].name + "(refund) $"+mon);
            this.players[betsSorted[0].idx].money += mon;
            betsSorted[0].bet = betsSorted[1].bet
        }

        while(doPlayerHaveBet()){
            var plysWithBet = getPlayersWithBet()
            var winners = this.bestHands(plysWithBet);
            var splitRatio = [];
            var splitTotal = 0;
            for(var i=0; i<winners.length; i++){
                splitTotal += winners[i].bet;
            }
            for(var i=0; i<winners.length; i++){ //calculate splitting for a draw
                splitRatio.push(winners[i].bet / splitTotal);
            } 
            var winner = {money: 0, bet: winners[0].bet}
            for(var i=0; i<plysWithBet.length; i++){
                var ply = plysWithBet[i];
                winner.money += Math.min(winner.bet, ply.bet)
                ply.bet = Math.max(0, ply.bet - winner.bet)
            }
            for(var i=0; i<winners.length; i++){
                var mon = winner.money * splitRatio[i]
                console.log("Giving player " + this.players[winners[i].idx].name + " $"+mon);
                this.players[winners[i].idx].money += mon; //give out money from pot
            }

        }

        console.log("Round over");
        console.log("\n========================================================\n");
        //this.room.nextRound();

    }

    bestHands(data) { //just return objects in data that win (several if draw);
        //form data into something nicer:
        var cards = [];
        for(var i=0; i<data.length; i++){
            cards.push({ply: data[i], cards: this.plyCards[data[i].idx], i: i});
        }

        var winners = [];

        for(var i=0; i<cards.length; i++){
            var cardsToCheck = this.midCards.clone();
            cardsToCheck.push(cards[i].cards[0]);
            cardsToCheck.push(cards[i].cards[1]);
            cards[i].bestHand = this.getHands(cardsToCheck);
            console.log(this.players[cards[i].ply.idx].name + " had " + handNames[cards[i].bestHand[0]] + "(" + cards[i].bestHand[1] + ")")

            if(winners.length == 0){
                winners = [cards[i]];
            } else {
                if(cards[i].bestHand[0] > winners[0].bestHand[0]){
                    winners = [cards[i]];
                } else if(cards[i].bestHand[0] == winners[0].bestHand[0]) {
                    var checkCards = cards[i].bestHand[1];
                    var winnerCards = winners[0].bestHand[1];
                    for(var j=0; j<5; j++){
                        if(checkCards[j] != winnerCards[j]) {
                            if(checkCards[j] > winnerCards[j] || checkCards[j] == 0){
                                winners = [cards[i]];
                                break;
                            } else {
                                break;
                            }
                        } else {
                            if(j == 4){
                                winners.push(cards[i]);
                            }
                        }
                    }
                }
            }

        }

        var out = [];
        for(var i=0; i<winners.length; i++){
            out.push(data[winners[i].i]);
        }

        return out;

    }


    getHands(cards){
        /*
            royalFlush 9
            straightFlush 8 
            4kind - cancels 3kind 7
            fullHouse - cancels 3kind and pair 6
            flush 5
            straight 4
            3kind - cancels pair (2 kickers) 3
            2pair (1 kicker) 2
            pair (3 kickers) 1
            high (4 kickers) 0
        */

        cards.sort(function(a,b){
            var ca = a[0] == 0 ? 15 : a[0];
            var cb = b[0] == 0 ? 15 : b[0];
            if(ca == cb) {
                return 0;
            } else if(ca > cb){
                return -1;
            } else if(ca < cb){
                return 1;
            }
        });

        var best = [0, []];

        var cardCounts = [0,0,0,0,0,0,0,0,0,0,0,0,0];
        var suitHighs = [[],[],[],[]];
        var cardCountSuits = [[],[],[],[],[],[],[],[],[],[],[],[],[],[]];
        for(var i=0; i<7; i++){
            cardCounts[cards[i][0]]++;
            cardCountSuits[cards[i][0]][cards[i][1]] = true;
            suitHighs[cards[i][1]].push(cards[i][0]);
        }
        for(var i=0; i<4; i++){
            suitHighs[i] = suitHighs[i].slice(0,5);
            if(suitHighs[i].length == 5){
                best = [5, suitHighs[i], i];
            }
        }

        //royalFlush/straightFlush might work now?
        var straightCounter = 0;
        var straightSuitCounters = [0,0,0,0]
        var straightSuitHighs = [1,1,1,1];
        for(var k=0; k<15; k++){
            var i = k%13;
            if(cardCounts[i] > 0 && k!=14){
                straightCounter++;
                for(var j = 0; j < 3; j++){
                    if(cardCountSuits[i][j]){
                        straightSuitCounters[j]++;
                        straightSuitHighs[j] = i;
                    }
                }
                
            } else {
                if(straightCounter >= 5){
                    //straight 4
                    //highcard = (i-1)%13;
                    if(4 > best[0]){
                        best = [4, [(i-1)%13, (i-2)%13, (i-3)%13, (i-4)%13, (i-5)%13]]
                    }
                    for(var j = 0; j < 3; j++){
                        var high = straightSuitHighs[j];
                        var counter = straightSuitCounters[j];
                        if(counter >= 5){
                            //straight flush 8

                            best = [8, [(high-1)%13, (high-2)%13, (high-3)%13, (high-4)%13, (high-5)%13], j];
                            if(i == 1){
                                //royal flush 9
                                best = [9, [0, 13, 12, 11, 10], j];
                            }
                        }
                    }

                    break;
                }

                straightCounter = 0;
                for(var j = 0; j < 3; j++){
                    straightSuitCounters[j] = 0;
                }
            }
        }



        //kinds
        
        var kinds = [0,0,0];
        var kindsCards = [[],[],[]];
        for(var j=1; j<14; j++){
            var i = j%13;
            for(var x=0; x<3; x++){
                if(cardCounts[i] == (x+2)){
                    kinds[x]++;
                    kindsCards[x].push(i);
                }
            }
        }
        
        var cardsNums = [];
        for(var i=0; i<7; i++){
            cardsNums.push(cards[i][0]);
        }
        var cardsCopy = cardsNums.clone();
        if(kinds[2] > 0){
            //4kind 7
            if(7 > best[0]){
                var handCards = arrayOf(kindsCards[2][0], 4);
                cardsCopy.removeMany(handCards);
                handCards.push(cardsCopy[0]);
                
                best = [7, handCards];
            }
        } else if(kinds[1] > 1){
            //full house 6 (with 2 3kinds)
            if(6 > best[0]){
                var handCards = arrayOf(kindsCards[1][1], 3).concat(arrayOf(kindsCards[1][0], 2));
                best = [6, handCards];
            }
        } else if( (kinds[1] > 0 && kinds[0] > 0)){
            //full house 6
            if(6 > best[0]){
                var handCards = arrayOf(kindsCards[1][0], 3).concat(arrayOf(kindsCards[0][0], 2));
                best = [6, handCards];
            }
        } else if(kinds[1] > 0){
            //3kind 3
            if(3 > best[0]){
                var handCards = arrayOf(kindsCards[1][0], 3);
                cardsCopy.removeMany(handCards);
                handCards.push(cardsCopy[0]);
                handCards.push(cardsCopy[1]);
                
                best = [3, handCards];
            }
        } else if(kinds[0] > 1){
            //2pair 2
            if(2 > best[0]){
                var handCards = arrayOf(kindsCards[0][kindsCards[0].length-1], 2) . concat(arrayOf(kindsCards[0][kindsCards[0].length-2], 2));
                cardsCopy.removeMany(handCards);
                handCards.push(cardsCopy[0]);
                
                best = [2, handCards];
            }
        } else if(kinds[0] > 0){
            //pair 1
            if(1 > best[0]){
                var handCards = arrayOf(kindsCards[0][0], 2);
                cardsCopy.removeMany(handCards);
                handCards.push(cardsCopy[0]);
                handCards.push(cardsCopy[1]);
                handCards.push(cardsCopy[2]);
                
                best = [1, handCards];
            }
        }

        if(best[0] == 0){
            for(var i=0; i<5; i++){
                best[1].push(cardsCopy[i]);
            }
        }


        return best;

    }



    informPlayers(action, ...data){
        for(var i=0; i<this.numPlayers; i++){
            this.players[i].socket.emit("pokerEvent", action, ...data);
        }

    }

    getDecision(plyIdx){
        if(this.roundBets[plyIdx] < this.maxBet){
            this.players[plyIdx].socket.emit("pokerRequest", "Call", this.maxBet - this.roundBets[plyIdx]);
        } else {
            this.players[plyIdx].socket.emit("pokerRequest", "Check"); //I removed the room id here since it shouldnt be needed, 1 socket plays 1 game, hopefully things didnt break :)
        }
        this.informPlayers("pokerRequest", plyIdx);
    }

    getCard(){
        return this.deck.pop();
    }

    pushMoney(plyIdx, amt){
    	if(typeof amt != "number") {
    		throw "AMOUNT WAS NOT A NUMBER";
    	}
        console.log(this.players[plyIdx].name + " is trying to push " + amt + "...");
        if(amt <= this.players[plyIdx].money) {
            
            if(this.roundBets[plyIdx] + amt > this.maxBet){
                this.roundBets[plyIdx] += amt;
                this.totalBets[plyIdx] += amt;
                this.pot += amt;
                this.players[plyIdx].money -= amt;
                var allIn = this.players[plyIdx].money == 0;
                
                var prevMaxBet = this.maxBet;
                this.maxBet = this.roundBets[plyIdx];
                this.lastRaiser = plyIdx;

                if(prevMaxBet == 0){
                    this.informPlayers("bet", plyIdx, this.roundBets[plyIdx], this.pot, this.players[plyIdx].money, allIn);
                } else {
                    this.informPlayers("raise", plyIdx, this.roundBets[plyIdx], this.pot, this.players[plyIdx].money, allIn);
                }
                
            } else if(this.roundBets[plyIdx] + amt <= this.maxBet) {
                this.roundBets[plyIdx] += amt;
                this.totalBets[plyIdx] += amt;
                this.pot += amt;
                this.players[plyIdx].money -= amt;
                var allIn = this.players[plyIdx].money == 0;

                this.informPlayers("call", plyIdx, this.roundBets[plyIdx], this.pot, this.players[plyIdx].money, allIn);
            }
            console.log("   SUCCESS")
            return true;
        } else {
            console.log("   FAIL, can't afford")
            return false;
        }
    }


}

if(shared.first){

    shared.first = false;
}

function sendRoomData(){
    retArr = [];
    for(var i=0; i<rooms.length; i++){
        room = rooms[i];
        retArr[i] = {name: room.name, moneyData: [room.startMoney, room.bigBlind, room.smallBlind], plyData: [room.numPlayers, room.maxPlayers], public: (room.pass == "")}
    }
    socket.emit("pokerRoomData", JSON.stringify({data: retArr}))
}

emitter.on("roomDataChange", sendRoomData);
socket.on("reqRoomData", sendRoomData);

socket.on("pokerNewRoom", function(name, pass, startAmt, bigBlind, userName){
    name = name || "";
    name = name.split("\n").join("");
    pass = pass || "";
    startAmt = startAmt || 1000;
    bigBlind = bigBlind || 100;
    userName = userName || "Default";
    for(var i=0; i<rooms.length; i++){
        if(rooms[i].name.toLowerCase() == name.toLowerCase()){
            socket.emit("pokerNewRoomRes", 400, "Room name already taken!");
            return;
        }
    }
    if(name === ""){
        socket.emit("pokerNewRoomRes", 400, "Room name cannot be empty!");
        return;
    }
    if(!isNaN(name)){
        socket.emit("pokerNewRoomRes", 400, "Room name cannot be a number!");
        return;
    }
    if(name.length > 50){
        socket.emit("pokerNewRoomRes", 400, "Room name cannot be longer than 50 characters.");
        return;
    }
    if(rooms.length == 99){
        socket.emit("pokerNewRoomRes", 400, "There are currently too many rooms to create a new one.");
        return;
    }
    rooms.push(new Poker_room(name, pass, startAmt, bigBlind, socket, userName));
    socket.emit("pokerNewRoomRes", 200, rooms.length - 1);
    emitter.emit("roomDataChange");
});

socket.on("pokerJoinRoom", function(roomName, userName, pass){
    roomName = roomName || "";
    userName = userName || "Default";
    pass = pass || "";
    for(var i=0; i<rooms.length; i++){
        if(rooms[i].name == roomName){
            room = rooms[i];
            if(room.pass == pass){

                var joined = room.addPlayer(socket, userName);
                if(joined){
                	socket.emit("pokerJoinRoomRes", 200, i);
                } else {
                	socket.emit("pokerJoinRoomRes", 400, "Room full");
                }
            } else {
                socket.emit("pokerJoinRoomRes", 400, "Incorrect password");
            }
            return;
        }
    }
});

socket.on("nextTurn", function(roomIdx, ...data){
    if( (!roomIdx) && roomIdx !== 0 ){
        return;
    }
    var game = TH_games[roomIdx];
    if(!game){return;}
    ply = game.players[game.plyTurn];
    if(socket == ply.socket){
        game.nextTurn(...data);
    }
});