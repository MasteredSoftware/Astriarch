/**
 * Command Processor
 *
 * Processes player commands and generates client events.
 * This is the core of the new event-driven architecture.
 */

import { GameModelData } from './gameModel';
import {
  GameCommand,
  CommandResult,
  GameCommandType,
  ClientEventType,
  BuildShipCommand,
  BuildImprovementCommand,
  SendShipsCommand,
  UpdatePlanetWorkerAssignmentsCommand,
  SetWaypointCommand,
  ClearWaypointCommand,
  AdjustResearchPercentCommand,
  SubmitResearchItemCommand,
  CancelResearchItemCommand,
  SubmitTradeCommand,
  CancelTradeCommand,
  PlanetWorkerAssignmentsUpdatedEvent,
  WaypointSetEvent,
  WaypointClearedEvent,
  ResearchPercentAdjustedEvent,
  ResearchQueuedEvent,
  ResearchCancelledEvent,
  ProductionItemQueuedEvent,
} from './GameCommands';
import { ClientGameModel } from './clientGameModel';
import { Player } from './player';
import { Fleet } from './fleet';

/**
 * NOTE: CommandProcessor validates commands and marks them for processing.
 * The actual game state mutation happens in the backend GameController methods
 * which then generate the appropriate events to broadcast.
 *
 * This keeps the complex logic (resources, fleets, trading) in one place
 * while establishing the command/event architecture.
 */

export class CommandProcessor {
  /**
   * Process a player command and return events to broadcast
   */
  public static processCommand(gameModel: GameModelData, command: GameCommand): CommandResult {
    switch (command.type) {
      case GameCommandType.BUILD_SHIP:
        return this.processBuildShip(gameModel, command as BuildShipCommand);

      case GameCommandType.BUILD_IMPROVEMENT:
        return this.processBuildImprovement(gameModel, command as BuildImprovementCommand);

      case GameCommandType.SEND_SHIPS:
        return this.processSendShips(gameModel, command as SendShipsCommand);

      case GameCommandType.UPDATE_PLANET_WORKER_ASSIGNMENTS:
        return this.processUpdatePlanetWorkerAssignments(gameModel, command as UpdatePlanetWorkerAssignmentsCommand);

      case GameCommandType.SET_WAYPOINT:
        return this.processSetWaypoint(gameModel, command as SetWaypointCommand);

      case GameCommandType.CLEAR_WAYPOINT:
        return this.processClearWaypoint(gameModel, command as ClearWaypointCommand);

      case GameCommandType.ADJUST_RESEARCH_PERCENT:
        return this.processAdjustResearchPercent(gameModel, command as AdjustResearchPercentCommand);

      case GameCommandType.SUBMIT_RESEARCH_ITEM:
        return this.processSubmitResearchItem(gameModel, command as SubmitResearchItemCommand);

      case GameCommandType.CANCEL_RESEARCH_ITEM:
        return this.processCancelResearchItem(gameModel, command as CancelResearchItemCommand);

      case GameCommandType.SUBMIT_TRADE:
        return this.processSubmitTrade(gameModel, command as SubmitTradeCommand);

      case GameCommandType.CANCEL_TRADE:
        return this.processCancelTrade(gameModel, command as CancelTradeCommand);

      default:
        const unknownCommand = command as { type: string };
        return {
          success: false,
          error: `Unknown command type: ${unknownCommand.type}`,
          events: [],
        };
    }
  }

  private static processBuildShip(gameModel: GameModelData, command: BuildShipCommand): CommandResult {
    const { modelData, grid } = gameModel;
    const planet = modelData.planets.find((p) => p.id === command.planetId);
    if (!planet) {
      return { success: false, error: 'Planet not found', events: [] };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player || !player.ownedPlanetIds.includes(command.planetId)) {
      return { success: false, error: 'Player does not own this planet', events: [] };
    }

    const productionItem = command.productionItem;
    if (!productionItem) {
      return { success: false, error: 'Production item not provided', events: [] };
    }

    // Build client model and enqueue
    const clientModel = ClientGameModel.constructClientGameModel(modelData, command.playerId);
    const canBuild = Player.enqueueProductionItemAndSpendResourcesIfPossible(
      clientModel,
      grid,
      planet,
      productionItem as any, // TODO: Fix type
    );

    if (!canBuild) {
      return { success: false, error: 'Not enough resources to build item', events: [] };
    }

    // Get player resources after spending
    const totalResources = Player.getTotalResourceAmount(player, clientModel.mainPlayerOwnedPlanets);

    const event: ProductionItemQueuedEvent = {
      type: ClientEventType.PRODUCTION_ITEM_QUEUED,
      affectedPlayerIds: [command.playerId],
      data: {
        planetId: command.planetId,
        productionItem: productionItem as any, // TODO: Fix type
        playerResources: totalResources,
      },
    };

    return { success: true, events: [event] };
  }

