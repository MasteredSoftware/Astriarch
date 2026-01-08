import { ClientPlayer } from './clientModel';
import { FleetData } from './fleet';
import { PlanetResourceData } from './planet';

export interface ResearchBoost {
  attack: number;
  defense: number;
}

/**
 * Delta-based combat results for applying to fleet state
 * Allows client to apply changes without overwriting concurrent production/repairs
 */
export interface CombatResultDiff {
  shipsDestroyed: string[]; // IDs of ships killed in battle (planet-scoped strings)
  shipsDamaged: {
    // Damage to apply to surviving ships
    id: string;
    damage: number; // Amount of damage dealt (subtract from current health)
  }[];
  shipsExperienceGained: {
    // Experience gained by surviving ships
    id: string;
    experience: number;
  }[];
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
  combatResultDiff: CombatResultDiff | null; // Delta to apply to the winning fleet
  resourcesLooted: PlanetResourceData;
}
