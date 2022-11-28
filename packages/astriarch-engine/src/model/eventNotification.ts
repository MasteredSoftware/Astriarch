import { ClientPlayer } from "./clientModel";
import { FleetData } from "./fleet";
import { PlanetData, PlanetResourceData } from "./planet";

export interface PlanetaryConflictData {
  defendingClientPlayer: ClientPlayer;
  defendingFleet: FleetData;
  attackingClientPlayer: ClientPlayer;
  attackingFleet: FleetData;
  winningFleet: FleetData; // Fleet remaining
  resourcesLooted: PlanetResourceData;
}

export enum EventNotificationType {
  ResourcesAutoSpent = 0,
  PopulationGrowth = 1,
  TradesExecuted = 2,
  TradesNotExecuted = 3,
  ImprovementBuilt = 4,
  ShipBuilt = 5,
  ImprovementDemolished = 6,
  BuildQueueEmpty = 7,
  ResearchComplete = 8,
  ResearchQueueEmpty = 9,
  ResearchStolen = 10,
  CitizensProtesting = 11,
  InsufficientFood = 12, //either general food shortage or couldn't ship because of lack of gold, leads to population unrest
  DefendedAgainstAttackingFleet = 13,
  AttackingFleetLost = 14,
  PlanetCaptured = 15,
  PopulationStarvation = 16,
  FoodShortageRiots = 17,
  PlanetLostDueToStarvation = 18, //this is bad but you probably know it's bad
  PlanetLost = 19,
}

export interface EventNotification {
  playerId: string;
  type: EventNotificationType;
  message: string;
  planet?: PlanetData; //only populated if applies to message
  data?: PlanetaryConflictData; //for planetary conflict type messages
}
