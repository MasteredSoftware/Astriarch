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
import { recalculateFleetHash } from '../utils/fleetHash';
import { CombatResultDiff } from '../model/battle';
import { FleetData } from '../model/fleet';
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
  TradesProcessedEvent,
  PlanetCapturedEvent,
  PlanetLostEvent,
  FleetAttackFailedEvent,
  FleetDefenseSuccessEvent,
} from './GameCommands';
import { Grid } from './grid';
import { Player } from './player';
import { GameModel } from './gameModel';
import { TradingCenter } from './tradingCenter';

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

      case ClientEventType.TRADES_PROCESSED:
        this.applyTradesProcessed(clientModel, event as TradesProcessedEvent, grid);
        break;

      case ClientEventType.PLANET_CAPTURED:
        this.applyPlanetCaptured(clientModel, event as PlanetCapturedEvent);
        break;

      case ClientEventType.PLANET_LOST:
        this.applyPlanetLost(clientModel, event as PlanetLostEvent);
        break;

      case ClientEventType.FLEET_ATTACK_FAILED:
        this.applyFleetAttackFailed(clientModel, event as FleetAttackFailedEvent);
        break;
      case ClientEventType.FLEET_DEFENSE_SUCCESS:
        this.applyFleetDefenseSuccess(clientModel, event as FleetDefenseSuccessEvent);
        break;

      case ClientEventType.RESEARCH_STOLEN:
        // Notification-only event - the research level change already happened on the server
        // No client state changes needed
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
    const { planetId, productionItem, playerResources, serverCycle } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets in applyProductionItemQueued`);
      return;
    }

    // Log cycle information for debugging clock drift
    const clientCycle = clientModel.currentCycle;
    const cycleDrift = clientCycle - serverCycle;
    console.log(`Production item queued on planet ${planetId}`);
    console.log(`  Server cycle: ${serverCycle}, Client cycle: ${clientCycle}, Drift: ${cycleDrift.toFixed(4)} cycles`);
    console.log(`  Player resources from server event:`, playerResources);

    Planet.enqueueProductionItemAndSpendResources(
      grid,
      clientModel.mainPlayer,
      clientModel.mainPlayerOwnedPlanets,
      planet,
      productionItem,
    );

    const totalResources = Player.getTotalResourceAmount(clientModel.mainPlayer, clientModel.mainPlayerOwnedPlanets);
    console.log(`  Total player resources on client after production item queued:`, totalResources);

    // Calculate and log the resource drift
    const resourceDrift = {
      food: totalResources.food - playerResources.food,
      energy: totalResources.energy - playerResources.energy,
      ore: totalResources.ore - playerResources.ore,
      iridium: totalResources.iridium - playerResources.iridium,
    };
    console.log(`  Resource drift (client - server):`, resourceDrift);
  }

  private static applyProductionItemRemoved(clientModel: ClientModelData, event: ProductionItemRemovedEvent): void {
    const { planetId, itemIndex } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets in applyProductionItemRemoved`);
      return;
    }

    // Use engine method to remove item and handle refund - same pattern as server
    Planet.removeBuildQueueItemForRefund(planet, itemIndex);
  }

  private static applyFleetLaunched(clientModel: ClientModelData, event: FleetLaunchedEvent, grid: Grid): void {
    const { fromPlanetId, toPlanetId, shipIds } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[fromPlanetId];
    if (!planet) {
      console.warn(`Planet ${fromPlanetId} not found in player's owned planets in applyFleetLaunched`);
      return;
    }

    const destPlanet = clientModel.clientPlanets.find((p) => p.id === toPlanetId);
    if (!destPlanet) {
      console.warn(`Destination planet ${toPlanetId} not found`);
      return;
    }

    // Use engine method to replicate server logic exactly
    Fleet.launchFleetToPlanet(planet, destPlanet, grid, shipIds, clientModel.mainPlayer);

    const totalShips =
      shipIds.scouts.length + shipIds.destroyers.length + shipIds.cruisers.length + shipIds.battleships.length;
    console.log(`Fleet launched from planet ${fromPlanetId} to ${toPlanetId} with ${totalShips} ships`, shipIds);
  }

  private static applyPlanetWorkerAssignmentsUpdated(
    clientModel: ClientModelData,
    event: PlanetWorkerAssignmentsUpdatedEvent,
  ): void {
    const { planetId, workers } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets in applyPlanetWorkerAssignmentsUpdated`);
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
      console.warn(`Planet ${planetId} not found in player's owned planets in applyPlanetOptionsUpdated`);
      return;
    }

    planet.buildLastStarship = buildLastStarship;
    console.log(`Planet ${planetId} options updated: buildLastStarship=${buildLastStarship}`);
  }

  // SERVER-ONLY EVENT APPLICATORS
  // These handle state mutations that the client doesn't compute locally

  private static applyTradesProcessed(clientModel: ClientModelData, event: TradesProcessedEvent, grid: Grid): void {
    const { tradesProcessed } = event.data;

    for (const tradeInfo of tradesProcessed) {
      const { tradeId, planetId, executedStatus } = tradeInfo;
      // Remove the trade from the client's trading center
      const tradeIndex = clientModel.clientTradingCenter.mainPlayerTrades.findIndex((t) => t.id === tradeId);
      if (tradeIndex < 0) {
        console.warn(`Trade ${tradeInfo.tradeId} not found in player's trades`);
        return;
      }

      clientModel.clientTradingCenter.mainPlayerTrades.splice(tradeIndex, 1);

      TradingCenter.completeTradeExecutionForClientPlayer(clientModel, grid, planetId, executedStatus);

      const action = executedStatus.tradeType === 1 ? 'bought' : 'sold';
      console.log(
        `Trade ${tradeId} executed: ${action} ${executedStatus.foodAmount + executedStatus.oreAmount + executedStatus.iridiumAmount} of resource type ${executedStatus.resourceType} for ${executedStatus.tradeEnergyAmount} energy`,
      );
    }
  }

  private static applyPlanetCaptured(clientModel: ClientModelData, event: PlanetCapturedEvent): void {
    const { planetId, planetData, conflictData } = event.data;

    // Remove the attacking fleet from fleetsInTransit if still present
    // (may have already been removed by client's local time advancement)
    const attackingFleetId = conflictData.attackingFleet.id;
    console.log(`🏴 PLANET_CAPTURED: Removing attacking fleet ${attackingFleetId} (merged with planet)`);
    console.log(`   Fleets in transit before: [${clientModel.mainPlayer.fleetsInTransit.map((f) => f.id).join(', ')}]`);

    const fleetIndex = clientModel.mainPlayer.fleetsInTransit.findIndex((f) => f.id === attackingFleetId);
    if (fleetIndex >= 0) {
      clientModel.mainPlayer.fleetsInTransit.splice(fleetIndex, 1);
      console.log(`   ✓ Removed fleet at index ${fleetIndex}`);
    } else {
      console.log(`   ⚠️ Fleet ${attackingFleetId} not found in transit (may have already been removed)`);
    }
    console.log(`   Fleets in transit after: [${clientModel.mainPlayer.fleetsInTransit.map((f) => f.id).join(', ')}]`);

    // We captured a planet - add it to our owned planets
    // The planetData already has the merged fleet from the server
    GameModel.setPlanetOwnedByPlayer(clientModel.mainPlayer, planetId);
    clientModel.mainPlayerOwnedPlanets[planetId] = planetData;
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

  private static applyFleetAttackFailed(clientModel: ClientModelData, event: FleetAttackFailedEvent): void {
    const { planetId, conflictData, defenderId } = event.data;

    // Remove the attacking fleet from fleetsInTransit if still present
    // (may have already been removed by client's local time advancement)
    const attackingFleetId = conflictData.attackingFleet.id;
    console.log(`🗑️ FLEET_ATTACK_FAILED: Removing attacking fleet ${attackingFleetId}`);
    console.log(`   Fleets in transit before: [${clientModel.mainPlayer.fleetsInTransit.map((f) => f.id).join(', ')}]`);

    const fleetIndex = clientModel.mainPlayer.fleetsInTransit.findIndex((f) => f.id === attackingFleetId);
    if (fleetIndex >= 0) {
      clientModel.mainPlayer.fleetsInTransit.splice(fleetIndex, 1);
      console.log(`   ✓ Removed fleet at index ${fleetIndex}`);
    } else {
      console.log(`   ⚠️ Fleet ${attackingFleetId} not found in transit (may have already been removed)`);
    }
    console.log(`   Fleets in transit after: [${clientModel.mainPlayer.fleetsInTransit.map((f) => f.id).join(', ')}]`);

    // Set planet as explored with last known fleet strength
    Player.setPlanetExplored(
      clientModel.mainPlayer,
      planetId,
      conflictData.winningFleet!,
      clientModel.currentCycle,
      defenderId,
    );
  }

  private static applyFleetDefenseSuccess(clientModel: ClientModelData, event: FleetDefenseSuccessEvent): void {
    const { planetId, conflictData } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (!planet) {
      console.warn(`Planet ${planetId} not found in player's owned planets in applyFleetDefenseSuccess`);
      return;
    }

    // Apply combat diff to the planetary fleet instead of replacing it
    // This preserves any ships produced between combat resolution and event delivery
    if (conflictData.combatResultDiff) {
      this.applyCombatDiff(planet.planetaryFleet, conflictData.combatResultDiff);
      console.log(
        `⚔️ FLEET_DEFENSE_SUCCESS: Planet ${planetId} defended, combat diff applied (destroyed: ${conflictData.combatResultDiff.shipsDestroyed.length}, damaged: ${conflictData.combatResultDiff.shipsDamaged.length})`,
      );
    } else {
      console.warn(`No combat result diff provided in FLEET_DEFENSE_SUCCESS event for planet ${planetId}`);
    }
  }

  /**
   * Apply a combat result diff to a fleet, modifying it in place
   * @param fleet The fleet to modify
   * @param diff The combat result diff to apply
   */
  private static applyCombatDiff(fleet: FleetData, diff: CombatResultDiff): void {
    // Remove destroyed ships
    if (diff.shipsDestroyed.length > 0) {
      const destroyedSet = new Set(diff.shipsDestroyed);
      fleet.starships = fleet.starships.filter((ship) => !destroyedSet.has(ship.id));
    }

    // Apply damage to surviving ships
    if (diff.shipsDamaged.length > 0) {
      const damageMap = new Map(diff.shipsDamaged.map((d) => [d.id, d.damage]));
      for (const ship of fleet.starships) {
        const damage = damageMap.get(ship.id);
        if (damage !== undefined) {
          ship.health = Math.max(0, ship.health - damage);
        }
      }
    }

    // Apply experience gains (future feature)
    if (diff.shipsExperienceGained.length > 0) {
      const experienceMap = new Map(diff.shipsExperienceGained.map((e) => [e.id, e.experience]));
      for (const ship of fleet.starships) {
        const experience = experienceMap.get(ship.id);
        if (experience !== undefined) {
          ship.experienceAmount += experience;
        }
      }
    }

    // Recalculate fleet hash after applying changes
    const shipIds = fleet.starships.map((s) => s.id);
    fleet.eventChainHash = recalculateFleetHash(shipIds);

    // DEBUG: Log fleet state after applying diff
    const shipIdsAfter = fleet.starships.map((s) => s.id).sort((a, b) => a - b);
    console.log(`      Fleet ships AFTER: [${shipIdsAfter.join(', ')}] (${shipIdsAfter.length})`);
    console.log(`      Fleet hash AFTER: ${fleet.eventChainHash}`);
  }
}
