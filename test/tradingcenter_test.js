var should = require('should');

var Astriarch = require("./../public/js/astriarch/astriarch_loader");

var player1 = new Astriarch.Player(Astriarch.Player.PlayerType.Computer_Expert, "Player1");
var player2 = new Astriarch.Player(Astriarch.Player.PlayerType.Computer_Expert, "Player2");
var gameModel = new Astriarch.Model([player1, player2], {systemsToGenerate:2, planetsPerSystem:4, distributePlanetsEvenly: true, "turnTimeLimitSeconds":0});

describe('#TradingCenter', function () {

	describe('executeTrade()', function () {
		it('should execute a sell food trade for player1 given that player has sufficient resources', function (done) {
			var tradeAmount = 1;
			checkTrade(player1, Astriarch.TradingCenter.TradeType.SELL, Astriarch.TradingCenter.ResourceType.FOOD, tradeAmount, done);
		});

		it('should execute a sell food trade for player2 given that player has sufficient resources', function (done) {
			var tradeAmount = 2;
			checkTrade(player2, Astriarch.TradingCenter.TradeType.SELL, Astriarch.TradingCenter.ResourceType.FOOD, tradeAmount, done);
		});
	});

	describe('executeCurrentTrades()', function () {
		it('should execute all current trades when trades are valid', function (done) {
			var newTrades = [];
			newTrades.push(new Astriarch.TradingCenter.Trade(player1.Id, player1.HomePlanetId, Astriarch.TradingCenter.TradeType.SELL, Astriarch.TradingCenter.ResourceType.FOOD, 1, Astriarch.TradingCenter.OrderType.MARKET, null));
			newTrades.push(new Astriarch.TradingCenter.Trade(player2.Id, player2.HomePlanetId, Astriarch.TradingCenter.TradeType.BUY, Astriarch.TradingCenter.ResourceType.FOOD, 1, Astriarch.TradingCenter.OrderType.MARKET, null));
			gameModel.TradingCenter.currentTrades = gameModel.TradingCenter.currentTrades.concat(newTrades);
			var endOfTurnMessagesByPlayerId = {};
			var executedStatusListByPlayerId = Astriarch.ServerController.executeCurrentTrades(gameModel, endOfTurnMessagesByPlayerId);
			console.log("executedStatusListByPlayerId:", executedStatusListByPlayerId);
			Object.keys(executedStatusListByPlayerId).forEach(function(key) {
				executedStatusListByPlayerId[key].forEach(function(executedStatus) {
					if(!executedStatus.executed) {
						done("Not all trades executed!" + JSON.stringify(executedStatus));
					}
				});
			});
			done();
		});
	});



});

var checkTrade = function(player, tradeType, resourceType, tradeAmount, callback) {

	var origGoldAmount = player.ExactTotalGoldAmount();
	var origFoodAmount = player.ExactTotalFoodAmount();
	var origFoodPrice = gameModel.TradingCenter.foodResource.currentPrice;
	var trade = new Astriarch.TradingCenter.Trade(-1, player.HomePlanetId, tradeType, resourceType, tradeAmount, Astriarch.TradingCenter.OrderType.MARKET, null);
	//{executed:false, foodAmount:0, oreAmount:0, iridiumAmount:0, tradeGoldAmount:0}
	var homePlanet = gameModel.getPlanetById(player.HomePlanetId);
	var executedStatus = gameModel.TradingCenter.executeTrade(gameModel, player, homePlanet, trade);
	if(executedStatus.executed) {
		//recalculate current prices in trading center for each trade executed
		gameModel.TradingCenter.recalculatePrices();
	} else {
		return callback("Trade was not executed successfully")
	}
	var tradeGoldAmount = (origFoodPrice * tradeAmount);
	//subtract fee
	tradeGoldAmount -= tradeGoldAmount * gameModel.TradingCenter.transactionFeePercentage;
	executedStatus.tradeGoldAmount.should.equal(tradeGoldAmount);
	executedStatus.foodAmount.should.equal(tradeAmount);
	(origGoldAmount + tradeGoldAmount).should.equal(player.ExactTotalGoldAmount());
	(origFoodAmount - tradeAmount).should.equal(player.ExactTotalFoodAmount());
	callback();
};