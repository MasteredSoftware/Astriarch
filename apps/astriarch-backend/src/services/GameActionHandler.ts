// Game action handler - processes game actions through business logic
import { GameState, PlayerAction, GameEvent } from '../models';
import { logger } from '../utils/logger';

export interface GameActionResult {
  success: boolean;
  message?: string;
  changes?: any;
  gameStateUpdate?: any;
}

export class GameActionHandler {
  /**
   * Process a building construction action
   */
  static async processBuildStructure(
    gameState: any,
    playerId: string,
    actionData: {
      planetId: string;
      buildingType: string;
      quantity?: number;
    }
  ): Promise<GameActionResult> {
    try {
      const { planetId, buildingType, quantity = 1 } = actionData;
      
      // Validate planet ownership
      const planet = gameState.planets?.[planetId];
      if (!planet || planet.playerId !== playerId) {
        return {
          success: false,
          message: 'Planet not found or not owned by player'
        };
      }

      // Validate building type
      const validBuildings = ['farm', 'mine', 'factory', 'spacePlatform'];
      if (!validBuildings.includes(buildingType)) {
        return {
          success: false,
          message: `Invalid building type: ${buildingType}`
        };
      }

      // Check resource requirements (simplified for now)
      const buildingCosts = {
        farm: { ore: 10, iridium: 0 },
        mine: { ore: 15, iridium: 5 },
        factory: { ore: 20, iridium: 10 },
        spacePlatform: { ore: 50, iridium: 25 }
      };

      const cost = buildingCosts[buildingType as keyof typeof buildingCosts];
      const totalCost = {
        ore: cost.ore * quantity,
        iridium: cost.iridium * quantity
      };

      // Check if player has enough resources
      if (planet.resources.ore < totalCost.ore || planet.resources.iridium < totalCost.iridium) {
        return {
          success: false,
          message: 'Insufficient resources'
        };
      }

      // Deduct resources and add to build queue
      planet.resources.ore -= totalCost.ore;
      planet.resources.iridium -= totalCost.iridium;
      
      // Add to build queue (simplified - assuming immediate completion for now)
      planet.buildings[buildingType] = (planet.buildings[buildingType] || 0) + quantity;

      const changes = {
        type: 'building_started',
        planetId,
        buildingType,
        quantity,
        newResources: planet.resources,
        newBuildings: planet.buildings
      };

      return {
        success: true,
        message: `${buildingType} construction started`,
        changes,
        gameStateUpdate: { planets: { [planetId]: planet } }
      };

    } catch (error) {
      logger.error('Error processing build structure action:', error);
      return {
        success: false,
        message: 'Failed to process building construction'
      };
    }
  }

  /**
   * Process a fleet movement action
   */
  static async processSendFleet(
    gameState: any,
    playerId: string,
    actionData: {
      fromPlanetId: string;
      toPlanetId: string;
      ships: {
        scouts?: number;
        destroyers?: number;
        cruisers?: number;
        battleships?: number;
      };
      orders: 'attack' | 'colonize' | 'reinforce';
    }
  ): Promise<GameActionResult> {
    try {
      const { fromPlanetId, toPlanetId, ships, orders } = actionData;

      // Validate source planet
      const fromPlanet = gameState.planets?.[fromPlanetId];
      if (!fromPlanet || fromPlanet.playerId !== playerId) {
        return {
          success: false,
          message: 'Source planet not found or not owned'
        };
      }

      // Validate destination planet exists
      const toPlanet = gameState.planets?.[toPlanetId];
      if (!toPlanet) {
        return {
          success: false,
          message: 'Destination planet not found'
        };
      }

      // Calculate total ships being sent
      const totalShips = Object.values(ships).reduce((sum, count) => sum + (count || 0), 0);
      if (totalShips === 0) {
        return {
          success: false,
          message: 'No ships specified for fleet'
        };
      }

      // Check if planet has enough ships (simplified - assume planet has ships)
      // In real implementation, would check planet's available ships

      // Create fleet
      const fleetId = `fleet_${Date.now()}_${playerId}`;
      const fleet = {
        id: fleetId,
        playerId,
        ships,
        fromPlanetId,
        toPlanetId,
        orders,
        position: fromPlanet.position || { x: 0, y: 0 },
        destination: toPlanet.position || { x: 100, y: 100 },
        arrivalTime: new Date(Date.now() + 60000), // 1 minute travel time
        status: 'in_transit'
      };

      // Add fleet to game state
      if (!gameState.fleets) gameState.fleets = {};
      gameState.fleets[fleetId] = fleet;

      const changes = {
        type: 'fleet_dispatched',
        fleetId,
        fromPlanetId,
        toPlanetId,
        ships,
        orders,
        arrivalTime: fleet.arrivalTime
      };

      return {
        success: true,
        message: `Fleet dispatched to ${toPlanetId}`,
        changes,
        gameStateUpdate: { fleets: { [fleetId]: fleet } }
      };

    } catch (error) {
      logger.error('Error processing send fleet action:', error);
      return {
        success: false,
        message: 'Failed to dispatch fleet'
      };
    }
  }

