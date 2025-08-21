import WebSocket from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger';
import { Session, Game, IGame } from '../models';
import { GameController } from '../controllers/GameControllerWebSocket';
import { v4 as uuidv4 } from 'uuid';
import { 
  MESSAGE_TYPE, 
  Message, 
  getMessageTypeName, 
  ERROR_TYPE, 
  CHAT_MESSAGE_TYPE,
  type IMessage,
  // Import available type guards
  isCreateGameRequest,
  isJoinGameRequest,
  isStartGameRequest,
  isListGamesResponse,
  isGameStateUpdate,
  isErrorMessage,
  // Import available payload types
  type ICreateGameRequestPayload,
  type IJoinGameRequestPayload,
  type IStartGameRequestPayload,
  type IChangeGameOptionsPayload,
  constructClientGameModel
} from 'astriarch-engine';
import { getPlayerId } from '../utils/player-id-helper';

export interface IConnectedClient {
  ws: WebSocket;
  sessionId: string;
  gameId?: string;
  playerId?: string;
  playerName?: string;
  lastPing: Date;
  upgradeReq?: any; // For backward compatibility with cookie parsing
}

export class WebSocketServer {
  private static instance: WebSocketServer;
  private wss: WebSocket.Server;
  private clients: Map<string, IConnectedClient> = new Map();
  private sessionLookup: Map<string, string> = new Map(); // sessionId -> clientId mapping
  private gameRooms: Map<string, Set<string>> = new Map(); // gameId -> sessionIds
  private chatRooms: Map<string, Set<string>> = new Map(); // gameId -> sessionIds (null for lobby)
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
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientId = uuidv4();
      const sessionId = this.extractSessionId(req) || clientId;
      
      logger.info(`New WebSocket connection established. SessionId: ${sessionId}`);

      const client: IConnectedClient = {
        ws,
        sessionId,
        lastPing: new Date(),
        upgradeReq: req // Store for cookie parsing compatibility
      };

      this.clients.set(clientId, client);
      this.sessionLookup.set(sessionId, clientId);

