requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: 'libs/jquery-3.4.1',
        socketio: '/socket.io/socket.io.js',
        console: 'base/console',
        emitter: 'libs/emitter',
        program: 'base/program_manager'
    }
});

require(["jquery", "socketio", "emitter"], 
function( $,        socket,     emitter) {
    require(["console", "program"], function(c, p) {
        c.setLine(0, "This project is a ", c.Color(0,255,0), "Work In Progress", c.Color(255,255,255), "!");
    })
})
