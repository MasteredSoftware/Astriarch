var config = require("config");
var mongoose = require("mongoose");
var ObjectId = mongoose.Schema.Types.ObjectId;

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

//connect to database
//add username:password@ to url
var un_pw = "";
var un = (process.env.OPENSHIFT_MONGODB_DB_USERNAME || config.mongodb.username);
var pw = (process.env.OPENSHIFT_MONGODB_DB_PASSWORD || config.mongodb.password);
if(un && pw){
	un_pw = un + ":" + pw + "@"
}
var db = mongoose.connect('mongodb://' + un_pw + (process.env.OPENSHIFT_MONGODB_DB_HOST || config.mongodb.host) + ':' + (process.env.OPENSHIFT_MONGODB_DB_PORT || config.mongodb.port) + '/' + config.mongodb.gamedb_name);

//create schema for a game
var GameSchema = new mongoose.Schema({
	nonce: ObjectId, //this is used for protecting against concurrent edits: http://docs.mongodb.org/ecosystem/use-cases/metadata-and-asset-management/
	name:  String,
	players: [{name:String, sessionId:{ type: String, index: true }, Id: Number, position:Number, currentTurnEnded:{type: Boolean, default:false}}],
	started:  {type: Boolean, default:false},
	ended:  {type: Boolean, default:false},
	dateCreated: { type: Date, default: Date.now },
	dateLastPlayed: { type: Date, default: Date.now },
	gameData: mongoose.Schema.Types.Mixed,
	gameOptions: {type:mongoose.Schema.Types.Mixed, default:{"mainPlayerName":"Player", "opponentOptions": [{name:"2", type:-1},{name:"3", type:-1},{name:"4", type:-1}], "systemsToGenerate":4, "planetsPerSystem":4} }
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