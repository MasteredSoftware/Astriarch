var mongoose = require("mongoose");

var models = require("./../models/models");

var async = require("async");

var extend = require("extend");

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

var wssInterface = require("./../wss_interface");

var GetHighScoreBoard = function(maxResults, callback){
	maxResults = maxResults || 10;

	models.GameHighScoreBoardModel.find({}, null, {"skip":0, "limit":maxResults, "sort": { playerPoints : -1 }}, function(err, results){
		//console.log("GetHighScoreBoard:", err, results);
		callback(err, results);
	});
};
exports.GetHighScoreBoard = GetHighScoreBoard;

var AddHighScoreBoardEntry = function(highScoreBoardSession, callback){
	//Maybe this should not add an entry if the entry isn't in the top x players?
	var highScore = new models.GameHighScoreBoardModel(highScoreBoardSession);
	highScore.save(function(err, results){
		if(err){
			console.error("Problem saving HighScoreBoardEntry:", err);
		}
		if(callback){
			callback(err, results);
		}
	});
};
exports.AddHighScoreBoardEntry = AddHighScoreBoardEntry;

var GetChatRoomWithSessions = function(gameId, callback){
	models.ChatRoomModel.findOne({"gameId":gameId}, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		var chatRoom = doc;
		models.ChatRoomSessionModel.find({"gameId":gameId}, function(err, sessions){
			if(err){
				callback(err);
				return;
			}
			chatRoom.sessions = sessions || [];
			callback(null, chatRoom);
		});
	});
};
exports.GetChatRoomWithSessions = GetChatRoomWithSessions;

/**
 *
 * @param gameId
 * @param session
 * @param callback (err, newChatRoomWithSessions, oldChatRoomWithSessions)
 * @constructor
 */
var JoinChatRoom = function(gameId, session, callback){
	//This will create a new chat room if one doesn't exist
	models.ChatRoomModel.findOneAndUpdate({"gameId":gameId},{}, { upsert: true, new: true }, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		var newChatRoomWithSessions = null;
		var oldChatRoomWithSessions = null;

		async.series([
			function(cb){
				models.ChatRoomSessionModel.findOneAndUpdate({"sessionId":session.sessionId}, session, { upsert: true, new: false }, function(err, doc){
					if(err){
						callback(err);
						return;
					}
					//notify the new room that the user joined
					var chatLogMessage = {messageType: Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_ENTER, sentByPlayerName: session.playerName, sentByPlayerNumber: session.playerNumber, sentBySessionId: session.sessionId};
					wssInterface.addMessageToChatRoomAndBroadcastToOtherMembers(gameId, chatLogMessage, session.sessionId);
					//check to see if we're leaving an existing room
					if(doc && doc.gameId != gameId){

						//notify the old room that the user left
						chatLogMessage = {messageType: Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_EXIT, sentByPlayerName: doc.playerName, sentByPlayerNumber: doc.playerNumber, sentBySessionId: session.sessionId};
						wssInterface.addMessageToChatRoomAndBroadcastToOtherMembers(doc.gameId, chatLogMessage, session.sessionId);
						//we'll want to update the sessions for the old chat room with the new session list so we need to return it
						GetChatRoomWithSessions(doc.gameId, function(err, chatRoom){
							if(err){
								cb(err);
							} else {
								oldChatRoomWithSessions = chatRoom;
								cb(null, chatRoom);
							}
						});
					} else {
						cb(null);
					}
				});
			},
			function(cb){
				GetChatRoomWithSessions(gameId, function(err, chatRoom){
					if(err){
						cb(err);
					} else {
						newChatRoomWithSessions = chatRoom;
						cb(null);
					}
				});
			}
		], function(err, results){
			callback(err, newChatRoomWithSessions, oldChatRoomWithSessions);
		});
	});

};
exports.JoinChatRoom = JoinChatRoom;

var LeaveChatRoom = function(sessionId, disconnected, callback){
	models.ChatRoomSessionModel.findOneAndRemove({"sessionId":sessionId}, function(err, chatRoomSession){
		if(err){
			callback(err);
			return;
		}
		//check to see if we're leaving an existing room
		console.debug("LeaveChatRoom:", chatRoomSession);
		if(chatRoomSession){
			GetChatRoomWithSessions(chatRoomSession.gameId, function(err, chatRoom){
				if(err){
					callback(err);
				} else {

					if(chatRoom){
						//notify the room that the user left or disconnected
						var chatLogMessage = {messageType: (disconnected ? Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_DISCONNECT : Astriarch.Shared.CHAT_MESSAGE_TYPE.PLAYER_EXIT), sentByPlayerName: chatRoomSession.playerName, sentByPlayerNumber: chatRoomSession.playerNumber, sentBySessionId: sessionId};
						wssInterface.addMessageToChatRoomAndBroadcastToOtherMembers(chatRoom.gameId, chatLogMessage, sessionId);
					}

					callback(null, chatRoom, chatRoomSession);
				}
			});
		} else {
			callback(null, null);
		}
	});
};
exports.LeaveChatRoom = LeaveChatRoom;

exports.AddMessageToChatRoom = function(gameId, message, callback){
	models.ChatRoomModel.findOneAndUpdate({"gameId":gameId}, {$push:{messages:message}}, { upsert: true, new: true }, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		var chatRoom = doc;
		models.ChatRoomSessionModel.find({"gameId":gameId}, function(err, sessions){
			if(err){
				callback(err);
				return;
			}
			chatRoom.sessions = sessions;
			callback(null, chatRoom);
		});
	});
};

