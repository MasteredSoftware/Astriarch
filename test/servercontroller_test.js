var should = require('should');

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

describe('#ServerController', function () {

	beforeEach(function(){

	});

	describe('CalculateEndGamePoints()', function () {
		it('should base points on total points at the end of the game', function (done) {
			var gameModel = generateGameModel(100, 100, 4, 8, 16);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], true);
			points.should.equal(786);
			done();
		});

		it('should award less points if the player loses', function (done) {
			var gameModel = generateGameModel(100, 100, 4, 8, 16);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], false);
			points.should.equal(430);
			done();
		});

		it('should give bonus points for a quick game', function (done) {
			var gameModel = generateGameModel(50, 100, 4, 8, 16);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], true);
			points.should.equal(1143);
			done();
		});

		it('should give less points for an easier game', function (done) {
			var gameModel = generateGameModel(100, 100, 2, 5, 5);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Human}], true);
			console.log("Points: ", points);
			points.should.equal(442);
			done();
		});
	});

});

function generateGameModel(turnNumber, points, systemsToGenerate, planetsPerSystem, ownedPlanetCount) {
	var player1 = new Astriarch.Player(1, Astriarch.Player.PlayerType.Computer_Expert, "Player1");
	player1.IncreasePoints(Astriarch.Player.EarnedPointsType.POPULATION_GROWTH, points);
	var player2 = new Astriarch.Player(2, Astriarch.Player.PlayerType.Computer_Expert, "Player2");
	player2.IncreasePoints(Astriarch.Player.EarnedPointsType.POPULATION_GROWTH, points);
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
