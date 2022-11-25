import { TradingCenterData, TradingCenterResource, TradingCenterResourceType } from "../model/tradingCenter";

export class TradingCenter {
    public static buildData(playerCount: number): TradingCenterData {
        const creditAmount = playerCount ? playerCount * 5 : 10;
        const foodResource = TradingCenter.buildResource(TradingCenterResourceType.FOOD, (playerCount || 2) * 200, 400, 0.1, 1.5, 40);
        const oreResource = TradingCenter.buildResource(TradingCenterResourceType.ORE, (playerCount || 2) * 10, 200, 0.2, 3.0, 20);
        const iridiumResource = TradingCenter.buildResource(TradingCenterResourceType.IRIDIUM, (playerCount || 2) * 5, 100, 0.4, 6.0, 10);
        return {
            creditAmount,
            foodResource,
            oreResource,
            iridiumResource,
            currentTrades: [],
            transactionFeePercentage: 0.1,
            interestPercentage: 0.01
        }
    }

    public static buildResource(type: TradingCenterResourceType, amount:number, desiredAmount:number, priceMin:number, priceMax:number, tradeAmountMax:number): TradingCenterResource {
        const resource = {
            type,
            amount,
            desiredAmount,
            priceMin,
            priceMax,
            tradeAmountMax,
            currentPrice: priceMax
        }
        TradingCenter.adjustCurrentPrice(resource);
        return resource;
    }

    public static adjustCurrentPrice(resource: TradingCenterResource): TradingCenterResource {
        if (resource.amount >= resource.desiredAmount) {
            resource.currentPrice = resource.priceMin;
          } else if (resource.amount <= 0) {
            resource.currentPrice = resource.priceMax;
          } else {
            var priceChangePerUnit = (resource.priceMax - resource.priceMin) / resource.desiredAmount;
            resource.currentPrice = resource.priceMin + priceChangePerUnit * (resource.desiredAmount - resource.amount);
          }
        return resource;
    }
}