exports.CreateGame = function(options, callback){
	options.nonce = new mongoose.Types.ObjectId;
	var game = new models.GameModel(options);
	//save model to MongoDB
	game.save(function (err, doc) {
		if (err) {
			callback(err);
		} else {
			console.debug("Game saved: ", options, doc);
			callback(null, doc);
		}
	});
};

var FindGameById = function(id, callback){
	//search for an existing game for the user
	models.GameModel.findOne({"_id":id}, function(err, doc){
		if(err){
			console.error("FindGameById:", err);
		} else if(!doc){
			var msg = "Could Not FindGameById:" + id;
			console.error(msg);
			return callback(msg);
		}
		callback(err, doc);
	});
};

var updateGameById = function(gameId, data, callback){
	models.GameModel.update({"_id":gameId}, data, function(err, numberAffected, raw){
		if(err){
			callback(err);
			return;
		}
		console.debug("updateGameById: ", numberAffected, raw);
		FindGameById(gameId, callback);
	});
};

exports.ListLobbyGames = function(options, callback){
	//find any game that is not started, or the current player is already in
	var query = {
		$or:[
			{started:false},
			{$and:
				[
					{ended:false},
					{ "players.sessionId": options.sessionId, "players.destroyed": false }
				]
			}
		]
	};
	models.GameModel.find(query, null, {"sort": { dateLastPlayed : -1 }}, function(err, docs){
		var lobbyGameSummaries = [];
		if(err){
			console.error("ListLobbyGames", err);
		} else if(docs){

			//clean up the docs, we don't need to send everything to the client

			for(var i in docs){
				var doc = docs[i];
				var lobbyGameSummary = GetGameSummaryFromGameDoc(doc);
				for(var p = 0; p < doc.players.length; p++){
					var player = doc.players[p];
					lobbyGameSummary.players.push({"name":player.name, "position":player.position});
				}
				lobbyGameSummaries.push(lobbyGameSummary);
			}
			console.debug("Found lobby game docs: ", lobbyGameSummaries);
		}
		callback(err, lobbyGameSummaries);
	});
};

var GetGameSummaryFromGameDoc = function(doc){
	return {"_id":doc["_id"],
		"name":doc.name,
		"gameOptions":doc.gameOptions,
		"dateLastPlayed":doc.dateLastPlayed,
		"dateCreated":doc.dateCreated,
		"ended":doc.ended,
		"started":doc.started,
		"players":[]
	};
};
exports.GetGameSummaryFromGameDoc = GetGameSummaryFromGameDoc;

exports.UpdateGameOptions = function(payload, callback){
	updateGameById(payload.gameId, {gameOptions: payload.gameOptions, name: payload.name }, callback);
};

exports.ChangePlayerName = function(options, callback){
	var playerName = options.playerName || "UNKNOWN";
	FindGameById(options.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		for(var i = 0; i < doc.players.length; i++){
			var player = doc.players[i];
			if(player.sessionId == options.sessionId){
				player.name = playerName;

				if(player.position == 0){
					doc.gameOptions.mainPlayerName = playerName;
				} else {
					doc.gameOptions.opponentOptions[player.position-1].name = playerName;
				}
				doc.markModified('gameOptions');
			}
		}
		doc.save(function(err){
			if(err){
				console.error("ChangePlayerName", err);
			}
			callback(err, doc);
		});
	});
};

exports.JoinGame = function(options, callback){
	var playerName = options.playerName || "Player";
	var playerPosition = null;
	saveGameByIdWithConcurrencyProtection(options.gameId, function(doc, cb){
		//first check if this user is already a player
		for(var i = 0; i < doc.players.length; i++){
			if(doc.players[i].sessionId == options.sessionId){
				playerPosition = i;
				break;
			}
		}
		//if not assign the player a position and add
		if(playerPosition === null){
			//check if computer players are already assigned in doc.gameOptions.opponentOptions
			for(var slot = 0; slot < doc.gameOptions.opponentOptions.length; slot++) {
				var opponent = doc.gameOptions.opponentOptions[slot];
				if(opponent.type == -1){
					playerPosition = slot + 1;
					break;
				}
			}
			//if we don't have any open slots then just assign the first non-human slot, eventually maybe we don't let another player join if all slots are full?
			if(playerPosition === null) {
				playerPosition = doc.players.length;
			}
			doc.players.push({name:playerName, sessionId:options.sessionId, position:playerPosition});
		}

		var data = {gameOptions: doc.gameOptions, players:doc.players};
		if(playerPosition > 0){
			data.gameOptions.opponentOptions[playerPosition - 1] = {name:playerName, type:0};
		}
		cb(null, data);
	}, 0, function(err, doc){
		callback(err, doc, playerPosition);
	});

};

/*
This method uses the nonce field in the document to protect against concurrent edits on the game document
 http://docs.mongodb.org/ecosystem/use-cases/metadata-and-asset-management/
 transformFunction will be given the game doc and should callback the data to update:
 transformFunction(doc, callback)
 */
var saveGameByIdWithConcurrencyProtection = function(gameId, transformFunction, retries, callback){
	FindGameById(gameId, function(err, doc){
		if(err || !doc){
			callback(err || "Unable to find game in saveGameByIdWithConcurrencyProtection");
			return;
		}
		transformFunction(doc, function(err, data){
			if(err){
				callback(err);
				return;
			}
			data.nonce = new mongoose.Types.ObjectId;
			//setTimeout(function(){ //setTimeout for testing concurrent edits
			models.GameModel.update({"_id":gameId, "nonce":doc.nonce}, data, function(err, numberAffected, raw){
				if(err){
					callback(err);
					return;
				}
				//console.log("updateGameByIdWithConcurrencyProtection: ", numberAffected, raw);
				if(!numberAffected && retries < 10){
					//we weren't able to update the doc because someone else modified it first, retry
					console.log("Unable to saveGameByIdWithConcurrencyProtection, retrying ", retries);
					//retry with a little delay
					setTimeout(function(){
						saveGameByIdWithConcurrencyProtection(gameId, transformFunction, (retries + 1), callback);
					}, 20);
				} else if(retries >= 10){
					//there is probably something wrong, just return an error
					callback("Couldn't update document after 10 retries in saveGameByIdWithConcurrencyProtection");
				} else {
					FindGameById(gameId, callback);
				}
			});
			//}, 5000);
		});
	});

};

