/**
 * Event Applicator
 *
 * Applies client events to a client model.
 * This runs on BOTH server (for validation) and client (when event received).
 *
 * The engine deterministically handles how to mutate state based on minimal event data.
 */

import { ClientModelData } from '../model/clientModel';
import { TradeData, TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import { Planet } from './planet';
import { Fleet } from './fleet';
import {
  ClientEvent,
  ClientEventType,
  ProductionItemQueuedEvent,
  ProductionItemRemovedEvent,
  FleetLaunchedEvent,
  PlanetWorkerAssignmentsUpdatedEvent,
  PlanetOptionsUpdatedEvent,
  WaypointSetEvent,
  WaypointClearedEvent,
  ResearchPercentAdjustedEvent,
  ResearchQueuedEvent,
  ResearchCancelledEvent,
  TradeSubmittedEvent,
  TradeCancelledEvent,
  TradeExecutedEvent,
  PlanetCapturedEvent,
  PlanetLostEvent,
  FleetDestroyedEvent,
} from './GameCommands';
import { Grid } from './grid';

/**
 * Apply client events to a client model
 * This mutates the client model in place
 */
export class EventApplicator {
  public static applyEvent(clientModel: ClientModelData, event: ClientEvent, grid: Grid): void {
    switch (event.type) {
      case ClientEventType.PRODUCTION_ITEM_QUEUED:
        this.applyProductionItemQueued(clientModel, event as ProductionItemQueuedEvent, grid);
        break;

      case ClientEventType.PRODUCTION_ITEM_REMOVED:
        this.applyProductionItemRemoved(clientModel, event as ProductionItemRemovedEvent);
        break;

      case ClientEventType.FLEET_LAUNCHED:
        this.applyFleetLaunched(clientModel, event as FleetLaunchedEvent, grid);
        break;

      case ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED:
        this.applyPlanetWorkerAssignmentsUpdated(clientModel, event as PlanetWorkerAssignmentsUpdatedEvent);
        break;

      case ClientEventType.PLANET_OPTIONS_UPDATED:
        this.applyPlanetOptionsUpdated(clientModel, event as PlanetOptionsUpdatedEvent);
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

      case ClientEventType.TRADE_EXECUTED:
        this.applyTradeExecuted(clientModel, event as TradeExecutedEvent);
        break;

      case ClientEventType.PLANET_CAPTURED:
        this.applyPlanetCaptured(clientModel, event as PlanetCapturedEvent);
        break;

      case ClientEventType.PLANET_LOST:
        this.applyPlanetLost(clientModel, event as PlanetLostEvent);
        break;

      case ClientEventType.FLEET_DESTROYED:
        this.applyFleetDestroyed(clientModel, event as FleetDestroyedEvent);
        break;

      default:
        console.warn(`Unhandled client event type: ${event.type}`);
    }
  }

  private static applyProductionItemQueued(
    clientModel: ClientModelData,
    event: ProductionItemQueuedEvent,
    grid: Grid,
  ): void {
    const { planetId, productionItem, playerResources } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    Planet.enqueueProductionItemAndSpendResources(
      grid,
      clientModel.mainPlayer,
      clientModel.mainPlayerOwnedPlanets,
      planet,
      productionItem,
    );
    console.log(`Production item queued on planet ${planetId}, player resources now:`, playerResources);
  }

  private static applyProductionItemRemoved(clientModel: ClientModelData, event: ProductionItemRemovedEvent): void {
    const { planetId, itemIndex } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    // Use engine method to remove item and handle refund - same pattern as server
    Planet.removeBuildQueueItemForRefund(planet, itemIndex);
  }

  private static applyFleetLaunched(clientModel: ClientModelData, event: FleetLaunchedEvent, grid: Grid): void {
    const { fromPlanetId, toPlanetId, shipIds } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[fromPlanetId];
    if (!planet) {
      console.warn(`Planet ${fromPlanetId} not found in player's owned planets`);
      return;
    }

    const destPlanet = clientModel.clientPlanets.find((p) => p.id === toPlanetId);
    if (!destPlanet) {
      console.warn(`Destination planet ${toPlanetId} not found`);
      return;
    }

    // Use engine method to replicate server logic exactly
    Fleet.launchFleetToPlanet(planet, destPlanet, grid, shipIds);

    const totalShips =
      shipIds.scouts.length + shipIds.destroyers.length + shipIds.cruisers.length + shipIds.battleships.length;
    console.log(`Fleet launched from planet ${fromPlanetId} to ${toPlanetId} with ${totalShips} ships`);
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

    // Calculate diffs from current state to target state
    const current = Planet.countPopulationWorkerTypes(planet);
    const farmerDiff = workers.farmers - current.farmers;
    const minerDiff = workers.miners - current.miners;
    const builderDiff = workers.builders - current.builders;

    // Use engine method to apply worker reassignments
    Planet.updatePopulationWorkerTypes(planet, clientModel.mainPlayer, farmerDiff, minerDiff, builderDiff);

    console.log(
      `Worker assignments updated for planet ${planetId}: ${workers.farmers}F/${workers.miners}M/${workers.builders}B`,
    );
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
    const { tradeId, planetId, resourceType, amount, action } = event.data;

    // Map resource type string to enum
    const resourceTypeMap: Record<string, TradingCenterResourceType> = {
      food: TradingCenterResourceType.FOOD,
      ore: TradingCenterResourceType.ORE,
      iridium: TradingCenterResourceType.IRIDIUM,
    };

    // Create trade with server-provided ID
    const trade: TradeData = {
      id: tradeId,
      playerId: clientModel.mainPlayer.id,
      planetId,
      tradeType: action === 'buy' ? TradeType.BUY : TradeType.SELL,
      resourceType: resourceTypeMap[resourceType] || TradingCenterResourceType.FOOD,
      amount,
      submittedAt: Date.now(), // Approximate, server has authoritative timestamp
      executeAfter: Date.now() + 5000, // Approximate 5s delay
    };

    clientModel.clientTradingCenter.mainPlayerTrades.push(trade);
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

  private static applyPlanetOptionsUpdated(clientModel: ClientModelData, event: PlanetOptionsUpdatedEvent): void {
    const { planetId, buildLastStarship } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    planet.buildLastStarship = buildLastStarship;
    console.log(`Planet ${planetId} options updated: buildLastStarship=${buildLastStarship}`);
  }

  // SERVER-ONLY EVENT APPLICATORS
  // These handle state mutations that the client doesn't compute locally

  private static applyTradeExecuted(clientModel: ClientModelData, event: TradeExecutedEvent): void {
    const { tradeId, resourceType, amount, tradeType } = event.data;

    // Remove the trade from the client's trading center
    const tradeIndex = clientModel.clientTradingCenter.mainPlayerTrades.findIndex((t) => t.id === tradeId);
    if (tradeIndex < 0) {
      console.warn(`Trade ${tradeId} not found in player's trades`);
      return;
    }

    const trade = clientModel.clientTradingCenter.mainPlayerTrades[tradeIndex];
    const planetId = trade.planetId;
    clientModel.clientTradingCenter.mainPlayerTrades.splice(tradeIndex, 1);

    // Update planet resources (critical for accurate resource display)
    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (planet) {
      const isBuy = tradeType === 1;
      const modifier = isBuy ? 1 : -1;

      // Map resource type to planet resource field
      switch (resourceType) {
        case 1: // FOOD
          planet.resources.food += amount * modifier;
          break;
        case 2: // ORE
          planet.resources.ore += amount * modifier;
          break;
        case 3: // IRIDIUM
          planet.resources.iridium += amount * modifier;
          break;
      }
    }

    const action = tradeType === 1 ? 'bought' : 'sold';
    console.log(`Trade ${tradeId} executed: ${action} ${amount} of resource type ${resourceType}`);
  }

  private static applyPlanetCaptured(clientModel: ClientModelData, event: PlanetCapturedEvent): void {
    const { planetId, newOwnerId, previousOwnerId, resourcesLooted } = event.data;

    if (newOwnerId === clientModel.mainPlayer.id) {
      // We captured a planet - it will be added to mainPlayerOwnedPlanets in next sync
      console.log(
        `Planet ${planetId} captured! Looted ${resourcesLooted.food}F/${resourcesLooted.ore}O/${resourcesLooted.iridium}I`,
      );
    } else if (previousOwnerId === clientModel.mainPlayer.id) {
      // We lost a planet - remove it from our owned planets immediately
      if (clientModel.mainPlayerOwnedPlanets[planetId]) {
        delete clientModel.mainPlayerOwnedPlanets[planetId];
        console.log(`Planet ${planetId} was captured by player ${newOwnerId}`);
      }
    }
  }

  private static applyPlanetLost(clientModel: ClientModelData, event: PlanetLostEvent): void {
    const { planetId, newOwnerId } = event.data;

    // Remove planet from our owned planets immediately
    if (clientModel.mainPlayerOwnedPlanets[planetId]) {
      delete clientModel.mainPlayerOwnedPlanets[planetId];
      console.log(`Lost planet ${planetId} to player ${newOwnerId}`);
    }
    // also remove from mainPlayer's ownedPlanetIds
    clientModel.mainPlayer.ownedPlanetIds = clientModel.mainPlayer.ownedPlanetIds.filter((id) => id !== planetId);
  }

  private static applyFleetDestroyed(clientModel: ClientModelData, event: FleetDestroyedEvent): void {
    const { planetId, wasAttacking } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      // Planet might have been lost in the same battle
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    if (wasAttacking) {
      // Clear all outgoing fleets from this planet
      planet.outgoingFleets = [];
      console.log(`Attacking fleets from planet ${planetId} were destroyed`);
    } else {
      // Clear the planetary defense fleet
      if (planet.planetaryFleet) {
        planet.planetaryFleet.starships = [];
      }
      console.log(`Defending fleet on planet ${planetId} was destroyed`);
    }
  }
}
