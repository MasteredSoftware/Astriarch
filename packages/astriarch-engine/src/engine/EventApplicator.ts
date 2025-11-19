/**
 * Event Applicator
 *
 * Applies client events to a client model.
 * This runs on BOTH server (for validation) and client (when event received).
 *
 * The engine deterministically handles how to mutate state based on minimal event data.
 */

import { ClientModelData } from '../model/clientModel';
import { PlanetProductionItemData } from '../model/planet';
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
} from './GameCommands';
import { Grid } from './grid';

/**
 * Apply client events to a client model
 * This mutates the client model in place
 */
export class EventApplicator {
  public static applyEvent(clientModel: ClientModelData, event: ClientEvent, grid?: Grid): void {
    switch (event.type) {
      case ClientEventType.PRODUCTION_ITEM_QUEUED:
        this.applyProductionItemQueued(clientModel, event as ProductionItemQueuedEvent);
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

      case ClientEventType.SHIP_BUILT:
        this.applyShipBuilt(clientModel, event as import('./GameCommands').ShipBuiltEvent);
        break;

      case ClientEventType.IMPROVEMENT_BUILT:
        this.applyImprovementBuilt(clientModel, event as import('./GameCommands').ImprovementBuiltEvent);
        break;

      case ClientEventType.IMPROVEMENT_DEMOLISHED:
        this.applyImprovementDemolished(clientModel, event as import('./GameCommands').ImprovementDemolishedEvent);
        break;

      case ClientEventType.RESEARCH_COMPLETED:
        this.applyResearchCompleted(clientModel, event as import('./GameCommands').ResearchCompletedEvent);
        break;

      case ClientEventType.POPULATION_GREW:
        this.applyPopulationGrew(clientModel, event as import('./GameCommands').PopulationGrewEvent);
        break;

      case ClientEventType.TRADE_EXECUTED:
        this.applyTradeExecuted(clientModel, event as import('./GameCommands').TradeExecutedEvent);
        break;

      case ClientEventType.PLANET_CAPTURED:
        this.applyPlanetCaptured(clientModel, event as import('./GameCommands').PlanetCapturedEvent);
        break;

      case ClientEventType.PLANET_LOST:
        this.applyPlanetLost(clientModel, event as import('./GameCommands').PlanetLostEvent);
        break;

      case ClientEventType.FLEET_DESTROYED:
        this.applyFleetDestroyed(clientModel, event as import('./GameCommands').FleetDestroyedEvent);
        break;

      case ClientEventType.RESOURCES_AUTO_SPENT:
        this.applyResourcesAutoSpent(clientModel, event as import('./GameCommands').ResourcesAutoSpentEvent);
        break;

      default:
        console.warn(`Unhandled client event type: ${event.type}`);
    }
  }