exports.ResumeGame = function(options, callback){
	FindGameById(options.gameId, function(err, doc){
		if(err){
			console.error("ResumeGame FindGameById: ", err);
			callback(err);
		}
		var serverPlayer = getPlayerFromDocumentBySessionId(doc, options.sessionId);
		if(!serverPlayer){
			callback("ServerPlayer not found in ResumeGame!");
			return;
		}

		//find all working planet view data objects for player to apply to the model for that player
		models.PlanetViewWorkingDataModel.find({"gameId":options.gameId,"sessionId":options.sessionId}, function(err, planetViewWorkingDataModels){
			if(err){
				console.error("ResumeGame => models.PlanetViewWorkingDataModel.find:", err);
				callback(err);
				return;
			}
			if(planetViewWorkingDataModels.length > 0){
				console.debug("Found PlanetViewWorkingDataModels:", planetViewWorkingDataModels.length, "gameId:", options.gameId);

				var gameModel = Astriarch.SavedGameInterface.getModelFromSerializableModel(doc.gameData);

				applyPlanetViewWorkingDataObjectsToModel(planetViewWorkingDataModels, gameModel);

				//reserialize
				doc.gameData = new Astriarch.SerializableModel(gameModel);
			}

			//TODO: for now we'll just resume the game, later we'll want to have a UI for waiting for the rest of the original players to join
			//  and give the host an option to substitute them with computer players
			callback(err, doc, serverPlayer);
		});

	});
};

exports.StartGame = function(options, callback){
	FindGameById(options.gameOptions.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//TODO: should we change this not to be sent from the game creator? and just get it from the doc instead?
		var gameOptions = options.gameOptions;// {"mainPlayerName":playerName, "opponentOptions": playerOptions, "systemsToGenerate":systemsToGenerate, "planetsPerSystem":planetsPerSystem, "galaxySize":galaxySize};

		var players = []; //List<Player>
		var playerName = gameOptions.mainPlayerName;
		if(!playerName)
			playerName = "Player";
		var hostPlayer = new Astriarch.Player(1, Astriarch.Player.PlayerType.Human, playerName);
		doc.players[0].Id = hostPlayer.Id;//the hosting player is always at position zero
		players.push(hostPlayer);

		var computerNumber = 1;
		//NOTE: difficulty Combobox values correspond to Astriarch.Player.PlayerType 'enum' values
		for(var i = 0; i < gameOptions.opponentOptions.length; i++){
			var playerType = gameOptions.opponentOptions[i].type;
			if(playerType == 0){
				var player = new Astriarch.Player(i + 2, playerType, gameOptions.opponentOptions[i].name);
				//get corresponding player from the doc and set the Id
				for(var j = 0; j < doc.players.length; j++){
					var dp = doc.players[j];
					if(dp.position == (i + 1)){
						dp.Id = player.Id;
						break;
					}
				}
				players.push(player);
			} else if(playerType > 0){
				players.push(new Astriarch.Player(i + 2, playerType, "Computer " + (computerNumber++)));
			}
		}

		if(players.length <= 1){
			//there is a problem, we can't create a proper game for the user by him/her self
			callback({type:Astriarch.Shared.ERROR_TYPE.INVALID_GAME_OPTIONS});
			return;
		}

		var gameModel = new Astriarch.Model(
					players,
					{
						SystemsToGenerate:gameOptions.systemsToGenerate,
						PlanetsPerSystem:gameOptions.planetsPerSystem,
						GalaxySize:gameOptions.galaxySize,
						DistributePlanetsEvenly: gameOptions.distributePlanetsEvenly,
						TurnTimeLimitSeconds:gameOptions.turnTimeLimitSeconds
					}
				);
		doc.gameData = new Astriarch.SerializableModel(gameModel);
		doc.started = true;

		//update the game object in mongo and return the gameModel
		doc.markModified('gameData');
		doc.save(function(err){
			if(err){
				console.error("StartGame: ", err);
			}
			callback(err, doc.gameData, doc);
		});
	});
};

