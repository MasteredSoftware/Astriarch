var config = require("config");
var mongoose = require("mongoose");
var ObjectId = mongoose.Schema.Types.ObjectId;

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

//connect to database
var db = mongoose.connect('mongodb://'+ config.mongodb.host +':'+ config.mongodb.port +'/'+ config.mongodb.gamedb_name);

//create schema for a game
var GameSchema = new mongoose.Schema({
	name:  String,
	players: [{name:String, sessionId:{ type: String, index: true }, Id: Number, position:Number, currentTurnEnded:{type: Boolean, default:false}}],
	started:  {type: Boolean, default:false},
	ended:  {type: Boolean, default:false},
	dateCreated: { type: Date, default: Date.now },
	dateLastPlayed: { type: Date, default: Date.now },
	gameData: mongoose.Schema.Types.Mixed,
	gameOptions: {type:mongoose.Schema.Types.Mixed, default:{"mainPlayerName":"Player1", "opponentOptions": [{name:"2", type:-1},{name:"3", type:-1},{name:"4", type:-1}], "systemsToGenerate":4, "planetsPerSystem":4} }
});

//compile schema to model
exports.GameModel = db.model('game', GameSchema);

var PlanetViewWorkingDataSchema = new mongoose.Schema({
	gameId: {type: mongoose.Schema.Types.ObjectId, index: true},
	planetId: {type: Number, index: true},
	sessionId: {type: String, index: true},
	planetViewWorkingData: mongoose.Schema.Types.Mixed
});

//compile schema to model
exports.PlanetViewWorkingDataModel = db.model('planet_view_working', PlanetViewWorkingDataSchema);

var PlanetViewWorkingData = function(player, planet){
	this.planetId = planet.Id;
	this.workingResources = new Astriarch.Model.WorkingPlayerResources(player);
	this.workingBuildQueue = [];
	for(var i in planet.BuildQueue) {
		this.workingBuildQueue.push(Astriarch.SavedGameInterface.makePlanetProductionItemSerializable(planet.BuildQueue[i]));
	}
	var populationWorkerTypes = {};
	planet.CountPopulationWorkerTypes(populationWorkerTypes);
	this.farmers = populationWorkerTypes.Farmers;
	this.miners = populationWorkerTypes.Miners;
	this.workers = populationWorkerTypes.Workers;
	this.BuildLastStarShip = true;
};

exports.PlanetViewWorkingData = PlanetViewWorkingData;