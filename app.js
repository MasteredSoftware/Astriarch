/**
 * Module dependencies.
 */
var config = require("config");

//add timestamps to each console function
//https://github.com/mpalmerlee/console-ten
var consoleTEN = require("console-ten");
consoleTEN.init(console, consoleTEN.LEVELS[config.loglevel]);

var WebSocketServer = require("ws").Server;

var express = require("express"),
  http = require("http"),
  async = require("async"),
  path = require("path");

var favicon = require("serve-favicon");
var morgan = require("morgan");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var expressSession = require("express-session");
var errorHandler = require("errorhandler");

var models = require("./models/models");
var wssInterface = require("./wss_interface");
var gameController = require("./controllers/game_controller");

var clientFiles = require("./client_file_registry.js");

var app = express();

// all environments
app.set("host", process.env.HOST || "localhost");
app.set("port", process.env.PORT || config.port || 8000);
app.set("ws_port", process.env.WS_PORT || config.ws_port || 8000);
app.set("ws_protocol", process.env.WS_PROTOCOL || config.ws_protocol || "ws");

app.use(favicon(path.join(__dirname, "public", "img", "favicon.ico")));
app.use(morgan("combined"));

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

//app.use(express.methodOverride());

var parseCookie = cookieParser(config.cookie.secret);
app.use(parseCookie);

var MongoStore = require("connect-mongo")(expressSession);
var sessionStore = new MongoStore({
  mongooseConnection: models.mongoose.connection
});

var month = 30 * 24 * 60 * 60 * 1000;

app.use(
  expressSession({
    secret: config.cookie.secret,
    store: sessionStore,
    cookie: { maxAge: month * 6 }
  })
);

//app.use(express.compress());//NOTE: this ended up being slower on OPENSHIFT (probably because of increased cpu usage)
app.use(express.static(path.join(__dirname, "public"), { maxAge: 30 * 24 * 60 * 60 }));

app.set("view engine", "pug");

// development only
if ("development" == app.get("env")) {
  app.use(errorHandler());
}

app.get("/test", function(req, res) {
  res.render("test", {
    port: app.get("ws_port"),
    ping_freq: config.ws_ping_freq,
    use_compressed_js: config.use_compressed_js,
    file_list_external: clientFiles.clientFilesExternal,
    file_list_internal: clientFiles.clientFilesInternal
  });
});

app.get("/", function(req, res) {
  async.auto(
    {
      top_rulers: function(cb) {
        gameController.GetHighScoreBoard(10, function(err, results) {
          if (err) {
            console.error("gameController.GetHighScoreBoard:", err);
          }
          results = results || [];
          cb(null, results);
        });
      },
      top_rulers_recent: function(cb) {
        gameController.GetHighScoreBoardRecent(10, function(err, results) {
          if (err) {
            console.error("gameController.GetHighScoreBoardRecent:", err);
          }
          results = results || [];
          cb(null, results);
        });
      }
    },
    function(err, results) {
      res.render("astriarch", {
        port: app.get("ws_port"),
        ws_protocol: app.get("ws_protocol"),
        ping_freq: config.ws_ping_freq,
        use_compressed_js: config.use_compressed_js,
        external_resource_connect: config.external_resource_connect,
        file_list_external: clientFiles.clientFilesExternal,
        file_list_internal: clientFiles.clientFilesInternal,
        top_rulers: results.top_rulers,
        top_rulers_recent: results.top_rulers_recent
      });
    }
  );
});

var server = http.createServer(app).listen(app.get("port"), function() {
  console.log("Express server listening at: " + app.get("host") + ":" + app.get("port"));
  setupUncaughtExceptionHandler();
});

var cleanupOldGames = function() {
  gameController.cleanupOldGames(function(err) {
    setTimeout(function() {
      cleanupOldGames();
    }, config.cleanup_old_games.check_interval_seconds * 1000);
  });
};

var checkForExpiredSessions = function() {
  gameController.cleanupExpiredSessions(config.client_timeout, function(err) {
    setTimeout(function() {
      checkForExpiredSessions();
    }, config.client_timeout);
  });
};

var initializeAfterWssConnected = function() {
  if (config.cleanup_old_games.enabled) {
    cleanupOldGames();
  }
  if (config.client_timeout) {
    checkForExpiredSessions();
  }
};

