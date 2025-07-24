import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { Session, Game, RealtimeConnection } from '../models';
import { RealtimeGameController } from '../controllers/RealtimeGameController';
import { v4 as uuidv4 } from 'uuid';

export interface IWebSocketMessage {
  type: string;
  data: any;
  sessionId?: string;
  gameId?: string;
}

export interface IConnectedClient {
  ws: WebSocket;
  sessionId: string;
  gameId?: string;
  playerName?: string;
  lastPing: Date;
}

export class WebSocketServer {
  private static instance: WebSocketServer;
  private wss: WebSocket.Server;
  private clients: Map<string, IConnectedClient> = new Map();
  private gameRooms: Map<string, Set<string>> = new Map(); // gameId -> sessionIds
  private pingInterval?: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ server });
    this.setupWebSocketServer();
    this.startPingInterval();
    WebSocketServer.instance = this;
  }

  public static getInstance(): WebSocketServer | null {
    return WebSocketServer.instance || null;
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const sessionId = uuidv4();
      logger.info(`New WebSocket connection established: ${sessionId}`);

      const client: IConnectedClient = {
        ws,
        sessionId,
        lastPing: new Date()
      };

      this.clients.set(sessionId, client);

      // Send initial connection message
      this.sendToClient(sessionId, {
        type: 'connection_established',
        data: { sessionId }
      });

      ws.on('message', (message: string) => {
        this.handleMessage(sessionId, message);
      });

      ws.on('close', () => {
        this.handleDisconnection(sessionId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for session ${sessionId}:`, error);
        this.handleDisconnection(sessionId);
      });
    });
  }

  private async handleMessage(sessionId: string, message: string): Promise<void> {
    try {
      const parsedMessage: IWebSocketMessage = JSON.parse(message);
      const client = this.clients.get(sessionId);

      if (!client) {
        logger.warn(`Received message from unknown session: ${sessionId}`);
        return;
      }

      // Update last ping
      client.lastPing = new Date();

      logger.debug(`Received message from ${sessionId}:`, parsedMessage);

      switch (parsedMessage.type) {
        case 'join_game':
          await this.handleJoinGame(sessionId, parsedMessage.data);
          break;
        case 'leave_game':
          await this.handleLeaveGame(sessionId);
          break;
        case 'chat_message':
          await this.handleChatMessage(sessionId, parsedMessage.data);
          break;
        case 'game_action':
          await this.handleGameAction(sessionId, parsedMessage.data);
          break;
        case 'ping':
          this.sendToClient(sessionId, { type: 'pong', data: {} });
          break;
        default:
          logger.warn(`Unknown message type: ${parsedMessage.type}`);
      }
    } catch (error) {
      logger.error(`Error handling message from ${sessionId}:`, error);
      this.sendToClient(sessionId, {
        type: 'error',
        data: { message: 'Invalid message format' }
      });
    }
  }

  private async handleJoinGame(sessionId: string, data: { gameId: string; playerName: string }): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client) return;

    try {
      // Verify game exists
      const game = await Game.findById(data.gameId);
      if (!game) {
        this.sendToClient(sessionId, {
          type: 'error',
          data: { message: 'Game not found' }
        });
        return;
      }

      // Update client info
      client.gameId = data.gameId;
      client.playerName = data.playerName;

      // Add to game room
      if (!this.gameRooms.has(data.gameId)) {
        this.gameRooms.set(data.gameId, new Set());
      }
      this.gameRooms.get(data.gameId)!.add(sessionId);

      // Create/update realtime connection tracking
      await RealtimeConnection.findOneAndUpdate(
        { sessionId },
        {
          gameId: data.gameId,
          sessionId,
          playerId: data.playerName, // TODO: Use proper player ID
          playerName: data.playerName,
          connectionState: 'connected',
          websocketId: sessionId,
          connectedAt: new Date(),
          lastActivity: new Date(),
          reconnectAttempts: 0,
          clientInfo: {
            userAgent: 'WebSocket Client', // TODO: Get from headers
            version: '2.0.0'
          },
          gameSync: {
            lastSyncTime: new Date(),
            syncVersion: '2.0.0',
            pendingActions: 0
          },
          performance: {
            latency: 0,
            packetsLost: 0,
            reconnects: 0
          }
        },
        { upsert: true, new: true }
      );

      // Create/update legacy session for compatibility
      await Session.findOneAndUpdate(
        { sessionId },
        {
          sessionId,
          gameId: data.gameId,
          playerName: data.playerName,
          connectionStatus: 'connected',
          lastPing: new Date()
        },
        { upsert: true, new: true }
      );

      // Initialize realtime game processing if not already started
      try {
        await RealtimeGameController.initializeRealtimeGame(data.gameId);
      } catch (error) {
        logger.warn(`Game ${data.gameId} already initialized or failed to initialize:`, error);
      }

      // Notify game room of new player
      this.broadcastToGame(data.gameId, {
        type: 'player_joined',
        data: { playerName: data.playerName }
      }, sessionId);

      // Get current game state from RealtimeGameController
      const currentGameState = await RealtimeGameController.getCurrentGameState(data.gameId);
      
      this.sendToClient(sessionId, {
        type: 'game_joined',
        data: { 
          gameId: data.gameId, 
          gameState: currentGameState || game.gameState // Fallback to legacy if needed
        }
      });

      logger.info(`Player ${data.playerName} joined game ${data.gameId} with session ${sessionId}`);
    } catch (error) {
      logger.error('Error handling join game:', error);
      this.sendToClient(sessionId, {
        type: 'error',
        data: { message: 'Failed to join game' }
      });
    }
  }

  private async handleLeaveGame(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client || !client.gameId) return;

    try {
      // Remove from game room
      const gameRoom = this.gameRooms.get(client.gameId);
      if (gameRoom) {
        gameRoom.delete(sessionId);
        if (gameRoom.size === 0) {
          this.gameRooms.delete(client.gameId);
        }
      }

      // Update legacy session status  
      await Session.findOneAndUpdate(
        { sessionId },
        { connectionStatus: 'disconnected' }
      );

      // Notify game room
      this.broadcastToGame(client.gameId, {
        type: 'player_left',
        data: { playerName: client.playerName }
      }, sessionId);

      logger.info(`Player ${client.playerName} left game ${client.gameId}`);

      // Clear client game info
      client.gameId = undefined;
      client.playerName = undefined;
    } catch (error) {
      logger.error('Error handling leave game:', error);
    }
  }

  private async handleChatMessage(sessionId: string, data: { message: string; messageType?: string }): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client || !client.gameId || !client.playerName) return;

    try {
      const chatMessage = {
        gameId: client.gameId,
        playerName: client.playerName,
        message: data.message,
        messageType: data.messageType || 'public',
        timestamp: new Date()
      };

      // Broadcast to game room
      this.broadcastToGame(client.gameId, {
        type: 'chat_message',
        data: chatMessage
      });

      logger.debug(`Chat message from ${client.playerName} in game ${client.gameId}: ${data.message}`);
    } catch (error) {
      logger.error('Error handling chat message:', error);
    }
  }

  private async handleGameAction(sessionId: string, data: any): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client || !client.gameId || !client.playerName) return;

    try {
      // Process action through RealtimeGameController
      const result = await RealtimeGameController.processPlayerAction(
        client.gameId,
        client.playerName, // TODO: Use proper player ID
        data.actionType || 'unknown_action',
        data.actionData || data
      );

      // Update connection activity
      await RealtimeConnection.findOneAndUpdate(
        { sessionId },
        { 
          lastActivity: new Date(),
          $inc: { 'gameSync.pendingActions': result.success ? 0 : 1 }
        }
      );

      // Send result back to the client
      this.sendToClient(sessionId, {
        type: 'game_action_result',
        data: {
          success: result.success,
          message: result.message,
          changes: result.changes,
          originalAction: data
        }
      });

      // Note: Game state broadcasts are handled by RealtimeGameController.processPlayerAction
      // No need to broadcast here as the controller handles real-time synchronization

      logger.debug(`Game action processed for ${client.playerName} in game ${client.gameId}:`, {
        action: data,
        result: result.success,
        message: result.message
      });
    } catch (error) {
      logger.error('Error handling game action:', error);
      
      // Send error response to client
      this.sendToClient(sessionId, {
        type: 'game_action_result',
        data: {
          success: false,
          message: 'Failed to process action',
          originalAction: data
        }
      });
    }
  }

  private async handleDisconnection(sessionId: string): Promise<void> {
    const client = this.clients.get(sessionId);
    if (!client) return;

    try {
      // Update legacy session status  
      await Session.findOneAndUpdate(
        { sessionId },
        { connectionStatus: 'disconnected' }
      );

      // Remove from game room if in one
      if (client.gameId) {
        const gameRoom = this.gameRooms.get(client.gameId);
        if (gameRoom) {
          gameRoom.delete(sessionId);
          if (gameRoom.size === 0) {
            this.gameRooms.delete(client.gameId);
          }
        }

        // Notify game room
        this.broadcastToGame(client.gameId, {
          type: 'player_disconnected',
          data: { playerName: client.playerName }
        }, sessionId);
      }

      this.clients.delete(sessionId);
      logger.info(`Session ${sessionId} disconnected`);
    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  private sendToClient(sessionId: string, message: IWebSocketMessage): void {
    const client = this.clients.get(sessionId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Error sending message to ${sessionId}:`, error);
    }
  }

  public broadcastToGame(gameId: string, message: IWebSocketMessage, excludeSessionId?: string): void {
    const gameRoom = this.gameRooms.get(gameId);
    if (!gameRoom) return;

    for (const sessionId of gameRoom) {
      if (excludeSessionId && sessionId === excludeSessionId) continue;
      this.sendToClient(sessionId, message);
    }
  }

  public broadcastGameUpdate(gameId: string, gameState: any): void {
    this.broadcastToGame(gameId, {
      type: 'game_state_update',
      data: { gameState }
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30 seconds

      for (const [sessionId, client] of this.clients.entries()) {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          logger.warn(`Session ${sessionId} timed out`);
          this.handleDisconnection(sessionId);
        }
      }
    }, 15000); // Check every 15 seconds
  }

  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.wss.close();
  }
}
