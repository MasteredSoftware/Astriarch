var mongoose = require("mongoose");

var models = require("./../models/models");

var async = require("async");

var extend = require("extend");

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

exports.CreateGame = function(options, callback){
	options.nonce = new mongoose.Types.ObjectId;
	var game = new models.GameModel(options);
	//save model to MongoDB
	game.save(function (err, doc) {
		if (err) {
			callback(err);
		} else {
			console.log("Game saved: ", options, doc);
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
		console.log("updateGameById: ", numberAffected, raw);
		FindGameById(gameId, callback);
	});
};

exports.ListLobbyGames = function(options, callback){
	//find any game that is not started
	models.GameModel.find({$or:[{started:false},{ended:false,"players.sessionId":options.sessionId}]}, function(err, docs){
		var lobbyGameSummaries = [];
		if(err){
			console.error("ListLobbyGames", err);
		} else if(docs){

			//clean up the docs, we don't need to send everything to the client

			for(var i in docs){
				var doc = docs[i];
				var lobbyGameSummary = {"_id":doc["_id"],
					"name":doc.name,
					"gameOptions":doc.gameOptions,
					"dateLastPlayed":doc.dateLastPlayed,
					"dateCreated":doc.dateCreated,
					"ended":doc.ended,
					"started":doc.started,
					"players":[]
				};
				for(var p = 0; p < doc.players.length; p++){
					var player = doc.players[p];
					lobbyGameSummary.players.push({"name":player.name, "position":player.position});
				}
				lobbyGameSummaries.push(lobbyGameSummary);
			}
			console.log("Found lobby game docs: ", lobbyGameSummaries);
		}
		callback(err, lobbyGameSummaries);
	});
};

exports.UpdateGameOptions = function(payload, callback){
	updateGameById(payload.gameId, {gameOptions: payload.gameOptions, name: payload.name }, callback);
};

exports.ChangePlayerName = function(options, callback){
	var playerName = options.playerName || "UNKNOWN";
	FindGameById(options.gameId, function(err, doc){
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

	saveGameByIdWithConcurrencyProtection(options.gameId, function(doc, cb){
		var playerPosition = doc.players.length - 1;
		doc.players.push({name:playerName, sessionId:options.sessionId, position:playerPosition + 1});
		var data = {gameOptions: doc.gameOptions, players:doc.players};
		data.gameOptions.opponentOptions[playerPosition] = {name:playerName, type:0};
		cb(null, data);
	}, 0, callback);

};

/*
This method uses the nonce field in the document to protect against concurrent edits on the game document
 http://docs.mongodb.org/ecosystem/use-cases/metadata-and-asset-management/
 transformFunction will be given the game doc and should callback the data to update:
 transformFunction(doc, callback)
 */
var saveGameByIdWithConcurrencyProtection = function(gameId, transformFunction, retries, callback){
	FindGameById(gameId, function(err, doc){
		if(err){
			callback(err);
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
				console.log("updateGameByIdWithConcurrencyProtection: ", numberAffected, raw);
				if(!numberAffected && retries < 5){
					//we weren't able to update the doc because someone else modified it first, retry
					console.log("Unable to saveGameByIdWithConcurrencyProtection, retrying ", retries);
					saveGameByIdWithConcurrencyProtection(gameId, transformFunction, (retries + 1), callback);
				} else if(retries >= 5){
					//there is probably something wrong, just return an error
					callback("Couldn't update document after 5 retries in saveGameByIdWithConcurrencyProtection");
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
		var player = null;
		for(var i = 0; i < doc.players.length; i++){
			var p = doc.players[i];
			if(p.sessionId == options.sessionId){
				player = p;
				break;
			}
		}

		if(!player){
			console.error("Could not find player in game for ResumeGame!");
		}
		//TODO: for now we'll just resume the game, later we'll want to have a UI for waiting for the rest of the original players to join
		//  and give the host an option to substitute them with computer players
		callback(err, doc, player);

	});
};

exports.StartGame = function(options, callback){
	FindGameById(options.gameOptions.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//TODO: should we change this not to be sent from the game creator? and just get it from the doc instead?
		var gameOptions = options.gameOptions;// {"mainPlayerName":playerName, "opponentOptions": playerOptions, "systemsToGenerate":systemsToGenerate, "planetsPerSystem":planetsPerSystem};

		var players = []; //List<Player>
		var playerName = gameOptions.mainPlayerName;
		if(!playerName)
			playerName = "Player";
		var hostPlayer = new Astriarch.Player(Astriarch.Player.PlayerType.Human, playerName);
		doc.players[0].Id = hostPlayer.Id;//the hosting player is always at position zero
		players.push(hostPlayer);

		var computerNumber = 1;
		//NOTE: difficulty Combobox values correspond to Astriarch.Player.PlayerType 'enum' values
		for(var i = 0; i < gameOptions.opponentOptions.length; i++){
			var playerType = gameOptions.opponentOptions[i].type;
			if(playerType == 0){
				var player = new Astriarch.Player(playerType, gameOptions.opponentOptions[i].name);
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
				players.push(new Astriarch.Player(playerType, "Computer " + (computerNumber++)));
			}
		}

		var gameModel = new Astriarch.Model(players, gameOptions.systemsToGenerate, gameOptions.planetsPerSystem);
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

	var setCurrentTurnEndedReturnAllPlayersFinished = function(sessionId, doc){
		//Check to see if all other players have finished their turns
		var allPlayersFinished = true;
		for(var i = 0; i < doc.players.length; i++){
			var player = doc.players[i];
			if(player.sessionId == sessionId){
				player.currentTurnEnded = true;
			} else if(!player.currentTurnEnded) {
				allPlayersFinished = false;
			}
		}
		return allPlayersFinished;
	};

	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){

		setCurrentTurnEndedReturnAllPlayersFinished(sessionId, doc);
		var data = {players:doc.players};
		//update players current turn ended
		cb(null, data);
	}, 0, function(err, doc){
		//now that we ensured only one player ended their turn at a time, let's check again
		var returnData = {"allPlayersFinished": false, "endOfTurnMessagesByPlayerId": null, "destroyedClientPlayers":null, "game": doc, "gameModel":null};
		returnData.allPlayersFinished = setCurrentTurnEndedReturnAllPlayersFinished(sessionId, doc);
		if(returnData.allPlayersFinished){
			//set all players back to currentTurnEnded = false for next turn;
			for(var i = 0; i < doc.players.length; i++){
				doc.players[i].currentTurnEnded = false;
			}

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
					for(var ip in destroyedPlayers){
						var p = destroyedPlayers[ip];
						returnData.destroyedClientPlayers.push(new Astriarch.ClientPlayer(p.Id, p.Type, p.Name, p.Color));
					}

					//check to see if the game is ended (either no more human players or only one player left)
					var humansLeft = false;
					for(var ip in returnData.gameModel.Players){
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

var finalizePlanetViewWorkingDataObjectsForGame = function(gameId, gameModel, callback){
	//find all working data objects
	models.PlanetViewWorkingDataModel.find({"gameId":gameId}, function(err, planetViewWorkingDataModels){
		if(err){
			console.error("finalizePlanetViewWorkingDataObjectsForGame:", err);
			callback(err);
			return;
		}
		console.log("Found PlanetViewWorkingDataModels:", planetViewWorkingDataModels.length, "gameId:", gameId);
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
				planet.BuildQueue.push(Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(pvwd.workingBuildQueue[i]));
			}

			//now spend our resources and in case we issued a refund, add remainders to this planets resources and accumulate
			var originalResources = new Astriarch.Model.WorkingPlayerResources(planet.Owner);
			var goldCost = originalResources.GoldAmount - pvwd.workingResources.GoldAmount;
			var oreCost = originalResources.OreAmount - pvwd.workingResources.OreAmount;
			var iridiumCost = originalResources.IridiumAmount - pvwd.workingResources.IridiumAmount;
			planet.SpendResources(gameModel, goldCost, oreCost, iridiumCost, planet.Owner);
			//add the remainders to the planets resources and accumulate
			planet.Owner.Resources.GoldRemainder = pvwd.workingResources.GoldRemainder;
			planet.Owner.Resources.OreRemainder = pvwd.workingResources.OreRemainder;
			planet.Owner.Resources.IridiumRemainder = pvwd.workingResources.IridiumRemainder;
			planet.Owner.Resources.AccumulateResourceRemainders();

			planet.BuildLastStarShip = (pvwd.BuildLastStarShip ? true : false);

			//now delete processed PlanetViewWorkingDataModel
			planetViewWorkingDataModel.remove();
		}




		callback();
	});
};

/**
 * Simply create the PlanetViewWorkingDataModel for us to update later
 * @param options
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
					console.log("Created pvwdOptions:", pvwdOptions);
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

exports.FinishUpdatePlanet = function(options, payload, callback){
	var sessionId = options.sessionId;
	FindGameById(payload.gameId, function(err, doc){
		if(err){
			callback(err);
			return;
		}
		//payload: {"OkClose": true|false, "planetId": 1, "farmers":1, "miners":1, "workers":1, "BuildLastStarShip":true}
		getExistingPlanetViewWorkingDataModel(doc._id, sessionId, payload.planetId, function(err, pvwdmExisting){
			if(err){
				callback(err);
				return;
			}
			if(!pvwdmExisting){
				var msg = "Couldn't find ExistingPlanetViewWorkingDataModel in FinishUpdatePlanet!";
				console.error(msg);
				callback(msg);
				return;
			}
			if(payload.OkClose){
				//update working

				getPlayerPlanetAndGameModelFromDocumentBySessionId(doc, sessionId, payload.planetId, function(err, player, planet, gameModelReturned){
					if(err){
						callback(err);
						return;
					}

					//ensure farmers + miners + workers == population count
					var totalWorkerCount = payload.farmers + payload.miners + payload.workers;
					if(totalWorkerCount != planet.Population.length){
						callback("Total workers sent in payload does not match Population total in UpdatePlanetForPlayer!");
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
			} else {
				//delete PlanetViewWorkingDataModel
				/*
				pvwdmExisting.remove(function(err){
					if(err){
						console.error("FinishUpdatePlanet error removing PlanetViewWorkingDataModel: ", err);
					}
					callback(err);
				});
				*/
				console.log("Nothing to do when payload.OkClose == false;")
			}
		});
	});
};

exports.SendShips = function(sessionId, payload, callback){
	saveGameByIdWithConcurrencyProtection(payload.gameId, function(doc, cb){
		//payload: {"planetIdSource":1, "planetIdDest":1, "data":{"scouts":1, "destroyers":1, "cruisers":1, "battleships":1}}
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
			var createdFleet = planetSource.PlanetaryFleet.SplitFleet(payload.data.scouts, payload.data.destroyers, payload.data.cruisers, payload.data.battleships);
			createdFleet.SetDestination(gameModel.GameGrid, planetSource.BoundingHex, planetDest.BoundingHex);

			planetSource.OutgoingFleets.push(createdFleet);

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
					cb(err);
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

						//CHECK if (lbiImprovement.CanBuild)
						var canBuild = true;
						var improvementCount = planet.BuiltImprovementCount();

						//count items that take up slots in working queue
						for (var i in pvwd.workingBuildQueue)
						{
							var ppi = pvwd.workingBuildQueue[i];//PlanetProductionItem
							if (ppi.PlanetProductionItemType == Astriarch.Planet.PlanetProductionItemType.PlanetImprovement && ppi.Type != Astriarch.Planet.PlanetImprovementType.SpacePlatform)
								improvementCount++;
						}

						var slotsAvailable = planet.MaxImprovements - improvementCount;


						if(payload.data != Astriarch.Planet.PlanetImprovementType.SpacePlatform){
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

						var availablePlanetImprovement = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.PlanetImprovement(parseInt(payload.data)));
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

						var canBuild = true;

						if (payload.data == Astriarch.Fleet.StarShipType.Destroyer && planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.Factory].length == 0){
							canBuild = false;
						} else if((payload.data == Astriarch.Fleet.StarShipType.Cruiser || payload.data == Astriarch.Fleet.StarShipType.Battleship) && planet.BuiltImprovements[Astriarch.Planet.PlanetImprovementType.SpacePlatform].length == 0){
							canBuild = false;
						}

						if(!canBuild){
							callback({'type':'UNABLE_TO_BUILD','message':'You cannot build that starship at this time.'});
							return;
						}

						var availableStarShip = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.StarShipInProduction(parseInt(payload.data)));
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

						var index = parseInt(payload.data);
						if(index < pvwd.workingBuildQueue.length){
							pvwd.workingResources = new Astriarch.Model.WorkingPlayerResources(null, pvwd.workingResources);
							var refundObject = Astriarch.SavedGameInterface.getPlanetProductionItemFromSerializedPlanetProductionItem(pvwd.workingBuildQueue[index]).GetRefundAmount();

							pvwd.workingResources.GoldRemainder += refundObject.Gold;
							pvwd.workingResources.OreRemainder += refundObject.Ore;
							pvwd.workingResources.IridiumRemainder += refundObject.Iridium;
							pvwd.workingResources.AccumulateResourceRemainders();

							pvwd.workingBuildQueue.splice(index, 1);
						} else {
							callback({'type':'INVALID_INDEX','message':'Payload.data containted an invalid index for REMOVE:' + payload.data});
							return;
						}

						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEUP:
						//payload.data is the index in the queue
						moveItemInQueue(pvwd, parseInt(payload.data), true);
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.MOVEDOWN:
						//payload.data is the index in the queue
						moveItemInQueue(pvwd, parseInt(payload.data), false);
						break;
					case Astriarch.Shared.PLANET_BUILD_QUEUE_ACTION_TYPE.DEMOLISH_IMPROVEMENT:
						//payload.data is an Astriarch.Planet.PlanetImprovementType
						var pi = Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(new Astriarch.Planet.PlanetImprovementToDestroy(parseInt(payload.data)));
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

var getPlayerPlanetAndGameModelFromDocumentBySessionId = function(doc, sessionId, planetId, callback){
	var serverPlayer = getPlayerFromDocumentBySessionId(doc, sessionId);
	if(!serverPlayer){
		callback("ServerPlayer not found in UpdatePlanetForPlayer!");
		return;
	}

	var gameModel = Astriarch.SavedGameInterface.getModelFromSerializableModel(doc.gameData);

	var player = getPlayerFromGameModelById(gameModel, serverPlayer.Id);
	if(!player){
		callback("Player not found in UpdatePlanetForPlayer!");
		return;
	}

	//ensure that the PlanetId passed in belongs to the player
	var planet = player.GetPlanetIfOwnedByPlayer({"Id":planetId});
	if(!planet){
		callback("PlanetId: " + planetId + " not owned by Player in UpdatePlanetForPlayer!");
		return;
	}

	callback(null, player, planet, gameModel);
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