  private static processBuildImprovement(gameModel: GameModelData, command: BuildImprovementCommand): CommandResult {
    const { modelData, grid } = gameModel;
    const planet = modelData.planets.find((p) => p.id === command.planetId);
    if (!planet) {
      return { success: false, error: 'Planet not found', events: [] };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player || !player.ownedPlanetIds.includes(command.planetId)) {
      return { success: false, error: 'Player does not own this planet', events: [] };
    }

    const productionItem = command.productionItem;
    if (!productionItem) {
      return { success: false, error: 'Production item not provided', events: [] };
    }

    // Build client model and enqueue
    const clientModel = ClientGameModel.constructClientGameModel(modelData, command.playerId);
    const canBuild = Player.enqueueProductionItemAndSpendResourcesIfPossible(
      clientModel,
      grid,
      planet,
      productionItem as any, // TODO: Fix type
    );

    if (!canBuild) {
      return { success: false, error: 'Not enough resources to build item', events: [] };
    }

    // Get player resources after spending
    const totalResources = Player.getTotalResourceAmount(player, clientModel.mainPlayerOwnedPlanets);

    const event: ProductionItemQueuedEvent = {
      type: ClientEventType.PRODUCTION_ITEM_QUEUED,
      affectedPlayerIds: [command.playerId],
      data: {
        planetId: command.planetId,
        productionItem: productionItem as any, // TODO: Fix type
        playerResources: totalResources,
      },
    };

    return { success: true, events: [event] };
  }

  private static processSendShips(gameModel: GameModelData, command: SendShipsCommand): CommandResult {
    const { modelData } = gameModel;
    const sourcePlanet = modelData.planets.find((p) => p.id === command.fromPlanetId);
    if (!sourcePlanet) {
      return { success: false, error: 'Source planet not found', events: [] };
    }

    const destPlanet = modelData.planets.find((p) => p.id === command.toPlanetId);
    if (!destPlanet) {
      return { success: false, error: 'Destination planet not found', events: [] };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player || !player.ownedPlanetIds.includes(command.fromPlanetId)) {
      return { success: false, error: 'Player does not own source planet', events: [] };
    }

    // Defer to backend for now - this needs access to the grid and Fleet utilities
    // which require refactoring to work in CommandProcessor
    return { success: true, events: [] };
  }