  /**
   * Process a research action
   */
  static async processResearchUpgrade(
    gameState: any,
    playerId: string,
    actionData: {
      researchType: 'attack' | 'defense' | 'propulsion';
      allocation: number; // Percentage of resources to allocate
    }
  ): Promise<GameActionResult> {
    try {
      const { researchType, allocation } = actionData;

      // Validate research type
      const validResearch = ['attack', 'defense', 'propulsion'];
      if (!validResearch.includes(researchType)) {
        return {
          success: false,
          message: `Invalid research type: ${researchType}`
        };
      }

      // Validate allocation
      if (allocation < 0 || allocation > 100) {
        return {
          success: false,
          message: 'Research allocation must be between 0 and 100'
        };
      }

      // Get player data
      const player = gameState.players?.[playerId];
      if (!player) {
        return {
          success: false,
          message: 'Player not found'
        };
      }

      // Update research allocation
      if (!player.research) {
        player.research = { attack: 0, defense: 0, propulsion: 0 };
      }

      const previousAllocation = player.research[`${researchType}Allocation`] || 0;
      player.research[`${researchType}Allocation`] = allocation;

      const changes = {
        type: 'research_allocation_changed',
        researchType,
        previousAllocation,
        newAllocation: allocation
      };

      return {
        success: true,
        message: `${researchType} research allocation set to ${allocation}%`,
        changes,
        gameStateUpdate: { players: { [playerId]: player } }
      };

    } catch (error) {
      logger.error('Error processing research upgrade action:', error);
      return {
        success: false,
        message: 'Failed to update research'
      };
    }
  }

  /**
   * Process planet management actions
   */
  static async processPlanetManagement(
    gameState: any,
    playerId: string,
    actionData: {
      planetId: string;
      action: 'adjust_population' | 'demolish_building' | 'upgrade_building';
      parameters: any;
    }
  ): Promise<GameActionResult> {
    try {
      const { planetId, action, parameters } = actionData;

      // Validate planet ownership
      const planet = gameState.planets?.[planetId];
      if (!planet || planet.playerId !== playerId) {
        return {
          success: false,
          message: 'Planet not found or not owned by player'
        };
      }

      let changes: any = { type: action, planetId };
      let gameStateUpdate: any = {};

      switch (action) {
        case 'adjust_population':
          // Adjust population allocation between different roles
          const { workerAllocation } = parameters;
          if (workerAllocation) {
            planet.populationAllocation = workerAllocation;
            changes.newAllocation = workerAllocation;
            gameStateUpdate = { planets: { [planetId]: planet } };
          }
          break;

        case 'demolish_building':
          // Remove a building and get some resources back
          const { buildingType } = parameters;
          if (planet.buildings[buildingType] > 0) {
            planet.buildings[buildingType]--;
            // Return some resources (50% of original cost)
            const refundCosts = {
              farm: { ore: 5, iridium: 0 },
              mine: { ore: 7, iridium: 2 },
              factory: { ore: 10, iridium: 5 },
              spacePlatform: { ore: 25, iridium: 12 }
            };
            const refund = refundCosts[buildingType as keyof typeof refundCosts];
            if (refund) {
              planet.resources.ore += refund.ore;
              planet.resources.iridium += refund.iridium;
            }
            changes.buildingType = buildingType;
            changes.resourcesRefunded = refund;
            gameStateUpdate = { planets: { [planetId]: planet } };
          } else {
            return {
              success: false,
              message: `No ${buildingType} buildings to demolish`
            };
          }
          break;

        default:
          return {
            success: false,
            message: `Unknown planet management action: ${action}`
          };
      }

      return {
        success: true,
        message: `Planet management action completed: ${action}`,
        changes,
        gameStateUpdate
      };

    } catch (error) {
      logger.error('Error processing planet management action:', error);
      return {
        success: false,
        message: 'Failed to process planet management action'
      };
    }
  }

  /**
   * Main dispatcher for all game actions
   */
  static async processAction(
    gameState: any,
    playerId: string,
    actionType: string,
    actionData: any
  ): Promise<GameActionResult> {
    logger.debug(`Processing action: ${actionType} for player: ${playerId}`);

    switch (actionType) {
      case 'build_structure':
        return await this.processBuildStructure(gameState, playerId, actionData);
      
      case 'send_fleet':
        return await this.processSendFleet(gameState, playerId, actionData);
      
      case 'research_upgrade':
        return await this.processResearchUpgrade(gameState, playerId, actionData);
      
      case 'planet_management':
        return await this.processPlanetManagement(gameState, playerId, actionData);
      
      default:
        return {
          success: false,
          message: `Unknown action type: ${actionType}`
        };
    }
  }
}