var should = require('should');

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

describe('#ServerController', function () {

	beforeEach(function(){

	});

	describe('CalculateEndGamePoints()', function () {
		it('should return points based on gameModel properties', function (done) {
			var gameModel = generateGameModel(50, 4, 8, 16);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:4}, {name:"Player3", type:4}, {name:"Player4", type:4}], true);
			console.log("Points: ", points);
			done();
		});


	});

});

function generateGameModel(turnNumber, systemsToGenerate, planetsPerSystem, ownedPlanetCount) {
	var player1 = new Astriarch.Player(1, Astriarch.Player.PlayerType.Computer_Expert, "Player1");
	var player2 = new Astriarch.Player(2, Astriarch.Player.PlayerType.Computer_Expert, "Player2");
	var gameModel = new Astriarch.Model([player1, player2], {SystemsToGenerate:systemsToGenerate, PlanetsPerSystem:planetsPerSystem, DistributePlanetsEvenly: true, "TurnTimeLimitSeconds":0});
	gameModel.Turn.Number = turnNumber;
	var i = 0;
	gameModel.Planets.forEach(function(planet) {
		if(i == ownedPlanetCount) {
			return;
		}
		if(!planet.Owner || planet.Owner.Id != player1.Id) {
			planet.SetPlanetOwner(player1);
			i++;
		}
	});
	return gameModel;
}
