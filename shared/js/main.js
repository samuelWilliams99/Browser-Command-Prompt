requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: 'libs/jquery-3.4.1',
        "socket.io": '/socket.io/socket.io.js',
        console: 'base/console',
        emitter: 'libs/emitter',
        program: 'base/program_manager',
        timer: "libs/timer",
        net: "libs/net",
        helper: "libs/helper",
        optional: "libs/optional"
    }
});

// Put server/client indicator in global env
__SERVER = false;
__CLIENT = true;

requirejs(["jquery", "socket.io", "timer", "emitter"], 
function( $,        socketio,     t,        e) {
    var socket = socketio.connect();

    // Reload if lost connect (on server reload)
    socket.on("reconnect_attempt", function(){
        location.reload();
    })

    var emitter = new e();

    requirejs(["console", "program"], function(c, p) {
        p.setSocket(socket);
        c.setEmitter(emitter);
    })
})
