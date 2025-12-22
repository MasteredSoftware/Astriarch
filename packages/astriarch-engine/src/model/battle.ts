import { ClientPlayer } from './clientModel';
import { FleetData } from './fleet';
import { PlanetResourceData } from './planet';

export interface ResearchBoost {
  attack: number;
  defense: number;
}

/**
 * Detailed information about a planetary conflict/battle
 * Used for displaying battle results and statistics to players
 */
export interface PlanetaryConflictData {
  defendingClientPlayer: ClientPlayer | null;
  defendingFleet: FleetData;
  defendingFleetResearchBoost: ResearchBoost;
  attackingClientPlayer: ClientPlayer;
  attackingFleet: FleetData;
  attackingFleetResearchBoost: ResearchBoost;
  attackingFleetChances: number | null;
  winningFleet: FleetData | null; // Fleet remaining after battle
  resourcesLooted: PlanetResourceData;
}
