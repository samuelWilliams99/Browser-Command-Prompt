requirejs.config({
    baseUrl: 'js',
    paths: {
        jquery: 'libs/jquery-3.4.1',
        socketio: '/socket.io/socket.io.js',
        console: 'base/console',
        emitter: 'libs/emitter'
    }
});

require(["jquery", "socketio", "emitter"], 
function( $,        socket,     emitter) {
    require(["console"], function(c) {
        emitter.on("console.keyDown", "test", function(key) {
            console.log("down " + key);
        });
        emitter.on("console.keyUp", "test", function(key) {
            console.log("up " + key);
        });
        emitter.on("console.keyPress", "test", function(key) {
            console.log("press " + key);
        });
    })


})