exports.EndPlayerTurn = function(sessionId, payload, callback){

	var returnAllPlayersFinished = function(serializableGameModel) {
		//Check to see if all players have finished their turns
		var allPlayersFinished = true;
		var sp = null;

		for(var i = 0; i < serializableGameModel.SerializablePlayers.length; i++) {
			sp = serializableGameModel.SerializablePlayers[i];
			if(sp.Type == Astriarch.Player.PlayerType.Human && !sp.CurrentTurnEnded) {
				allPlayersFinished = false;
				break;
			}
		}

		return allPlayersFinished;
	};

	var setPlayerCurrentTurnEnded = function(doc, sessionId, callback){
		getPlayerAndGameModelFromDocumentBySessionId(doc, sessionId, function(err, player, gameModel){
			if(err) {
				callback(err);
				return;
			}
			//update players current turn ended
			player.CurrentTurnEnded = true;
			callback(null, {gameData: new Astriarch.SerializableModel(gameModel)});
		});
	};

	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){
		setPlayerCurrentTurnEnded(doc, sessionId, cb);
	}, 0, function(err, doc){
		if(err || !doc) {
			callback(err || "Unable to find game doc in EndPlayerTurn");
			return;
		}
		//now that we ensured only one player ended their turn at a time, let's check to see if all players are finished
		var returnData = {"allPlayersFinished": false, "endOfTurnMessagesByPlayerId": null, "destroyedClientPlayers":null, "game": doc, "gameModel":null};
		returnData.allPlayersFinished = returnAllPlayersFinished(doc.gameData);
		if(returnData.allPlayersFinished){
			doc.dateLastPlayed = new Date();

			returnData.gameModel = Astriarch.SavedGameInterface.getModelFromSerializableModel(doc.gameData);

			//finalize all planetViewWorkingData objects for players
			finalizePlanetViewWorkingDataObjectsForGame(doc._id, returnData.gameModel, function(err){
				if(err){
					callback(err);
					return;
				}
				returnData.endOfTurnMessagesByPlayerId = Astriarch.ServerController.EndTurns(returnData.gameModel);
				var destroyedPlayers = Astriarch.ServerController.CheckPlayersDestroyed(returnData.gameModel);
				if(destroyedPlayers.length > 0){
					returnData.destroyedClientPlayers = [];
					for(var ip in destroyedPlayers) {
						var p = destroyedPlayers[ip];
						returnData.destroyedClientPlayers.push(new Astriarch.ClientPlayer(p.Id, p.Type, p.Name, p.Color, p.Points, true, true));

						//set destroyed players
						for(var i = 0; i < doc.players.length; i++){
							if(p.Id == doc.players[i].Id) {
								doc.players[i].destroyed = true;
							}
						}
					}

					//check to see if the game is ended (either no more human players or only one player left)
					var humansLeft = false;
					for(var ip in returnData.gameModel.Players) {
						if(returnData.gameModel.Players[ip].Type == Astriarch.Player.PlayerType.Human){
							humansLeft = true;
							break;
						}
					}
					if(!humansLeft || returnData.gameModel.Players.length <= 1){
						doc.ended = true;
					}
				}

				doc.gameData = new Astriarch.SerializableModel(returnData.gameModel);
				doc.markModified('gameData');
				doc.save(function(err){
					if(err){
						console.error("EndPlayerTurn: ", err);
					}

					callback(err, returnData);
				});
			});
		} else {
			callback(null, returnData);
		}
	});

};

exports.SubmitTrade = function(sessionId, payload, callback){

	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){

		if(!payload.trade){
			cb("No Trade Submitted.");
			return;
		}

		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.trade.planetId, function(err, player, planetSource, gameModel){
			if(err){
				callback(err);
				return;
			}
			payload.trade.playerId = player.Id;

			payload.trade.amount = payload.trade.amount || 0;

			gameModel.TradingCenter.currentTrades.push(payload.trade);

			var data = {gameData: new Astriarch.SerializableModel(gameModel)};
			cb(null, data);
		});
	}, 0, function(err, doc){
		callback(err, doc);
	});

};

exports.CancelTrade = function(sessionId, payload, callback){

	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){

		if(payload.tradeIndex == null){
			cb("No Trade Index Submitted.");
			return;
		}

		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetId, function(err, player, planetSource, gameModel){
			if(err){
				callback(err);
				return;
			}
			var playerTradeCount = 0;
			for(var i=0; i < gameModel.TradingCenter.currentTrades.length; i++){
				var trade = gameModel.TradingCenter.currentTrades[i];
				if(trade.playerId == player.Id){
					if(payload.tradeIndex == playerTradeCount){
						gameModel.TradingCenter.currentTrades.splice(i, 1);
						break;
					}
					playerTradeCount++;
				}
			}

			var data = {gameData: new Astriarch.SerializableModel(gameModel)};
			cb(null, data);
		});
	}, 0, function(err, doc){
		callback(err, doc);
	});

};

exports.ExitResign = function(sessionId, payload, callback){

	var score = 0;
	var gameModel = null;
	var playerId = null;
	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){

		var serverPlayer = getPlayerFromDocumentBySessionId(doc, sessionId);
		if(!serverPlayer){
			callback("ServerPlayer not found in ExitResign!");
			return;
		}
		playerId = serverPlayer.Id;
		gameModel = Astriarch.SavedGameInterface.getModelFromSerializableModel(doc.gameData);

		score = Astriarch.ServerController.ResignPlayer(gameModel, playerId, doc.gameOptions.opponentOptions);

		var data = {players:doc.players, gameData: new Astriarch.SerializableModel(gameModel)};

		//set player destroyed so they can't re-join the game
		for(var i = 0; i < doc.players.length; i++){
			if(playerId == doc.players[i].Id) {
				doc.players[i].destroyed = true;
			}
		}

		cb(null, data);
	}, 0, function(err, doc){
		var returnData = {"playerId": playerId, "score": score, "game": doc, "gameModel": gameModel};

		callback(err, returnData);
	});

};

