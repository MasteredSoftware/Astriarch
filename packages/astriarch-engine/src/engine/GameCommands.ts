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

import { PlanetProductionItemData } from '../model';

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
// CLIENT EVENT TYPES - Minimal data to tell clients what changed
// ============================================================================

export enum ClientEventType {
  // Building/Production events
  PRODUCTION_ITEM_QUEUED = 'PRODUCTION_ITEM_QUEUED',
  PRODUCTION_ITEM_REMOVED = 'PRODUCTION_ITEM_REMOVED',
  SHIP_BUILT = 'SHIP_BUILT',
  IMPROVEMENT_BUILT = 'IMPROVEMENT_BUILT',
  IMPROVEMENT_DEMOLISHED = 'IMPROVEMENT_DEMOLISHED',

  // Fleet events (only for discrete actions, not continuous movement)
  FLEET_LAUNCHED = 'FLEET_LAUNCHED',
  FLEET_DESTROYED = 'FLEET_DESTROYED',
  WAYPOINT_SET = 'WAYPOINT_SET',
  WAYPOINT_CLEARED = 'WAYPOINT_CLEARED',

  // Research events (discrete actions only)
  RESEARCH_QUEUED = 'RESEARCH_QUEUED',
  RESEARCH_CANCELLED = 'RESEARCH_CANCELLED',
  RESEARCH_PERCENT_ADJUSTED = 'RESEARCH_PERCENT_ADJUSTED',
  RESEARCH_COMPLETED = 'RESEARCH_COMPLETED',

  // Trade events
  TRADE_SUBMITTED = 'TRADE_SUBMITTED',
  TRADE_CANCELLED = 'TRADE_CANCELLED',
  TRADE_EXECUTED = 'TRADE_EXECUTED',

  // Planet events
  PLANET_WORKER_ASSIGNMENTS_UPDATED = 'PLANET_WORKER_ASSIGNMENTS_UPDATED',
  PLANET_OPTIONS_UPDATED = 'PLANET_OPTIONS_UPDATED',
  PLANET_CAPTURED = 'PLANET_CAPTURED',
  PLANET_LOST = 'PLANET_LOST',
  POPULATION_GREW = 'POPULATION_GREW',

  // Resource events
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
// TIME-BASED EVENT PAYLOADS (from game clock advancement)
// ============================================================================

export interface ShipBuiltEvent extends ClientEvent {
  type: ClientEventType.SHIP_BUILT;
  data: {
    planetId: number;
    shipType: number; // StarShipType
    customShipData?: {
      advantageAgainst: number; // StarShipType
      disadvantageAgainst: number; // StarShipType
    };
    sentToWaypoint: boolean; // Was ship sent to waypoint or added to planetary fleet?
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ImprovementBuiltEvent extends ClientEvent {
  type: ClientEventType.IMPROVEMENT_BUILT;
  data: {
    planetId: number;
    improvementType: number; // PlanetImprovementType
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ImprovementDemolishedEvent extends ClientEvent {
  type: ClientEventType.IMPROVEMENT_DEMOLISHED;
  data: {
    planetId: number;
    improvementType: number; // PlanetImprovementType
    nextItemInQueue?: string; // Description of next item in queue
  };
}

export interface ResearchCompletedEvent extends ClientEvent {
  type: ClientEventType.RESEARCH_COMPLETED;
  data: {
    researchType: number; // ResearchType
    newLevel: number;
    researchQueueCleared: boolean; // If max level reached
  };
}

export interface PopulationGrewEvent extends ClientEvent {
  type: ClientEventType.POPULATION_GREW;
  data: {
    planetId: number;
    newPopulation: number;
  };
}

export interface TradeExecutedEvent extends ClientEvent {
  type: ClientEventType.TRADE_EXECUTED;
  data: {
    tradeId: string;
    resourceType: number; // TradingCenterResourceType
    amount: number;
    tradeType: number; // TradeType (BUY or SELL)
    energyCost: number;
  };
}

export interface PlanetCapturedEvent extends ClientEvent {
  type: ClientEventType.PLANET_CAPTURED;
  data: {
    planetId: number;
    newOwnerId: string;
    previousOwnerId?: string;
    resourcesLooted: PlayerResourcesData;
  };
}

export interface PlanetLostEvent extends ClientEvent {
  type: ClientEventType.PLANET_LOST;
  data: {
    planetId: number;
    planetName: string;
    newOwnerId: string;
  };
}

export interface FleetDestroyedEvent extends ClientEvent {
  type: ClientEventType.FLEET_DESTROYED;
  data: {
    planetId: number; // Planet where battle occurred
    wasAttacking: boolean; // True if this player was attacking, false if defending
  };
}

export interface ResourcesAutoSpentEvent extends ClientEvent {
  type: ClientEventType.RESOURCES_AUTO_SPENT;
  data: {
    planetId: number;
    itemQueued: string; // Description of item that was auto-queued
  };
}
