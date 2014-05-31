var config = require("config");
var mongoose = require("mongoose");
var ObjectId = mongoose.Schema.Types.ObjectId;

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

//connect to database
//add username:password@ to url
var un_pw = "";
var un = (process.env.OPENSHIFT_MONGODB_DB_USERNAME || process.env.MONGODB_DB_USERNAME || config.mongodb.username);
var pw = (process.env.OPENSHIFT_MONGODB_DB_PASSWORD || process.env.MONGODB_DB_PASSWORD || config.mongodb.password);
if(un && pw){
	un_pw = un + ":" + pw + "@"
}
var host = (process.env.OPENSHIFT_MONGODB_DB_HOST || process.env.MONGODB_DB_HOST || config.mongodb.host);
var port = (process.env.OPENSHIFT_MONGODB_DB_PORT || process.env.MONGODB_DB_PORT || config.mongodb.port);
var gamedb = (process.env.MONGODB_GAME_DB_NAME || config.mongodb.gamedb_name);
var db = mongoose.connect('mongodb://' + un_pw + host + ':' + port + '/' + gamedb);

var ChatRoomSchema = new mongoose.Schema({
	messages:[{messageType: Number, text:String, sentByPlayerName:String, sentByPlayerNumber: Number, sentBySessionId:String, dateSent:{ type: Date, default: Date.now } }],
	gameId: {type:ObjectId, index:true, unique: true}//if this is null it is the lobby chat room
});
exports.ChatRoomModel = db.model('chatRooms', ChatRoomSchema);

var ChatRoomSessionSchema = new mongoose.Schema({
	sessionId:{type:String, index:true, unique: true},
	playerName:String,
	playerNumber: Number,
	dateJoined:{ type: Date, default: Date.now },
	gameId: {type:ObjectId, index:true}//if this is null it is the lobby chat room
});
exports.ChatRoomSessionModel = db.model('chatRoomSessions', ChatRoomSessionSchema);

var GameHighScoreBoardSchema = new mongoose.Schema({
	sessionId:String,
	playerName:String,
	playerNumber: Number,
	playerPoints: {type:Number, index:true},
	gameId: {type:ObjectId}
});
exports.GameHighScoreBoardModel = db.model('gameHighScoreBoard', GameHighScoreBoardSchema);

//create schema for a game
var GameSchema = new mongoose.Schema({
	nonce: ObjectId, //this is used for protecting against concurrent edits: http://docs.mongodb.org/ecosystem/use-cases/metadata-and-asset-management/
	name:  String,
	players: [{name:String, sessionId:{ type: String, index: true }, Id: Number, position:Number, currentTurnEnded:{type: Boolean, default:false}, destroyed:{type: Boolean, default:false}}],
	started:  {type: Boolean, default:false},
	ended:  {type: Boolean, default:false},
	dateCreated: { type: Date, default: Date.now },
	dateLastPlayed: { type: Date, default: Date.now },
	gameData: mongoose.Schema.Types.Mixed,
	gameOptions: {type:mongoose.Schema.Types.Mixed, default:{"mainPlayerName":"Player", "opponentOptions": [{name:"2", type:-1},{name:"3", type:-1},{name:"4", type:-1}], "systemsToGenerate":4, "planetsPerSystem":4, "distributePlanetsEvenly":true, "turnTimeLimitSeconds":0} }
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

var SessionSchema = new mongoose.Schema({
	_id: String,
	session: {type: String},
	expires: { type: Date },
	dateLastSeenAt: { type: Date, index: true, default: Date.now }
});

//compile schema to model
exports.SessionModel = db.model('session', SessionSchema);