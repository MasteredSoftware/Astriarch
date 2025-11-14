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
  FleetLaunchedEvent,
  PlanetWorkerAssignmentsUpdatedEvent,
  WaypointSetEvent,
  WaypointClearedEvent,
  ResearchPercentAdjustedEvent,
  ResearchQueuedEvent,
  ResearchCancelledEvent,
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

      // Add other event handlers...

      default:
        console.warn(`Unhandled client event type: ${event.type}`);
    }
  }

  private static applyProductionItemQueued(clientModel: ClientModelData, event: ProductionItemQueuedEvent): void {
    const { planetId, playerResources } = event.data;

    // Update planet build queue
    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (planet) {
      // The production item in the event is a simplified version
      // In a full implementation, we'd convert this to a full PlanetProductionItemData
      // For now, we'll just note that the build queue has changed
      // The next full state sync will have the complete build queue

      // Update player resources (placeholder - need proper resource update logic)
      console.log('Player resources updated:', playerResources);
    }
  }

  private static applyFleetLaunched(clientModel: ClientModelData, event: FleetLaunchedEvent): void {
    const { fromPlanetId, ships } = event.data;

    // Remove ships from source planet
    const planet = clientModel.mainPlayerOwnedPlanets[fromPlanetId];
    if (planet) {
      // Update planet's fleet
      for (const [shipTypeStr, quantity] of Object.entries(ships)) {
        const shipType = parseInt(shipTypeStr);
        // Find and reduce starships of this type
        const starshipsToRemove = planet.planetaryFleet.starships.filter((s) => s.type === shipType).slice(0, quantity);
        for (const ship of starshipsToRemove) {
          const index = planet.planetaryFleet.starships.indexOf(ship);
          if (index > -1) {
            planet.planetaryFleet.starships.splice(index, 1);
          }
        }
      }
    }

    // Note: We don't add the fleet here because the regular game clock
    // advancement will handle fleet updates (position, arrival, etc.)
    // This event just confirms the action was successful
  }

  private static applyPlanetWorkerAssignmentsUpdated(
    clientModel: ClientModelData,
    event: PlanetWorkerAssignmentsUpdatedEvent,
  ): void {
    const { planetId, workers } = event.data;

    const planet = clientModel.mainPlayerOwnedPlanets[planetId];
    if (planet) {
      // Update worker assignments - this would require manipulating the citizen array
      // For now, just note that workers have been updated
      // The full implementation would require engine methods to properly update citizens
      console.log(`Worker assignments updated for planet ${planetId}:`, workers);
    }
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

  private static applyResearchCancelled(clientModel: ClientModelData, _event: ResearchCancelledEvent): void {
    // Clear research queue
    clientModel.mainPlayer.research.researchTypeInQueue = null;
  }
}