var Astriarch = require("./public/js/astriarch/astriarch_loader");

var wssInitialized = false;

var wss = new WebSocketServer({ server: server });

wss.on("listening", function() {
  console.log("Web Socket Server Listening.");
  if (!wssInitialized) {
    wssInitialized = true;
    wssInterface.init(wss);
    initializeAfterWssConnected();
  }
});

wss.on("connection", function(ws, req) {
  ws.upgradeReq = req; // for backwards compatibility see: https://github.com/websockets/ws/pull/1099
  parseCookie(ws.upgradeReq, null, function(err) {
    var sessionId = ws.upgradeReq.signedCookies["connect.sid"]; // ws.upgradeReq.cookies['connect.sid'];
    console.log("SessionId: ", sessionId);

    ws.on("message", function(data) {
      //touch session
      gameController.touchSession(sessionId, function(err) {
        if (err) {
          console.error("TouchSession Error: ", err);
        }
      });

      var message = new Astriarch.Shared.Message();
      try {
        var parsedMessage = JSON.parse(data);
        message = new Astriarch.Shared.Message(parsedMessage.type, parsedMessage.payload);
        console.info(Astriarch.Shared.GetMessageType(message.type), "Message received:", data, sessionId);
      } catch (e) {
        console.error("Issue parsing message:", data, e);
      }

      switch (message.type) {
        case Astriarch.Shared.MESSAGE_TYPE.NOOP:
          message.payload.message = "Hello From the Server";
          message.payload.counter = (message.payload.counter || 0) + 1;
          wssInterface.wsSend(ws, message);
          break;
        case Astriarch.Shared.MESSAGE_TYPE.PING:
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED:
          //This is a client bound message, the server shouldn't receive it
          break;
        case Astriarch.Shared.MESSAGE_TYPE.LOGOUT:
          break;
        case Astriarch.Shared.MESSAGE_TYPE.LIST_GAMES:
          gameController.ListLobbyGames({ sessionId: sessionId }, function(err, docs) {
            message.payload = docs;
            wssInterface.wsSend(ws, message);
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS:
          gameController.UpdateGameOptions(message.payload, function(err, game) {
            //broadcast to other players
            broadcastMessageToOtherPlayers(game, sessionId, message);

            sendUpdatedGameListToLobbyPlayers(game);
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CHANGE_PLAYER_NAME:
          var newPlayerName = message.payload.playerName;
          if (!newPlayerName) {
            wssInterface.wsSend(ws, {
              payload: "New name cannot be empty!",
              type: Astriarch.Shared.MESSAGE_TYPE.ERROR
            });
            return;
          }
          gameController.ChangePlayerName(
            {
              playerName: newPlayerName.substring(0, 20),
              gameId: message.payload.gameId,
              sessionId: sessionId
            },
            function(err, game) {
              //broadcast to other players
              var broadcastMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS, {
                gameOptions: game.gameOptions,
                name: game.name
              });
              broadcastMessageToOtherPlayers(game, sessionId, broadcastMessage);

              wssInterface.wsSend(ws, broadcastMessage);
            }
          );
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CREATE_GAME:
          gameController.CreateGame(
            {
              name: message.payload.name,
              players: [
                {
                  name: message.payload.playerName.substring(0, 20),
                  sessionId: sessionId,
                  position: 0
                }
              ]
            },
            function(err, doc) {
              message.payload = doc["_id"];
              wssInterface.wsSend(ws, message);

              //update the players in the lobby for the new game
              sendUpdatedGameListToLobbyPlayers(doc);
            }
          );
          break;
        case Astriarch.Shared.MESSAGE_TYPE.JOIN_GAME:
          gameController.JoinGame(
            {
              gameId: message.payload.gameId,
              sessionId: sessionId,
              playerName: message.payload.playerName.substring(0, 20)
            },
            function(err, game, playerPosition) {
              if (err || !game) {
                var msg = err || "Unable to find Game to Join.";
                console.error("gameController.JoinGame: ", msg);
                message.payload = msg;
                message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
                wssInterface.wsSend(ws, message);
              } else {
                console.log("Player" + playerPosition + " Joined, sessionId: ", sessionId);
                message.payload = {
                  gameOptions: game.gameOptions,
                  name: game.name,
                  playerPosition: playerPosition
                };
                message.payload["_id"] = game["_id"];
                wssInterface.wsSend(ws, message);

                //broadcast to other players
                var broadcastMessage = new Astriarch.Shared.Message(
                  Astriarch.Shared.MESSAGE_TYPE.CHANGE_GAME_OPTIONS,
                  message.payload
                );
                broadcastMessageToOtherPlayers(game, sessionId, broadcastMessage);

                sendUpdatedGameListToLobbyPlayers(game);
              }
            }
          );
          break;
        case Astriarch.Shared.MESSAGE_TYPE.RESUME_GAME:
          gameController.ResumeGame({ sessionId: sessionId, gameId: message.payload.gameId }, function(
            err,
            doc,
            player
          ) {
            if (err || !doc) {
              var msg = err || "Unable to find Game to Resume.";
              console.error("gameController.ResumeGame: ", msg);
              message.payload = msg;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            } else {
              var serializableClientModel = getSerializableClientModelFromSerializableModelForPlayer(
                doc.gameData,
                player.Id
              );
              message.payload = {
                gameData: serializableClientModel,
                playerPosition: player.position
              };
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.START_GAME:
          gameController.StartGame({ sessionId: sessionId, gameOptions: message.payload }, function(
            err,
            serializableModel,
            game
          ) {
            if (err) {
              console.error("gameController.StartGame:", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              if (err.type == Astriarch.Shared.ERROR_TYPE.INVALID_GAME_OPTIONS) {
                message.payload = "Invalid Game Options!";
              }
              wssInterface.wsSend(ws, message);
            } else {
              //for each player we need to create a client model and send that model to the player
              console.log("gameController.StartGame players: ", game.players);
              for (var p = 0; p < game.players.length; p++) {
                var player = game.players[p];
                var serializableClientModel = getSerializableClientModelFromSerializableModelForPlayer(
                  serializableModel,
                  player.Id
                );
                //player.sessionId
                message.payload = serializableClientModel;
                wss.broadcastToSession(player.sessionId, message);
              }
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_START:
          gameController.StartUpdatePlanet({ sessionId: sessionId }, message.payload, function(err) {
            if (err) {
              console.error("gameController.StartUpdatePlanet: ", err);
            }
          });

          break;
        case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_OPTIONS:
          gameController.UpdatePlanetOptions({ sessionId: sessionId }, message.payload, function(err) {
            if (err) {
              console.error("gameController.FinishUpdatePlanet: ", err);
            }
          });

          break;
        case Astriarch.Shared.MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE:
          gameController.UpdatePlanetBuildQueue(sessionId, message.payload, function(err) {
            if (err) {
              console.error("gameController.UpdatePlanetBuildQueue: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });

          break;
        case Astriarch.Shared.MESSAGE_TYPE.SEND_SHIPS:
          gameController.SendShips(sessionId, message.payload, function(err) {
            if (err) {
              console.error("gameController.SendShips: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CLEAR_WAYPOINT:
          gameController.ClearWaypoint(sessionId, message.payload, function(err) {
            if (err) {
              console.error("gameController.ClearWaypoint: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.END_TURN:
          gameController.EndPlayerTurn(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.EndPlayerTurn: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
              return;
            }
            // data = {"allPlayersFinished": true|false, "endOfTurnMessagesByPlayerId": null, "destroyedClientPlayers":null, "game": doc};
            var payloadOrig = {
              allPlayersFinished: data.allPlayersFinished,
              endOfTurnMessages: null,
              destroyedClientPlayers: data.destroyedClientPlayers,
              clientPlayers: null
            };
            if (data.allPlayersFinished) {
              var winningSerializablePlayer = null;
              var destroyedHumanClientPlayersById = {};
              if (data.destroyedClientPlayers) {
                //check to see if there are any human players destroyed
                //	those players need GAME_OVER messages instead of END_TURN messages
                for (var i in data.destroyedClientPlayers) {
                  var cp = data.destroyedClientPlayers[i];
                  if (cp.Type == Astriarch.Player.PlayerType.Human) {
                    destroyedHumanClientPlayersById[cp.Id] = cp;
                  }
                }

                //check to see if there is only one player left
                if (data.game.gameData.SerializablePlayers.length == 1) {
                  winningSerializablePlayer = data.game.gameData.SerializablePlayers[0];
                }
              }

              //broadcast turn ended to all players with a message per player for that player's end of turn event messages
              var playersBySessionKey = getOtherPlayersBySessionKeyFromGame(data.game, null); //pass null as second arg to get all players
              for (var sk in playersBySessionKey) {
                var player = playersBySessionKey[sk];
                var payload = JSON.parse(JSON.stringify(payloadOrig)); //poor man's clone
                payload.endOfTurnMessages = [];
                if (player.Id in data.endOfTurnMessagesByPlayerId) {
                  payload.endOfTurnMessages = data.endOfTurnMessagesByPlayerId[player.Id];
                }

                payload.gameData = getSerializableClientModelFromSerializableModelForPlayer(
                  data.game.gameData,
                  player.Id
                );

                var playerMessage = null;
                if (player.Id in destroyedHumanClientPlayersById || winningSerializablePlayer) {
                  var playerWon = winningSerializablePlayer && winningSerializablePlayer.Id == player.Id;
                  //calculate end of game score
                  var score = Astriarch.ServerController.CalculateEndGamePoints(
                    data.gameModel,
                    player.Id,
                    data.game.gameOptions.opponentOptions,
                    playerWon
                  );

                  //add high score entry
                  var highScoreBoardSession = {
                    sessionId: sessionId,
                    playerName: player.name,
                    playerNumber: player.position,
                    playerPoints: score,
                    gameId: gameId
                  };
                  gameController.AddHighScoreBoardEntry(highScoreBoardSession);

                  payload = {
                    winningSerializablePlayer: winningSerializablePlayer,
                    playerWon: playerWon,
                    score: score,
                    endOfTurnMessages: payload.endOfTurnMessages,
                    gameData: payload.gameData
                  };
                  playerMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.GAME_OVER, payload);
                } else {
                  playerMessage = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.END_TURN, payload);
                }

                if (sk != sessionId) {
                  wss.broadcastToSession(sk, playerMessage);
                } else {
                  wssInterface.wsSend(ws, playerMessage);
                }
              }
            } else {
              payloadOrig.clientPlayers = getSerializableClientPlayersFromSerializableModel(data.game.gameData);
              message.payload = payloadOrig;
              wssInterface.wsSend(ws, message);

              broadcastMessageToOtherPlayers(data.game, sessionId, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.SUBMIT_TRADE:
          gameController.SubmitTrade(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.SubmitTrade: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CANCEL_TRADE:
          gameController.CancelTrade(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.CancelTrade: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT:
          gameController.AdjustResearchPercent(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.AdjustResearchPercent: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM:
          gameController.SubmitResearchItem(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.SubmitResearchItem: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CANCEL_RESEARCH_ITEM:
          gameController.CancelResearchItem(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.CancelResearchItem: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
            }
          });
          break;
        case Astriarch.Shared.MESSAGE_TYPE.CHAT_MESSAGE:
          //TODO: get the player name and player number from the existing chatRoom so they can't as easily spoof that
          var playerName = message.payload.sentByPlayerName;
          if (!playerName) {
            wssInterface.wsSend(ws, {
              payload: "Player name cannot be empty!",
              type: Astriarch.Shared.MESSAGE_TYPE.ERROR
            });
            return;
          }
          message.payload.text = (message.payload.text || "").trim();
          if (message.payload.messageType == Astriarch.Shared.CHAT_MESSAGE_TYPE.TEXT_MESSAGE && message.payload.text) {
            var chatLogMessage = {
              messageType: Astriarch.Shared.CHAT_MESSAGE_TYPE.TEXT_MESSAGE,
              text: message.payload.text,
              sentByPlayerName: playerName.substring(0, 20),
              sentByPlayerNumber: message.payload.sentByPlayerNumber,
              sentBySessionId: sessionId
            };
            wssInterface.addMessageToChatRoomAndBroadcastToOtherMembers(
              message.payload.gameId,
              chatLogMessage,
              sessionId
            );
          } else if (message.payload.messageType == Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_ENTER) {
            //we need to join the user to the lobby or requested game chat room
            var gameId = message.payload.gameId ? message.payload.gameId : null;
            var session = {
              sessionId: sessionId,
              playerName: message.payload.sentByPlayerName,
              playerNumber: message.payload.sentByPlayerNumber,
              gameId: gameId
            };
            gameController.JoinChatRoom(gameId, session, function(
              err,
              newChatRoomWithSessions,
              oldChatRoomWithSessions
            ) {
              //broadcast to all other sessions in the chat room that a player just logged in
              wssInterface.sendChatRoomSessionListUpdates(ws, sessionId, newChatRoomWithSessions);
              if (oldChatRoomWithSessions) {
                wssInterface.sendChatRoomSessionListUpdates(ws, sessionId, oldChatRoomWithSessions);
              }
            });
          }
          break;
        case Astriarch.Shared.MESSAGE_TYPE.EXIT_RESIGN:
          gameController.ExitResign(sessionId, message.payload, function(err, data) {
            if (err) {
              console.error("gameController.ExitResign: ", err);
              message.payload = err;
              message.type = Astriarch.Shared.MESSAGE_TYPE.ERROR;
              wssInterface.wsSend(ws, message);
              return;
            }
            //Acknowledge the EXIT_RESIGN message
            wssInterface.wsSend(ws, message);

            //data = {"playerId":playerId, "score":score, "game": doc, "gameModel":gameModel};
            var payload = {
              winningSerializablePlayer: null,
              playerWon: false,
              score: data.score,
              endOfTurnMessages: [],
              gameData: null
            };
            payload.gameData = getSerializableClientModelFromSerializableModelForPlayer(
              data.game.gameData,
              data.playerId
            );
            message.payload = payload;
            message.type = Astriarch.Shared.MESSAGE_TYPE.GAME_OVER;
            wssInterface.wsSend(ws, message);
          });
          break;
        default:
          console.error("Unhandled Message Type: ", message.type);
          break;
      }
    });
  });

  ws.on("close", function() {
    parseCookie(ws.upgradeReq, null, function(err) {
      var sessionId = ws.upgradeReq.signedCookies["connect.sid"];
      console.log("connection closed for session: ", sessionId);
      //TODO: if we are in the game and it hasn't started we should probably leave the game too?
      gameController.LeaveChatRoom(sessionId, true, function(err, chatRoomWithSessions) {
        console.debug("Leaving Chat Room: ", err, chatRoomWithSessions);
        if (chatRoomWithSessions) {
          wssInterface.sendChatRoomSessionListUpdates(ws, null, chatRoomWithSessions);
        }
      });
    });
  });
});

var sendUpdatedGameListToLobbyPlayers = function(gameDoc) {
  console.debug("sendUpdatedGameListToLobbyPlayers:", gameDoc);
  var gameSummary = gameController.GetGameSummaryFromGameDoc(gameDoc);
  var messageForPlayers = new Astriarch.Shared.Message(Astriarch.Shared.MESSAGE_TYPE.GAME_LIST_UPDATED, gameSummary);
  gameController.GetChatRoomWithSessions(null, function(err, chatRoom) {
    if (err) {
      console.error("sendUpdatedGameListToLobbyPlayers.GetChatRoomWithSessions:", err);
    } else {
      for (var s = 0; s < chatRoom.sessions.length; s++) {
        wss.broadcastToSession(chatRoom.sessions[s].sessionId, messageForPlayers);
      }
    }
  });
};

var getSerializableClientPlayersFromSerializableModel = function(serializableModel) {
  return serializableModel.SerializablePlayers.map(function(player) {
    return new Astriarch.SerializableClientPlayer(
      player.Id,
      player.Type,
      player.Name,
      player.Color,
      player.Points,
      player.CurrentTurnEnded,
      player.Destroyed,
      player.Research
    );
  });
};

var getSerializableClientModelFromSerializableModelForPlayer = function(serializableModel, targetPlayerId) {
  var mainPlayerOwnedSerializablePlanets = {};
  var serializableClientPlayers = getSerializableClientPlayersFromSerializableModel(serializableModel);
  var serializableMainPlayer = null;
  serializableModel.SerializablePlayers.forEach(function(player) {
    if (player.Id == targetPlayerId) {
      serializableMainPlayer = player;
    }
  });

  if (!serializableMainPlayer) {
    //main player is destroyed
    for (var p in serializableModel.SerializablePlayersDestroyed) {
      var player = serializableModel.SerializablePlayersDestroyed[p];
      if (player.Id == targetPlayerId) {
        serializableMainPlayer = player;
        break;
      }
    }
  }
  //TODO: what do we do if we still don't have a serializableMainPlayer at this point? right now this happens if a player sends a message for a game the server doesn't know he/she is in
  //  currently this happens when a player joins and then the host disconnects and reconnects, the client thinks they are still in the game but the server doesn't know?
  if (!serializableMainPlayer) {
    return null; //For now just return null in this case to indicate a problem
  }
  var serializableClientPlanets = [];
  for (var p in serializableModel.SerializablePlanets) {
    var planet = serializableModel.SerializablePlanets[p];
    var type = null;
    //has main player explored this planet?
    for (var i in serializableMainPlayer.KnownPlanetIds) {
      if (serializableMainPlayer.KnownPlanetIds[i] == planet.Id) {
        type = planet.Type;
        break;
      }
    }

    serializableClientPlanets.push(
      new Astriarch.SerializableClientPlanet(planet.Id, planet.Name, planet.OriginPoint, type)
    );

    //does main player own this planet?
    for (var i in serializableMainPlayer.OwnedPlanetIds) {
      if (serializableMainPlayer.OwnedPlanetIds[i] == planet.Id) {
        mainPlayerOwnedSerializablePlanets[planet.Id] = planet;
        break;
      }
    }
  }

  var tc = serializableModel.TradingCenter;
  var clientPlayerTrades = [];
  //collect trades for targetPlayer
  for (var t in tc.currentTrades) {
    var trade = tc.currentTrades[t];
    if (trade.playerId == targetPlayerId) {
      clientPlayerTrades.push(trade);
    }
  }

  var clientTradingCenter = new Astriarch.ClientTradingCenter(
    tc.goldAmount,
    tc.foodResource,
    tc.oreResource,
    tc.iridiumResource,
    clientPlayerTrades
  );

  var serializableClientModel = new Astriarch.SerializableClientModel(
    serializableModel.Turn.Number,
    serializableMainPlayer,
    serializableClientPlayers,
    serializableClientPlanets,
    mainPlayerOwnedSerializablePlanets,
    clientTradingCenter,
    serializableModel.GameOptions
  );

  return serializableClientModel;
};

var broadcastMessageToOtherPlayers = function(game, sessionId, message) {
  var playersBySessionKey = getOtherPlayersBySessionKeyFromGame(game, sessionId);
  wss.broadcast(playersBySessionKey, message);
};

var getOtherPlayersBySessionKeyFromGame = function(game, currentPlayerSessionKey) {
  var playersBySessionKey = {};
  for (var p in game.players) {
    var player = game.players[p];
    if (player.sessionId && player.sessionId != currentPlayerSessionKey) {
      playersBySessionKey[player.sessionId] = player;
    }
  }
  return playersBySessionKey;
};

//broadcast sending
wss.broadcast = function(playersBySessionKey, message) {
  var data = JSON.stringify(message);
  wss.clients.forEach(function(client) {
    var clientSessionId = client.upgradeReq.signedCookies["connect.sid"];
    if (clientSessionId in playersBySessionKey) {
      client.send(data);
    }
  });
};

wss.broadcastToSession = function(playerSessionKey, message) {
  var data = JSON.stringify(message);
  wss.clients.forEach(function(client) {
    var clientSessionId = client.upgradeReq.signedCookies["connect.sid"];
    if (clientSessionId == playerSessionKey) {
      client.send(data);
    }
  });
};

//404 handling
app.use(function(req, res, next) {
  res.redirect(301, "http://old.astriarch.com" + req.path);
});

var setupUncaughtExceptionHandler = function() {
  /**
   * Handle uncaught node exceptions:
   * http://nodejs.org/docs/v0.6.19/api/process.html#process_event_uncaughtexception
   */
  process.on("uncaughtException", function(err) {
    try {
      var message = "Caught exception: " + err.stack;
      console.error(message);

      //persist to mongo
      var errorEvent = new models.ErrorEventModel({ message: message });
      errorEvent.save(function(err, results) {
        if (err) {
          console.error("Problem saving ErrorEvent:", err);
        }
        process.exit(1);
      });
    } catch (err) {
      console.error("Exception caught in uncaughtException handler: " + err);
      process.exit(1);
    }
  });
};
