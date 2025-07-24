import { RealtimeGameController } from '../controllers/RealtimeGameController';
import { GameActionHandler } from '../services/GameActionHandler';
import { Game, GameState, PlayerAction, GameEvent } from '../models';
import { connectDatabase } from '../database/connection';

describe('RealtimeGameController', () => {
  let testGameId: string;
  let mockGameState: any;

  beforeAll(async () => {
    await connectDatabase();
  });

  beforeEach(async () => {
    // Create test game
    const game = new Game({
      hostPlayerName: 'TestHost',
      maxPlayers: 4,
      gameType: 'test',
      isPrivate: false,
      gameState: {
        gameTime: 0,
        planets: {
          'planet1': {
            playerId: 'player1',
            population: 100,
            buildings: { farms: 2, mines: 1, factories: 0, spacePlatforms: 0 },
            resources: { food: 50, ore: 100, iridium: 25 }
          },
          'planet2': {
            playerId: null,
            population: 0,
            buildings: { farms: 0, mines: 0, factories: 0, spacePlatforms: 0 },
            resources: { food: 0, ore: 0, iridium: 0 }
          }
        },
        fleets: {},
        players: {
          'player1': {
            name: 'TestPlayer1',
            isAI: false,
            research: { attack: 1, defense: 1, propulsion: 1 },
            resources: { credits: 1000 },
            isActive: true
          }
        },
        gameSettings: {
          gameSpeed: 1,
          maxPlayers: 4,
          galaxySize: 'small',
          aiDifficulty: 'normal'
        }
      },
      status: 'active'
    });

    await game.save();
    testGameId = game._id.toString();
    mockGameState = game.gameState;
  });

  afterEach(async () => {
    // Clean up
    await Game.deleteOne({ _id: testGameId });
    await GameState.deleteMany({ gameId: testGameId });
    await PlayerAction.deleteMany({ gameId: testGameId });
    await GameEvent.deleteMany({ gameId: testGameId });
    
    // Stop any running game processing
    RealtimeGameController.stopContinuousProcessing(testGameId);
  });

  describe('Game Initialization', () => {
    test('should initialize realtime game processing', async () => {
      await RealtimeGameController.initializeRealtimeGame(testGameId);
      
      // Check that game state is cached
      const currentState = await RealtimeGameController.getCurrentGameState(testGameId);
      expect(currentState).toBeDefined();
      expect(currentState.gameTime).toBeDefined();
    });

    test('should save initial game state snapshot', async () => {
      await RealtimeGameController.initializeRealtimeGame(testGameId);
      
      // Check database for game state
      const gameStates = await GameState.find({ gameId: testGameId });
      expect(gameStates.length).toBeGreaterThan(0);
      
      const latestState = gameStates[gameStates.length - 1];
      expect(latestState.gameId).toBe(testGameId);
      expect(latestState.version).toBe('2.0.0');
    });
  });

  describe('Player Action Processing', () => {
    beforeEach(async () => {
      await RealtimeGameController.initializeRealtimeGame(testGameId);
    });

    test('should process valid building action', async () => {
      const result = await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'build_structure',
        {
          planetId: 'planet1',
          buildingType: 'farm',
          quantity: 1
        }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('construction started');
      expect(result.changes).toBeDefined();
      expect(result.changes.type).toBe('building_started');
    });

    test('should reject invalid building action', async () => {
      const result = await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'build_structure',
        {
          planetId: 'nonexistent_planet',
          buildingType: 'farm',
          quantity: 1
        }
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    test('should process fleet dispatch action', async () => {
      const result = await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'send_fleet',
        {
          fromPlanetId: 'planet1',
          toPlanetId: 'planet2',
          ships: { scouts: 3, destroyers: 1 },
          orders: 'colonize'
        }
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('dispatched');
      expect(result.changes.type).toBe('fleet_dispatched');
    });

    test('should create player action record', async () => {
      await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'build_structure',
        {
          planetId: 'planet1',
          buildingType: 'mine',
          quantity: 1
        }
      );

      const actions = await PlayerAction.find({ 
        gameId: testGameId,
        playerId: 'player1',
        actionType: 'build_structure'
      });

      expect(actions.length).toBe(1);
      const action = actions[0];
      expect(action.processed).toBe(true);
      expect(action.result.success).toBe(true);
      expect(action.actionData.buildingType).toBe('mine');
    });

    test('should create game event for successful actions', async () => {
      await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'research_upgrade',
        {
          researchType: 'propulsion',
          allocation: 75
        }
      );

      const events = await GameEvent.find({ 
        gameId: testGameId,
        eventType: 'player_action'
      });

      expect(events.length).toBe(1);
      const event = events[0];
      expect(event.category).toBe('player_action');
      expect(event.eventData.playerId).toBe('player1');
      expect(event.eventData.actionType).toBe('research_upgrade');
    });
  });

  describe('Continuous Game Processing', () => {
    beforeEach(async () => {
      await RealtimeGameController.initializeRealtimeGame(testGameId);
    });

    test('should advance game time continuously', async () => {
      // Wait for at least one processing cycle
      await new Promise(resolve => setTimeout(resolve, 1100));

      const gameStates = await GameState.find({ gameId: testGameId })
        .sort({ timestamp: -1 })
        .limit(2);

      expect(gameStates.length).toBeGreaterThan(1);
      
      // Check that game time advanced
      if (gameStates.length >= 2) {
        expect(gameStates[0].gameTime).toBeGreaterThan(gameStates[1].gameTime);
      }
    });

    test('should create time advancement events', async () => {
      // Wait for processing cycle
      await new Promise(resolve => setTimeout(resolve, 1100));

      const events = await GameEvent.find({ 
        gameId: testGameId,
        eventType: 'game_message',
        'eventData.message': 'Game time advanced'
      });

      expect(events.length).toBeGreaterThan(0);
    });

    test('should stop continuous processing when requested', async () => {
      // Stop processing
      RealtimeGameController.stopContinuousProcessing(testGameId);

      // Count current game states
      const statesBefore = await GameState.countDocuments({ gameId: testGameId });

      // Wait for what would be a processing cycle
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Count states again - should not have increased significantly
      const statesAfter = await GameState.countDocuments({ gameId: testGameId });
      expect(statesAfter - statesBefore).toBeLessThan(2);
    });
  });

  describe('Game State Management', () => {
    beforeEach(async () => {
      await RealtimeGameController.initializeRealtimeGame(testGameId);
    });

    test('should retrieve current game state', async () => {
      const gameState = await RealtimeGameController.getCurrentGameState(testGameId);
      
      expect(gameState).toBeDefined();
      expect(gameState.planets).toBeDefined();
      expect(gameState.players).toBeDefined();
      expect(gameState.gameSettings).toBeDefined();
    });

    test('should cache game state for performance', async () => {
      // First call should load from database
      const state1 = await RealtimeGameController.getCurrentGameState(testGameId);
      
      // Second call should use cache
      const state2 = await RealtimeGameController.getCurrentGameState(testGameId);
      
      expect(state1).toEqual(state2);
    });

    test('should update cached state after actions', async () => {
      const initialState = await RealtimeGameController.getCurrentGameState(testGameId);
      const initialOre = initialState.planets.planet1.resources.ore;

      await RealtimeGameController.processPlayerAction(
        testGameId,
        'player1',
        'build_structure',
        {
          planetId: 'planet1',
          buildingType: 'mine',
          quantity: 1
        }
      );

      const updatedState = await RealtimeGameController.getCurrentGameState(testGameId);
      const updatedOre = updatedState.planets.planet1.resources.ore;

      // Ore should have decreased due to building cost
      expect(updatedOre).toBeLessThan(initialOre);
    });
  });
});