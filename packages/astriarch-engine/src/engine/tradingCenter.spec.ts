import { ClientModelData } from '../model/clientModel';
import { PlayerData } from '../model/player';
import { TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import {startNewTestGame, TestGameData} from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { GameModel, GameModelData } from './gameModel';
import { TradingCenter } from './tradingCenter';

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;

const checkTrade = function(gameModel: GameModelData, clientGameModel: ClientModelData, player: PlayerData, tradeType: TradeType, resourceType: TradingCenterResourceType, tradeAmount: number) {
  const {tradingCenter} = gameModel.modelData;
  const totalResources = GameModel.getPlayerTotalResources(player, clientGameModel.mainPlayerOwnedPlanets);
  const origEnergyAmount = totalResources.energy;
  const origResourceAmount = resourceType === TradingCenterResourceType.FOOD ? totalResources.food : resourceType === TradingCenterResourceType.ORE ? totalResources.ore : totalResources.iridium;
  const origResourcePrice = resourceType === TradingCenterResourceType.FOOD ? tradingCenter.foodResource.currentPrice : resourceType === TradingCenterResourceType.ORE ? tradingCenter.foodResource.currentPrice : tradingCenter.iridiumResource.currentPrice;
  const trade = TradingCenter.constructTrade(player.id, player.homePlanetId!, tradeType, resourceType, tradeAmount);
  //{executed:false, foodAmount:0, oreAmount:0, iridiumAmount:0, tradeGoldAmount:0}
  const homePlanet = GameModel.getPlanetById(gameModel, player.homePlanetId!);
  const executedStatus = TradingCenter.executeTrade(gameModel, player, homePlanet!, trade);
  if (executedStatus.executed) {
    //recalculate current prices in trading center for each trade executed
    TradingCenter.recalculatePrices(tradingCenter);
  } else {
    throw new Error("Trade was not executed successfully");
  }
  let tradeEnergyAmount = origResourcePrice * tradeAmount;
  //subtract fee
  tradeEnergyAmount -= tradeEnergyAmount * tradingCenter.transactionFeePercentage;
  const totalResourcesNew = GameModel.getPlayerTotalResources(player, clientGameModel.mainPlayerOwnedPlanets);
  expect(executedStatus.tradeEnergyAmount).toEqual(tradeEnergyAmount);
  expect(resourceType === TradingCenterResourceType.FOOD ? executedStatus.foodAmount : resourceType === TradingCenterResourceType.ORE ? executedStatus.oreAmount : executedStatus.iridiumAmount).toEqual(tradeAmount);
  expect(origEnergyAmount + tradeEnergyAmount).toEqual(totalResourcesNew.energy);
  expect(origResourceAmount - tradeAmount).toEqual(totalResourcesNew.food);
};

describe('tradingCenter', () => {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
  });

  describe("executeTrade", () => {
    it("should execute a sell food trade for player1 given that player has sufficient resources", function() {
      const tradeAmount = 1;
      const clientGameModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player1.id);
      checkTrade(
        testGameData.gameModel,
        clientGameModel,
        player1,
        TradeType.SELL,
        TradingCenterResourceType.FOOD,
        tradeAmount
      );
    });

    it("should execute a sell food trade for player2 given that player has sufficient resources", () => {
      const tradeAmount = 2;
      const clientGameModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player2.id);
      checkTrade(
        testGameData.gameModel,
        clientGameModel,
        player2,
        TradeType.SELL,
        TradingCenterResourceType.FOOD,
        tradeAmount
      );
    });

    /*
    it("should not execute a sell food trade for player1 given that player has insufficient resources", (done) => {
      const tradeAmount = 20;
      const trade = new Astriarch.TradingCenter.Trade(
        -1,
        player1.HomePlanetId,
        Astriarch.TradingCenter.TradeType.SELL,
        Astriarch.TradingCenter.ResourceType.FOOD,
        tradeAmount,
        Astriarch.TradingCenter.OrderType.MARKET,
        null
      );
      const homePlanet = gameModel.getPlanetById(player1.HomePlanetId);
      const executedStatus = gameModel.TradingCenter.executeTrade(gameModel, player1, homePlanet, trade);
      executedStatus.executed.should.equal(false);

      done();
    });

    it("should not execute a buy food trade for player1 given that player has insufficient gold", (done) => {
      const tradeAmount = 30;
      const trade = new Astriarch.TradingCenter.Trade(
        -1,
        player1.HomePlanetId,
        Astriarch.TradingCenter.TradeType.BUY,
        Astriarch.TradingCenter.ResourceType.FOOD,
        tradeAmount,
        Astriarch.TradingCenter.OrderType.MARKET,
        null
      );
      const homePlanet = gameModel.getPlanetById(player1.HomePlanetId);
      const executedStatus = gameModel.TradingCenter.executeTrade(gameModel, player1, homePlanet, trade);
      executedStatus.executed.should.equal(false);

      done();
    });
  });

  describe("executeCurrentTrades()", () => {
    it("should execute all current trades when trades are valid", (done) => {
      const newTrades = [];
      newTrades.push(
        new Astriarch.TradingCenter.Trade(
          player1.Id,
          player1.HomePlanetId,
          Astriarch.TradingCenter.TradeType.SELL,
          Astriarch.TradingCenter.ResourceType.FOOD,
          1,
          Astriarch.TradingCenter.OrderType.MARKET,
          null
        )
      );
      newTrades.push(
        new Astriarch.TradingCenter.Trade(
          player2.Id,
          player2.HomePlanetId,
          Astriarch.TradingCenter.TradeType.BUY,
          Astriarch.TradingCenter.ResourceType.FOOD,
          1,
          Astriarch.TradingCenter.OrderType.MARKET,
          null
        )
      );
      gameModel.TradingCenter.currentTrades = gameModel.TradingCenter.currentTrades.concat(newTrades);
      const endOfTurnMessagesByPlayerId = {};
      const executedStatusListByPlayerId = Astriarch.ServerController.executeCurrentTrades(
        gameModel,
        endOfTurnMessagesByPlayerId
      );

      Object.keys(executedStatusListByPlayerId).forEach(function(key) {
        executedStatusListByPlayerId[key].forEach(function(executedStatus) {
          if (!executedStatus.executed) {
            done("Not all trades executed!" + JSON.stringify(executedStatus.trade));
          }
        });
      });
      done();
    });

    it("should not execute all current trades when some trades are invalid", (done) => {
      const newTrades = [];
      newTrades.push(
        new Astriarch.TradingCenter.Trade(
          player1.Id,
          player1.HomePlanetId,
          Astriarch.TradingCenter.TradeType.BUY,
          Astriarch.TradingCenter.ResourceType.FOOD,
          15,
          Astriarch.TradingCenter.OrderType.MARKET,
          null
        )
      );
      newTrades.push(
        new Astriarch.TradingCenter.Trade(
          player1.Id,
          player1.HomePlanetId,
          Astriarch.TradingCenter.TradeType.BUY,
          Astriarch.TradingCenter.ResourceType.FOOD,
          15,
          Astriarch.TradingCenter.OrderType.MARKET,
          null
        )
      );
      gameModel.TradingCenter.currentTrades = gameModel.TradingCenter.currentTrades.concat(newTrades);
      const endOfTurnMessagesByPlayerId = {};
      const executedStatusListByPlayerId = Astriarch.ServerController.executeCurrentTrades(
        gameModel,
        endOfTurnMessagesByPlayerId
      );
      //console.log("executedStatusListByPlayerId:", executedStatusListByPlayerId);
      const tradeExecutedCount = 0;
      Object.keys(executedStatusListByPlayerId).forEach(function(key) {
        executedStatusListByPlayerId[key].forEach(function(executedStatus) {
          if (executedStatus.executed) {
            tradeExecutedCount++;
          }
        });
      });
      tradeExecutedCount.should.equal(1);
      done();
    });
    */
  });
  
});