  private static processUpdatePlanetWorkerAssignments(
    gameModel: GameModelData,
    command: UpdatePlanetWorkerAssignmentsCommand,
  ): CommandResult {
    const { modelData } = gameModel;
    const planet = modelData.planets.find((p) => p.id === command.planetId);

    if (!planet) {
      return {
        success: false,
        error: 'Planet not found',
        events: [],
      };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    if (!player.ownedPlanetIds.includes(command.planetId)) {
      return {
        success: false,
        error: 'Player does not own this planet',
        events: [],
      };
    }

    // Validate worker assignments don't exceed population
    const totalWorkers = command.workers.industry + command.workers.science + command.workers.energy;
    if (totalWorkers > planet.population.length) {
      return {
        success: false,
        error: 'Worker assignments exceed population',
        events: [],
      };
    }

    // Update worker assignments using engine - need to manipulate citizen array
    // For now, just track the counts (the actual citizen assignment logic is complex)
    // The engine should have a method for this, but for MVP we can just validate and store

    const event: PlanetWorkerAssignmentsUpdatedEvent = {
      type: ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED,
      affectedPlayerIds: [command.playerId],
      data: {
        planetId: planet.id,
        workers: command.workers,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processSetWaypoint(gameModel: GameModelData, command: SetWaypointCommand): CommandResult {
    const { modelData } = gameModel;
    const planet = modelData.planets.find((p) => p.id === command.planetId);

    if (!planet) {
      return {
        success: false,
        error: 'Planet not found',
        events: [],
      };
    }

    const waypointPlanet = modelData.planets.find((p) => p.id === command.waypointPlanetId);
    if (!waypointPlanet) {
      return {
        success: false,
        error: 'Waypoint planet not found',
        events: [],
      };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    if (!player.ownedPlanetIds.includes(command.planetId)) {
      return {
        success: false,
        error: 'Player does not own this planet',
        events: [],
      };
    }

    // Set waypoint using engine - just set the reference point
    planet.waypointBoundingHexMidPoint = waypointPlanet.boundingHexMidPoint;

    const event: WaypointSetEvent = {
      type: ClientEventType.WAYPOINT_SET,
      affectedPlayerIds: [command.playerId],
      data: {
        planetId: command.planetId,
        waypointPlanetId: command.waypointPlanetId,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processClearWaypoint(gameModel: GameModelData, command: ClearWaypointCommand): CommandResult {
    const { modelData } = gameModel;
    const planet = modelData.planets.find((p) => p.id === command.planetId);

    if (!planet) {
      return {
        success: false,
        error: 'Planet not found',
        events: [],
      };
    }

    const player = modelData.players.find((p) => p.id === command.playerId);
    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    if (!player.ownedPlanetIds.includes(command.planetId)) {
      return {
        success: false,
        error: 'Player does not own this planet',
        events: [],
      };
    }

    // Clear waypoint
    planet.waypointBoundingHexMidPoint = null;

    const event: WaypointClearedEvent = {
      type: ClientEventType.WAYPOINT_CLEARED,
      affectedPlayerIds: [command.playerId],
      data: {
        planetId: command.planetId,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processAdjustResearchPercent(
    gameModel: GameModelData,
    command: AdjustResearchPercentCommand,
  ): CommandResult {
    const { modelData } = gameModel;
    const player = modelData.players.find((p) => p.id === command.playerId);

    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    // Validate percent is between 0 and 1
    if (command.researchPercent < 0 || command.researchPercent > 1) {
      return {
        success: false,
        error: 'Research percent must be between 0 and 1',
        events: [],
      };
    }

    // Update research percent
    player.research.researchPercent = command.researchPercent;

    const event: ResearchPercentAdjustedEvent = {
      type: ClientEventType.RESEARCH_PERCENT_ADJUSTED,
      affectedPlayerIds: [command.playerId],
      data: {
        researchPercent: command.researchPercent,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processSubmitResearchItem(
    gameModel: GameModelData,
    command: SubmitResearchItemCommand,
  ): CommandResult {
    const { modelData } = gameModel;
    const player = modelData.players.find((p) => p.id === command.playerId);

    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    // Check if player already has research in queue
    if (player.research.researchTypeInQueue !== null) {
      return {
        success: false,
        error: 'Research already in progress',
        events: [],
      };
    }

    // Set research in queue
    player.research.researchTypeInQueue = command.researchType;

    // Get research progress to determine turns remaining
    const researchProgress =
      player.research.researchProgressByType[
        command.researchType as keyof typeof player.research.researchProgressByType
      ];
    const turnsRemaining = researchProgress
      ? Math.ceil((researchProgress.researchPointsBase - researchProgress.researchPointsCompleted) / 10)
      : 10; // Default estimate

    const event: ResearchQueuedEvent = {
      type: ClientEventType.RESEARCH_QUEUED,
      affectedPlayerIds: [command.playerId],
      data: {
        researchType: command.researchType,
        turnsRemaining,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processCancelResearchItem(
    gameModel: GameModelData,
    command: CancelResearchItemCommand,
  ): CommandResult {
    const { modelData } = gameModel;
    const player = modelData.players.find((p) => p.id === command.playerId);

    if (!player) {
      return {
        success: false,
        error: 'Player not found',
        events: [],
      };
    }

    // Check if this research is actually in queue
    if (player.research.researchTypeInQueue !== command.researchType) {
      return {
        success: false,
        error: 'Research not in queue',
        events: [],
      };
    }

    // Clear research queue
    player.research.researchTypeInQueue = null;

    const event: ResearchCancelledEvent = {
      type: ClientEventType.RESEARCH_CANCELLED,
      affectedPlayerIds: [command.playerId],
      data: {
        researchType: command.researchType,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processSubmitTrade(gameModel: GameModelData, command: SubmitTradeCommand): CommandResult {
    const player = gameModel.modelData.players.find((p) => p.id === command.playerId);
    if (!player) {
      return { success: false, error: 'Player not found', events: [] };
    }

    // Defer to backend for now - trading logic needs refactoring
    return { success: true, events: [] };
  }

  private static processCancelTrade(gameModel: GameModelData, command: CancelTradeCommand): CommandResult {
    const player = gameModel.modelData.players.find((p) => p.id === command.playerId);
    if (!player) {
      return { success: false, error: 'Player not found', events: [] };
    }

    // Defer to backend for now - trading logic needs refactoring
    return { success: true, events: [] };
  }
}