var applyPlanetViewWorkingDataObjectsToModel = function(planetViewWorkingDataModels, gameModel){
	var planet = null;
	var planetsById = {};//id:planet
	for(var p in gameModel.Planets){
		planet = gameModel.Planets[p];
		planetsById[planet.Id] = planet;
	}

	for(var i in planetViewWorkingDataModels){
		var planetViewWorkingDataModel = planetViewWorkingDataModels[i];
		var pvwd = planetViewWorkingDataModel.planetViewWorkingData;
		planet = planetsById[planetViewWorkingDataModel.planetId];

		planet.UpdatePopulationWorkerTypes(pvwd.farmers, pvwd.miners, pvwd.workers);
		planet.ResourcesPerTurn.UpdateResourcesPerTurnBasedOnPlanetStats();

		planet.BuildQueue = [];
		for (var i in pvwd.workingBuildQueue){
			var sppi = pvwd.workingBuildQueue[i];
			if(sppi){
				planet.BuildQueue.push(Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(sppi));
			}
		}

		//now spend our resources and in case we issued a refund, set this planets resources
		var originalResources = new Astriarch.Model.WorkingPlayerResources(planet.Owner);
		var goldCost = originalResources.GoldAmount - pvwd.workingResources.GoldAmount;
		var oreCost = originalResources.OreAmount - pvwd.workingResources.OreAmount;
		var iridiumCost = originalResources.IridiumAmount - pvwd.workingResources.IridiumAmount;
		planet.SpendResources(gameModel, goldCost, 0, oreCost, iridiumCost, planet.Owner);
		//set the workingResources to the planets resources
		planet.Owner.Resources.GoldAmount = pvwd.workingResources.GoldAmount;
		planet.Owner.Resources.OreAmount = pvwd.workingResources.OreAmount;
		planet.Owner.Resources.IridiumAmount = pvwd.workingResources.IridiumAmount;

		planet.BuildLastStarShip = (pvwd.BuildLastStarShip ? true : false);
	}
};

var finalizePlanetViewWorkingDataObjectsForGame = function(gameId, gameModel, callback){
	//find all working data objects
	models.PlanetViewWorkingDataModel.find({"gameId":gameId}, function(err, planetViewWorkingDataModels){
		if(err){
			console.error("finalizePlanetViewWorkingDataObjectsForGame:", err);
			callback(err);
			return;
		}
		console.debug("Found PlanetViewWorkingDataModels:", planetViewWorkingDataModels.length, "gameId:", gameId);

		applyPlanetViewWorkingDataObjectsToModel(planetViewWorkingDataModels, gameModel);

		//now delete processed PlanetViewWorkingDataModel
		var removePlanetViewWorkingDataModel = function(planetViewWorkingDataModel, callback){
			planetViewWorkingDataModel.remove(callback);
		};

		async.each(planetViewWorkingDataModels, removePlanetViewWorkingDataModel, function(err, result){
			if(err) {
				console.error("Problem removing planetViewWorkingDataModel in finalizePlanetViewWorkingDataObjectsForGame:", err);
			}
			callback();
		});

	});
};

/**
 * Simply create the PlanetViewWorkingDataModel for us to update later
 * @param options
 * @param payload
 * @param callback
 * @constructor
 */
exports.StartUpdatePlanet = function(options, payload, callback){
	var sessionId = options.sessionId;
	FindGameById(payload.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//payload: {"planetId": 1, "gameId":"abc"}
		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetId, function(err, player, planet, gameModel){
			if(err){
				callback(err);
				return;
			}
			//see if we already have a planet view working data
			getExistingPlanetViewWorkingDataModel(doc._id, sessionId, planet.Id, function(err, pvwdExisting){
				if(err){
					callback(err);
					return;
				}
				if(!pvwdExisting){
					var pvwdOptions = {planetViewWorkingData: new models.PlanetViewWorkingData(player, planet), gameId:doc._id, planetId:planet.Id, sessionId:sessionId};
					var pvwd = new models.PlanetViewWorkingDataModel(pvwdOptions);
					//save model to MongoDB
					pvwd.save(function (err) {

						if(err){
							console.error("StartUpdatePlanet error saving PlanetViewWorkingDataModel: ", err);
						}
						callback(err);
					});
				} else {
					callback();
				}
			});


		});
	});
};

exports.UpdatePlanetOptions = function(options, payload, callback){
	var sessionId = options.sessionId;
	FindGameById(payload.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//payload: {"planetId": 1, "farmers":1, "miners":1, "workers":1, "BuildLastStarShip":true}
		getExistingPlanetViewWorkingDataModel(doc._id, sessionId, payload.planetId, function(err, pvwdmExisting){
			if(err){
				callback(err);
				return;
			}
			if(!pvwdmExisting){
				var msg = "Couldn't find ExistingPlanetViewWorkingDataModel in FinishUpdatePlanet!";
				console.warn(msg);
				callback();
				return;
			}
			getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetId, function(err, player, planet, gameModelReturned){
				if(err){
					callback(err);
					return;
				}

				//ensure farmers + miners + workers == population count
				var totalWorkerCount = payload.farmers + payload.miners + payload.workers;
				var citizens = planet.GetPopulationByContentment();
				if(totalWorkerCount != citizens.content.length){
					callback("Total workers sent in payload does not match content Population total in UpdatePlanetForPlayer!");
					return;
				}

				pvwdmExisting.planetViewWorkingData.farmers = payload.farmers;
				pvwdmExisting.planetViewWorkingData.miners = payload.miners;
				pvwdmExisting.planetViewWorkingData.workers = payload.workers;
				pvwdmExisting.planetViewWorkingData.BuildLastStarShip = payload.BuildLastStarShip;

				pvwdmExisting.markModified('planetViewWorkingData');
				pvwdmExisting.save(function(err){
					if(err){
						console.error("FinishUpdatePlanet error saving PlanetViewWorkingDataModel: ", err);
					}
					callback(err);
				});
			});
		});
	});
};

