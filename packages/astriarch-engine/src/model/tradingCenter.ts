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
  id: string; // Unique trade ID for cancellation
  playerId: string;
  planetId: number;
  tradeType: TradeType;
  resourceType: TradingCenterResourceType;
  amount: number;
  submittedAt: number; // Timestamp when trade was submitted
  executeAfter: number; // Timestamp when trade becomes executable
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

export interface TradingCenterBase {
  energyAmount: number;
  foodResource: TradingCenterResource;
  oreResource: TradingCenterResource;
  iridiumResource: TradingCenterResource;
}

export interface TradingCenterData extends TradingCenterBase {
  currentTrades: TradeData[];
  transactionFeePercentage: number;
  interestPercentage: number;
}
