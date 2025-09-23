import { PlanetById } from '../model/clientModel';
import { PlanetData } from '../model/planet';
import { PlayerData } from '../model/player';
import {
  TradeData,
  TradeType,
  TradingCenterData,
  TradingCenterResource,
  TradingCenterResourceType,
} from '../model/tradingCenter';
import { Events } from './events';
import { GameModel, GameModelData } from './gameModel';
import { Planet } from './planet';
import { Utils } from '../utils/utils';
import { EventNotificationType } from '../model/eventNotification';

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
      40,
    );
    const oreResource = TradingCenter.constructResource(
      TradingCenterResourceType.ORE,
      (playerCount || 2) * 10,
      200,
      0.2,
      3.0,
      20,
    );
    const iridiumResource = TradingCenter.constructResource(
      TradingCenterResourceType.IRIDIUM,
      (playerCount || 2) * 5,
      100,
      0.4,
      6.0,
      10,
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
    tradeAmountMax: number,
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
    amount: number,
    delaySeconds = 5,
  ): TradeData {
    const now = Date.now();
    return {
      id: Utils.generateUniqueId(),
      playerId,
      planetId,
      tradeType,
      resourceType,
      amount,
      submittedAt: now,
      executeAfter: now + delaySeconds * 1000,
    };
  }

  public static cancelTrade(tradingCenterData: TradingCenterData, tradeId: string, playerId: string): boolean {
    const tradeIndex = tradingCenterData.currentTrades.findIndex(
      (trade) => trade.id === tradeId && trade.playerId === playerId,
    );

    if (tradeIndex === -1) {
      return false; // Trade not found or not owned by player
    }

    const trade = tradingCenterData.currentTrades[tradeIndex];
    const now = Date.now();

    // Allow cancellation only if trade hasn't been executed yet
    if (now < trade.executeAfter) {
      tradingCenterData.currentTrades.splice(tradeIndex, 1);
      return true; // Successfully cancelled
    }

    return false; // Too late to cancel
  }

  public static adjustCurrentPrice(resource: TradingCenterResource): TradingCenterResource {
    if (resource.amount >= resource.desiredAmount) {
      resource.currentPrice = resource.priceMin;
    } else if (resource.amount <= 0) {
      resource.currentPrice = resource.priceMax;
    } else {
      const priceChangePerUnit = (resource.priceMax - resource.priceMin) / resource.desiredAmount;
      resource.currentPrice = resource.priceMin + priceChangePerUnit * (resource.desiredAmount - resource.amount);
    }
    return resource;
  }

  public static recalculatePrices(tradingCenterData: TradingCenterData) {
    this.adjustCurrentPrice(tradingCenterData.foodResource);
    this.adjustCurrentPrice(tradingCenterData.oreResource);
    this.adjustCurrentPrice(tradingCenterData.iridiumResource);
  }

  public static getResourceByType(tradingCenterData: TradingCenterData, resourceType: TradingCenterResourceType) {
    return resourceType === TradingCenterResourceType.FOOD
      ? tradingCenterData.foodResource
      : resourceType === TradingCenterResourceType.ORE
        ? tradingCenterData.oreResource
        : tradingCenterData.iridiumResource;
  }

  public static executeTrade(
    gameModel: GameModelData,
    planetById: PlanetById,
    player: PlayerData,
    planet: PlanetData,
    trade: TradeData,
  ): ExecuteTradeResults {
    const executedStatus = { executed: false, foodAmount: 0, oreAmount: 0, iridiumAmount: 0, tradeEnergyAmount: 0 };
    const { tradingCenter } = gameModel.modelData;
    const playerTotalResources = GameModel.getPlayerTotalResources(player, planetById);
    const marketResource = this.getResourceByType(tradingCenter, trade.resourceType);
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
          gameModel.grid,
          player,
          planetById,
          planet,
          0,
          executedStatus.foodAmount,
          executedStatus.oreAmount,
          executedStatus.iridiumAmount,
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
        Planet.spendResources(gameModel.grid, player, planetById, planet, executedStatus.tradeEnergyAmount, 0, 0, 0);

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

  public static executeCurrentTrades(gameModel: GameModelData, planetById: PlanetById, cyclesElapsed: number) {
    //go through the current trades and deduct from the stockpile for buy orders and add to the stockpile for sell orders
    const tc = gameModel.modelData.tradingCenter;
    const now = Date.now();

    // Separate trades into executable and pending based on timing
    const executableTrades = tc.currentTrades.filter((trade) => now >= trade.executeAfter);
    const pendingTrades = tc.currentTrades.filter((trade) => now < trade.executeAfter);

    // Update currentTrades to only contain pending trades
    tc.currentTrades = pendingTrades;

    const playersById: Record<string, PlayerData> = {};
    const executedTradeResultsByPlayerId: Record<string, { trade: TradeData; results: ExecuteTradeResults }[]> = {};
    for (const p of gameModel.modelData.players) {
      playersById[p.id] = p;
      executedTradeResultsByPlayerId[p.id] = [];
    }

    // Execute only the trades that are ready
    for (const trade of executableTrades) {
      const player = playersById[trade.playerId];
      if (player) {
        const planet = planetById[trade.planetId];
        if (planet) {
          //{executed:false, foodAmount:0, oreAmount:0, iridiumAmount:0, tradeGoldAmount:0}
          const results = TradingCenter.executeTrade(gameModel, planetById, player, planet, trade);
          if (results.executed) {
            //recalculate current prices in trading center for each trade executed
            TradingCenter.recalculatePrices(tc);
          }
          executedTradeResultsByPlayerId[trade.playerId].push({ trade, results });
        } else {
          console.warn('Unable to find planet in executeCurrentTrades:', trade);
        }
      } else {
        console.warn('Unable to find player in executeCurrentTrades:', trade);
      }
    }

    //create summary endOfTurnMessages
    for (const [playerId, results] of Object.entries(executedTradeResultsByPlayerId)) {
      const resourcesBought = { food: 0, ore: 0, iridium: 0, energySpent: 0, tradeCount: 0 };
      const resourcesSold = { food: 0, ore: 0, iridium: 0, energyEarned: 0, tradeCount: 0 };
      const resourcesNotBought = { food: 0, ore: 0, iridium: 0, energySpent: 0, tradeCount: 0 };
      const resourcesNotSold = { food: 0, ore: 0, iridium: 0, energyEarned: 0, tradeCount: 0 };
      for (const r of results) {
        let rbTarget = resourcesNotBought;
        let rsTarget = resourcesNotSold;
        if (r.results.executed) {
          rbTarget = resourcesBought;
          rsTarget = resourcesSold;
        }
        if (r.trade.tradeType === TradeType.BUY) {
          rbTarget.food += r.results.foodAmount;
          rbTarget.ore += r.results.oreAmount;
          rbTarget.iridium += r.results.iridiumAmount;
          rbTarget.energySpent += r.results.tradeEnergyAmount;
          rbTarget.tradeCount++;
        } else {
          rsTarget.food += r.results.foodAmount;
          rsTarget.ore += r.results.oreAmount;
          rsTarget.iridium += r.results.iridiumAmount;
          rsTarget.energyEarned += r.results.tradeEnergyAmount;
          rsTarget.tradeCount++;
        }
      }
      if (resourcesBought.tradeCount || resourcesSold.tradeCount) {
        const tradeCount = resourcesBought.tradeCount + resourcesSold.tradeCount;
        let message = tradeCount > 1 ? tradeCount + ' Trades Executed,' : tradeCount + ' Trade Executed,';
        if (resourcesBought.energySpent) {
          message +=
            ' Spent ' +
            Utils.decimalToFixed(resourcesBought.energySpent, 2) +
            ' energy buying: ' +
            (resourcesBought.food ? resourcesBought.food + ' food, ' : '') +
            (resourcesBought.ore ? resourcesBought.ore + ' ore, ' : '') +
            (resourcesBought.iridium ? resourcesBought.iridium + ' iridium, ' : '');
        }
        if (resourcesSold.energyEarned) {
          message +=
            ' Earned ' +
            Utils.decimalToFixed(resourcesSold.energyEarned, 2) +
            ' energy selling: ' +
            (resourcesSold.food ? resourcesSold.food + ' food, ' : '') +
            (resourcesSold.ore ? resourcesSold.ore + ' ore, ' : '') +
            (resourcesSold.iridium ? resourcesSold.iridium + ' iridium, ' : '');
        }
        message = message.substring(0, message.length - 2);

        Events.enqueueNewEvent(playerId, EventNotificationType.TradesExecuted, message);
      }

      if (resourcesNotBought.tradeCount || resourcesNotSold.tradeCount) {
        const tradeCount = resourcesNotBought.tradeCount + resourcesNotSold.tradeCount;
        let message = tradeCount > 1 ? tradeCount + ' Trades Not Executed,' : tradeCount + ' Trade Not Executed,';
        if (resourcesNotBought.energySpent) {
          message +=
            ' Could not Buy: ' +
            (resourcesNotBought.food ? resourcesNotBought.food + ' food, ' : '') +
            (resourcesNotBought.ore ? resourcesNotBought.ore + ' ore, ' : '') +
            (resourcesNotBought.iridium ? resourcesNotBought.iridium + ' iridium, ' : '');
        }
        if (resourcesNotSold.energyEarned) {
          message +=
            ' Could not Sell: ' +
            (resourcesNotSold.food ? resourcesNotSold.food + ' food, ' : '') +
            (resourcesNotSold.ore ? resourcesNotSold.ore + ' ore, ' : '') +
            (resourcesNotSold.iridium ? resourcesNotSold.iridium + ' iridium, ' : '');
        }
        message = message.substring(0, message.length - 2);

        Events.enqueueNewEvent(playerId, EventNotificationType.TradesNotExecuted, message);
      }
    }

    // Note: tc.currentTrades now only contains pending trades (not yet executable)
    // We no longer clear all trades here since pending trades should remain
    this.earnInterest(tc, cyclesElapsed);

    return executedTradeResultsByPlayerId;
  }

  public static earnInterest(tradingCenter: TradingCenterData, cyclesElapsed: number) {
    tradingCenter.energyAmount +=
      this.getResourcesTotalValue(tradingCenter) * tradingCenter.interestPercentage * cyclesElapsed;
  }

  public static getResourcesTotalValue(tradingCenter: TradingCenterData) {
    let totalValue = tradingCenter.energyAmount;
    totalValue += tradingCenter.foodResource.amount * tradingCenter.foodResource.currentPrice;
    totalValue += tradingCenter.oreResource.amount * tradingCenter.oreResource.currentPrice;
    totalValue += tradingCenter.iridiumResource.amount * tradingCenter.iridiumResource.currentPrice;
    return totalValue;
  }

  public static getPendingTrades(tradingCenterData: TradingCenterData, playerId: string): TradeData[] {
    return tradingCenterData.currentTrades.filter((trade) => trade.playerId === playerId);
  }

  public static getTradeTimeRemaining(trade: TradeData): number {
    const now = Date.now();
    const remaining = trade.executeAfter - now;
    return Math.max(0, remaining);
  }

  public static canCancelTrade(trade: TradeData): boolean {
    const now = Date.now();
    return now < trade.executeAfter;
  }
}
