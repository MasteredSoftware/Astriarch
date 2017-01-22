var should = require('should');

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

describe('#ServerController', function () {

	beforeEach(function(){

	});

	describe('CalculateEndGamePoints()', function () {
		it('should base points on total points at the end of the game', function (done) {
			var gameModel = generateGameModel(100, 100, 4, 4, 8);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], true);
			points.should.equal(438);
			done();
		});

		it('should award less points if the player loses', function (done) {
			var gameModel = generateGameModel(100, 100, 4, 4, 8);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], false);
			points.should.equal(404);
			done();
		});

		it('should handle awarding points even if the player owns no planets', function (done) {
			var gameModel = generateGameModel(100, 100, 4, 4, 0);
			var player = gameModel.getPlayerById(1);
			for(var i in player.OwnedPlanets) {
				player.OwnedPlanets[i].SetPlanetOwner(null);
			}
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], false);
			points.should.equal(400);
			done();
		});

		it('should give bonus points for a quick game', function (done) {
			var gameModel = generateGameModel(50, 100, 4, 4, 8);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player3", type:Astriarch.Player.PlayerType.Computer_Expert}, {name:"Player4", type:Astriarch.Player.PlayerType.Computer_Expert}], true);
			points.should.equal(477);
			done();
		});

		it('should give less points for an easier game', function (done) {
			var gameModel = generateGameModel(100, 100, 2, 4, 8);
			var points = Astriarch.ServerController.CalculateEndGamePoints(gameModel, 1, [{name:"Player2", type:Astriarch.Player.PlayerType.Human}], true);
			console.log("Points: ", points);
			points.should.equal(444);
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
	var i = 1;
	gameModel.Planets.forEach(function(planet) {
		if(i >= ownedPlanetCount) {
			return;
		}
		if(!planet.Owner || planet.Owner.Id != player1.Id) {
			planet.SetPlanetOwner(player1);
			i++;
		}
	});
	return gameModel;
}
