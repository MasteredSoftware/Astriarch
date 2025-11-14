/**
 * Event Applicator
 *
 * Applies client events to a client model.
 * This runs on BOTH server (for validation) and client (when event received).
 *
 * The engine deterministically handles how to mutate state based on minimal event data.
 */

import { ClientModelData } from '../model/clientModel';
import {
  ClientEvent,
  ClientEventType,
  ProductionItemQueuedEvent,
  ProductionItemRemovedEvent,
  FleetLaunchedEvent,
  PlanetWorkerAssignmentsUpdatedEvent,
  WaypointSetEvent,
  WaypointClearedEvent,
  ResearchPercentAdjustedEvent,
  ResearchQueuedEvent,
  ResearchCancelledEvent,
  TradeSubmittedEvent,
  TradeCancelledEvent,
} from './GameCommands';

/**
 * Apply client events to a client model
 * This mutates the client model in place
 */
export class EventApplicator {
  public static applyEvent(clientModel: ClientModelData, event: ClientEvent): void {
    switch (event.type) {
      case ClientEventType.PRODUCTION_ITEM_QUEUED:
        this.applyProductionItemQueued(clientModel, event as ProductionItemQueuedEvent);
        break;

      case ClientEventType.PRODUCTION_ITEM_REMOVED:
        this.applyProductionItemRemoved(clientModel, event as ProductionItemRemovedEvent);
        break;

      case ClientEventType.FLEET_LAUNCHED:
        this.applyFleetLaunched(clientModel, event as FleetLaunchedEvent);
        break;

      case ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED:
        this.applyPlanetWorkerAssignmentsUpdated(clientModel, event as PlanetWorkerAssignmentsUpdatedEvent);
        break;

      case ClientEventType.WAYPOINT_SET:
        this.applyWaypointSet(clientModel, event as WaypointSetEvent);
        break;

      case ClientEventType.WAYPOINT_CLEARED:
        this.applyWaypointCleared(clientModel, event as WaypointClearedEvent);
        break;

      case ClientEventType.RESEARCH_PERCENT_ADJUSTED:
        this.applyResearchPercentAdjusted(clientModel, event as ResearchPercentAdjustedEvent);
        break;

      case ClientEventType.RESEARCH_QUEUED:
        this.applyResearchQueued(clientModel, event as ResearchQueuedEvent);
        break;

      case ClientEventType.RESEARCH_CANCELLED:
        this.applyResearchCancelled(clientModel, event as ResearchCancelledEvent);
        break;

      case ClientEventType.TRADE_SUBMITTED:
        this.applyTradeSubmitted(clientModel, event as TradeSubmittedEvent);
        break;

      case ClientEventType.TRADE_CANCELLED:
        this.applyTradeCancelled(clientModel, event as TradeCancelledEvent);
        break;

      default:
        console.warn(`Unhandled client event type: ${event.type}`);
    }
  }

  private static applyProductionItemQueued(clientModel: ClientModelData, event: ProductionItemQueuedEvent): void {
    const { planetId } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    // The backend has already added the item to the build queue
    // Resources are stored on planets, not the player
    // We rely on periodic full state syncs to get the complete and accurate build queue
    // since PlanetProductionItemData is complex (linked list, progress tracking, etc.)
  }

  private static applyProductionItemRemoved(clientModel: ClientModelData, event: ProductionItemRemovedEvent): void {
    const { planetId, itemIndex } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    // Remove the item from build queue
    if (itemIndex >= 0 && itemIndex < planet.buildQueue.length) {
      planet.buildQueue.splice(itemIndex, 1);
    }

    // Resources are refunded on the planet server-side, will sync on next update
  }