  private static applyProductionItemQueued(clientModel: ClientModelData, event: ProductionItemQueuedEvent): void {
    const { planetId, productionItem, playerResources } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets`);
      return;
    }

    // Add to build queue
    planet.buildQueue.push(productionItem);

    // Update aggregate player resource display
    // Resources are actually stored on planets, but events include totals for UI
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

  private static applyFleetLaunched(
    clientModel: ClientModelData,
    event: FleetLaunchedEvent,
    grid?: import('./grid').Grid,
  ): void {
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

    // Split the fleet by specific ship IDs using the Fleet engine method
    const outgoingFleet = Fleet.splitFleetByShipIds(planet.planetaryFleet, shipIds);

    // Set destination points
    outgoingFleet.travelingFromHexMidPoint = planet.boundingHexMidPoint;
    outgoingFleet.destinationHexMidPoint = destPlanet.boundingHexMidPoint;
    outgoingFleet.parsecsToDestination = null;
    outgoingFleet.totalTravelDistance = null;

    // If grid is available, use Fleet.setDestination to calculate distances properly
    if (grid && planet.boundingHexMidPoint && destPlanet.boundingHexMidPoint) {
      Fleet.setDestination(outgoingFleet, grid, planet.boundingHexMidPoint, destPlanet.boundingHexMidPoint);
    }

    // Add the fleet to outgoing fleets
    planet.outgoingFleets.push(outgoingFleet);

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

    // Apply worker assignments by updating citizen workerType fields
    // The event contains the final counts that the server calculated
    const targetFarmers = workers.farmers;
    const targetMiners = workers.miners;
    const targetBuilders = workers.builders;

    // Count current workers
    let currentFarmers = 0;
    let currentMiners = 0;
    let currentBuilders = 0;

    for (const citizen of planet.population) {
      if (citizen.workerType === 1)
        currentFarmers++; // CitizenWorkerType.Farmer
      else if (citizen.workerType === 2)
        currentMiners++; // CitizenWorkerType.Miner
      else if (citizen.workerType === 3) currentBuilders++; // CitizenWorkerType.Builder
    }

    // Calculate diffs
    const farmerDiff = targetFarmers - currentFarmers;
    const minerDiff = targetMiners - currentMiners;
    const builderDiff = targetBuilders - currentBuilders;

    // Apply the diffs by reassigning workers
    // Priority: Farmers first, then miners, then builders
    let remainingFarmerDiff = farmerDiff;
    let remainingMinerDiff = minerDiff;
    let remainingBuilderDiff = builderDiff;

    // Helper to find a citizen of a specific type
    const findCitizen = (workerType: number): number => {
      return planet.population.findIndex((c) => c.workerType === workerType && c.protestLevel === 0);
    };

    // Apply farmer changes
    while (remainingFarmerDiff !== 0) {
      if (remainingFarmerDiff > 0) {
        // Need more farmers - convert miners or builders
        if (remainingMinerDiff < 0) {
          const idx = findCitizen(2); // Miner
          if (idx >= 0) {
            planet.population[idx].workerType = 1; // Farmer
            remainingFarmerDiff--;
            remainingMinerDiff++;
            continue;
          }
        }
        if (remainingBuilderDiff < 0) {
          const idx = findCitizen(3); // Builder
          if (idx >= 0) {
            planet.population[idx].workerType = 1; // Farmer
            remainingFarmerDiff--;
            remainingBuilderDiff++;
            continue;
          }
        }
        break; // Can't find anyone to convert
      } else {
        // Need fewer farmers - convert to miners or builders
        if (remainingMinerDiff > 0) {
          const idx = findCitizen(1); // Farmer
          if (idx >= 0) {
            planet.population[idx].workerType = 2; // Miner
            remainingFarmerDiff++;
            remainingMinerDiff--;
            continue;
          }
        }
        if (remainingBuilderDiff > 0) {
          const idx = findCitizen(1); // Farmer
          if (idx >= 0) {
            planet.population[idx].workerType = 3; // Builder
            remainingFarmerDiff++;
            remainingBuilderDiff--;
            continue;
          }
        }
        break; // Can't find anyone to convert
      }
    }

    // Apply miner changes
    while (remainingMinerDiff !== 0) {
      if (remainingMinerDiff > 0) {
        // Need more miners - convert builders
        if (remainingBuilderDiff < 0) {
          const idx = findCitizen(3); // Builder
          if (idx >= 0) {
            planet.population[idx].workerType = 2; // Miner
            remainingMinerDiff--;
            remainingBuilderDiff++;
            continue;
          }
        }
        break;
      } else {
        // Need fewer miners - convert to builders
        if (remainingBuilderDiff > 0) {
          const idx = findCitizen(2); // Miner
          if (idx >= 0) {
            planet.population[idx].workerType = 3; // Builder
            remainingMinerDiff++;
            remainingBuilderDiff--;
            continue;
          }
        }
        break;
      }
    }

    console.log(
      `Worker assignments updated for planet ${planetId}: ${targetFarmers}F/${targetMiners}M/${targetBuilders}B`,
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

  // TIME-BASED EVENT APPLICATORS
  // These events are primarily for UI notifications
  // Server sends full state updates, so these don't need to mutate much

  private static applyShipBuilt(clientModel: ClientModelData, event: import('./GameCommands').ShipBuiltEvent): void {
    const { planetId, shipType, sentToWaypoint } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet state with updated fleet/queue
    console.log(`Ship type ${shipType} built on planet ${planetId}, sentToWaypoint=${sentToWaypoint}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyImprovementBuilt(
    clientModel: ClientModelData,
    event: import('./GameCommands').ImprovementBuiltEvent,
  ): void {
    const { planetId, improvementType } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet state with updated improvements/queue
    console.log(`Improvement type ${improvementType} built on planet ${planetId}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyImprovementDemolished(
    clientModel: ClientModelData,
    event: import('./GameCommands').ImprovementDemolishedEvent,
  ): void {
    const { planetId, improvementType } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet state with updated improvements/queue
    console.log(`Improvement type ${improvementType} demolished on planet ${planetId}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyResearchCompleted(
    clientModel: ClientModelData,
    event: import('./GameCommands').ResearchCompletedEvent,
  ): void {
    const { researchType, newLevel } = event.data;

    // Event is primarily for UI notification
    // Server will send full research state
    console.log(`Research type ${researchType} completed, now at level ${newLevel}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyPopulationGrew(
    clientModel: ClientModelData,
    event: import('./GameCommands').PopulationGrewEvent,
  ): void {
    const { planetId, newPopulation } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet state with updated population
    console.log(`Planet ${planetId} population grew to ${newPopulation}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyTradeExecuted(
    clientModel: ClientModelData,
    event: import('./GameCommands').TradeExecutedEvent,
  ): void {
    const { tradeId, resourceType, amount, tradeType } = event.data;

    // Remove the trade from the client's trading center
    const index = clientModel.clientTradingCenter.mainPlayerTrades.findIndex((t) => t.id === tradeId);
    if (index >= 0) {
      clientModel.clientTradingCenter.mainPlayerTrades.splice(index, 1);
    }

    // Event is primarily for UI notification
    // Server will send full resource/price state
    const action = tradeType === 1 ? 'bought' : 'sold';
    console.log(`Trade ${tradeId} executed: ${action} ${amount} of resource type ${resourceType}`);
  }

  private static applyPlanetCaptured(
    clientModel: ClientModelData,
    event: import('./GameCommands').PlanetCapturedEvent,
  ): void {
    const { planetId, newOwnerId, previousOwnerId, resourcesLooted } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet ownership state
    if (newOwnerId === clientModel.mainPlayer.id) {
      console.log(
        `Planet ${planetId} captured! Looted ${resourcesLooted.food}F/${resourcesLooted.ore}O/${resourcesLooted.iridium}I`,
      );
    } else if (previousOwnerId === clientModel.mainPlayer.id) {
      console.log(`Planet ${planetId} was captured by player ${newOwnerId}`);
    }
  }

  private static applyPlanetLost(clientModel: ClientModelData, event: import('./GameCommands').PlanetLostEvent): void {
    const { planetId, newOwnerId } = event.data;

    // Event is primarily for UI notification
    // Server will send full planet ownership state
    console.log(`Lost planet ${planetId} to player ${newOwnerId}`);

    // Unused but kept for linter
    void clientModel;
  }

  private static applyFleetDestroyed(
    clientModel: ClientModelData,
    event: import('./GameCommands').FleetDestroyedEvent,
  ): void {
    const { planetId, wasAttacking } = event.data;

    // Event is primarily for UI notification
    // Server will send full fleet state
    if (wasAttacking) {
      console.log(`Attacking fleets from planet ${planetId} were destroyed`);
    } else {
      console.log(`Defending fleet on planet ${planetId} was destroyed`);
    }

    // Unused but kept for linter
    void clientModel;
  }

  private static applyResourcesAutoSpent(
    clientModel: ClientModelData,
    event: import('./GameCommands').ResourcesAutoSpentEvent,
  ): void {
    const { planetId, itemQueued } = event.data;

    // Event is primarily for UI notification
    // Server will send full resource/queue state
    console.log(`Resources auto-spent on planet ${planetId} for ${itemQueued}`);

    // Unused but kept for linter
    void clientModel;
  }
}
