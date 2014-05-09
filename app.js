
/**
 * Module dependencies.
 */
var config = require("config");

//add timestamps to each console function
//https://github.com/mpalmerlee/console-ten
var consoleTEN = require('console-ten');
consoleTEN.init(console, consoleTEN.LEVELS[config.loglevel]);

var WebSocketServer = require('ws').Server;

var express = require('express')
  , http = require('http')
  , path = require('path');


var models = require("./models/models");
var gameController = require("./controllers/game_controller");

var clientFiles = require('./client_file_registry.js');

var app = express();

// all environments
app.set('host', process.env.OPENSHIFT_NODEJS_IP || 'localhost');
app.set('port', process.env.OPENSHIFT_NODEJS_PORT || process.env.PORT || config.ws_port || 8000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());

var parseCookie = express.cookieParser(config.cookie.secret);
app.use(parseCookie);

var MongoStore = require('connect-mongo')(express);
var sessionStore = new MongoStore({
	db: process.env.MONGODB_SESSION_DB_NAME || config.mongodb.sessiondb_name,
	host: process.env.OPENSHIFT_MONGODB_DB_HOST || process.env.MONGODB_DB_HOST || config.mongodb.host,
	port: process.env.OPENSHIFT_MONGODB_DB_PORT || process.env.MONGODB_DB_PORT || config.mongodb.port,
	username: process.env.OPENSHIFT_MONGODB_DB_USERNAME || process.env.MONGODB_DB_USERNAME || config.mongodb.username,
	password: process.env.OPENSHIFT_MONGODB_DB_PASSWORD || process.env.MONGODB_DB_PASSWORD || config.mongodb.password
});

app.use(express.session({
	secret: config.cookie.secret,
	store: sessionStore
}));

app.use(app.router);
//app.use(express.compress());//NOTE: this ended up being slower on OPENSHIFT (probably because of increased cpu usage)
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 30 * 24 * 60 * 60 }));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/test', function(req, res){
	res.render('test', { title: 'Astriarch' });
});

app.get('/', function(req, res){
	gameController.GetHighScoreBoard(10, function(err, results){
		results = results || [];
		res.render("astriarch", {"port":config.ws_port, "use_compressed_js": config.use_compressed_js, "file_list_external": clientFiles.clientFilesExternal, "file_list_internal": clientFiles.clientFilesInternal, "top_rulers":results});
	});
});

var server = http.createServer(app).listen(app.get('port'), app.get('host'), function(){
	console.log('Express server listening on port ' + app.get('port'));
	if(config.cleanup_old_games.enabled){
		cleanupOldGames();
	}
});

var cleanupOldGames = function(){
	gameController.cleanupOldGames(function(err){
		setTimeout(function(){cleanupOldGames()}, config.cleanup_old_games.check_interval_seconds * 1000);
	});
};


var Astriarch = require("./public/js/astriarch/astriarch_loader");

