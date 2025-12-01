/**
 * Game Commands and Client Events
 *
 * This module defines the command/event architecture for the game:
 * - Commands: Player actions that mutate server-side game state
 * - Client Events: Minimal state changes broadcast to affected players
 *
 * This architecture avoids race conditions by:
 * 1. Processing commands through the engine
 * 2. Generating minimal client events
 * 3. Broadcasting only to affected players
 * 4. Using checksums to detect desync
 */

import { PlanetData, PlanetProductionItemData } from '../model';
import { PlanetaryConflictData } from '../model/battle';
import { ExecuteTradeResults } from './tradingCenter';

// ============================================================================
// COMMAND TYPES - Player actions that change game state
// ============================================================================

export enum GameCommandType {
  QUEUE_PRODUCTION_ITEM = 'QUEUE_PRODUCTION_ITEM',
  REMOVE_PRODUCTION_ITEM = 'REMOVE_PRODUCTION_ITEM',
  DEMOLISH_IMPROVEMENT = 'DEMOLISH_IMPROVEMENT',
  SEND_SHIPS = 'SEND_SHIPS',
  SET_WAYPOINT = 'SET_WAYPOINT',
  CLEAR_WAYPOINT = 'CLEAR_WAYPOINT',
  ADJUST_RESEARCH_PERCENT = 'ADJUST_RESEARCH_PERCENT',
  SUBMIT_RESEARCH_ITEM = 'SUBMIT_RESEARCH_ITEM',
  CANCEL_RESEARCH_ITEM = 'CANCEL_RESEARCH_ITEM',
  SUBMIT_TRADE = 'SUBMIT_TRADE',
  CANCEL_TRADE = 'CANCEL_TRADE',
  UPDATE_PLANET_WORKER_ASSIGNMENTS = 'UPDATE_PLANET_WORKER_ASSIGNMENTS',
  UPDATE_PLANET_OPTIONS = 'UPDATE_PLANET_OPTIONS',
}

// ============================================================================
// CLIENT EVENT TYPES - State-mutating events that require client model updates
// These are either:
// 1. Command responses (player action confirmed by server)
// 2. Server-only operations (conflicts, trade execution)
// ============================================================================

export enum ClientEventType {
  // Command responses - Building/Production
  PRODUCTION_ITEM_QUEUED = 'PRODUCTION_ITEM_QUEUED',
  PRODUCTION_ITEM_REMOVED = 'PRODUCTION_ITEM_REMOVED',

  // Command responses - Fleet actions
  FLEET_LAUNCHED = 'FLEET_LAUNCHED',
  WAYPOINT_SET = 'WAYPOINT_SET',
  WAYPOINT_CLEARED = 'WAYPOINT_CLEARED',

  // Command responses - Research actions
  RESEARCH_QUEUED = 'RESEARCH_QUEUED',
  RESEARCH_CANCELLED = 'RESEARCH_CANCELLED',
  RESEARCH_PERCENT_ADJUSTED = 'RESEARCH_PERCENT_ADJUSTED',

  // Command responses - Trade actions
  TRADE_SUBMITTED = 'TRADE_SUBMITTED',
  TRADE_CANCELLED = 'TRADE_CANCELLED',

  // Command responses - Planet management
  PLANET_WORKER_ASSIGNMENTS_UPDATED = 'PLANET_WORKER_ASSIGNMENTS_UPDATED',
  PLANET_OPTIONS_UPDATED = 'PLANET_OPTIONS_UPDATED',

  // Server-only operations - Trade execution
  TRADES_PROCESSED = 'TRADES_PROCESSED',

  // Server-only operations - Combat/Conflict resolution
  PLANET_CAPTURED = 'PLANET_CAPTURED',
  PLANET_LOST = 'PLANET_LOST',
  FLEET_ATTACK_FAILED = 'FLEET_ATTACK_FAILED',
  FLEET_DEFENSE_SUCCESS = 'FLEET_DEFENSE_SUCCESS',
  RESEARCH_STOLEN = 'RESEARCH_STOLEN',
}

