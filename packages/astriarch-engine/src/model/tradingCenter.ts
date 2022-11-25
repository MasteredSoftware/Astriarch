export enum TradingCenterResourceType {
  FOOD = 1,
  ORE = 2,
  IRIDIUM = 3,
}

export enum TradeType {
  BUY = 1,
  SELL = 2,
}

export interface TradeData {
  playerId: string;
  planetId: string;
  tradeType: TradeType;
  resourceType: TradingCenterResourceType;
  amount: number;
}

export interface TradingCenterResource {
  type: TradingCenterResourceType;
  amount: number;
  desiredAmount: number;
  priceMin: number;
  priceMax: number;
  tradeAmountMax: number;
  currentPrice: number;
}

export interface TradingCenterData {
  creditAmount: number;
  foodResource: TradingCenterResource;
  oreResource: TradingCenterResource;
  iridiumResource: TradingCenterResource;
  currentTrades: TradeData[];
  transactionFeePercentage: number;
  interestPercentage: number;
}