exports.SendShips = function(sessionId, payload, callback){
	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){
		//payload: {"planetIdSource":1, "planetIdDest":1, "data":{"scouts":[1,5], "destroyers":[], "cruisers":[2,14], "battleships":[31]}}
		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetIdSource, function(err, player, planetSource, gameModel){
			if(err){
				callback(err);
				return;
			}
			var planetDest = null;
			for(var i in gameModel.Planets){
				if(gameModel.Planets[i].Id == payload.planetIdDest){
					planetDest = gameModel.Planets[i];
					break;
				}
			}
			if(!planetDest){
				callback({'type':'INVALID_PLANET_ID','message':'Could not find destination planet for Id: ' + payload.planetIdDest});
				return;
			}
			var createdFleet = planetSource.PlanetaryFleet.SplitFleetWithShipIds(payload.data.scouts, payload.data.destroyers, payload.data.cruisers, payload.data.battleships);
			createdFleet.SetDestination(gameModel.GameGrid, planetSource.BoundingHex, planetDest.BoundingHex);

			planetSource.OutgoingFleets.push(createdFleet);

			//set WayPointPlanetId if key is set
			if(payload.data.WayPointPlanetId !== undefined){
				planetSource.WayPointPlanetId = payload.data.WayPointPlanetId;
			}

			var data = {gameData: new Astriarch.SerializableModel(gameModel)};
			cb(null, data);
		});
	}, 0, callback);
};

exports.ClearWaypoint = function(sessionId, payload, callback){
	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){
		//payload: {"planetIdSource":1}
		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetIdSource, function(err, player, planetSource, gameModel){
			if(err){
				callback(err);
				return;
			}

			//clear WayPointPlanetId
			planetSource.WayPointPlanetId = null;

			var data = {gameData: new Astriarch.SerializableModel(gameModel)};
			cb(null, data);
		});
	}, 0, callback);
};

exports.UpdatePlanetBuildQueue = function(sessionId, payload, callback){
	FindGameById(payload.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//payload: {"actionType":Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE, "planetId":1, "data":{}}

		getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetId, function(err, player, planet, gameModel){
			if(err){
				callback(err);
				return;
			}
			getExistingPlanetViewWorkingDataModel(doc._id, sessionId, payload.planetId, function(err, pvwdmExisting){
				if(err){
					callback(err);
					return;
				}
				if(!pvwdmExisting){
					var msg = "Couldn't find ExistingPlanetViewWorkingDataModel in UpdatePlanetBuildQueue!";
					console.error(msg);
					callback(msg);
					return;
				}
				var pvwd = pvwdmExisting.planetViewWorkingData;

				switch(payload.actionType){
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.ADD_IMPROVEMENT:
						//payload.data is an Astriarch.Planet.PlanetImprovementType
						var pitData = parseIntDefaultIfNaN(payload.data, 3);

						//CHECK if (lbiImprovement.CanBuild)
						var canBuild = true;
						var improvementCount = planet.BuiltImprovementCount();

						//count items that take up slots in working queue
						for (var i in pvwd.workingBuildQueue) {
							var ppi = pvwd.workingBuildQueue[i];//PlanetProductionItem
							if (ppi && ppi.PlanetProductionItemType == Astriarch.Planet.PlanetProductionItemType.PlanetImprovement && ppi.Type != Astriarch.Planet.PlanetImprovementType.SpacePlatform) {
								improvementCount++;
							}
						}

						var slotsAvailable = planet.MaxImprovements - improvementCount;


						if(pitData != Astriarch.Planet.PlanetImprovementType.SpacePlatform){
							if (slotsAvailable <= 0) {//less than zero is a problem, but we'll just make sure they can't build more here
								canBuild = false;
							}
						} else {
							if (planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length == 0) {
								canBuild = false;
							} else if (planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length > 0 ||
								workingQueueContainsSpacePlatform(pvwd))
							{
								//we can only have one space platform
								canBuild = false;
							}
						}

						if(!canBuild){
							callback({'type':'UNABLE_TO_BUILD','message':'You cannot build that improvement at this time.'});
							return;
						}

						var availablePlanetImprovement = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.PlanetImprovement(pitData));
						if (pvwd.workingResources.GoldAmount >= availablePlanetImprovement.GoldCost &&
							pvwd.workingResources.IridiumAmount >= availablePlanetImprovement.IridiumCost &&
							pvwd.workingResources.OreAmount >= availablePlanetImprovement.OreCost)
						{
							pvwd.workingResources.GoldAmount -= availablePlanetImprovement.GoldCost;
							pvwd.workingResources.IridiumAmount -= availablePlanetImprovement.IridiumCost;
							pvwd.workingResources.OreAmount -= availablePlanetImprovement.OreCost;
							pvwd.workingBuildQueue.push(availablePlanetImprovement);
						} else {
							var message = "Insufficient resources: (Gold/Ore/Iridium)\r\nRequires  (" + availablePlanetImprovement.GoldCost + " / " + availablePlanetImprovement.OreCost + " / " + availablePlanetImprovement.IridiumCost + ")\r\n" +
								"You have (" + pvwd.workingResources.GoldAmount + " / " + pvwd.workingResources.OreAmount + " / " + pvwd.workingResources.IridiumAmount + ")";
							callback({'type':'INSUFFICIENT_RESOURCES','message':message});
							return;
						}
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.ADD_STARSHIP:
						//payload.data is an Astriarch.Fleet.StarShipType

						var sstData = parseIntDefaultIfNaN(payload.data, 1);

						var canBuild = true;

						if (sstData == Astriarch.Fleet.StarShipType.Destroyer && planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length == 0){
							canBuild = false;
						} else if((sstData == Astriarch.Fleet.StarShipType.Cruiser || sstData == Astriarch.Fleet.StarShipType.Battleship) && planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length == 0){
							canBuild = false;
						}

						if(!canBuild){
							callback({'type':'UNABLE_TO_BUILD','message':'You cannot build that starship at this time.'});
							return;
						}

						var availableStarShip = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.StarShipInProduction(sstData));
						if (pvwd.workingResources.GoldAmount >= availableStarShip.GoldCost &&
							pvwd.workingResources.IridiumAmount >= availableStarShip.IridiumCost &&
							pvwd.workingResources.OreAmount >= availableStarShip.OreCost)
						{
							pvwd.workingResources.GoldAmount -= availableStarShip.GoldCost;
							pvwd.workingResources.IridiumAmount -= availableStarShip.IridiumCost;
							pvwd.workingResources.OreAmount -= availableStarShip.OreCost;
							pvwd.workingBuildQueue.push(availableStarShip);
						} else {
							var message = "Insufficient resources: (Gold/Ore/Iridium)\r\nRequires  (" + availableStarShip.GoldCost + " / " + availableStarShip.OreCost + " / " + availableStarShip.IridiumCost + ")\r\n" +
								"You have (" + pvwd.workingResources.GoldAmount + " / " + pvwd.workingResources.OreAmount + " / " + pvwd.workingResources.IridiumAmount + ")";
							callback({'type':'INSUFFICIENT_RESOURCES','message':message});
							return;
						}
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.REMOVE:
						//payload.data is the index in the queue

						var index = parseIntDefaultIfNaN(payload.data);
						if(index < pvwd.workingBuildQueue.length){
							pvwd.workingResources = new Astriarch.Model.WorkingPlayerResources(null, pvwd.workingResources);
							var sppi = pvwd.workingBuildQueue[index];
							if(sppi) {
								var refundObject = Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(sppi).GetRefundAmount();

								pvwd.workingResources.GoldAmount += refundObject.Gold;
								pvwd.workingResources.OreAmount += refundObject.Ore;
								pvwd.workingResources.IridiumAmount += refundObject.Iridium;
							}
							pvwd.workingBuildQueue.splice(index, 1);
						} else {
							callback({'type':'INVALID_INDEX','message':'Payload.data containted an invalid index for REMOVE:' + payload.data});
							return;
						}

						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEUP:
						//payload.data is the index in the queue
						moveItemInQueue(pvwd, parseIntDefaultIfNaN(payload.data, 1), true);
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEDOWN:
						//payload.data is the index in the queue
						moveItemInQueue(pvwd, parseIntDefaultIfNaN(payload.data, 0), false);
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.DEMOLISH_IMPROVEMENT:
						//payload.data is an Astriarch.Planet.PlanetImprovementType
						var pi = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.PlanetImprovementToDestroy(parseIntDefaultIfNaN(payload.data, 3)));
						pvwd.workingBuildQueue.push(pi);
						break;
				}

				pvwdmExisting.markModified('planetViewWorkingData');
				pvwdmExisting.save(function(err){
					if(err){
						console.error("UpdatePlanetBuildQueue error saving pvwdmExisting: ", err);
					}
					callback(err);
				});
			});

		});


	});
};

