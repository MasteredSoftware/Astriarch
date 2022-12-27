import { PlanetData } from "../model/planet";
import { PlayerData } from "../model/player";
import {
  TradeData,
  TradeType,
  TradingCenterData,
  TradingCenterResource,
  TradingCenterResourceType,
} from "../model/tradingCenter";
import { ClientGameModel } from "./clientGameModel";
import { GameModel, GameModelData } from "./gameModel";
import { Planet } from "./planet";

export interface ExecuteTradeResults {
  executed: boolean;
  foodAmount: number;
  oreAmount: number;
  iridiumAmount: number;
  tradeEnergyAmount: number;
}

export class TradingCenter {
  public static constructData(playerCount: number): TradingCenterData {
    const energyAmount = playerCount ? playerCount * 5 : 10;
    const foodResource = TradingCenter.constructResource(
      TradingCenterResourceType.FOOD,
      (playerCount || 2) * 200,
      400,
      0.1,
      1.5,
      40
    );
    const oreResource = TradingCenter.constructResource(
      TradingCenterResourceType.ORE,
      (playerCount || 2) * 10,
      200,
      0.2,
      3.0,
      20
    );
    const iridiumResource = TradingCenter.constructResource(
      TradingCenterResourceType.IRIDIUM,
      (playerCount || 2) * 5,
      100,
      0.4,
      6.0,
      10
    );
    return {
      energyAmount,
      foodResource,
      oreResource,
      iridiumResource,
      currentTrades: [],
      transactionFeePercentage: 0.1,
      interestPercentage: 0.01,
    };
  }

  public static constructResource(
    type: TradingCenterResourceType,
    amount: number,
    desiredAmount: number,
    priceMin: number,
    priceMax: number,
    tradeAmountMax: number
  ): TradingCenterResource {
    const resource = {
      type,
      amount,
      desiredAmount,
      priceMin,
      priceMax,
      tradeAmountMax,
      currentPrice: priceMax,
    };
    TradingCenter.adjustCurrentPrice(resource);
    return resource;
  }

  public static constructTrade(
    playerId: string,
    planetId: number,
    tradeType: TradeType,
    resourceType: TradingCenterResourceType,
    amount: number
  ): TradeData {
    return {
      playerId,
      planetId,
      tradeType,
      resourceType,
      amount,
    };
  }

  public static adjustCurrentPrice(resource: TradingCenterResource): TradingCenterResource {
    if (resource.amount >= resource.desiredAmount) {
      resource.currentPrice = resource.priceMin;
    } else if (resource.amount <= 0) {
      resource.currentPrice = resource.priceMax;
    } else {
      let priceChangePerUnit = (resource.priceMax - resource.priceMin) / resource.desiredAmount;
      resource.currentPrice = resource.priceMin + priceChangePerUnit * (resource.desiredAmount - resource.amount);
    }
    return resource;
  }

  public static recalculatePrices(tradingCenterData: TradingCenterData) {
    this.adjustCurrentPrice(tradingCenterData.foodResource);
    this.adjustCurrentPrice(tradingCenterData.oreResource);
    this.adjustCurrentPrice(tradingCenterData.iridiumResource);
  }

  public static getResourceByType = function (
    tradingCenterData: TradingCenterData,
    resourceType: TradingCenterResourceType
  ) {
    return resourceType === TradingCenterResourceType.FOOD
      ? tradingCenterData.foodResource
      : resourceType === TradingCenterResourceType.ORE
      ? tradingCenterData.oreResource
      : tradingCenterData.iridiumResource;
  };

  public static executeTrade(
    gameModel: GameModelData,
    player: PlayerData,
    planet: PlanetData,
    trade: TradeData
  ): ExecuteTradeResults {
    let executedStatus = { executed: false, foodAmount: 0, oreAmount: 0, iridiumAmount: 0, tradeEnergyAmount: 0 };
    const { tradingCenter } = gameModel.modelData;
    const planetById = ClientGameModel.getPlanetByIdIndex(gameModel.modelData.planets);
    const playerTotalResources = GameModel.getPlayerTotalResources(player, planetById);
    let marketResource = this.getResourceByType(tradingCenter, trade.resourceType);
    let playerResourceAmount = 0;

    if (trade.resourceType == TradingCenterResourceType.FOOD) {
      trade.amount = Math.min(trade.amount, tradingCenter.foodResource.tradeAmountMax); //limit trade to trading max for resource
      playerResourceAmount = playerTotalResources.food;
      executedStatus.foodAmount = trade.amount;
    } else if (trade.resourceType == TradingCenterResourceType.ORE) {
      trade.amount = Math.min(trade.amount, tradingCenter.oreResource.tradeAmountMax); //limit trade to trading max for resource
      playerResourceAmount = playerTotalResources.ore;
      executedStatus.oreAmount = trade.amount;
    } else {
      trade.amount = Math.min(trade.amount, tradingCenter.iridiumResource.tradeAmountMax); //limit trade to trading max for resource
      playerResourceAmount = playerTotalResources.iridium;
      executedStatus.iridiumAmount = trade.amount;
    }
    executedStatus.tradeEnergyAmount = trade.amount * marketResource.currentPrice;

    if (trade.tradeType == TradeType.SELL) {
      //ensure the player has enough resources and the market has enough gold

      executedStatus.tradeEnergyAmount -= executedStatus.tradeEnergyAmount * tradingCenter.transactionFeePercentage;
      if (tradingCenter.energyAmount >= executedStatus.tradeEnergyAmount && playerResourceAmount >= trade.amount) {
        //execute trade
        tradingCenter.energyAmount -= executedStatus.tradeEnergyAmount;
        planet.resources.energy += executedStatus.tradeEnergyAmount;
        marketResource.amount += trade.amount;

        Planet.spendResources(
          gameModel,
          player,
          planetById,
          planet,
          0,
          executedStatus.foodAmount,
          executedStatus.oreAmount,
          executedStatus.iridiumAmount
        );

        executedStatus.executed = true;
      }
    } else {
      //BUY
      //ensure the player has enough energy and the market has enough resources

      executedStatus.tradeEnergyAmount += executedStatus.tradeEnergyAmount * tradingCenter.transactionFeePercentage;
      if (playerTotalResources.energy >= executedStatus.tradeEnergyAmount && marketResource.amount >= trade.amount) {
        //execute trade
        tradingCenter.energyAmount += executedStatus.tradeEnergyAmount;
        const energyAmount = executedStatus.tradeEnergyAmount * -1;
        Planet.spendResources(gameModel, player, planetById, planet, energyAmount, 0, 0, 0);

        marketResource.amount -= trade.amount;
        if (trade.resourceType === TradingCenterResourceType.FOOD) {
          planet.resources.food += trade.amount;
        } else if (trade.resourceType == TradingCenterResourceType.ORE) {
          planet.resources.ore += trade.amount;
        } else {
          planet.resources.iridium += trade.amount;
        }

        executedStatus.executed = true;
      }
    }

    return executedStatus;
  }
}
