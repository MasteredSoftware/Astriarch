import { PlanetData } from './planet';
import { PlayerData } from './player';
import { TradingCenterData } from './tradingCenter';

export enum GameSpeed {
  SLOWEST = 1,
  SLOW = 2,
  NORMAL = 3,
  FAST = 4,
  FASTEST = 5,
}

export enum PlanetsPerSystemOption {
  FOUR = 4,
  FIVE = 5,
  SIX = 6,
  SEVEN = 7,
  EIGHT = 8,
}

export enum GalaxySizeOption {
  TINY = 1,
  SMALL = 2,
  MEDIUM = 3,
  LARGE = 4,
} //multiplier for Astriarch.Hexagon.Static

export interface GameOptions {
  systemsToGenerate: number;
  planetsPerSystem: PlanetsPerSystemOption;
  galaxySize: GalaxySizeOption;
  distributePlanetsEvenly: boolean;
  quickStart: boolean;
  gameSpeed: GameSpeed;
  version: string;
}

export interface ModelBase {
  gameOptions: GameOptions;
  gameStartedAtTime: number;
  lastSnapshotTime: number;
  currentCycle: number;
}

export interface ModelData extends ModelBase {
  tradingCenter: TradingCenterData;
  players: PlayerData[];
  planets: PlanetData[];
}
