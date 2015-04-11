/*
 * TODO:
 * 	Gameplay...
 * 	Player ready functions and stuff. When all players are ready admin may start the game
 */
//console.log('You can change startup options: node server.js "<secretKey>" <port> <ip>');
var port = process.argv[3] || 8080;
var ip = /*process.argv[4] || */"0.0.0.0";
var io = require('socket.io').listen(port/*, ip*/);
var fs = require('fs');
require('./ServerObject');
var secretKey = process.argv[2] || "secret";
var version = 0.044;

var tickRate = 60;
var serverTickLoopsWaiting = 1;
var resetOnNextTick = false;
var IPs = {};

var nrOfplayers = -1;
var players = {};
var serverStatus = 'idle';

var nextUserId = 0;

var adminUID = "";

function reset() {
	resetOnNextTick = false;
	io.sockets.emit('disconnect');
	log('Server reset');
	log('Entering idle');
	nrOfplayers = -1;
	serverStatus = 'idle';
	adminUID = "";
	players = {};
}

function log(message, admin) {
	d = new Date();
	console.log(d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds() + '.' + d.getMilliseconds() + ': ' + message);
	if (admin) {
		// broadcast to admin
		players[adminUID].socket.emit('admin-recieve-log', JSON.stringify({
			'message' : message
		}));
	}
}
function loguid(uid, message, admin) {
	d = new Date();
	log('Client [' + uid + ']<'+(uid === adminUID ? 'ADMIN' : 'USER')+'> ' + message, admin);
}

function serverTick() {
	if (resetOnNextTick) {
		reset();
	}
	data = {};
	for (a in players) {
		if (!players[a]) {
			continue;
		}
		if (serverStatus == 'game') {

		} else if (serverStatus == 'lobby') {

		}
		players[a].recievedHeartbeat = false;
	}
	if (serverStatus == 'game') {
		tickRate = 17;
	} else if (serverStatus == 'lobby') {
		tickRate = 1000;
	} else if (serverStatus == 'idle') {
		tickRate = 5000;
	}
	io.sockets.emit('server tick', JSON.stringify(data));
	setTimeout(serverTick, tickRate);
}

// do some awesome checking, and timeout people and stuff
setInterval(function() {
	for (a in players) {
		if (players[a] === undefined) {
			continue;
		}
		if (players[a].cmdrate > Server.getVar('max_cmdrate').value) {
			loguid(a, 'reached max cmdrate and was kick from the server', true);
			players[a].socket.disconnect();
		}
		if (players[a].msgTimeout !== false && Date.now() > players[a].msgTimeout) {
			loguid(a, 'can now use the chat again');
			players[a].msgTimeout = false;
		}
		if (players[a]) {
			players[a].cmdrate = 0;
			players[a].msgrate = 0;
		}
		if (players[a].verified === false) {
			if (players[a].socket.handshake.query.t.substr(0,13) < Date.now() + 2000) {
				loguid(a, 'Kicked, reason: No verification');
				players[a].socket.disconnect();
				return;
			}
		}
		if (players[a].kickFlag === false && Date.now() > players[a].lastHeartbeat + 1000) {
			players[a].kickFlag = Date.now();
		}
		if ((players[a].kickFlag !== false && Date.now() >  players[a].kickFlag + Server.getVar('kick_delay').value)) {
			loguid(a, 'Kicked, reason: AFK/timeout');
			if (players[a] && players[a].socket) {
				players[a].socket.disconnect();
			}
			if (adminUID === a) {
				io.sockets.emit('admin-leave');
				reset();
			}
			delete players[a];
		}
	}
}, 1000);

io.set('authorization', function(req, callback) {
	var ip = req.socket.address().address;
	var token = encodeURIComponent(req._query.token);
	token = token.replace(/%2B/g, "%20");
	var encoded_secretKey = encodeURIComponent(secretKey);
	if (token === undefined || token.length === 0) {
		log('Unauthorized user from ' + ip);
		return callback('Unauthorized', false);
	}
	var validated = false;
	if (token == encoded_secretKey) {
		validated = true;
	}

	if (validated) {
		return callback(null, true);
	} else {
		log('Unauthorized user from ' + ip);
		return callback('Unauthorized', false);
	}
	return callback('Unauthorized', false);
});

