requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: 'libs/jquery-3.4.1',
        socketio: '/socket.io/socket.io.js',
        console: 'base/console',
        emitter: 'libs/emitter',
        program: 'base/program_manager',
        timer: "libs/timer",
        helper: "libs/helper"
    }
});

require(["jquery", "socketio", "timer", "emitter"], 
function( $,        socket,     timer,   emitter) {
    require(["console", "program"], function(c, p) {
        
    })
})