var wss = new WebSocketServer({server: server});
wss.on('connection', function(ws) {

	parseCookie(ws.upgradeReq, null, function(err) {
		var sessionId = ws.upgradeReq.signedCookies['connect.sid'];// ws.upgradeReq.cookies['connect.sid'];
		console.log("SessionId: ", sessionId);
		/*
		sessionStore.get(sessionId, function(err, sess) {
			console.log("Session: ", sess);
		});

		*/

		ws.on('message', function(data, flags) {
			console.debug("Message received:", data, sessionId);


			var message = new Astriarch.Shared.Message();
			if (!flags.binary) {
				var parsedMessage = JSON.parse(data);
				message = new Astriarch.Shared.Message(parsedMessage.type, parsedMessage.payload);
			}

			switch(message.type){
				case Astriarch.Shared.MESSAGE_TYPE.NOOP:
					message.payload.message = "Hello From the Server";
					message.payload.counter = (message.payload.counter || 0) + 1 ;
					ws.send(JSON.stringify(message));
					break;
				case Astriarch.Shared.MESSAGE_TYPE.PING:
					break;
				case Astriarch.Shared.MESSAGE_TYPE.JOIN_CHAT_ROOM:
					//we need to join the user to the lobby chat room
					var gameId = message.payload.gameId ? message.payload.gameId : null;
					var session = {sessionId:sessionId, playerName:message.payload.playerName, playerNumber: message.payload.playerNumber, gameId:gameId};
					gameController.JoinChatRoom(gameId, session, function(err, newChatRoomWithSessions, oldChatRoomWithSessions){
						//broadcast to all other sessions in the chat room that a player just logged in
						sendChatRoomSessionListUpdates(ws, sessionId, newChatRoomWithSessions);
						if(oldChatRoomWithSessions) {
							sendChatRoomSessionListUpdates(ws, sessionId, oldChatRoomWithSessions);
						}
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.LOGOUT:
					break;
				case Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES:
					gameController.ListLobbyGames({sessionId: sessionId}, function(err, docs){
						message.payload = docs;
						ws.send(JSON.stringify(message));
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS:
					gameController.UpdateGameOptions(message.payload, function(err, game){
						//broadcast to other players
						broadcastMessageToOtherPlayers(game, sessionId, message);

						sendUpdatedGameListToLobbyPlayers(game);
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.CHANGE_PLAYER_NAME:
					gameController.ChangePlayerName({playerName:message.payload.playerName, gameId:message.payload.gameId, sessionId:sessionId}, function(err, game){
						//broadcast to other players
						var broadcastMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, {gameOptions:game.gameOptions});
						broadcastMessageToOtherPlayers(game, sessionId, broadcastMessage);

						ws.send(JSON.stringify(broadcastMessage));
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.CREATE_GAME:
					gameController.CreateGame({name:message.payload.name, players:[{name:message.payload.playerName, sessionId:sessionId, position:0}]}, function(err, doc){
						message.payload = doc["_id"];
						ws.send(JSON.stringify(message));

						//update the players in the lobby for the new game
						sendUpdatedGameListToLobbyPlayers(doc);
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME:
					gameController.JoinGame({gameId:message.payload.gameId, sessionId:sessionId, playerName:message.payload.playerName}, function(err, game, playerPosition){
						console.log("Player" + playerPosition + " Joined, sessionId: ", sessionId);
						message.payload = {gameOptions:game.gameOptions, name:game.name, playerPosition: playerPosition};
						message.payload["_id"] = game["_id"];
						ws.send(JSON.stringify(message));

						//broadcast to other players
						var broadcastMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, message.payload);
						broadcastMessageToOtherPlayers(game, sessionId, broadcastMessage);

						sendUpdatedGameListToLobbyPlayers(game);
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME:
					gameController.ResumeGame({sessionId: sessionId, gameId: message.payload.gameId}, function(err, doc, player){
						var serializableClientModel = getSerializableClientModelFromSerializableModelForPlayer(doc.gameData, player);
						message.payload = {gameData: serializableClientModel, playerPosition: player.position};
						ws.send(JSON.stringify(message));
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.START_GAME:
					gameController.StartGame({sessionId:sessionId, gameOptions:message.payload}, function(err, serializableModel, game){
						if(err){
							console.error("gameController.StartGame:", err);
							message.payload = err;
							message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
							if(err.type == Astriarch.Shared.ERROR_TYPE.INVALID_GAME_OPTIONS){
								message.payload = "Invalid Game Options!";
							}
							ws.send(JSON.stringify(message));
						} else {
							//for each player we need to create a client model and send that model to the player
							console.log("gameController.StartGame players: ", game.players);
							for(var p = 0; p < game.players.length; p++){
								var player = game.players[p];
								var serializableClientModel = getSerializableClientModelFromSerializableModelForPlayer(serializableModel, player);
								//player.sessionId
								message.payload = serializableClientModel;
								wss.broadcastToSession(player.sessionId, message);
							}
						}
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_START:
					gameController.StartUpdatePlanet({sessionId:sessionId}, message.payload, function(err){
						if(err){
							console.error("gameController.StartUpdatePlanet: ", err);
						}
					});

					break;
				case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_FINISH:
					gameController.FinishUpdatePlanet({sessionId:sessionId}, message.payload, function(err){
						if(err){
							console.error("gameController.FinishUpdatePlanet: ", err);
						}
					});

					break;
				case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE:
					gameController.UpdatePlanetBuildQueue(sessionId, message.payload, function(err){
						if(err){
							console.error("gameController.UpdatePlanetBuildQueue: ", err);
							message.payload = {"error":err};
							ws.send(JSON.stringify(message));
						}
					});

					break;
				case Astriarch.Shared.MESSAGE_TYPE.SEND_SHIPS:
					gameController.SendShips(sessionId, message.payload, function(err){
						if(err){
							console.error("gameController.SendShips: ", err);
							message.payload = {"error":err};
							ws.send(JSON.stringify(message));
						}
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.END_TURN:
					gameController.EndPlayerTurn(sessionId, message.payload, function(err, data){
						if(err){
							console.error("gameController.EndPlayerTurn: ", err);
							message.payload = {"error":err};
							ws.send(JSON.stringify(message));
							return;
						}
						// data = {"allPlayersFinished": true|false, "endOfTurnMessagesByPlayerId": null, "destroyedClientPlayers":null, "game": doc};
						var payloadOrig = {"allPlayersFinished":data.allPlayersFinished, "endOfTurnMessages":null, "destroyedClientPlayers":data.destroyedClientPlayers};
						if(data.allPlayersFinished){

							var winningSerializablePlayer = null;
							var destroyedHumanClientPlayersById = {};
							if(data.destroyedClientPlayers){
								//check to see if there are any human players destroyed
								//	those players need GAME_OVER messages instead of END_TURN messages
								for(var i in data.destroyedClientPlayers){
									var cp = data.destroyedClientPlayers[i];
									if(cp.Type == Astriarch.Player.PlayerType.Human){
										destroyedHumanClientPlayersById[cp.Id] = cp;
									}
								}

								//check to see if there is only one player left
								if(data.game.gameData.SerializablePlayers.length == 1){
									winningSerializablePlayer = data.game.gameData.SerializablePlayers[0];
								}
							}

							//broadcast turn ended to all players with a message per player for that player's end of turn event messages
							var playersBySessionKey = getOtherPlayersBySessionKeyFromGame(data.game, null);//pass null as second arg to get all players
							for(var sk in playersBySessionKey){
								var player = playersBySessionKey[sk];
								var payload = JSON.parse(JSON.stringify(payloadOrig));//poor man's clone
								payload.endOfTurnMessages = [];
								if(player.Id in data.endOfTurnMessagesByPlayerId){
									payload.endOfTurnMessages = data.endOfTurnMessagesByPlayerId[player.Id];
								}

								payload.gameData = getSerializableClientModelFromSerializableModelForPlayer(data.game.gameData, player);

								var playerMessage = null;
								if(player.Id in destroyedHumanClientPlayersById || winningSerializablePlayer){
									var playerWon = (winningSerializablePlayer && winningSerializablePlayer.Id == player.Id);
									//calculate end of game score
									var score = Astriarch.ServerController.CalculateEndGamePoints(data.gameModel, player.Id, data.game.gameOptions.opponentOptions, playerWon);

									//add high score entry
									var highScoreBoardSession = {sessionId:sessionId, playerName:player.name, playerNumber: player.position, playerPoints:score, gameId:gameId};
									gameController.AddHighScoreBoardEntry(highScoreBoardSession);

									payload = {"winningSerializablePlayer": winningSerializablePlayer, "playerWon": playerWon, "score":score, "endOfTurnMessages":payload.endOfTurnMessages, "gameData":payload.gameData};
									playerMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.GAME_OVER, payload);
								} else {
									playerMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.END_TURN, payload);
								}

								if(sk != sessionId){
									wss.broadcastToSession(sk, playerMessage);
								} else {
									ws.send(JSON.stringify(playerMessage));
								}
							}
						} else {
							message.payload = payloadOrig;
							ws.send(JSON.stringify(message));
						}

					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.SUBMIT_TRADE:
					gameController.SubmitTrade(sessionId, message.payload, function(err, data) {
						if (err) {
							console.error("gameController.SubmitTrade: ", err);
							message.payload = {"error": err};
							ws.send(JSON.stringify(message));
						}
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.CANCEL_TRADE:
					gameController.CancelTrade(sessionId, message.payload, function(err, data) {
						if (err) {
							console.error("gameController.CancelTrade: ", err);
							message.payload = {"error": err};
							ws.send(JSON.stringify(message));
						}
					});
					break;
				case Astriarch.Shared.MESSAGE_TYPE.TEXT_MESSAGE:
					//TODO: get the player name and player number from the existing chatRoom so they can't as easily spoof that
					message.payload.text = (message.payload.text || "").trim();
					if(message.payload.text){
						var chatLogMessage = {text: message.payload.text, sentByPlayerName: message.payload.sentByPlayerName, sentByPlayerNumber: message.payload.sentByPlayerNumber, sentBySessionId: sessionId};
						gameController.AddMessageToChatRoom(message.payload.gameId, chatLogMessage, function(err, doc){
							//broadcast to all other sessions in the chat room
							var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.TEXT_MESSAGE,{text: message.payload.text, sentByPlayerName: message.payload.sentByPlayerName, sentByPlayerNumber: message.payload.sentByPlayerNumber, dateSent:new Date().getTime()});
							for(var s = 0; s < doc.sessions.length; s++){
								var session = doc.sessions[s];
								if(session.sessionId != sessionId){
									wss.broadcastToSession(session.sessionId, messageForPlayers);
								}
							}
						});
					}
					break;
				default:
					console.error("Unhandled Message Type: ", message.type);
					break;
			}

		});
	});

	ws.on('close', function() {
		parseCookie(ws.upgradeReq, null, function(err) {
			var sessionId = ws.upgradeReq.signedCookies['connect.sid'];
			console.log('connection closed for session: ', sessionId);
			gameController.LeaveChatRoom(sessionId, function(err, chatRoomWithSessions){
				console.log("Leaving Chat Room: ", err, chatRoomWithSessions);
				if(chatRoomWithSessions) {
					sendChatRoomSessionListUpdates(ws, null, chatRoomWithSessions);
				}
			});
		});
	});

});

var sendUpdatedGameListToLobbyPlayers = function(gameDoc){
	console.debug("sendUpdatedGameListToLobbyPlayers:", gameDoc);
	var gameSummary = gameController.GetGameSummaryFromGameDoc(gameDoc);
	var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.GAME_LIST_UPDATED, gameSummary);
	gameController.GetChatRoomWithSessions(null, function(err, chatRoom){
		if(err){
			console.error("sendUpdatedGameListToLobbyPlayers.GetChatRoomWithSessions:", err);
		} else {
			for(var s = 0; s < chatRoom.sessions.length; s++){
				wss.broadcastToSession(chatRoom.sessions[s].sessionId, messageForPlayers);
			}
		}
	});
};

var sendChatRoomSessionListUpdates = function(ws, sessionId, chatRoomWithSessions){
	var cleanSessions = [], session = null;//This doesn't include other player session ids for security
	for(var s = 0; s < chatRoomWithSessions.sessions.length; s++){
		session = chatRoomWithSessions.sessions[s];
		cleanSessions.push({playerName:session.playerName, playerNumber: session.playerNumber, dateJoined: session.dateJoined});
	}
	var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.JOIN_CHAT_ROOM,{sessions:cleanSessions});
	for(var s = 0; s < chatRoomWithSessions.sessions.length; s++){
		session = chatRoomWithSessions.sessions[s];
		if(session.sessionId != sessionId){
			wss.broadcastToSession(session.sessionId, messageForPlayers);
		} else {
			ws.send(JSON.stringify(messageForPlayers));
		}
	}
};

var getSerializableClientModelFromSerializableModelForPlayer = function(serializableModel, targetPlayer){

	var mainPlayerOwnedSerializablePlanets = {};
	var serializableClientPlayers = [];
	var serializableMainPlayer = null;
	for(var p in serializableModel.SerializablePlayers){
		var player = serializableModel.SerializablePlayers[p];
		serializableClientPlayers.push(new Astriarch.SerializableClientPlayer(player.Id, player.Type, player.Name, player.Color, player.Points));
		if(player.Id == targetPlayer.Id){
			serializableMainPlayer = player;
		}
	}
	if(!serializableMainPlayer){
		//main player is destroyed
		for(var p in serializableModel.SerializablePlayersDestroyed){
			var player = serializableModel.SerializablePlayersDestroyed[p];
			if(player.Id == targetPlayer.Id){
				serializableMainPlayer = player;
			}
		}
	}
	var serializableClientPlanets = [];
	for(var p in serializableModel.SerializablePlanets){
		var planet = serializableModel.SerializablePlanets[p];
		var type = null;
		//has main player explored this planet?
		for(var i in serializableMainPlayer.KnownPlanetIds){
			if(serializableMainPlayer.KnownPlanetIds[i] == planet.Id){
				type = planet.Type;
				break;
			}
		}

		serializableClientPlanets.push(new Astriarch.SerializableClientPlanet(planet.Id, planet.Name, planet.OriginPoint, type));

		//does main player own this planet?
		for(var i in serializableMainPlayer.OwnedPlanetIds){
			if(serializableMainPlayer.OwnedPlanetIds[i] == planet.Id){
				mainPlayerOwnedSerializablePlanets[planet.Id] = planet;
				break;
			}
		}
	}

	var tc = serializableModel.TradingCenter;
	var clientPlayerTrades = [];
	//collect trades for targetPlayer
	for(var t in tc.currentTrades){
		var trade = tc.currentTrades[t];
		if(trade.playerId == targetPlayer.Id){
			clientPlayerTrades.push(trade);
		}
	}

	var clientTradingCenter = new Astriarch.ClientTradingCenter(tc.goldAmount, tc.foodResource, tc.oreResource, tc.iridiumResource, clientPlayerTrades);

	var serializableClientModel = new Astriarch.SerializableClientModel(serializableModel.Turn.Number, serializableMainPlayer, serializableClientPlayers, serializableClientPlanets, mainPlayerOwnedSerializablePlanets, clientTradingCenter, {"TurnTimeLimitSeconds":serializableModel.TurnTimeLimitSeconds});

	return serializableClientModel;
};

var broadcastMessageToOtherPlayers = function(game, sessionId, message){
	var playersBySessionKey = getOtherPlayersBySessionKeyFromGame(game, sessionId);
	wss.broadcast(playersBySessionKey, message);
};

var getOtherPlayersBySessionKeyFromGame = function(game, currentPlayerSessionKey){
	var playersBySessionKey	= {};
	for(var p in game.players){
		var player = game.players[p];
		if(player.sessionId && player.sessionId != currentPlayerSessionKey){
			playersBySessionKey[player.sessionId] = player;
		}
	}
	return playersBySessionKey;
};

//broadcast sending
wss.broadcast = function(playersBySessionKey, message) {
	var data = JSON.stringify(message);
	for(var i in this.clients) {
		var client = this.clients[i];
		var clientSessionId = client.upgradeReq.signedCookies['connect.sid'];
		if(clientSessionId in playersBySessionKey){
			client.send(data);
		}
	}
};

wss.broadcastToSession = function(playerSessionKey, message) {
	var data = JSON.stringify(message);
	for(var i in this.clients) {
		var client = this.clients[i];
		var clientSessionId = client.upgradeReq.signedCookies['connect.sid'];
		if(clientSessionId == playerSessionKey){
			client.send(data);
		}
	}
};
