import { ClientModelData, PlanetById } from '../model/clientModel';
import { PlayerData } from '../model/player';
import { TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import { startNewTestGame, TestGameData } from '../test/testUtils';
import { ClientGameModel } from './clientGameModel';
import { GameModel, GameModelData } from './gameModel';
import { TradingCenter } from './tradingCenter';

let testGameData: TestGameData;
let player1: PlayerData;
let player2: PlayerData;
let planetById: PlanetById;

const checkTrade = function (
  gameModel: GameModelData,
  planetById: PlanetById,
  clientGameModel: ClientModelData,
  player: PlayerData,
  tradeType: TradeType,
  resourceType: TradingCenterResourceType,
  tradeAmount: number,
) {
  const { tradingCenter } = gameModel.modelData;
  const totalResources = GameModel.getPlayerTotalResources(player, clientGameModel.mainPlayerOwnedPlanets);
  const origEnergyAmount = totalResources.energy;
  const origResourceAmount =
    resourceType === TradingCenterResourceType.FOOD
      ? totalResources.food
      : resourceType === TradingCenterResourceType.ORE
        ? totalResources.ore
        : totalResources.iridium;
  const origResourcePrice =
    resourceType === TradingCenterResourceType.FOOD
      ? tradingCenter.foodResource.currentPrice
      : resourceType === TradingCenterResourceType.ORE
        ? tradingCenter.foodResource.currentPrice
        : tradingCenter.iridiumResource.currentPrice;
  const trade = TradingCenter.constructTrade(player.id, player.homePlanetId!, tradeType, resourceType, tradeAmount);
  //{executed:false, foodAmount:0, oreAmount:0, iridiumAmount:0, tradeGoldAmount:0}
  const homePlanet = GameModel.getPlanetById(gameModel, player.homePlanetId!);
  const executedStatus = TradingCenter.executeTrade(gameModel, planetById, player, homePlanet!, trade);
  if (executedStatus.executed) {
    //recalculate current prices in trading center for each trade executed
    TradingCenter.recalculatePrices(tradingCenter);
  } else {
    throw new Error('Trade was not executed successfully');
  }
  let tradeEnergyAmount = origResourcePrice * tradeAmount;
  //subtract fee
  tradeEnergyAmount -= tradeEnergyAmount * tradingCenter.transactionFeePercentage;
  const totalResourcesNew = GameModel.getPlayerTotalResources(player, clientGameModel.mainPlayerOwnedPlanets);
  expect(executedStatus.tradeEnergyAmount).toEqual(tradeEnergyAmount);
  expect(
    resourceType === TradingCenterResourceType.FOOD
      ? executedStatus.foodAmount
      : resourceType === TradingCenterResourceType.ORE
        ? executedStatus.oreAmount
        : executedStatus.iridiumAmount,
  ).toEqual(tradeAmount);
  expect(origEnergyAmount + tradeEnergyAmount).toEqual(totalResourcesNew.energy);
  expect(origResourceAmount - tradeAmount).toEqual(totalResourcesNew.food);
};

describe('tradingCenter', () => {
  beforeEach(() => {
    testGameData = startNewTestGame();
    player1 = testGameData.gameModel.modelData.players[0];
    player2 = testGameData.gameModel.modelData.players[1];
    planetById = ClientGameModel.getPlanetByIdIndex(testGameData.gameModel.modelData.planets);
  });

  describe('executeTrade', () => {
    it('should execute a sell food trade for player1 given that player has sufficient resources', function () {
      const tradeAmount = 1;
      const clientGameModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player1.id);
      checkTrade(
        testGameData.gameModel,
        planetById,
        clientGameModel,
        player1,
        TradeType.SELL,
        TradingCenterResourceType.FOOD,
        tradeAmount,
      );
    });

    it('should execute a sell food trade for player2 given that player has sufficient resources', () => {
      const tradeAmount = 2;
      const clientGameModel = ClientGameModel.constructClientGameModel(testGameData.gameModel.modelData, player2.id);
      checkTrade(
        testGameData.gameModel,
        planetById,
        clientGameModel,
        player2,
        TradeType.SELL,
        TradingCenterResourceType.FOOD,
        tradeAmount,
      );
    });

    it('should not execute a sell food trade for player1 given that player has insufficient resources', () => {
      const tradeAmount = 20;
      const trade = TradingCenter.constructTrade(
        player1.id,
        player1.homePlanetId!,
        TradeType.SELL,
        TradingCenterResourceType.FOOD,
        tradeAmount,
      );
      const homePlanet = GameModel.getPlanetById(testGameData.gameModel, player1.homePlanetId!);
      const executedStatus = TradingCenter.executeTrade(
        testGameData.gameModel,
        planetById,
        player1,
        homePlanet!,
        trade,
      );
      expect(executedStatus.executed).toEqual(false);
    });

    it('should not execute a buy food trade for player1 given that player has insufficient gold', () => {
      const tradeAmount = 30;
      const trade = TradingCenter.constructTrade(
        player1.id,
        player1.homePlanetId!,
        TradeType.BUY,
        TradingCenterResourceType.FOOD,
        tradeAmount,
      );
      const homePlanet = GameModel.getPlanetById(testGameData.gameModel, player1.homePlanetId!);
      const executedStatus = TradingCenter.executeTrade(
        testGameData.gameModel,
        planetById,
        player1,
        homePlanet!,
        trade,
      );
      expect(executedStatus.executed).toEqual(false);
    });
  });

  describe('executeCurrentTrades', () => {
    it('should execute all current trades when trades are valid', () => {
      const newTrades = [];
      newTrades.push(
        TradingCenter.constructTrade(
          player1.id,
          player1.homePlanetId!,
          TradeType.SELL,
          TradingCenterResourceType.FOOD,
          1,
          0, // 0 second delay to execute immediately
        ),
      );
      newTrades.push(
        TradingCenter.constructTrade(
          player2.id,
          player2.homePlanetId!,
          TradeType.BUY,
          TradingCenterResourceType.FOOD,
          1,
          0, // 0 second delay to execute immediately
        ),
      );

      testGameData.gameModel.modelData.tradingCenter.currentTrades =
        testGameData.gameModel.modelData.tradingCenter.currentTrades.concat(newTrades);
      const events = TradingCenter.executeCurrentTrades(testGameData.gameModel, planetById, 1.0);

      // Verify trade execution events were generated (now returns ClientEvent[])
      const tradeEvents = events.filter((e) => e.type === 'TRADE_EXECUTED');
      expect(tradeEvents.length).toEqual(newTrades.length);
    });

    it('should not execute all current trades when some trades are invalid', () => {
      const newTrades = [];
      newTrades.push(
        TradingCenter.constructTrade(
          player1.id,
          player1.homePlanetId!,
          TradeType.BUY,
          TradingCenterResourceType.FOOD,
          15,
          0, // 0 second delay to execute immediately
        ),
      );
      newTrades.push(
        TradingCenter.constructTrade(
          player1.id,
          player1.homePlanetId!,
          TradeType.BUY,
          TradingCenterResourceType.FOOD,
          15,
          0, // 0 second delay to execute immediately
        ),
      );

      testGameData.gameModel.modelData.tradingCenter.currentTrades =
        testGameData.gameModel.modelData.tradingCenter.currentTrades.concat(newTrades);
      const events = TradingCenter.executeCurrentTrades(testGameData.gameModel, planetById, 1.0);

      // Verify only one trade was executed (now returns ClientEvent[])
      const tradeEvents = events.filter((e) => e.type === 'TRADE_EXECUTED');
      expect(tradeEvents.length).toEqual(1);
    });
  });
});
