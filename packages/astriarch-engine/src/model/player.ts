import { EarnedPointsType } from './earnedPoints';
import type { FleetData, LastKnownFleetData } from './fleet';
import type { PlanetProductionItemData } from './planet';
import type { ResearchData } from './research';

export interface PlayerGameOptions {
  showPlanetaryConflictPopups: boolean;
}

export enum PlayerType {
  Human = 0,
  Computer_Easy = 1,
  Computer_Normal = 2,
  Computer_Hard = 3,
  Computer_Expert = 4,
}

export interface ColorRgbaData {
  r: number; // red
  g: number; // green
  b: number; // blue
  a: number; // alpha
}

export type EarnedPointsByType = Record<EarnedPointsType, number>;

export type LastKnownPlanetFleetStrength = Record<number, LastKnownFleetData>;

export interface PlayerData {
  id: string;
  type: PlayerType;
  name: string;
  research: ResearchData;
  color: ColorRgbaData;
  lastTurnFoodNeededToBeShipped: number; //this is to know how much energy to keep in surplus for food shipments
  lastTurnFoodShipped: number; //how much food was actually shipped last turn
  options: PlayerGameOptions;
  ownedPlanetIds: number[];
  knownPlanetIds: number[];
  lastKnownPlanetFleetStrength: LastKnownPlanetFleetStrength;
  planetBuildGoals: Record<number, PlanetProductionItemData>;
  homePlanetId: number | null;
  earnedPointsByType: EarnedPointsByType;
  points: number;
  fleetsInTransit: FleetData[];
  destroyed: boolean;
  nextFleetId: number; // Player-scoped fleet ID counter

  /**
   * Rolling checksum of all events processed by this client.
   * Used to detect desync - if client and server checksums diverge,
   * we know events were missed or applied out of order.
   * Empty string initially, then updated with each event batch.
   */
  lastEventChecksum: string;
}