io.sockets.on('connection', function(socket) {
	//console.log(socket);
	if (serverStatus == 'idle') {
		nrOfplayers = 0;
		log('Leaving idle');
		serverStatus = 'lobby';
		//serverTick();
	}
	/*if (socket.handshake.query.token != secretKey || IPs[socket.handshake.address.address]) {
		socket.disconnect();
		return false;
	}*/
	socket.UID = nextUserId;
	nextUserId++;
	log('Client [' + socket.UID + '] connected from: ' + socket.handshake.address.address);
	//IPs[socket.handshake.address.address] = true;
	// set player stuff
	nrOfplayers++;

	socket.on('verify-version', function(data) {
		data = JSON.parse(data);
		if (data.v != version) {
			loguid(socket.UID, 'is running version ' + data.v + '. Server is running version ' + version);
			socket.disconnect();
			return;
		}
		if (nrOfplayers <= 1 && adminUID === "") {
			nrOfplayers = 1;
			adminUID = socket.UID;
			socket.emit('setadmin');
		}

		players[socket.UID] = new SO.Player(socket);
		loguid(socket.UID, 'Authorized');
		players[socket.UID].verified = true;

		var usersArray = {};
		for (a in players) {
			usersArray[a] = {
				name: players[a].username
			}
		}
		if (serverStatus == 'game') {
			socket.emit('game-in-progress');
		}
		socket.emit('accept-user', JSON.stringify({
			UID: socket.UID
		}));
		socket.emit('server-status', JSON.stringify({
			status: serverStatus
		}));
		socket.emit('connected-users', JSON.stringify(usersArray));
		socket.broadcast.emit('newuser', JSON.stringify({
			UID: socket.UID
		}));
	});

	socket.on('disconnect', function() {
		//delete IPs[socket.handshake.address.address];
		nrOfplayers--;
		loguid(socket.UID, 'disconnected');
		if (socket.UID === adminUID) {
			resetOnNextTick = true;
			//io.sockets.emit('admin-leave');
			//reset();
		} else {
			socket.broadcast.emit('userdisconnect', JSON.stringify({
				UID: socket.UID
			}));
		}
		if (nrOfplayers <= 0) {
			//reset();
		}
		delete players[socket.UID];
	});

	socket.on('set-username', function(data) {
		data = JSON.parse(data);
		if (players[socket.UID] && players[socket.UID].username == undefined) {
			if (data.username !== undefined) {
				var username = HTMLEncode(data.username.replace(/\[|\]|<|>|\/|\\|\{|\}|\s|\(|\)/g, ''));
				if (username.length > 16 || username.length < 3) {
					log(socket.UID, 'is trying to use an invalid username: "' + data.username + '"');
					username = 'User';
				}
				players[socket.UID].username = username;
				io.sockets.emit('change-username', JSON.stringify({
					userid: socket.UID,
					username: username
				}));
			}
		}
	});

	socket.on('lobby-new-message', function(data) {
		data = JSON.parse(data);
		players[socket.UID].msgrate++;
		if (players[socket.UID].msgrate > Server.getVar('max_msgrate').value) {
			players[socket.UID].msgTimeout = (players[socket.UID].msgTimeout === false ? Date.now() + 10000 : players[socket.UID].msgTimeout + 10000);
			loguid(socket.UID, 'is spamming the lobby chat and has been timed out for 10 seconds', true);
			socket.emit('chat-timeout');
			return;
		}
		if (players[socket.UID].msgTimeout !== false) {
			return;
		}
		var content = HTMLEncode(data.content);
		console.log(content);
		if (content !== undefined && content.length > 0) {
			var message = {
				user: {
					UID: socket.UID,
					name: escape(players[socket.UID].username)
				},
				content: escape(content.trim()),
				timestamp: escape(Date.now())
			};
			loguid(socket.UID, 'sent a message in lobby');
			io.sockets.emit('lobby-new-message', JSON.stringify(message));
		}
	});

	socket.on('new-command', function(data) {
		data = JSON.parse(data);
		loguid(socket.UID, 'sent command: ' + data.content);
		if (data.content && data.content.length > 0) {
			var c = data.content.split(" ");
			var r = handleCommand(c, socket.UID);
			//console.log(r);
			socket.emit('command-response', JSON.stringify(r));
		}
	});

	socket.on('start-game', function(data) {
		data = JSON.parse(data);
		if (data.UID === adminUID) {

		}
	});

	// change data = Object instead of string
	socket.on('client update', function(data) {
		data = JSON.parse(data);
		//console.log(data);
		if (players[data.UID]) {
			players[data.UID].cmdrate++;

			players[data.UID].recievedHeartbeat = true;
			if (players[data.UID].lastHeartbeat) {
				players[data.UID].timeOnServer += Date.now() - players[data.UID].lastHeartbeat;
			}
			players[data.UID].lastHeartbeat = Date.now();
			players[data.UID].kickFlag = false;

			if (serverStatus == 'game') {

			} else if (serverStatus == 'lobby') {

			}

		} else {
			socket.disconnect();
			delete players[a[0]];
		}
	});
});

