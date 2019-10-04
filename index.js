const requirejs = require("requirejs");

requirejs.config({
    //Pass the top-level main.js/index.js require
    //function to requirejs so that node modules
    //are loaded relative to the top-level JS file.
    nodeRequire: require,
    baseUrl: "shared/js",
    paths: {
    	emitter: 'libs/emitter',
        program: 'base/program_manager',
        timer: "libs/timer",
        helper: "libs/helper"
    }
});

requirejs(["express", "http", "socket.io", "fs", "emitter"], function(express, http, socket, fs) {
	const app = express();
	const server = http.Server(app);
	const io = socket(server);

	const PORT = process.env.PORT || 5000

	app.get('/', function(req, res){
		res.sendFile(__dirname + '/shared/index.html');
		app.use(express.static(__dirname + '/shared'));
	});



	server.listen(PORT, function(){
	  	console.log('listening on *:'+PORT);
	});
});