// ============================================================================
// CLIENT NOTIFICATION TYPES - Informational messages about time-based changes
// These are generated during advanceGameClockForPlayer but don't need to mutate
// client state because the client already applied the changes locally.
// They serve as server confirmation and UI notification triggers.
// ============================================================================

export enum ClientNotificationType {
  // Building/Production notifications
  SHIP_BUILT = 'SHIP_BUILT',
  IMPROVEMENT_BUILT = 'IMPROVEMENT_BUILT',
  IMPROVEMENT_DEMOLISHED = 'IMPROVEMENT_DEMOLISHED',

  // Research notifications
  RESEARCH_COMPLETED = 'RESEARCH_COMPLETED',

  // Population notifications
  POPULATION_GREW = 'POPULATION_GREW',
  POPULATION_STARVATION = 'POPULATION_STARVATION',

  // Food/Happiness notifications
  FOOD_SHORTAGE_RIOTS = 'FOOD_SHORTAGE_RIOTS',
  INSUFFICIENT_FOOD = 'INSUFFICIENT_FOOD',
  CITIZENS_PROTESTING = 'CITIZENS_PROTESTING',
  PLANET_LOST_DUE_TO_STARVATION = 'PLANET_LOST_DUE_TO_STARVATION',

  // Resource notifications
  RESOURCES_AUTO_SPENT = 'RESOURCES_AUTO_SPENT',
}

// ============================================================================
// BASE INTERFACES
// ============================================================================

export interface GameCommand {
  type: GameCommandType;
  playerId: string;
  timestamp: number;
}

export interface ClientEvent {
  type: ClientEventType;
  affectedPlayerIds: string[]; // Which players should receive this event
  data: unknown;
}

export interface ClientNotification {
  type: ClientNotificationType;
  affectedPlayerIds: string[]; // Which players should receive this notification
  data: unknown;
}

export interface CommandResult {
  success: boolean;
  error?: string;
  events: ClientEvent[]; // Events to send to clients
  // Note: stateChecksum will be calculated by the backend after processing,
  // using the player's ClientModelData
}

// ============================================================================
// SPECIFIC COMMAND PAYLOADS
// ============================================================================

export interface QueueProductionItemCommand extends GameCommand {
  type: GameCommandType.QUEUE_PRODUCTION_ITEM;
  planetId: number;
  productionItem: PlanetProductionItemData;
}

export interface RemoveProductionItemCommand extends GameCommand {
  type: GameCommandType.REMOVE_PRODUCTION_ITEM;
  planetId: number;
  index: number;
}

export interface DemolishImprovementCommand extends GameCommand {
  type: GameCommandType.DEMOLISH_IMPROVEMENT;
  planetId: number;
  productionItem: PlanetProductionItemData;
}

export interface SendShipsCommand extends GameCommand {
  type: GameCommandType.SEND_SHIPS;
  fromPlanetId: number;
  toPlanetId: number;
  shipIds: {
    // Specific ship IDs to send (user selected)
    scouts: number[];
    destroyers: number[];
    cruisers: number[];
    battleships: number[];
  };
}

export interface SetWaypointCommand extends GameCommand {
  type: GameCommandType.SET_WAYPOINT;
  planetId: number;
  waypointPlanetId: number;
}

export interface ClearWaypointCommand extends GameCommand {
  type: GameCommandType.CLEAR_WAYPOINT;
  planetId: number;
}

export interface AdjustResearchPercentCommand extends GameCommand {
  type: GameCommandType.ADJUST_RESEARCH_PERCENT;
  researchPercent: number;
}

export interface SubmitResearchItemCommand extends GameCommand {
  type: GameCommandType.SUBMIT_RESEARCH_ITEM;
  researchType: number;
}

export interface CancelResearchItemCommand extends GameCommand {
  type: GameCommandType.CANCEL_RESEARCH_ITEM;
  researchType: number;
}

export interface SubmitTradeCommand extends GameCommand {
  type: GameCommandType.SUBMIT_TRADE;
  tradeData: {
    resourceType: string;
    amount: number;
    action: 'buy' | 'sell';
  };
}

export interface CancelTradeCommand extends GameCommand {
  type: GameCommandType.CANCEL_TRADE;
  tradeId: string;
}