var moveItemInQueue = function(planetViewWorkingData, index, /*bool*/ moveUp){

	if (index == 0 && moveUp)
		return;
	else if (index == planetViewWorkingData.workingBuildQueue.length - 1 && !moveUp)
		return;

	var ppi = planetViewWorkingData.workingBuildQueue[index];//PlanetProductionItem

	planetViewWorkingData.workingBuildQueue.splice(index, 1);
	if(moveUp){
		planetViewWorkingData.workingBuildQueue.splice(index-1, 0, ppi);
	} else {
		planetViewWorkingData.workingBuildQueue.splice(index+1, 0, ppi);
	}
};

var workingQueueContainsSpacePlatform = function(planetViewWorkingData) {
	for (var i in planetViewWorkingData.workingBuildQueue)
	{
		var ppi = planetViewWorkingData.workingBuildQueue[i];//PlanetProductionItem
		if (ppi instanceof Astriarch.Planet.PlanetImprovement && ppi.Type == Astriarch.Planet.PlanetImprovementType.SpacePlatform)
			return true;
	}
	return false;
};

var getExistingPlanetViewWorkingDataModel = function(gameId, sessionId, planetId, callback){
	//search for an existing planetViewWorkingDataModel for the user and planet
	models.PlanetViewWorkingDataModel.findOne({"gameId":gameId, "sessionId":sessionId, "planetId":planetId}, function(err, planetViewWorkingDataModel){
		if(err){
			console.error("getExistingPlanetViewWorkingDataModel:", err);
		}
		callback(err, planetViewWorkingDataModel);
	});
};
var getPlayerAndGameModelFromDocumentBySessionId = function(doc, sessionId, callback) {
	var serverPlayer = getPlayerFromDocumentBySessionId(doc, sessionId);
	if (!serverPlayer) {
		callback("ServerPlayer not found for SessionId!");
		return;
	}

	var gameModel = Astriarch.SavedGameInterface.getModelFromSerializableModel(doc.gameData);

	var player = getPlayerFromGameModelById(gameModel, serverPlayer.Id);
	if (!player) {
		callback("Player not found for Id!");
		return;
	}

	callback(null, player, gameModel);
};


var getPlayerPlanetAndGameModelFromDocumentBySessionId = function(doc, sessionId, planetId, callback){
	getPlayerAndGameModelFromDocumentBySessionId(doc, sessionId, function(err, player, gameModel){
		if(err) {
			callback(err);
			return;
		}

		//ensure that the PlanetId passed in belongs to the player
		var planet = player.GetPlanetIfOwnedByPlayer(planetId);
		if(!planet){
			callback("PlanetId: " + planetId + " not owned by Player!");
			return;
		}

		callback(null, player, planet, gameModel);
	});
};

