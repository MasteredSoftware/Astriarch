import type { PlanetData } from './planet';
import type { PlayerData } from './player';
import type { TradingCenterData } from './tradingCenter';

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

export enum OpponentOptionType {
  CLOSED = -2,
  OPEN = -1,
  HUMAN = 0,
  EASY_COMPUTER = 1,
  NORMAL_COMPUTER = 2,
  HARD_COMPUTER = 3,
  EXPERT_COMPUTER = 4,
}

export interface OpponentOption {
  name: string;
  type: OpponentOptionType;
}

export interface GameOptions {
  systemsToGenerate: number; // Number of systems (2-4 players)
  planetsPerSystem: PlanetsPerSystemOption;
  galaxySize: GalaxySizeOption;
  distributePlanetsEvenly: boolean;
  quickStart: boolean;
  gameSpeed: GameSpeed;
  version: string;
}

export interface ServerGameOptions extends GameOptions {
  name?: string;
  mainPlayerName?: string;
  opponentOptions: OpponentOption[];
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
  playersDestroyed: PlayerData[];
}
