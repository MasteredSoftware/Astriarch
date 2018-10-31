//setup the "global" Astriarch namespace
var Astriarch = require("./astriarch_base");

var jCanvas = require("./../jCanvas");

var globals = require("./astriarch_globals");
var servercontroller = require("./astriarch_servercontroller");
var model = require("./astriarch_model");
var clientmodel = require("./astriarch_clientmodel");
var fleet = require("./astriarch_fleet");
var planet = require("./astriarch_planet");
var tc = require("./astriarch_tradingcenter");
var r = require("./astriarch_research");
var savedgameinterface = require("./astriarch_savedgameinterface");
var player = require("./astriarch_player");
var grid = require("./astriarch_grid");
var hexagon = require("./astriarch_hexagon");
var ai = require("./astriarch_ai");
var battlesimulator = require("./astriarch_battlesimulator");
var shared = require("./astriarch_shared");
var tem = require("./astriarch_turneventmessage");

module.exports = Astriarch;
