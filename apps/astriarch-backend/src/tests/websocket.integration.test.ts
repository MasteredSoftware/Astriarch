import WebSocket from 'ws';
import { WebSocketServer } from '../websocket/WebSocketServer';
import { RealtimeGameController } from '../controllers/RealtimeGameController';
import { GameController } from '../controllers/GameController';
import { connectDatabase } from '../database/connection';
import { Game, GameState, PlayerAction, GameEvent, RealtimeConnection } from '../models';
import { logger } from '../utils/logger';
import http from 'http';

describe('WebSocket Integration Tests', () => {
  let server: http.Server;
  let wsServer: WebSocketServer;
  let testGameId: string;
  let wsClient1: WebSocket;
  let wsClient2: WebSocket;

  beforeAll(async () => {
    // Connect to test database
    await connectDatabase();
    
    // Create HTTP server
    server = http.createServer();
    wsServer = new WebSocketServer(server);
    
    // Start server
    server.listen(0); // Use random available port
    const address = server.address() as any;
    const port = address?.port || 8001;
    
    // Create a test game
    const game = await GameController.createGame('TestPlayer1', {
      maxPlayers: 2,
      gameType: 'test',
      isPrivate: false
    });
    testGameId = game._id.toString();
    
    // Initialize clients
    wsClient1 = new WebSocket(`ws://localhost:${port}`);
    wsClient2 = new WebSocket(`ws://localhost:${port}`);
    
    // Wait for connections
    await Promise.all([
      new Promise(resolve => wsClient1.on('open', resolve)),
      new Promise(resolve => wsClient2.on('open', resolve))
    ]);
  });

  afterAll(async () => {
    // Clean up
    wsClient1?.close();
    wsClient2?.close();
    server?.close();
    
    // Clean up test data
    await Game.deleteOne({ _id: testGameId });
    await GameState.deleteMany({ gameId: testGameId });
    await PlayerAction.deleteMany({ gameId: testGameId });
    await GameEvent.deleteMany({ gameId: testGameId });
    await RealtimeConnection.deleteMany({ gameId: testGameId });
  });

  describe('Player Connection Flow', () => {
    test('should handle player joining game', (done) => {
      let messagesReceived = 0;
      const expectedMessages = 2; // connection_established + game_joined

      wsClient1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        logger.info('Client1 received:', message.type);
        
        messagesReceived++;
        
        if (message.type === 'connection_established') {
          // Send join game message
          wsClient1.send(JSON.stringify({
            type: 'join_game',
            data: {
              gameId: testGameId,
              playerName: 'TestPlayer1'
            }
          }));
        } else if (message.type === 'game_joined') {
          expect(message.data.gameId).toBe(testGameId);
          expect(message.data.gameState).toBeDefined();
        }
        
        if (messagesReceived >= expectedMessages) {
          done();
        }
      });
    });

    test('should track realtime connections', async () => {
      // Wait a bit for the connection to be saved
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const connections = await RealtimeConnection.find({ gameId: testGameId });
      expect(connections.length).toBeGreaterThan(0);
      
      const connection = connections[0];
      expect(connection.gameId).toBe(testGameId);
      expect(connection.playerName).toBe('TestPlayer1');
      expect(connection.connectionState).toBe('connected');
    });
  });

  describe('Game Action Processing', () => {
    test('should process build structure action', (done) => {
      wsClient1.send(JSON.stringify({
        type: 'game_action',
        data: {
          actionType: 'build_structure',
          actionData: {
            planetId: 'test_planet_1',
            buildingType: 'farm',
            quantity: 1
          }
        }
      }));

      wsClient1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'game_action_result') {
          expect(message.data.success).toBeDefined();
          expect(message.data.originalAction.actionType).toBe('build_structure');
          done();
        }
      });
    });

    test('should process send fleet action', (done) => {
      wsClient1.send(JSON.stringify({
        type: 'game_action',
        data: {
          actionType: 'send_fleet',
          actionData: {
            fromPlanetId: 'test_planet_1',
            toPlanetId: 'test_planet_2',
            ships: {
              scouts: 5,
              destroyers: 2
            },
            orders: 'attack'
          }
        }
      }));

      wsClient1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'game_action_result') {
          expect(message.data.success).toBeDefined();
          expect(message.data.originalAction.actionType).toBe('send_fleet');
          done();
        }
      });
    });

    test('should store player actions in database', async () => {
      // Wait for action to be processed and stored
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const actions = await PlayerAction.find({ gameId: testGameId });
      expect(actions.length).toBeGreaterThan(0);
      
      const buildAction = actions.find(a => a.actionType === 'build_structure');
      expect(buildAction).toBeDefined();
      expect(buildAction?.processed).toBe(true);
    });
  });

  describe('Real-time Game State Synchronization', () => {
    test('should broadcast game state updates to all players', (done) => {
      let player1Updated = false;
      let player2Updated = false;

      // Join second player
      wsClient2.send(JSON.stringify({
        type: 'join_game',
        data: {
          gameId: testGameId,
          playerName: 'TestPlayer2'
        }
      }));

      const checkCompletion = () => {
        if (player1Updated && player2Updated) {
          done();
        }
      };

      wsClient1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_state_update') {
          player1Updated = true;
          checkCompletion();
        }
      });

      wsClient2.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'game_state_update' || message.type === 'player_joined') {
          player2Updated = true;
          checkCompletion();
        }
      });

      // Trigger a game action to generate state update
      setTimeout(() => {
        wsClient1.send(JSON.stringify({
          type: 'game_action',
          data: {
            actionType: 'research_upgrade',
            actionData: {
              researchType: 'attack',
              allocation: 50
            }
          }
        }));
      }, 100);
    });

    test('should handle continuous game processing', async () => {
      // Initialize realtime game processing
      await RealtimeGameController.initializeRealtimeGame(testGameId);
      
      // Wait for a processing cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check that game states are being saved
      const gameStates = await GameState.find({ gameId: testGameId }).sort({ timestamp: -1 });
      expect(gameStates.length).toBeGreaterThan(0);
      
      // Check that game events are being created
      const gameEvents = await GameEvent.find({ gameId: testGameId });
      expect(gameEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid game actions gracefully', (done) => {
      wsClient1.send(JSON.stringify({
        type: 'game_action',
        data: {
          actionType: 'invalid_action',
          actionData: {}
        }
      }));

      wsClient1.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'game_action_result') {
          expect(message.data.success).toBe(false);
          expect(message.data.message).toContain('Unknown action type');
          done();
        }
      });
    });

    test('should handle connection drops gracefully', async () => {
      // Close one client
      wsClient2.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check connection status updated
      const connection = await RealtimeConnection.findOne({ 
        gameId: testGameId, 
        playerName: 'TestPlayer2' 
      });
      
      if (connection) {
        expect(connection.connectionState).toBe('disconnected');
        expect(connection.disconnectedAt).toBeDefined();
      }
    });
  });
});