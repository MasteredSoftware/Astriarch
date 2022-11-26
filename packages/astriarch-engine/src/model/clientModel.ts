import { HexagonData, PointData } from "../shapes/shapes";
import { GameOptions } from "./model";
import { PlanetType } from "./planet";
import { ColorRgbaData, PlayerData, PlayerType } from "./player";
import { ResearchData } from "./research";
import { TradeData, TradingCenterResource } from "./tradingCenter";

export interface ClientPlayer {
  id: string;
  type: PlayerType;
  name: string;
  color: ColorRgbaData;
  points: number;
  currentTurnEnded: boolean;
  destroyed: boolean;
  research: ResearchData;
}

export interface ClientPlanet {
  id: number;
  name: string;
  originPoint: PointData;
  boundingHex: HexagonData;
  type: PlanetType | null; //NOTE: Populated when the main player explores the planet
}

export interface ClientTradingCenter {
  creditAmount: number;
  foodResource: TradingCenterResource;
  oreResource: TradingCenterResource;
  iridiumResource: TradingCenterResource;
  mainPlayerTrades: TradeData[];
}

export interface ClientModelData {
  currentCycle: number;
  mainPlayer: PlayerData;
  clientPlayers: ClientPlayer[];
  clientPlanets: ClientPlanet[];
  clientTradingCenter: ClientTradingCenter;
  gameOptions: GameOptions;
}