      ws.on('message', (data: string) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', () => {
        this.handleDisconnection(clientId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for session ${sessionId}:`, error);
        this.handleDisconnection(clientId);
      });
    });
  }

  private extractSessionId(req: any): string | null {
    // Extract session ID from cookies similar to old app.js
    try {
      if (req.headers.cookie) {
        const cookies = req.headers.cookie.split(';').reduce((acc: any, cookie: string) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        
        // Look for connect.sid cookie (matches old implementation)
        return cookies['connect.sid'] || null;
      }
    } catch (error) {
      logger.warn('Error extracting session ID:', error);
    }
    return null;
  }

  private async handleMessage(clientId: string, data: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      logger.warn(`Received message from unknown client: ${clientId}`);
      return;
    }

    try {
      // Touch session (like old app.js)
      await this.touchSession(client.sessionId);

      const parsedMessage = JSON.parse(data);
      const message: IMessage<unknown> = {
        type: parsedMessage.type,
        payload: parsedMessage.payload || {},
        sessionId: client.sessionId,
        timestamp: new Date()
      };
      
      logger.info(`${getMessageTypeName(message.type)} Message received from ${client.sessionId}:`, data);

      // Update last ping
      client.lastPing = new Date();

      await this.processMessage(client, message);
    } catch (error) {
      logger.error(`Error parsing message from ${client.sessionId}:`, data, error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Invalid message format' }));
    }
  }

  private async processMessage(client: IConnectedClient, message: IMessage<unknown>): Promise<void> {
    const clientId = this.getClientIdBySessionId(client.sessionId);
    if (!clientId) return;

    switch (message.type) {
      case MESSAGE_TYPE.NOOP:
        // Echo back with server message (like old app.js)
        const counter = typeof message.payload === 'object' && message.payload !== null && 'counter' in message.payload 
          ? (message.payload as any).counter : 0;
        const response = {
          ...(message.payload as object),
          message: 'Hello From the Server',
          counter: counter + 1
        };
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.NOOP, response));
        break;

      case MESSAGE_TYPE.PING:
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.PONG, {}));
        break;

      case MESSAGE_TYPE.LIST_GAMES:
        await this.handleListGames(clientId, message);
        break;

      case MESSAGE_TYPE.CREATE_GAME:
        if (!isCreateGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Invalid create game request' }));
          return;
        }
        await this.handleCreateGame(clientId, message);
        break;

      case MESSAGE_TYPE.JOIN_GAME:
        if (!isJoinGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Invalid join game request' }));
          return;
        }
        await this.handleJoinGame(clientId, message);
        break;

      case MESSAGE_TYPE.START_GAME:
        if (!isStartGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Invalid start game request' }));
          return;
        }
        await this.handleStartGame(clientId, message);
        break;

      case MESSAGE_TYPE.RESUME_GAME:
        await this.handleResumeGame(clientId, message);
        break;

      case MESSAGE_TYPE.CHANGE_GAME_OPTIONS:
        await this.handleChangeGameOptions(clientId, message);
        break;

      case MESSAGE_TYPE.CHANGE_PLAYER_NAME:
        await this.handleChangePlayerName(clientId, message);
        break;

      case MESSAGE_TYPE.END_TURN:
        await this.handleEndTurn(clientId, message);
        break;

      case MESSAGE_TYPE.SEND_SHIPS:
        await this.handleSendShips(clientId, message);
        break;

      case MESSAGE_TYPE.UPDATE_PLANET_START:
        await this.handleUpdatePlanetStart(clientId, message);
        break;

      case MESSAGE_TYPE.UPDATE_PLANET_OPTIONS:
        await this.handleUpdatePlanetOptions(clientId, message);
        break;

      case MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE:
        await this.handleUpdatePlanetBuildQueue(clientId, message);
        break;

      case MESSAGE_TYPE.CLEAR_WAYPOINT:
        await this.handleClearWaypoint(clientId, message);
        break;

      case MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT:
        await this.handleAdjustResearchPercent(clientId, message);
        break;

      case MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM:
        await this.handleSubmitResearchItem(clientId, message);
        break;

      case MESSAGE_TYPE.CANCEL_RESEARCH_ITEM:
        await this.handleCancelResearchItem(clientId, message);
        break;

      case MESSAGE_TYPE.SUBMIT_TRADE:
        await this.handleSubmitTrade(clientId, message);
        break;

      case MESSAGE_TYPE.CANCEL_TRADE:
        await this.handleCancelTrade(clientId, message);
        break;

      case MESSAGE_TYPE.CHAT_MESSAGE:
        await this.handleChatMessage(clientId, message);
        break;

      case MESSAGE_TYPE.EXIT_RESIGN:
        await this.handleExitResign(clientId, message);
        break;

      case MESSAGE_TYPE.LOGOUT:
        await this.handleLogout(clientId, message);
        break;

      default:
        logger.error(`Unhandled Message Type: ${message.type}`);
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Unknown message type' }));
        break;
    }
  }

  // Helper methods
  private async touchSession(sessionId: string): Promise<void> {
    try {
      await Session.findOneAndUpdate(
        { sessionId },
        { lastActivity: new Date() },
        { upsert: true }
      );
    } catch (error) {
      logger.error('TouchSession Error:', error);
    }
  }

  private getClientIdBySessionId(sessionId: string): string | null {
    return this.sessionLookup.get(sessionId) || null;
  }

  private sendToClient(clientId: string, message: Message<any>): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error(`Error sending message to ${clientId}:`, error);
    }
  }

  // Message handlers - Basic game management
  private async handleListGames(clientId: string, message: IMessage<unknown>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const games = await GameController.listLobbyGames({ sessionId: client.sessionId });
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.LIST_GAMES, { games }));
    } catch (error) {
      logger.error('Error listing games:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Failed to list games' }));
    }
  }

  private async handleCreateGame(clientId: string, message: IMessage<ICreateGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { name, playerName } = message.payload;
      
      if (!name || !playerName) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Game name and player name are required' }));
        return;
      }

      const gameData = {
        name,
        players: [{
          name: playerName.substring(0, 20),
          sessionId: client.sessionId,
          position: 0
        }]
      };

      const game = await GameController.createGame(gameData);
      
      // Add client to game room
      client.gameId = game._id.toString();
      client.playerName = playerName;
      client.playerId = `player_0`;

      if (!this.gameRooms.has(game._id.toString())) {
        this.gameRooms.set(game._id.toString(), new Set());
      }
      this.gameRooms.get(game._id.toString())!.add(client.sessionId);

      // Send success response with game options to trigger view transition
      const createResponse = {
        gameId: game._id,
        gameOptions: game.gameOptions,
        name: game.name,
        playerPosition: 0
      };

      this.sendToClient(clientId, new Message(MESSAGE_TYPE.CREATE_GAME, createResponse));

      // Update lobby players about new game
      await this.sendUpdatedGameListToLobbyPlayers(game);
    } catch (error) {
      logger.error('Error creating game:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Failed to create game' }));
    }
  }

  private async handleJoinGame(clientId: string, message: IMessage<IJoinGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { gameId, playerName } = message.payload;
      
      if (!gameId || !playerName) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Game ID and player name are required' }));
        return;
      }

      const result = await GameController.joinGame({
        gameId,
        sessionId: client.sessionId,
        playerName: playerName.substring(0, 20)
      });

      if (result.success && result.game) {
        const joinResponse = {
          gameOptions: result.game.gameOptions,
          name: result.game.name,
          playerPosition: result.playerPosition,
          _id: result.game._id
        };

        this.sendToClient(clientId, new Message(MESSAGE_TYPE.JOIN_GAME, joinResponse));

        // Update client info
        client.gameId = gameId;
        client.playerName = playerName;
        client.playerId = result.playerId;

        // Add to game room
        if (!this.gameRooms.has(gameId)) {
          this.gameRooms.set(gameId, new Set());
        }
        this.gameRooms.get(gameId)!.add(client.sessionId);

        // Broadcast to other players
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, 
          new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, joinResponse));

        // Update lobby
        await this.sendUpdatedGameListToLobbyPlayers(result.game);
      } else {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error || 'Failed to join game' }));
      }
    } catch (error) {
      logger.error('Error joining game:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Failed to join game' }));
    }
  }

  private async handleStartGame(clientId: string, message: IMessage<IStartGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Get gameId from payload
      const gameId = message.payload.gameId;
      
      if (!gameId) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Game ID is required' }));
        return;
      }

      const result = await GameController.startGame({
        sessionId: client.sessionId,
        gameId
      });

      if (result.success && result.game) {
        const playerId = getPlayerId(0);
        const clientGameModel = constructClientGameModel(result.game.gameState, playerId);
        // Send success response with game state
        const startResponse = {
          success: true,
          gameState: clientGameModel
        };

        this.sendToClient(clientId, new Message(MESSAGE_TYPE.START_GAME, startResponse));


        // TODO: Send client models to each player (like old app.js)
        // for (const player of result.game.players) {
        //   const serializableClientModel = this.getSerializableClientModelFromSerializableModelForPlayer(
        //     result.serializableModel,
        //     player.Id
        //   );
        //   
        //   const startMessage = new Message(MESSAGE_TYPE.START_GAME, serializableClientModel);
        //   this.broadcastToSession(player.sessionId, startMessage);
        // }
      } else {
        const errorResponse = {
          success: false,
          error: result.error || 'Failed to start game'
        };
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.START_GAME, errorResponse));
      }
    } catch (error) {
      logger.error('Error starting game:', error);
      const errorResponse = {
        success: false,
        error: 'Failed to start game'
      };
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, errorResponse));
    }
  }

  private async handleResumeGame(clientId: string, message: IMessage<unknown>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const payload = message.payload as any;
      const gameId = payload.gameId;
      
      if (typeof gameId !== 'string') {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Game ID is required' }));
        return;
      }

      const result = await GameController.resumeGame({
        sessionId: client.sessionId,
        gameId
      });

      if (result.success && result.gameData && result.player) {
        const serializableClientModel = this.getSerializableClientModelFromSerializableModelForPlayer(
          result.gameData,
          result.player.Id
        );

        this.sendToClient(clientId, new Message(MESSAGE_TYPE.RESUME_GAME, {
          gameData: serializableClientModel,
          playerPosition: result.player.position
        }));
      } else {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { 
          message: result.error || 'Unable to find Game to Resume' 
        }));
      }
    } catch (error) {
      logger.error('Error resuming game:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Failed to resume game' }));
    }
  }

  // Placeholder handlers for game actions (to be implemented)
  private async handleChangeGameOptions(clientId: string, message: IMessage<IChangeGameOptionsPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { gameId, gameOptions, playerName } = message.payload;
      
      if (!gameId || !gameOptions) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Game ID and game options are required' }));
        return;
      }

      const result = await GameController.updateGameOptions({
        sessionId: client.sessionId,
        gameId,
        gameOptions,
        playerName
      });

      if (result.success && result.game) {
        const optionsResponse = {
          gameOptions: result.game.gameOptions,
          name: result.game.name,
          gameId: result.game._id
        };

        // Send success response to the player who changed options
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse));

        // Broadcast to other players in the game
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, 
          new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse));

        // Update lobby players about game changes
        await this.sendUpdatedGameListToLobbyPlayers(result.game);
      } else {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error || 'Failed to update game options' }));
      }
    } catch (error) {
      logger.error('Error changing game options:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Failed to update game options' }));
    }
  }

  private async handleChangePlayerName(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.changePlayerName
    logger.warn('handleChangePlayerName not yet implemented');
  }

  private async handleEndTurn(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.endPlayerTurn(client.sessionId, message.payload);
      
      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send response back to the client
      const response = new Message(MESSAGE_TYPE.END_TURN, {
        allPlayersFinished: result.allPlayersFinished,
        endOfTurnMessages: result.endOfTurnMessages,
        destroyedClientPlayers: result.destroyedClientPlayers
      });

      this.sendToClient(clientId, response);

      // If game has other players, broadcast to them too
      if (result.game && result.game.players) {
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, response);
      }

    } catch (error) {
      logger.error('handleEndTurn error:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'End turn failed' }));
    }
  }

  private async handleSendShips(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.sendShips(client.sessionId, message.payload);
      
      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // If game has other players, broadcast the ship movement
      if (result.game && result.game.players) {
        const response = new Message(MESSAGE_TYPE.SEND_SHIPS, message.payload);
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, response);
      }

    } catch (error) {
      logger.error('handleSendShips error:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Send ships failed' }));
    }
  }

  private async handleUpdatePlanetStart(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.startUpdatePlanet
    logger.warn('handleUpdatePlanetStart not yet implemented');
  }

  private async handleUpdatePlanetOptions(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.updatePlanetOptions
    logger.warn('handleUpdatePlanetOptions not yet implemented');
  }

  private async handleUpdatePlanetBuildQueue(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.updatePlanetBuildQueue
    logger.warn('handleUpdatePlanetBuildQueue not yet implemented');
  }

  private async handleClearWaypoint(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.clearWaypoint(client.sessionId, message.payload);
      
      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // If game has other players, broadcast the waypoint clearing
      if (result.game && result.game.players) {
        const response = new Message(MESSAGE_TYPE.CLEAR_WAYPOINT, message.payload);
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, response);
      }

    } catch (error) {
      logger.error('handleClearWaypoint error:', error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: 'Clear waypoint failed' }));
    }
  }

  private async handleAdjustResearchPercent(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.adjustResearchPercent
    logger.warn('handleAdjustResearchPercent not yet implemented');
  }

  private async handleSubmitResearchItem(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.submitResearchItem
    logger.warn('handleSubmitResearchItem not yet implemented');
  }

  private async handleCancelResearchItem(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.cancelResearchItem
    logger.warn('handleCancelResearchItem not yet implemented');
  }

  private async handleSubmitTrade(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.submitTrade
    logger.warn('handleSubmitTrade not yet implemented');
  }

  private async handleCancelTrade(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.cancelTrade
    logger.warn('handleCancelTrade not yet implemented');
  }

  private async handleChatMessage(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement chat system like old app.js
    logger.warn('handleChatMessage not yet implemented');
  }

  private async handleExitResign(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.exitResign
    logger.warn('handleExitResign not yet implemented');
  }

  private async handleLogout(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement logout
    logger.warn('handleLogout not yet implemented');
  }

  // Helper methods for game management
  private async sendUpdatedGameListToLobbyPlayers(gameDoc: any): Promise<void> {
    logger.debug('sendUpdatedGameListToLobbyPlayers for game:', gameDoc._id);
    
    try {
      // Get the complete updated games list instead of just the single game
      const games = await GameController.listLobbyGames({ sessionId: 'system' });
      const messageForPlayers = new Message(MESSAGE_TYPE.GAME_LIST_UPDATED, { games });
      
      const chatRoom = await GameController.getChatRoomWithSessions(null);
      if (chatRoom) {
        for (const session of chatRoom.sessions) {
          this.broadcastToSession(session.sessionId, messageForPlayers);
        }
      }
    } catch (error) {
      logger.error('sendUpdatedGameListToLobbyPlayers error:', error);
    }
  }

  private broadcastToOtherPlayersInGame(game: IGame, sessionId: string, message: Message<any>): void {
    const playersBySessionKey = this.getOtherPlayersBySessionKeyFromGame(game, sessionId);
    this.broadcast(playersBySessionKey, message);
  }

  private getOtherPlayersBySessionKeyFromGame(game: IGame, currentPlayerSessionKey: string | null): Record<string, any> {
    const playersBySessionKey: Record<string, any> = {};
    for (const player of game.players) {
      if (player.sessionId && player.sessionId !== currentPlayerSessionKey) {
        playersBySessionKey[player.sessionId] = player;
      }
    }
    return playersBySessionKey;
  }

  // Client model creation (like old app.js)
  private getSerializableClientModelFromSerializableModelForPlayer(serializableModel: any, targetPlayerId: string): any {
    // TODO: Implement client model filtering based on old app.js logic
    // This should filter the full game model to only show what the specific player should see
    logger.warn('getSerializableClientModelFromSerializableModelForPlayer not yet implemented');
    return serializableModel; // Temporary return full model
  }

  // Broadcasting methods (like old app.js)
  public broadcast(playersBySessionKey: Record<string, any>, message: Message<any>): void {
    const data = JSON.stringify(message);
    for (const [sessionId, clientId] of this.sessionLookup.entries()) {
      if (sessionId in playersBySessionKey) {
        const client = this.clients.get(clientId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(data);
        }
      }
    }
  }

  public broadcastToSession(playerSessionKey: string, message: Message<any>): void {
    const data = JSON.stringify(message);
    const clientId = this.sessionLookup.get(playerSessionKey);
    if (clientId) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  // Connection management
  private async handleDisconnection(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Update session status  
      await Session.findOneAndUpdate(
        { sessionId: client.sessionId },
        { connectionStatus: 'disconnected' }
      );

      // Remove from game room if in one
      if (client.gameId) {
        const gameRoom = this.gameRooms.get(client.gameId);
        if (gameRoom) {
          gameRoom.delete(client.sessionId);
          if (gameRoom.size === 0) {
            this.gameRooms.delete(client.gameId);
          }
        }

        // TODO: Handle chat room leaving like old app.js
      }

      this.clients.delete(clientId);
      this.sessionLookup.delete(client.sessionId);
      logger.info(`Session ${client.sessionId} disconnected`);
    } catch (error) {
      logger.error('Error handling disconnection:', error);
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = new Date();
      const timeout = 30000; // 30 seconds

      for (const [clientId, client] of this.clients.entries()) {
        if (now.getTime() - client.lastPing.getTime() > timeout) {
          logger.warn(`Session ${client.sessionId} timed out`);
          this.handleDisconnection(clientId);
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