export interface UpdatePlanetWorkerAssignmentsCommand extends GameCommand {
  type: GameCommandType.UPDATE_PLANET_WORKER_ASSIGNMENTS;
  planetId: number;
  workers: {
    farmerDiff: number;
    minerDiff: number;
    builderDiff: number;
  };
}

export interface UpdatePlanetOptionsCommand extends GameCommand {
  type: GameCommandType.UPDATE_PLANET_OPTIONS;
  planetId: number;
  options: {
    buildLastStarship?: boolean;
  };
}

// ============================================================================
// SPECIFIC EVENT PAYLOADS
// ============================================================================

export interface PlayerResourcesData {
  energy: number;
  food: number;
  ore: number;
  iridium: number;
}

export interface ProductionItemQueuedEvent extends ClientEvent {
  type: ClientEventType.PRODUCTION_ITEM_QUEUED;
  data: {
    planetId: number;
    productionItem: PlanetProductionItemData;
    // Include updated resources so client can sync immediately
    playerResources: PlayerResourcesData;
  };
}

export interface ProductionItemRemovedEvent extends ClientEvent {
  type: ClientEventType.PRODUCTION_ITEM_REMOVED;
  data: {
    planetId: number;
    itemIndex: number;
    // Include refunded resources if applicable
    playerResources?: PlayerResourcesData;
  };
}

export interface FleetLaunchedEvent extends ClientEvent {
  type: ClientEventType.FLEET_LAUNCHED;
  data: {
    fromPlanetId: number;
    toPlanetId: number;
    shipIds: {
      // Ship IDs that were moved to the outgoing fleet
      scouts: number[];
      destroyers: number[];
      cruisers: number[];
      battleships: number[];
    };
  };
}

export interface WaypointSetEvent extends ClientEvent {
  type: ClientEventType.WAYPOINT_SET;
  data: {
    planetId: number;
    waypointPlanetId: number;
  };
}

export interface WaypointClearedEvent extends ClientEvent {
  type: ClientEventType.WAYPOINT_CLEARED;
  data: {
    planetId: number;
  };
}

export interface ResearchQueuedEvent extends ClientEvent {
  type: ClientEventType.RESEARCH_QUEUED;
  data: {
    researchType: number;
    turnsRemaining: number;
  };
}

export interface ResearchCancelledEvent extends ClientEvent {
  type: ClientEventType.RESEARCH_CANCELLED;
  data: {
    researchType: number;
  };
}

export interface ResearchPercentAdjustedEvent extends ClientEvent {
  type: ClientEventType.RESEARCH_PERCENT_ADJUSTED;
  data: {
    researchPercent: number;
  };
}

export interface TradeSubmittedEvent extends ClientEvent {
  type: ClientEventType.TRADE_SUBMITTED;
  data: {
    tradeId: string;
    planetId: number;
    resourceType: string;
    amount: number;
    action: 'buy' | 'sell';
  };
}

export interface TradeCancelledEvent extends ClientEvent {
  type: ClientEventType.TRADE_CANCELLED;
  data: {
    tradeId: string;
    playerResources?: PlayerResourcesData;
  };
}

export interface PlanetWorkerAssignmentsUpdatedEvent extends ClientEvent {
  type: ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED;
  data: {
    planetId: number;
    workers: {
      farmers: number;
      miners: number;
      builders: number;
    };
  };
}

export interface PlanetOptionsUpdatedEvent extends ClientEvent {
  type: ClientEventType.PLANET_OPTIONS_UPDATED;
  data: {
    planetId: number;
    buildLastStarship: boolean;
  };
}

// ============================================================================
// SERVER-ONLY EVENT PAYLOADS (from server operations like conflicts, trades)
// These MUST mutate client state as client never runs this logic
// ============================================================================

export interface TradesProcessedEvent extends ClientEvent {
  type: ClientEventType.TRADES_PROCESSED;
  data: {
    tradesProcessed: [
      {
        tradeId: string;
        planetId: number;
        executedStatus: ExecuteTradeResults;
      },
    ];
  };
}