var getPlayerFromDocumentBySessionId = function(doc, sessionId){
	var retPlayer = null;
	for(var i = 0; i < doc.players.length; i++){
		var player = doc.players[i];
		if(player.sessionId == sessionId){
			retPlayer = player;
			break;
		}
	}
	return retPlayer;
};

var getPlayerFromGameModelById = function(gameModel, playerId){
	var retPlayer = null;
	for(var i = 0; i < gameModel.Players.length; i++){
		var p =  gameModel.Players[i];
		if(p.Id == playerId){
			retPlayer = p;
			break;
		}
	}
	return retPlayer;
};

var touchSession = function(sessionId, callback){
	models.SessionModel.update({"_id":sessionId}, {"dateLastSeenAt":new Date()}, function(err, numberAffected, raw) {
		callback(err);
	});
};
exports.touchSession = touchSession;

var cleanupExpiredSessions = function(clientTimeout, callback){
	var expirationDate = new Date(new Date().getTime() - clientTimeout);
	console.log("Checking for expired Sessions before:", expirationDate);

	models.SessionModel.find({"dateLastSeenAt":{$lt:expirationDate}}, function(err, docs){
		if(err){
			console.error("Problem in cleanupExpiredSessions:", err);
		} else if(docs && docs.length > 0) {
			console.log("cleanupExpiredSessions found:", docs.length, "expired sessions to timeout.");
			async.eachSeries(docs, sessionTimeout, callback);
		} else {
			console.debug("cleanupExpiredSessions did not find any expired session to timeout.");
			callback();
		}
	});

};
exports.cleanupExpiredSessions = cleanupExpiredSessions;

var sessionTimeout = function(sessionDoc, callback){
	async.series([
		function(cb){
			LeaveChatRoom(sessionDoc._id, true, function(err, chatRoom, chatRoomSession){
				if(err){
					console.error("Problem in sessionTimeout => ChatRoomSessionModel:", err);
				}
				cb(err);
			});
		},
		function(cb){
			//instead of removing the session, just remove the dateLastSeenAt property.
			// It seems removing the document causes express to regenerate a new sessionId for the user even if the cookie still exists
			models.SessionModel.update({"_id":sessionDoc._id}, {"dateLastSeenAt":null}, function(err, numberAffected, raw) {
				if(err){
					console.error("Problem deactivating session: ", err);
				}
				cb(err);
			});
		}
	], function(err, results){
		console.debug("Session Docs Timeout: ", sessionDoc);
		callback(err, results);
	});
};

var cleanupOldGames = function(callback){
	//find ended games, or games that haven't started and were created awhile ago
	// TODO: eventually we may want to cleanup old games that were started yet never finished
	var expirationDateStarted = new Date();
	expirationDateStarted.setHours(expirationDateStarted.getHours()-2);
	var expirationDateEnded = new Date();
	expirationDateEnded.setMinutes(expirationDateEnded.getMinutes()-60);
	models.GameModel.find({$or:[{ended:true, "dateLastPlayed":{$lt:expirationDateEnded}},{started:false,"dateCreated":{$lt:expirationDateStarted}}]}, function(err, docs){
		if(err){
			console.error("Problem in cleanupOldGames:", err);
		} else if(docs && docs.length > 0) {
			console.log("cleanupOldGames found:", docs.length, "expired games to delete.");
			async.eachSeries(docs, deleteGameById, callback);
		} else {
			console.log("cleanupOldGames did not find any expired games to delete.");
			callback();
		}
	});
};
exports.cleanupOldGames = cleanupOldGames;

var deleteGameById = function(gameDoc, callback){
	//dependent models to remove:
	//ChatRoomModel
	//ChatRoomSessionModel
	//PlanetViewWorkingDataModel
	//GameModel
	var gameId = gameDoc._id;
	async.series([
		function(cb){
			models.ChatRoomSessionModel.find({"gameId":gameId}, function(err, chatRoomSessionModels){
				if(err){
					console.error("Problem in deleteGameById => ChatRoomSessionModel:", err);
				} else {
					for(var i in chatRoomSessionModels){
						chatRoomSessionModels[i].remove();
					}
				}
				cb(err);
			});
		},
		function(cb){
			models.ChatRoomModel.find({"gameId":gameId}, function(err, chatRoomModel){
				if(err){
					console.error("Problem in deleteGameById => ChatRoomSessionModel:", err);
				} else {
					for(var i in chatRoomModel){
						chatRoomModel[i].remove();
					}
				}
				cb(err);
			});
		},
		function(cb){
			models.PlanetViewWorkingDataModel.find({"gameId":gameId}, function(err, planetViewWorkingDataModels){
				if(err){
					console.error("Problem in deleteGameById => PlanetViewWorkingDataModel:", err);
				} else {
					for(var i in planetViewWorkingDataModels){
						planetViewWorkingDataModels[i].remove();
					}
				}
				cb(err);
			});
		},
		function(cb){
			models.GameModel.findByIdAndRemove(gameId, function(err){
				if(err){
					console.error("Problem removing game: ", err);
				}
				cb(err);
			});
		}
	], function(err, results){
		console.log("Removed Game and dependent Docs: ", gameId, ":", gameDoc.name);
		callback(err, results);
	});

};

var parseIntDefaultIfNaN = function(str, defaultInt){
	defaultInt = defaultInt || 0;
	var intData = parseInt(str);
	if(isNaN(intData)){
		intData = defaultInt;
	}
	return intData;
};