if (io) {
	console.log('Ctrl+C to shutdown server')
	log('Server running on ' + ip + ':' + port);
	log('Secret key: "' + secretKey + '"');
	log('Server is in idle');
	//reset();
	serverTick();
}


varHelpText = [];
varHelpText.push('<p>help - Displays this help text</p>');
varHelpText.push('<p>reset - Reset the server, kicking every connected client</p>');
varHelpText.push('<p>kick - kick &lt;UID&gt; - Kick player</p>');
varHelpText.push('<p>var - var &lt;var&gt; &lt;value&gt;</p>');
function handleCommand(c, user) {
	var r = {};
	if (c[0] == 'help') {
		r['message'] = varHelpText;
	} else if(c[0] == 'ping') {
		r['message'] = 'pong';
	}
	if (user === adminUID) {
		if (c[0] == 'var') {
			//console.log(c);
			if (c[1]) {
				if (Server.Vars[c[1]]) {
					if (c[2] && Server.setVar(c[1], c[2])) {
						r['message'] = 'Server Var ' + c[1] + ' set to ' + c[2];
					} else {
						r['message'] = '<p><strong>' + c[1] + '</strong></p>' +
							'<p>Current value: ' + Server.Vars[c[1]].value + '</p>' +
							'<p>Default value: ' + Server.Vars[c[1]].def + '</p>' +
							'<p>Max value: ' + Server.Vars[c[1]].max + '</p>' +
							'<p>Min value: ' + Server.Vars[c[1]].min + '</p>';
					}
				} else {
					r['message'] = 'Server var ' + c[1] + ' does not exist';
				}
			} else {
				r['message'] = varHelpText[3];
			}
		}
		if (c[0] == 'kick') {
			if (c[1]) {
				if (players[c[1]]) {
					r['message'] = 'Kicked client' + c[1];
					loguid(user, 'kicked client ' + c[1]);
					players[c[1]].socket.disconnect();
				} else {
					r['message'] = 'Client ' + c[1] + ' is not on the server';
				}
			} else {
				r['message'] = varHelpText[2];
			}
		} else if (c[0] == 'reset') {
			reset();
		} else if (c[0] == 'shutdown') {
			//process.exit();
			r['message'] = 'Command is not enabled on the server';
		}
	}
	return r;
}

/*
 * Encode string with html special chars
 */
var HTMLEncodeMAP = {
		'&' : '&amp;',
		'<' : '&lt;',
		'>' : '&gt;',
		'"' : '&quot;',
		'\'' : '&#39;'
};
function HTMLEncode(str) {
	return str.replace(/[&<>'"]/g, function(c) {
		return HTMLEncodeMAP[c];
	});
}
