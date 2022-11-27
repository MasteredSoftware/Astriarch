import { PointData } from "../shapes/shapes";
import { GameOptions, ModelBase } from "./model";
import { PlanetData, PlanetType } from "./planet";
import { ColorRgbaData, PlayerData, PlayerType } from "./player";
import { ResearchData } from "./research";
import { TradeData, TradingCenterResource } from "./tradingCenter";

export type PlanetById = { [T in number]: PlanetData };

export interface ClientPlayer {
  id: string;
  type: PlayerType;
  name: string;
  color: ColorRgbaData;
  points: number;
  destroyed: boolean;
  research: ResearchData;
}

export interface ClientPlanet {
  id: number;
  name: string;
  originPoint: PointData;
  boundingHexMidPoint: PointData;
  type: PlanetType | null; //NOTE: Populated when the main player explores the planet
}

export interface ClientTradingCenter {
  creditAmount: number;
  foodResource: TradingCenterResource;
  oreResource: TradingCenterResource;
  iridiumResource: TradingCenterResource;
  mainPlayerTrades: TradeData[];
}

export interface ClientModelData extends ModelBase {
  clientTradingCenter: ClientTradingCenter;
  mainPlayer: PlayerData;
  mainPlayerOwnedPlanets: PlanetById;
  clientPlayers: ClientPlayer[];
  clientPlanets: ClientPlanet[];
}
