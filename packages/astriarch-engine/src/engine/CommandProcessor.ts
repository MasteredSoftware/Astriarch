/**
 * Command Processor
 *
 * Processes player commands and generates client events.
 * This is the core of the new event-driven architecture.
 */

import { GameModel } from './gameModel';
import { Planet } from './planet';
import type { ClientModelData, ClientPlanet } from '../model/clientModel';
import type { ModelData } from '../model/model';
import type { PlanetData } from '../model/planet';
import type { PlayerData } from '../model/player';
import type { Grid } from './grid';
import {
  GameCommand,
  CommandResult,
  CommandResultError,
  CommandResultErrorCode,
  GameCommandType,
  ClientEventType,
  QueueProductionItemCommand,
  RemoveProductionItemCommand,
  DemolishImprovementCommand,
  SendShipsCommand,
  UpdatePlanetWorkerAssignmentsCommand,
  UpdatePlanetOptionsCommand,
  SetWaypointCommand,
  ClearWaypointCommand,
  AdjustResearchPercentCommand,
  SubmitResearchItemCommand,
  CancelResearchItemCommand,
  SubmitTradeCommand,
  CancelTradeCommand,
  PlanetWorkerAssignmentsUpdatedEvent,
  PlanetOptionsUpdatedEvent,
  WaypointSetEvent,
  WaypointClearedEvent,
  ResearchPercentAdjustedEvent,
  ResearchQueuedEvent,
  ResearchCancelledEvent,
  ProductionItemQueuedEvent,
  FleetLaunchedEvent,
  TradeSubmittedEvent,
  TradeCancelledEvent,
} from './GameCommands';
import { Player } from './player';
import { Fleet } from './fleet';
import { TradingCenter } from './tradingCenter';
import { TradeType, TradingCenterResourceType } from '../model/tradingCenter';
import { PlanetProductionItemType } from '../model/planet';

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
   * Helper method to create a structured error response
   */
  private static createError(
    message: string,
    code: CommandResultErrorCode,
    possibleDesync = false,
  ): CommandResultError {
    return { message, code, possibleDesync };
  }

  /**
   * Type guard to check if model is ClientModelData
   */
  private static isClientModel(model: ModelData | ClientModelData): model is ClientModelData {
    return 'mainPlayerOwnedPlanets' in model;
  }

  /**
   * Get the main player from either ModelData or ClientModelData
   */
  private static getMainPlayer(model: ModelData | ClientModelData, playerId: string): PlayerData | undefined {
    if (this.isClientModel(model)) {
      return model.mainPlayer;
    } else {
      return model.players.find((p) => p.id === playerId);
    }
  }

  /**
   * Get a planet by ID only if owned by the specified player
   * For ClientModelData: checks mainPlayerOwnedPlanets
   * For ModelData: checks if planet exists and is in player's ownedPlanetIds
   */
  private static getPlanetIfOwned(
    model: ModelData | ClientModelData,
    planetId: number,
    playerId: string,
  ): PlanetData | undefined {
    if (this.isClientModel(model)) {
      // For client model, mainPlayerOwnedPlanets already filters by ownership
      return model.mainPlayerOwnedPlanets[planetId];
    } else {
      // For server model, verify planet exists and player owns it
      const planet = model.planets.find((p) => p.id === planetId);
      if (!planet) return undefined;

      const player = model.players.find((p) => p.id === playerId);
      if (!player || !player.ownedPlanetIds.includes(planetId)) {
        return undefined;
      }

      return planet;
    }
  }

  /**
   * Get all planets from either ModelData or ClientModelData
   */
  private static getAllPlanets(model: ModelData | ClientModelData): (ClientPlanet | PlanetData)[] {
    if (this.isClientModel(model)) {
      return model.clientPlanets;
    } else {
      return model.planets;
    }
  }

  /**
   * Process a player command and return events to broadcast
   *
   * @param model - Either full ModelData (server) or ClientModelData (client)
   * @param grid - Game grid for distance calculations
   * @param command - The command to process
   */
  public static processCommand(model: ModelData | ClientModelData, grid: Grid, command: GameCommand): CommandResult {
    switch (command.type) {
      case GameCommandType.QUEUE_PRODUCTION_ITEM:
        return this.processQueueProductionItem(model, grid, command as QueueProductionItemCommand);

      case GameCommandType.REMOVE_PRODUCTION_ITEM:
        return this.processRemoveProductionItem(model, command as RemoveProductionItemCommand);

      case GameCommandType.DEMOLISH_IMPROVEMENT:
        return this.processDemolishImprovement(model, grid, command as DemolishImprovementCommand);

      case GameCommandType.SEND_SHIPS:
        return this.processSendShips(model, grid, command as SendShipsCommand);

      case GameCommandType.UPDATE_PLANET_WORKER_ASSIGNMENTS:
        return this.processUpdatePlanetWorkerAssignments(model, command as UpdatePlanetWorkerAssignmentsCommand);

      case GameCommandType.SET_WAYPOINT:
        return this.processSetWaypoint(model, command as SetWaypointCommand);

      case GameCommandType.CLEAR_WAYPOINT:
        return this.processClearWaypoint(model, command as ClearWaypointCommand);

      case GameCommandType.ADJUST_RESEARCH_PERCENT:
        return this.processAdjustResearchPercent(model, command as AdjustResearchPercentCommand);

      case GameCommandType.SUBMIT_RESEARCH_ITEM:
        return this.processSubmitResearchItem(model, command as SubmitResearchItemCommand);

      case GameCommandType.CANCEL_RESEARCH_ITEM:
        return this.processCancelResearchItem(model, command as CancelResearchItemCommand);

      case GameCommandType.SUBMIT_TRADE:
        return this.processSubmitTrade(model, command as SubmitTradeCommand);

      case GameCommandType.CANCEL_TRADE:
        return this.processCancelTrade(model, command as CancelTradeCommand);

      case GameCommandType.UPDATE_PLANET_OPTIONS:
        return this.processUpdatePlanetOptions(model, command as UpdatePlanetOptionsCommand);

      default:
        const unknownCommand = command as { type: string };
        return {
          success: false,
          error: this.createError(
            `Unknown command type: ${unknownCommand.type}`,
            CommandResultErrorCode.UNKNOWN_COMMAND,
          ),
          events: [],
        };
    }
  }

  private static processQueueProductionItem(
    model: ModelData | ClientModelData,
    grid: Grid,
    command: QueueProductionItemCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);
    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    const productionItem = command.productionItem;
    if (!productionItem) {
      return {
        success: false,
        error: this.createError('Production item not provided', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    // Apply drift compensation if client sent their cycle
    let compensationApplied = false;
    let compensatedResources = { energy: 0, ore: 0, iridium: 0 };

    if (command.clientCycle !== undefined) {
      const cycleDrift = command.clientCycle - model.currentCycle;
      const MAX_DRIFT_COMPENSATION = 0.1; // Only compensate up to 0.1 cycles (~3 seconds at normal speed)

      if (cycleDrift > 0 && cycleDrift <= MAX_DRIFT_COMPENSATION) {
        // Client is slightly ahead - calculate extra resources they've generated
        const planetById = this.isClientModel(model)
          ? model.mainPlayerOwnedPlanets
          : Object.fromEntries(model.planets.map((p) => [p.id, p]));
        const resourcesPerCycle = GameModel.getPlayerTotalResourceProductionPerTurn(player, planetById);

        compensatedResources = {
          energy: resourcesPerCycle.energy * cycleDrift,
          ore: resourcesPerCycle.ore * cycleDrift,
          iridium: resourcesPerCycle.iridium * cycleDrift,
        };

        // Temporarily add these resources to the planet for validation
        planet.resources.energy += compensatedResources.energy;
        planet.resources.ore += compensatedResources.ore;
        planet.resources.iridium += compensatedResources.iridium;
        compensationApplied = true;

        console.log(
          `Drift compensation applied: cycleDrift=${cycleDrift.toFixed(6)}, ` +
            `energy+${compensatedResources.energy.toFixed(2)}, ` +
            `ore+${compensatedResources.ore.toFixed(2)}, ` +
            `iridium+${compensatedResources.iridium.toFixed(2)}`,
        );
      }
    }

    // Enqueue using engine method
    const canBuild = Player.enqueueProductionItemAndSpendResourcesIfPossible(
      model,
      grid,
      planet,
      productionItem,
      command.playerId,
    );

    // Remove temporary compensation after validation
    if (compensationApplied) {
      planet.resources.energy -= compensatedResources.energy;
      planet.resources.ore -= compensatedResources.ore;
      planet.resources.iridium -= compensatedResources.iridium;
    }

    if (!canBuild) {
      return {
        success: false,
        error: this.createError('Not enough resources to build item', CommandResultErrorCode.INSUFFICIENT_RESOURCES),
        events: [],
      };
    }

    // Pre-assign ship ID if this is a starship production item
    if (productionItem.itemType === PlanetProductionItemType.StarShipInProduction && productionItem.starshipData) {
      // Generate planet-scoped ID for deterministic ship identification
      productionItem.starshipData.assignedShipId = `${planet.id}_${planet.nextShipId++}`;
    }

    // Get player resources after spending
    const planetById = this.isClientModel(model)
      ? model.mainPlayerOwnedPlanets
      : Object.fromEntries(model.planets.map((p) => [p.id, p]));
    const totalResources = Player.getTotalResourceAmount(player, planetById);

    const event: ProductionItemQueuedEvent = {
      type: ClientEventType.PRODUCTION_ITEM_QUEUED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        planetId: command.planetId,
        productionItem,
        playerResources: totalResources,
        serverCycle: model.currentCycle,
        // Pass through metadata from command (e.g., autoQueued flag)
        metadata: command.metadata,
      },
    };

    console.log(
      'PRODUCTION_ITEM_QUEUED event in CommandProcessor:',
      event,
      'serverCycle:',
      model.currentCycle,
      'resources:',
      totalResources,
    );

    return { success: true, events: [event] };
  }

  private static processRemoveProductionItem(
    model: ModelData | ClientModelData,
    command: RemoveProductionItemCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);
    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    if (command.index < 0) {
      return {
        success: false,
        error: this.createError('Invalid item index', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    // Use engine method to remove item and handle refund
    const success = Planet.removeBuildQueueItemForRefund(planet, command.index);
    if (!success) {
      return {
        success: false,
        error: this.createError(
          'Failed to remove item from build queue',
          CommandResultErrorCode.PRODUCTION_ITEM_NOT_FOUND,
          true, // Possible desync - client thinks item exists but server disagrees
        ),
        events: [],
      };
    }

    const event = {
      type: ClientEventType.PRODUCTION_ITEM_REMOVED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        planetId: command.planetId,
        itemIndex: command.index,
      },
    };

    return { success: true, events: [event] };
  }

  private static processDemolishImprovement(
    model: ModelData | ClientModelData,
    grid: Grid,
    command: DemolishImprovementCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);
    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    const productionItem = command.productionItem;
    if (!productionItem) {
      return {
        success: false,
        error: this.createError('Production item not provided for demolish', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    // Enqueue demolish order using engine method
    const canBuild = Player.enqueueProductionItemAndSpendResourcesIfPossible(
      model,
      grid,
      planet,
      productionItem,
      command.playerId,
    );

    if (!canBuild) {
      return {
        success: false,
        error: this.createError('Cannot demolish improvement', CommandResultErrorCode.INVALID_OPERATION),
        events: [],
      };
    }

    // Get player resources after spending (no actual cost for demolish, but might get refund)
    const planetById = this.isClientModel(model)
      ? model.mainPlayerOwnedPlanets
      : Object.fromEntries(model.planets.map((p) => [p.id, p]));
    const totalResources = Player.getTotalResourceAmount(player, planetById);

    const event: ProductionItemQueuedEvent = {
      type: ClientEventType.PRODUCTION_ITEM_QUEUED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        planetId: command.planetId,
        productionItem: productionItem,
        playerResources: totalResources,
        serverCycle: model.currentCycle,
      },
    };

    return { success: true, events: [event] };
  }

  private static processSendShips(
    model: ModelData | ClientModelData,
    grid: Grid,
    command: SendShipsCommand,
  ): CommandResult {
    const sourcePlanet = this.getPlanetIfOwned(model, command.fromPlanetId, command.playerId);
    if (!sourcePlanet) {
      return {
        success: false,
        error: this.createError('Source planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    // Destination can be owned or just explored - use getAllPlanets for broader search
    const destPlanet = this.getAllPlanets(model).find((p: ClientPlanet | PlanetData) => p.id === command.toPlanetId);
    if (!destPlanet) {
      return {
        success: false,
        error: this.createError('Destination planet not found', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Validate that we have ships to send
    const totalShipsToSend =
      command.shipIds.scouts.length +
      command.shipIds.destroyers.length +
      command.shipIds.cruisers.length +
      command.shipIds.battleships.length;

    if (totalShipsToSend === 0) {
      return {
        success: false,
        error: this.createError('No ships selected to send', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }
    console.log('Sending ships command: totalShipsToSend', totalShipsToSend, command.shipIds);

    const allRequestedIds = [
      ...command.shipIds.scouts,
      ...command.shipIds.destroyers,
      ...command.shipIds.cruisers,
      ...command.shipIds.battleships,
    ];

    const existingShipIds = new Set<string>(sourcePlanet.planetaryFleet.starships.map((s) => s.id));
    const missingShips = allRequestedIds.filter((id) => !existingShipIds.has(id));

    if (missingShips.length > 0) {
      console.error('Ships not found in planetary fleet:', missingShips);
      return {
        success: false,
        error: this.createError(
          `Ships not found (already sent or destroyed): ${missingShips.slice(0, 5).join(', ')}`,
          CommandResultErrorCode.SHIPS_NOT_FOUND,
          true, // Possible desync - client thinks ships exist but server disagrees
        ),
        events: [],
      };
    }
    // Launch the fleet using the engine method with client-provided fleet ID
    Fleet.launchFleetToPlanet(sourcePlanet, destPlanet, grid, command.shipIds, player, command.fleetId);

    // Generate event with the fleet ID and ship IDs that were moved
    const event: FleetLaunchedEvent = {
      type: ClientEventType.FLEET_LAUNCHED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        fleetId: command.fleetId,
        fromPlanetId: command.fromPlanetId,
        toPlanetId: command.toPlanetId,
        shipIds: command.shipIds,
      },
    };

    return { success: true, events: [event] };
  }

  private static processUpdatePlanetWorkerAssignments(
    model: ModelData | ClientModelData,
    command: UpdatePlanetWorkerAssignmentsCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);

    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Update worker assignments using the engine method that handles rebalancing
    const { farmerDiff, minerDiff, builderDiff } = command.workers;
    Planet.updatePopulationWorkerTypes(planet, player, farmerDiff, minerDiff, builderDiff);

    // Generate event with updated worker counts
    const updatedWorkers = Planet.countPopulationWorkerTypes(planet);
    const event: PlanetWorkerAssignmentsUpdatedEvent = {
      type: ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        planetId: planet.id,
        workers: {
          farmers: updatedWorkers.farmers,
          miners: updatedWorkers.miners,
          builders: updatedWorkers.builders,
        },
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processSetWaypoint(model: ModelData | ClientModelData, command: SetWaypointCommand): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);

    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    // Waypoint planet can be owned or just explored - use getAllPlanets for broader search
    const waypointPlanet = this.getAllPlanets(model).find(
      (p: ClientPlanet | PlanetData) => p.id === command.waypointPlanetId,
    );
    if (!waypointPlanet) {
      return {
        success: false,
        error: this.createError('Waypoint planet not found', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Set waypoint using engine - just set the reference point
    planet.waypointBoundingHexMidPoint = waypointPlanet.boundingHexMidPoint;

    const event: WaypointSetEvent = {
      type: ClientEventType.WAYPOINT_SET,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
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

  private static processClearWaypoint(
    model: ModelData | ClientModelData,
    command: ClearWaypointCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);

    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Clear waypoint
    planet.waypointBoundingHexMidPoint = null;

    const event: WaypointClearedEvent = {
      type: ClientEventType.WAYPOINT_CLEARED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
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
    model: ModelData | ClientModelData,
    command: AdjustResearchPercentCommand,
  ): CommandResult {
    const player = this.getMainPlayer(model, command.playerId);

    if (!player || player.id !== command.playerId) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Validate percent is between 0 and 1
    if (command.researchPercent < 0 || command.researchPercent > 1) {
      return {
        success: false,
        error: this.createError('Research percent must be between 0 and 1', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    // Update research percent
    player.research.researchPercent = command.researchPercent;

    const event: ResearchPercentAdjustedEvent = {
      type: ClientEventType.RESEARCH_PERCENT_ADJUSTED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
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
    model: ModelData | ClientModelData,
    command: SubmitResearchItemCommand,
  ): CommandResult {
    const player = this.getMainPlayer(model, command.playerId);

    if (!player || player.id !== command.playerId) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
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
      sourceCommandId: command.commandId,
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
    model: ModelData | ClientModelData,
    command: CancelResearchItemCommand,
  ): CommandResult {
    const player = this.getMainPlayer(model, command.playerId);

    if (!player || player.id !== command.playerId) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Check if this research is actually in queue
    if (player.research.researchTypeInQueue !== command.researchType) {
      return {
        success: false,
        error: this.createError(
          'Research not in queue',
          CommandResultErrorCode.RESEARCH_NOT_IN_QUEUE,
          true, // Possible desync - client thinks research is queued but server disagrees
        ),
        events: [],
      };
    }

    // Clear research queue
    player.research.researchTypeInQueue = null;

    const event: ResearchCancelledEvent = {
      type: ClientEventType.RESEARCH_CANCELLED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        researchType: command.researchType,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }

  private static processSubmitTrade(model: ModelData | ClientModelData, command: SubmitTradeCommand): CommandResult {
    const player = this.getMainPlayer(model, command.playerId);
    if (!player || player.id !== command.playerId) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Validate trade data
    console.log('Processing trade command:', command);
    const { resourceType, amount, action } = command.tradeData;
    if (!resourceType || !amount || !action) {
      return {
        success: false,
        error: this.createError('Invalid trade data', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    // Map resource type string to enum
    const resourceTypeMap: Record<string, TradingCenterResourceType> = {
      food: TradingCenterResourceType.FOOD,
      ore: TradingCenterResourceType.ORE,
      iridium: TradingCenterResourceType.IRIDIUM,
    };

    const resourceTypeEnum = resourceTypeMap[resourceType];
    if (!resourceTypeEnum) {
      return {
        success: false,
        error: this.createError('Invalid resource type', CommandResultErrorCode.INVALID_PARAMETER),
        events: [],
      };
    }

    const tradeType = action === 'buy' ? TradeType.BUY : TradeType.SELL;

    // Find a planet owned by the player (trades need to be associated with a planet)
    const playerPlanetId = player.ownedPlanetIds[0];
    if (!playerPlanetId) {
      return {
        success: false,
        error: this.createError(
          'Player must own at least one planet to trade',
          CommandResultErrorCode.INVALID_OPERATION,
        ),
        events: [],
      };
    }

    // Create the trade using the engine method with client-provided ID
    const trade = TradingCenter.constructTrade(
      player.id,
      playerPlanetId,
      tradeType,
      resourceTypeEnum,
      amount,
      5, // 5 second delay
      command.tradeId, // Use client-generated ID for consistency
    );

    // Add trade to the client trading center (note: this is optimistic, server is authoritative)
    if (this.isClientModel(model)) {
      model.clientTradingCenter.mainPlayerTrades.push(trade);
    } else {
      // On server, add to the global trading center
      model.tradingCenter.currentTrades.push(trade);
    }

    // Generate event
    const event: TradeSubmittedEvent = {
      type: ClientEventType.TRADE_SUBMITTED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        tradeId: trade.id,
        planetId: playerPlanetId,
        resourceType,
        amount,
        action,
      },
    };

    return { success: true, events: [event] };
  }

  private static processCancelTrade(model: ModelData | ClientModelData, command: CancelTradeCommand): CommandResult {
    const player = this.getMainPlayer(model, command.playerId);
    if (!player || player.id !== command.playerId) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Get the appropriate trades array based on model type
    const trades = this.isClientModel(model)
      ? model.clientTradingCenter.mainPlayerTrades
      : model.tradingCenter.currentTrades;

    // Use TradingCenter method to cancel the trade
    const cancelled = TradingCenter.cancelTrade(trades, command.tradeId, command.playerId);

    if (!cancelled) {
      return {
        success: false,
        error: this.createError(
          'Trade not found or cannot be cancelled',
          CommandResultErrorCode.TRADE_NOT_FOUND,
          true, // Possible desync - client thinks trade exists but server disagrees
        ),
        events: [],
      };
    }

    // Get player resources after trade cancellation
    const planetById = this.isClientModel(model)
      ? model.mainPlayerOwnedPlanets
      : Object.fromEntries(model.planets.map((p) => [p.id, p]));
    const totalResources = Player.getTotalResourceAmount(player, planetById);

    // Generate event
    const event: TradeCancelledEvent = {
      type: ClientEventType.TRADE_CANCELLED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        tradeId: command.tradeId,
        playerResources: totalResources,
      },
    };

    return { success: true, events: [event] };
  }

  private static processUpdatePlanetOptions(
    model: ModelData | ClientModelData,
    command: UpdatePlanetOptionsCommand,
  ): CommandResult {
    const planet = this.getPlanetIfOwned(model, command.planetId, command.playerId);

    if (!planet) {
      return {
        success: false,
        error: this.createError('Planet not found or not owned by player', CommandResultErrorCode.INVALID_PLANET),
        events: [],
      };
    }

    const player = this.getMainPlayer(model, command.playerId);
    if (!player) {
      return {
        success: false,
        error: this.createError('Player not found', CommandResultErrorCode.INVALID_PLAYER),
        events: [],
      };
    }

    // Update planet options
    if (command.options.buildLastStarship !== undefined) {
      planet.buildLastStarship = command.options.buildLastStarship;
    }

    const event: PlanetOptionsUpdatedEvent = {
      type: ClientEventType.PLANET_OPTIONS_UPDATED,
      affectedPlayerIds: [command.playerId],
      sourceCommandId: command.commandId,
      data: {
        planetId: command.planetId,
        buildLastStarship: planet.buildLastStarship,
      },
    };

    return {
      success: true,
      events: [event],
    };
  }
}
