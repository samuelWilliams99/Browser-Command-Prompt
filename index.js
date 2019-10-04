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
        helper: "libs/helper",
        optional: "libs/optional"
    },
});

// Put server/client indicator in global env
__SERVER = true;
__CLIENT = false;

requirejs(["express", "http", "socket.io", "program", "fs"], function(express, http, socketio, p, fs) {
	const app = express();
	const server = http.Server(app);
	const io = socketio(server);

	const PORT = process.env.PORT || 5000

	const programNames = getProgramNames(fs);

	app.get('/', function(req, res){
		res.sendFile(__dirname + '/shared/index.html');
		app.use(express.static(__dirname + '/shared'));
	});

	io.on('connection', function(socket){
		console.log("Connection from " + socket.id);

		socket.on("PM.requestPrograms", function() {
			socket.emit("PM.getPrograms", programNames);
		});
	});

	server.listen(PORT, function(){
	  	console.log('listening on *:'+PORT);
	});
});

function getProgramNames(fs) {
	var out = [];
	fs.readdirSync("shared/js/programs").forEach(file => {
		if(/^[a-zA-Z0-9_]+\.js$/.test(file)) {
			out.push(file.substring(0, file.length-3));
		}
	});
	return out;
}
