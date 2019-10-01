# Browser-Command-Prompt
Browser Command Prompt (BCP), as the name suggests, is a command prompt built from scratch in javascript.  
It will act as a host for my future projects (ARM Assembler, JSKell: a javascript haskell-like language compiler, etc.)  
This is a rewrite of [the previous version](https://secret-eyrie-92934.herokuapp.com/) using a requireJS, a proper program manager, and more shell features.  
The master branch of this project is hosted [here](http://browsercmd.com/)  
Note: This project serves no real purpose other than as a challenge to myself. I'm making this for fun, not for utility.

## Features
- Program manager, which will keep track of permissions, events, socketio, etc. for any program
- File manager, which is implement a global (G:/) drive (for files stored on a database), a persistant (P:/) drive (which persists for a user) and a local (C:/) drive, which exists for the duration of the connection.
- Shell, which will support most of the windows/linux command line features (flags, switches, operators, streams, etc.)
- User system, users can create accounts in order to have permissions and a persistant drive.
- Poker game (ported from previous version of this project)
- Lua environment, including lua repl, and lua env for programs (the programs "nano" and "arm" are written in lua)

## Installation
- Install [Docker](https://www.docker.com/)
- Run build.bat / build.sh, depending on your OS (you may need to run `chmod +x ./build.sh` on linux)

## Usage
Once running, you'll be able to connect to localhost:5000, you can then run "help" to see all the programs

## Dependencies
- [Jquery](https://jquery.com/)
- [RequireJS](https://requirejs.org/?)
- [Express](https://expressjs.com/)
- [Socket.io](https://socket.io/)
- [MongoDB](https://mongodb.github.io/node-mongodb-native/)

## Other
- [Trello](https://trello.com/b/k41fAIvu/bcp)