export interface PlanetCapturedEvent extends ClientEvent {
  type: ClientEventType.PLANET_CAPTURED;
  data: {
    planetId: number;
    planetName: string;
    previousOwnerId?: string;
    previousOwnerName?: string;
    conflictData: PlanetaryConflictData;
    planetData: PlanetData;
  };
}

export interface PlanetLostEvent extends ClientEvent {
  type: ClientEventType.PLANET_LOST;
  data: {
    planetId: number;
    planetName: string;
    newOwnerId: string;
    newOwnerName: string;
    conflictData: PlanetaryConflictData;
  };
}

export interface FleetAttackFailedEvent extends ClientEvent {
  type: ClientEventType.FLEET_ATTACK_FAILED;
  data: {
    planetId: number; // Planet where battle occurred
    planetName: string;
    defenderName?: string;
    defenderId?: string;
    conflictData: PlanetaryConflictData;
  };
}

export interface FleetDefenseSuccessEvent extends ClientEvent {
  type: ClientEventType.FLEET_DEFENSE_SUCCESS;
  data: {
    planetId: number; // Planet where battle occurred
    planetName: string;
    attackerName: string;
    attackerId: string;
    conflictData: PlanetaryConflictData;
  };
}

// ============================================================================
// TIME-BASED NOTIFICATION PAYLOADS (from game clock advancement)
// These are informational only - client already applied changes locally
// ============================================================================

export interface ShipBuiltNotification extends ClientNotification {
  type: ClientNotificationType.SHIP_BUILT;
  data: {
    planetId: number;
    planetName: string;
    shipType: number; // StarShipType
    customShipData?: {
      advantageAgainst: number; // StarShipType
      disadvantageAgainst: number; // StarShipType
    };
    sentToWaypoint: boolean; // Was ship sent to waypoint or added to planetary fleet?
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ImprovementBuiltNotification extends ClientNotification {
  type: ClientNotificationType.IMPROVEMENT_BUILT;
  data: {
    planetId: number;
    planetName: string;
    improvementType: number; // PlanetImprovementType
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ImprovementDemolishedNotification extends ClientNotification {
  type: ClientNotificationType.IMPROVEMENT_DEMOLISHED;
  data: {
    planetId: number;
    planetName: string;
    improvementType: number; // PlanetImprovementType
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ResearchCompletedNotification extends ClientNotification {
  type: ClientNotificationType.RESEARCH_COMPLETED;
  data: {
    researchType: number; // ResearchType
    newLevel: number;
    researchQueueCleared: boolean; // If max level reached
  };
}

export interface PopulationGrewNotification extends ClientNotification {
  type: ClientNotificationType.POPULATION_GREW;
  data: {
    planetId: number;
    planetName: string;
    newPopulation: number;
  };
}

export interface PopulationStarvationNotification extends ClientNotification {
  type: ClientNotificationType.POPULATION_STARVATION;
  data: {
    planetId: number;
    planetName: string;
  };
}

export interface FoodShortageRiotsNotification extends ClientNotification {
  type: ClientNotificationType.FOOD_SHORTAGE_RIOTS;
  data: {
    planetId: number;
    planetName: string;
    reason: string; // e.g., "insufficient Energy to ship Food"
  };
}

export interface InsufficientFoodNotification extends ClientNotification {
  type: ClientNotificationType.INSUFFICIENT_FOOD;
  data: {
    planetId: number;
    planetName: string;
    foodDeficit: number;
  };
}

export interface CitizensProtestingNotification extends ClientNotification {
  type: ClientNotificationType.CITIZENS_PROTESTING;
  data: {
    planetId: number;
    planetName: string;
    reason: string;
  };
}

export interface PlanetLostDueToStarvationNotification extends ClientNotification {
  type: ClientNotificationType.PLANET_LOST_DUE_TO_STARVATION;
  data: {
    planetId: number;
    planetName: string;
  };
}

export interface ResourcesAutoSpentNotification extends ClientNotification {
  type: ClientNotificationType.RESOURCES_AUTO_SPENT;
  data: {
    amount: number;
    resourceType: string;
    reason: string;
  };
}