  private static applyFleetLaunched(clientModel: ClientModelData, event: FleetLaunchedEvent): void {
    const { fromPlanetId, ships } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[fromPlanetId];
    if (!planet) {
      console.warn(`Planet ${fromPlanetId} not found in player's owned planets`);
      return;
    }

    // Remove ships from source planet's planetary fleet
    for (const [shipTypeStr, quantity] of Object.entries(ships)) {
      const shipType = parseInt(shipTypeStr);
      let remaining = quantity;

      // Remove ships of this type
      for (let i = planet.planetaryFleet.starships.length - 1; i >= 0 && remaining > 0; i--) {
        if (planet.planetaryFleet.starships[i].type === shipType) {
          planet.planetaryFleet.starships.splice(i, 1);
          remaining--;
        }
      }
    }

    // Note: The outgoing fleet will appear in planet.outgoingFleets on next full sync
    // The game clock advancement handles fleet movement and arrival
  }

  private static applyPlanetWorkerAssignmentsUpdated(
    clientModel: ClientModelData,
    event: PlanetWorkerAssignmentsUpdatedEvent,
  ): void {
    const { planetId, workers } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    // Worker assignments are reflected in the citizen array assignments
    // The server has already updated this, so we rely on full state sync
    // to get the updated citizen array with correct assignments
    // For now, just log that we received the event
    console.log(`Worker assignments updated for planet ${planetId}:`, workers);

    // TODO: If we want immediate feedback, we could update citizen.assignment values
    // but this is complex and the full state sync will provide the authoritative state
  }

  private static applyWaypointSet(clientModel: ClientModelData, event: WaypointSetEvent): void {
    const { planetId, waypointPlanetId } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    const waypointPlanet = clientModel.clientPlanets.find((p) => p.id === waypointPlanetId);

    if (planet && waypointPlanet) {
      planet.waypointBoundingHexMidPoint = waypointPlanet.boundingHexMidPoint;
    }
  }

  private static applyWaypointCleared(clientModel: ClientModelData, event: WaypointClearedEvent): void {
    const { planetId } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (planet) {
      planet.waypointBoundingHexMidPoint = null;
    }
  }

  private static applyResearchPercentAdjusted(clientModel: ClientModelData, event: ResearchPercentAdjustedEvent): void {
    const { researchPercent } = event.data;
    clientModel.mainPlayer.research.researchPercent = researchPercent;
  }

  private static applyResearchQueued(clientModel: ClientModelData, event: ResearchQueuedEvent): void {
    const { researchType } = event.data;
    clientModel.mainPlayer.research.researchTypeInQueue = researchType;
  }

  private static applyResearchCancelled(clientModel: ClientModelData, event: ResearchCancelledEvent): void {
    // Clear research queue
    clientModel.mainPlayer.research.researchTypeInQueue = null;

    // Unused but kept for consistency
    void event;
  }

  private static applyTradeSubmitted(clientModel: ClientModelData, event: TradeSubmittedEvent): void {
    const { tradeId, resourceType, amount, action } = event.data;

    // Map resource type string to enum value
    const resourceTypeMap: Record<string, number> = {
      food: 1, // TradingCenterResourceType.FOOD
      ore: 2, // TradingCenterResourceType.ORE
      iridium: 3, // TradingCenterResourceType.IRIDIUM
    };

    // Add the trade to the client's trading center
    const trade: import('../model/tradingCenter').TradeData = {
      id: tradeId,
      playerId: clientModel.mainPlayer.id,
      planetId: -1, // Will be set server-side with actual planet
      tradeType: action === 'buy' ? 1 : 2, // TradeType.BUY or TradeType.SELL
      resourceType: resourceTypeMap[resourceType] || 1,
      amount: amount,
      submittedAt: Date.now(), // Approximate, server has authoritative timestamp
      executeAfter: Date.now() + 1000, // Approximate delay
    };

    clientModel.clientTradingCenter.mainPlayerTrades.push(trade);

    // Resources and prices updated server-side, will sync on next update
  }

  private static applyTradeCancelled(clientModel: ClientModelData, event: TradeCancelledEvent): void {
    const { tradeId } = event.data;

    // Remove the trade from the client's trading center
    const index = clientModel.clientTradingCenter.mainPlayerTrades.findIndex((t) => t.id === tradeId);
    if (index >= 0) {
      clientModel.clientTradingCenter.mainPlayerTrades.splice(index, 1);
    }

    // Resources refunded server-side, will sync on next update
  }
}
