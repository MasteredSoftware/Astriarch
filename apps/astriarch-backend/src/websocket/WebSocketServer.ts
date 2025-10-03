import WebSocket from "ws";
import { Server } from "http";
import { logger } from "../utils/logger";
import { Session, Game, IGame } from "../models";
import { ChatMessageModel, IChatMessage } from "../models/ChatMessage";
import { GameController } from "../controllers/GameControllerWebSocket";
import { persistGame } from "../database/DocumentPersistence";
import { v4 as uuidv4 } from "uuid";
import {
  MESSAGE_TYPE,
  Message,
  getMessageTypeName,
  ERROR_TYPE,
  CHAT_MESSAGE_TYPE,
  type IMessage,
  type IEventNotificationsPayload,
  // Import available type guards
  isCreateGameRequest,
  isJoinGameRequest,
  isStartGameRequest,
  isListGamesResponse,
  isGameStateUpdate,
  isErrorMessage,
  isGameSpeedAdjustment,
  // Import available payload types
  type ICreateGameRequestPayload,
  type IJoinGameRequestPayload,
  type IStartGameRequestPayload,
  type IChangeGameOptionsPayload,
  type IChangePlayerNamePayload,
  type IGameSpeedAdjustmentPayload,
  constructClientGameModel,
  advanceGameModelTime,
  resetGameSnapshotTime,
  GameModel,
  GameSpeed,
  ModelData,
  Events,
  type EventNotification,
  type PlayerData,
  GameController as EngineGameController,
  AdvanceGameClockResult,
  GameEndConditions,
} from "astriarch-engine";
import { getPlayerId } from "../utils/player-id-helper";

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
  private eventSubscriptions: Set<string> = new Set(); // track active event subscriptions by playerId
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

  // Event subscription management
  private subscribeToPlayerEvents(playerId: string): void {
    if (this.eventSubscriptions.has(playerId)) {
      return; // Already subscribed
    }

    Events.subscribe(playerId, (subscriptionPlayerId: string, events: EventNotification[]) => {
      this.handlePlayerEvents(subscriptionPlayerId, events);
    });

    this.eventSubscriptions.add(playerId);
    logger.info(`Subscribed to events for player: ${playerId}`);
  }

  private handlePlayerEvents(playerId: string, events: EventNotification[]): void {
    if (events.length === 0) {
      return;
    }

    logger.info(`Received ${events.length} events for player ${playerId}`);

    // Find the client for this player
    let targetClient: IConnectedClient | null = null;
    for (const client of this.clients.values()) {
      if (client.playerId === playerId) {
        targetClient = client;
        break;
      }
    }

    if (!targetClient) {
      logger.warn(`No connected client found for player ${playerId} to send events`);
      return;
    }

    // Send events to the client
    const eventMessage = new Message<IEventNotificationsPayload>(MESSAGE_TYPE.EVENT_NOTIFICATIONS, {
      events,
    });

    this.broadcastToSession(targetClient.sessionId, eventMessage);
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket, req: any) => {
      const clientId = uuidv4();
      const sessionId = this.extractSessionId(req) || clientId;

      logger.info(`New WebSocket connection established. SessionId: ${sessionId}`);

      const client: IConnectedClient = {
        ws,
        sessionId,
        lastPing: new Date(),
        upgradeReq: req, // Store for cookie parsing compatibility
      };

      this.clients.set(clientId, client);
      this.sessionLookup.set(sessionId, clientId);

      ws.on("message", (data: string) => {
        this.handleMessage(clientId, data);
      });

      ws.on("close", () => {
        this.handleDisconnection(clientId);
      });

      ws.on("error", (error) => {
        logger.error(`WebSocket error for session ${sessionId}:`, error);
        this.handleDisconnection(clientId);
      });
    });
  }

  private extractSessionId(req: any): string | null {
    // Extract session ID from signed cookies similar to old app.js
    try {
      if (req.headers.cookie) {
        logger.info("Raw cookies received:", req.headers.cookie);

        const cookie = require("cookie");
        const signature = require("cookie-signature");
        const config = require("config");
        const cookieSecret = config.get("cookie.secret") as string;

        // Parse the cookies first
        const cookies = cookie.parse(req.headers.cookie);
        logger.info("Parsed cookies:", cookies);

        // Get the signed connect.sid cookie
        const signedSessionCookie = cookies["connect.sid"];
        if (signedSessionCookie) {
          logger.info("Signed cookie found:", signedSessionCookie);

          // Unsign the cookie using the same secret
          if (signedSessionCookie.startsWith("s:")) {
            try {
              const unsigned = signature.unsign(signedSessionCookie.slice(2), cookieSecret);
              logger.info("Unsigned session ID:", unsigned);
              return unsigned;
            } catch (error) {
              logger.warn("Failed to unsign cookie:", error);
            }
          }
        }

        logger.info("No valid signed session cookie found");
      } else {
        logger.info("No cookies in WebSocket request headers");
      }
    } catch (error) {
      logger.warn("Error extracting session ID:", error);
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
        timestamp: new Date(),
      };

      logger.info(`${getMessageTypeName(message.type)} Message received from ${client.sessionId}:`, data.toString());

      // Update last ping
      client.lastPing = new Date();

      await this.processMessage(client, message);
    } catch (error) {
      logger.error(`Error parsing message from ${client.sessionId}:`, data, error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Invalid message format" }));
    }
  }

  private async processMessage(client: IConnectedClient, message: IMessage<unknown>): Promise<void> {
    const clientId = this.getClientIdBySessionId(client.sessionId);
    if (!clientId) return;

    // If this is a sync request and the client is in an active game, advance game time
    if (this.isGameSyncRequired(message.type) && client.gameId) {
      await this.advanceGameTimeForSync(client.gameId);
    }

    switch (message.type) {
      case MESSAGE_TYPE.NOOP:
        // Echo back with server message (like old app.js)
        const counter =
          typeof message.payload === "object" && message.payload !== null && "counter" in message.payload
            ? (message.payload as any).counter
            : 0;
        const response = {
          ...(message.payload as object),
          message: "Hello From the Server",
          counter: counter + 1,
        };
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.NOOP, response));
        break;

      case MESSAGE_TYPE.PING:
        // Send back PONG with updated client game model if player is in an active game
        await this.handlePing(clientId);
        break;

      case MESSAGE_TYPE.LIST_GAMES:
        await this.handleListGames(clientId, message);
        break;

      case MESSAGE_TYPE.CREATE_GAME:
        if (!isCreateGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Invalid create game request" }));
          return;
        }
        await this.handleCreateGame(clientId, message);
        break;

      case MESSAGE_TYPE.JOIN_GAME:
        if (!isJoinGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Invalid join game request" }));
          return;
        }
        await this.handleJoinGame(clientId, message);
        break;

      case MESSAGE_TYPE.START_GAME:
        if (!isStartGameRequest(message)) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Invalid start game request" }));
          return;
        }
        await this.handleStartGame(clientId, message);
        break;

      case MESSAGE_TYPE.RESUME_GAME:
        await this.handleResumeGame(clientId, message);
        break;

      case MESSAGE_TYPE.CHANGE_GAME_OPTIONS:
        await this.handleChangeGameOptions(clientId, message as IMessage<IChangeGameOptionsPayload>);
        break;

      case MESSAGE_TYPE.CHANGE_PLAYER_NAME:
        await this.handleChangePlayerName(clientId, message as IMessage<IChangePlayerNamePayload>);
        break;

      case MESSAGE_TYPE.SYNC_STATE:
        await this.handleSyncState(clientId, message);
        break;

      case MESSAGE_TYPE.SEND_SHIPS:
        await this.handleSendShips(clientId, message);
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

      case MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT:
        await this.handleGameSpeedAdjustment(clientId, message as IMessage<IGameSpeedAdjustmentPayload>);
        break;

      case MESSAGE_TYPE.EXIT_RESIGN:
        await this.handleExitResign(clientId, message);
        break;

      case MESSAGE_TYPE.LOGOUT:
        await this.handleLogout(clientId, message);
        break;

      default:
        logger.error(`Unhandled Message Type: ${message.type}`);
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Unknown message type" }));
        break;
    }
  }

  // Helper methods
  private async touchSession(sessionId: string): Promise<void> {
    try {
      await Session.findOneAndUpdate({ sessionId }, { lastActivity: new Date() }, { upsert: true });
    } catch (error) {
      logger.error("TouchSession Error:", error);
    }
  }

  private getClientIdBySessionId(sessionId: string): string | null {
    return this.sessionLookup.get(sessionId) || null;
  }

  // Real-time game management methods
  private isGameSyncRequired(messageType: MESSAGE_TYPE): boolean {
    // Only sync game state when explicitly requested via SYNC_STATE
    // This allows the client (host) to control when game time advances
    return messageType === MESSAGE_TYPE.SYNC_STATE;
  }

  private async advanceGameTimeForSync(gameId: string): Promise<void> {
    try {
      const game = await Game.findById(gameId);
      if (!game || game.status !== "in_progress") {
        return;
      }

      // Use the engine's advanceGameModelTime function which handles time properly
      // This will advance game time and process any AI/computer player actions
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as ModelData);
      const result = advanceGameModelTime(gameModelData);

      // Update the game state in the database
      game.gameState = result.gameModel.modelData;

      // Check for destroyed players and game over conditions
      if (result.destroyedPlayers.length > 0 || result.gameEndConditions.gameEnded) {
        await this.handleGameOverConditions(gameId, result, game);
      }

      // Save the updated game state with automatic Mixed field handling
      await persistGame(game);

      // Broadcast the updated game state to all connected players
      await this.broadcastGameStateUpdate(gameId);
    } catch (error) {
      logger.error("Error advancing game time:", error);
    }
  }

  private async broadcastGameStateUpdate(gameId: string): Promise<void> {
    try {
      logger.info(`Broadcasting game state update for game: ${gameId}`);

      const game = await Game.findById(gameId);
      if (!game) {
        logger.warn(`Game ${gameId} not found for state update`);
        return;
      }

      const gameRoom = this.gameRooms.get(gameId);
      if (!gameRoom) {
        logger.warn(`No game room found for game: ${gameId}`);
        return;
      }

      logger.info(`Game room has ${gameRoom.size} sessions: ${Array.from(gameRoom)}`);

      // Send updated client models to each connected player
      for (const sessionId of gameRoom) {
        const clientId = this.getClientIdBySessionId(sessionId);
        const client = clientId ? this.clients.get(clientId) : null;

        logger.info(`Session ${sessionId}: clientId=${clientId}, client.playerId=${client?.playerId}`);

        if (client?.playerId && clientId) {
          const clientGameModel = constructClientGameModel(game.gameState as any, client.playerId);

          // Debug: Log build queue data for the first planet
          const firstPlanetId = Object.keys(clientGameModel.mainPlayerOwnedPlanets)[0];
          if (firstPlanetId) {
            const firstPlanet = (clientGameModel.mainPlayerOwnedPlanets as any)[firstPlanetId];
            logger.info(`Build queue for planet ${firstPlanetId}: ${JSON.stringify(firstPlanet.buildQueue)}`);
          }

          const updateMessage = new Message(MESSAGE_TYPE.GAME_STATE_UPDATE, {
            clientGameModel,
            currentCycle: (game.gameState as any).currentCycle || 0,
          });
          this.sendToClient(clientId, updateMessage);
          logger.info(`Sent game state update to session ${sessionId} with playerId ${client.playerId}`);
        } else {
          logger.warn(`Skipping session ${sessionId}: missing client or playerId`);
        }
      }
    } catch (error) {
      logger.error("Error broadcasting game state update:", error);
    }
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
      logger.error("Error listing games:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Failed to list games" }));
    }
  }

  private async handleCreateGame(clientId: string, message: IMessage<ICreateGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { name, playerName } = message.payload;

      if (!name || !playerName) {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: "Game name and player name are required" }),
        );
        return;
      }

      const gameData = {
        name,
        players: [
          {
            name: playerName.substring(0, 20),
            sessionId: client.sessionId,
            position: 0,
          },
        ],
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
        playerPosition: 0,
      };

      this.sendToClient(clientId, new Message(MESSAGE_TYPE.CREATE_GAME, createResponse));

      // Update lobby players about new game
      await this.sendUpdatedGameListToLobbyPlayers(game);
    } catch (error) {
      logger.error("Error creating game:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Failed to create game" }));
    }
  }

  private async handleJoinGame(clientId: string, message: IMessage<IJoinGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { gameId, playerName } = message.payload;

      if (!gameId || !playerName) {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: "Game ID and player name are required" }),
        );
        return;
      }

      const result = await GameController.joinGame({
        gameId,
        sessionId: client.sessionId,
        playerName: playerName.substring(0, 20),
      });

      if (result.success && result.game) {
        const joinResponse = {
          success: true,
          gameId: gameId,
          gameOptions: result.game.gameOptions,
          name: result.game.name,
          playerPosition: result.playerPosition,
          _id: result.game._id,
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
        this.broadcastToOtherPlayersInGame(
          result.game,
          client.sessionId,
          new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, joinResponse),
        );

        // Update lobby
        await this.sendUpdatedGameListToLobbyPlayers(result.game);

        // Send chat history to the newly joined player
        await this.sendChatHistory(clientId, gameId);
      } else {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.JOIN_GAME, {
            success: false,
            error: result.error || "Failed to join game",
          }),
        );
      }
    } catch (error) {
      logger.error("Error joining game:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.JOIN_GAME, {
          success: false,
          error: "Failed to join game",
        }),
      );
    }
  }

  private async handleStartGame(clientId: string, message: IMessage<IStartGameRequestPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      // Get gameId from payload
      const gameId = message.payload.gameId;

      if (!gameId) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Game ID is required" }));
        return;
      }

      const result = await GameController.startGame({
        sessionId: client.sessionId,
        gameId,
      });

      if (result.success && result.game) {
        const playerId = getPlayerId(0);
        const clientGameModel = constructClientGameModel(result.game.gameState as any, playerId);
        // Send success response with game state
        const startResponse = {
          success: true,
          gameState: clientGameModel,
        };

        this.sendToClient(clientId, new Message(MESSAGE_TYPE.START_GAME, startResponse));

        // Send client models to each player (like old app.js)
        if (result.game && result.game.players) {
          for (const player of result.game.players) {
            // Only send to human players (not AI)
            if (!player.isAI && player.sessionId) {
              // Update client info for this player
              const playerClientId = this.getClientIdBySessionId(player.sessionId);
              const playerClient = playerClientId ? this.clients.get(playerClientId) : null;

              if (playerClient) {
                playerClient.gameId = gameId;
                playerClient.playerId = getPlayerId(player.position || 0);

                // Subscribe to events for this player
                this.subscribeToPlayerEvents(playerClient.playerId);

                // Add to game room
                if (!this.gameRooms.has(gameId)) {
                  this.gameRooms.set(gameId, new Set());
                }
                this.gameRooms.get(gameId)!.add(player.sessionId);
              }

              // The game state might be a GameModelData object with a modelData property,
              // or it might be the ModelData directly. Handle both cases.
              let modelData: any;
              if (result.game.gameState && typeof result.game.gameState === "object") {
                modelData = (result.game.gameState as any).modelData || result.game.gameState;
              } else {
                logger.warn("Invalid game state structure, skipping client model construction");
                continue;
              }

              // Construct the client-specific game model for this player
              const clientGameModel = constructClientGameModel(modelData, player.Id);

              const startMessage = new Message(MESSAGE_TYPE.START_GAME, {
                success: true,
                gameState: clientGameModel,
              });

              this.broadcastToSession(player.sessionId, startMessage);
            }
          }
        }
      } else {
        const errorResponse = {
          success: false,
          error: result.error || "Failed to start game",
        };
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.START_GAME, errorResponse));
      }
    } catch (error) {
      logger.error("Error starting game:", error);
      const errorResponse = {
        success: false,
        error: "Failed to start game",
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

      if (typeof gameId !== "string") {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Game ID is required" }));
        return;
      }

      // Always check if all human players are connected before resuming any in-progress game
      const game = await Game.findById(gameId);
      if (game && game.status === "in_progress") {
        // Reset the snapshot time to prevent time jumps when resuming
        // This should happen for the first player to resume, not just when all are connected
        await this.resetGameSnapshotTime(game);

        const allHumansConnected = await this.areAllHumanPlayersConnected(game);
        // If not all humans are connected, we still allow the player to join
        // but the game will remain in a paused state
      }

      const result = await GameController.resumeGame({
        sessionId: client.sessionId,
        gameId,
      });

      if (result.success && result.gameData && result.player) {
        const clientGameModel = constructClientGameModel(result.gameData, result.player.Id);

        // Update client info for resumed game
        client.gameId = gameId;
        client.playerId = getPlayerId(result.player.position || 0);

        // Subscribe to events for this player
        this.subscribeToPlayerEvents(client.playerId);

        // Add to game room if not already there
        if (!this.gameRooms.has(gameId)) {
          this.gameRooms.set(gameId, new Set());
        }
        this.gameRooms.get(gameId)!.add(client.sessionId);

        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.RESUME_GAME, {
            clientGameModel,
            playerPosition: result.player.position,
          }),
        );

        // Send chat history to the resuming player
        await this.sendChatHistory(clientId, gameId);

        // Check if all human players are now connected after this player joined
        if (game && game.status === "in_progress") {
          const allHumansConnected = await this.areAllHumanPlayersConnected(game);
          const gameRoom = this.gameRooms.get(gameId);

          if (gameRoom) {
            if (allHumansConnected) {
              // All players are now connected - notify everyone that the game has resumed
              for (const sessionId of gameRoom) {
                const notifyClientId = this.getClientIdBySessionId(sessionId);
                if (notifyClientId && notifyClientId !== clientId) {
                  // Don't send to the player who just resumed
                  this.sendToClient(
                    notifyClientId,
                    new Message(MESSAGE_TYPE.GAME_RESUMED, {
                      gameId: gameId,
                    }),
                  );
                }
              }
            } else {
              // Still waiting for other players - notify this player the game is paused
              this.sendToClient(
                clientId,
                new Message(MESSAGE_TYPE.GAME_PAUSED, {
                  reason: "waiting_for_players",
                  gameId: gameId,
                }),
              );
            }
          }
        }
      } else {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, {
            message: result.error || "Unable to find Game to Resume",
          }),
        );
      }
    } catch (error) {
      logger.error("Error resuming game:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Failed to resume game" }));
    }
  }

  private async handleChangeGameOptions(clientId: string, message: IMessage<IChangeGameOptionsPayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { gameId, gameOptions, playerName } = message.payload;

      if (!gameId || !gameOptions) {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: "Game ID and game options are required" }),
        );
        return;
      }

      const result = await GameController.updateGameOptions({
        sessionId: client.sessionId,
        gameId,
        gameOptions,
        playerName,
      });

      if (result.success && result.game) {
        const optionsResponse = {
          gameOptions: result.game.gameOptions,
          name: result.game.name,
          gameId: result.game._id,
        };

        // Send success response to the player who changed options
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse));

        // Broadcast to other players in the game
        this.broadcastToOtherPlayersInGame(
          result.game,
          client.sessionId,
          new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse),
        );

        // Update lobby players about game changes
        await this.sendUpdatedGameListToLobbyPlayers(result.game);
      } else {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: result.error || "Failed to update game options" }),
        );
      }
    } catch (error) {
      logger.error("Error changing game options:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Failed to update game options" }));
    }
  }

  private async handleChangePlayerName(clientId: string, message: IMessage<IChangePlayerNamePayload>): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { gameId, playerName } = message.payload;

      if (!gameId || !playerName) {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: "Game ID and player name are required" }),
        );
        return;
      }

      const result = await GameController.changePlayerName({
        sessionId: client.sessionId,
        gameId,
        playerName,
      });

      if (result.success && result.game) {
        const optionsResponse = {
          gameOptions: result.game.gameOptions,
          name: result.game.name,
          gameId: result.game._id,
        };

        // Send success response to the player who changed their name
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse));

        // Broadcast to other players in the game (following old game pattern)
        this.broadcastToOtherPlayersInGame(
          result.game,
          client.sessionId,
          new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, optionsResponse),
        );

        // Update lobby players about game changes
        await this.sendUpdatedGameListToLobbyPlayers(result.game);
      } else {
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, { message: result.error || "Failed to change player name" }),
        );
      }
    } catch (error) {
      logger.error("Error in handleChangePlayerName:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Internal server error" }));
    }
  }

  private async handleGameSpeedAdjustment(
    clientId: string,
    message: IMessage<IGameSpeedAdjustmentPayload>,
  ): Promise<void> {
    try {
      const client = this.clients.get(clientId);
      if (!client || !client.gameId) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Client not in a game" }));
        return;
      }

      const { newSpeed } = message.payload;

      // Prepare payload for GameController
      const payload = {
        gameId: client.gameId,
        newSpeed,
      };

      const result = await GameController.adjustGameSpeed(client.sessionId, payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Broadcast the new speed to all players in the game (including the requester)
      const speedUpdateMessage = new Message(MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT, {
        newSpeed,
        playerId: result.gameData?.playerId,
      });

      // Send to the requester
      this.sendToClient(clientId, speedUpdateMessage);

      // Broadcast to other players in the game
      if (result.game) {
        this.broadcastToOtherPlayersInGame(result.game, client.sessionId, speedUpdateMessage);
      }
    } catch (error) {
      logger.error("Error in handleGameSpeedAdjustment:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Failed to adjust game speed" }));
    }
  }

  private async handleSyncState(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // NOTE: this doesn't really even have to do anything since we've already synced state
      const response = new Message(MESSAGE_TYPE.SYNC_STATE, {
        success: true,
      });

      this.sendToClient(clientId, response);
    } catch (error) {
      logger.error("handleSyncState error:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Sync state failed" }));
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

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.SEND_SHIPS, {
          success: true,
          message: "Ships sent successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleSendShips error:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Send ships failed" }));
    }
  }

  private async handleUpdatePlanetOptions(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.updatePlanetOptions(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.UPDATE_PLANET_OPTIONS, {
          success: true,
          message: "Worker assignments updated successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleUpdatePlanetOptions error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: error instanceof Error ? error.message : "Unknown error occurred while updating worker assignments",
        }),
      );
    }
  }

  private async handleUpdatePlanetBuildQueue(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.updatePlanetBuildQueue(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, {
          success: true,
          message: "Production item added to queue",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleUpdatePlanetBuildQueue error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: error instanceof Error ? error.message : "Unknown error occurred while updating build queue",
        }),
      );
    }
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
      logger.error("handleClearWaypoint error:", error);
      this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: "Clear waypoint failed" }));
    }
  }

  private async handleAdjustResearchPercent(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.adjustResearchPercent(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ADJUST_RESEARCH_PERCENT, {
          success: true,
          message: "Research allocation updated successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleAdjustResearchPercent error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: "Failed to adjust research percent",
        }),
      );
    }
  }

  private async handleSubmitResearchItem(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.submitResearchItem(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.SUBMIT_RESEARCH_ITEM, {
          success: true,
          message: "Research started successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleSubmitResearchItem error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: "Failed to start research",
        }),
      );
    }
  }

  private async handleCancelResearchItem(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.cancelResearchItem(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.CANCEL_RESEARCH_ITEM, {
          success: true,
          message: "Research cancelled successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleCancelResearchItem error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: "Failed to cancel research",
        }),
      );
    }
  }

  private async handleSubmitTrade(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.submitTrade(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.SUBMIT_TRADE, {
          success: true,
          message: "Trade submitted successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleSubmitTrade error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: "Failed to submit trade",
        }),
      );
    }
  }

  private async handleCancelTrade(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const result = await GameController.cancelTrade(client.sessionId, message.payload);

      if (!result.success) {
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.ERROR, { message: result.error }));
        return;
      }

      // Send success response to the requesting client
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.CANCEL_TRADE, {
          success: true,
          message: "Trade cancelled successfully",
        }),
      );

      // Broadcast game state update to all players in the game
      if (result.game && result.game._id) {
        await this.broadcastGameStateUpdate(result.game._id.toString());
      }
    } catch (error) {
      logger.error("handleCancelTrade error:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          message: "Failed to cancel trade",
        }),
      );
    }
  }

  private async handleChatMessage(clientId: string, message: IMessage<unknown>): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      // Extract message content and gameId from payload
      const messagePayload = message.payload as { message: string; gameId: string };
      const chatText = messagePayload.message;
      const gameId = messagePayload.gameId;

      if (!chatText || !chatText.trim()) {
        logger.warn(`Empty chat message from ${client.sessionId}`);
        return;
      }

      if (!gameId) {
        logger.warn(`Chat message without gameId from ${client.sessionId}`);
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, {
            error: "CHAT_ERROR",
            message: "Game ID required for chat messages",
          }),
        );
        return;
      }

      // Verify the client is actually in this game
      if (client.gameId !== gameId) {
        logger.warn(`Chat message gameId mismatch for ${client.sessionId}: expected ${client.gameId}, got ${gameId}`);
        this.sendToClient(
          clientId,
          new Message(MESSAGE_TYPE.ERROR, {
            error: "CHAT_ERROR",
            message: "Invalid game session for chat",
          }),
        );
        return;
      }

      // Create and save chat message to database
      const chatDocument = new ChatMessageModel({
        gameId: gameId,
        playerName: client.playerName || "Unknown Player",
        message: chatText.trim(),
        messageType: "public", // Default to public chat
      });

      await chatDocument.save();
      logger.info(`Chat message saved to database from ${client.playerName}: ${chatText.trim()}`);

      // Create formatted chat message for broadcast
      const chatMessage = {
        id: chatDocument.id || uuidv4(), // Use mongoose document id or fallback to uuid
        playerId: client.playerId || client.sessionId,
        playerName: client.playerName || "Unknown Player",
        message: chatText.trim(),
        timestamp: chatDocument.timestamp.getTime(),
        messageType: "public",
      };

      // Broadcast to all players in the game
      const gameRoom = this.gameRooms.get(gameId);
      if (gameRoom) {
        const chatBroadcast = new Message(MESSAGE_TYPE.CHAT_MESSAGE, chatMessage);

        for (const sessionId of gameRoom) {
          this.broadcastToSession(sessionId, chatBroadcast);
        }
      } else {
        logger.warn(`No game room found for gameId: ${gameId}`);
        // Echo back to sender only
        this.sendToClient(clientId, new Message(MESSAGE_TYPE.CHAT_MESSAGE, chatMessage));
      }
    } catch (error) {
      logger.error("Error handling chat message:", error);
      this.sendToClient(
        clientId,
        new Message(MESSAGE_TYPE.ERROR, {
          error: "CHAT_ERROR",
          message: "Failed to send chat message",
        }),
      );
    }
  }

  private async sendChatHistory(clientId: string, gameId: string): Promise<void> {
    try {
      // Retrieve recent chat messages for this game (last 50 messages)
      const chatHistory = await ChatMessageModel.find({ gameId }).sort({ timestamp: -1 }).limit(50).exec();

      // Convert to client format and reverse to show oldest first
      const chatMessages = chatHistory.reverse().map((chat) => ({
        id: chat.id,
        playerId: chat.playerName, // Using playerName as playerId for backward compatibility
        playerName: chat.playerName,
        message: chat.message,
        timestamp: chat.timestamp.getTime(),
        messageType: chat.messageType,
      }));

      if (chatMessages.length > 0) {
        logger.info(`Sending ${chatMessages.length} chat history messages to client ${clientId}`);

        // Send each chat message individually to populate the chat history
        for (const chatMessage of chatMessages) {
          this.sendToClient(clientId, new Message(MESSAGE_TYPE.CHAT_MESSAGE, chatMessage));
        }
      }
    } catch (error) {
      logger.error("Error retrieving chat history:", error);
    }
  }

  private async handleExitResign(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement based on GameController.exitResign
    logger.warn("handleExitResign not yet implemented");
  }

  private async handleLogout(clientId: string, message: IMessage<unknown>): Promise<void> {
    // TODO: Implement logout
    logger.warn("handleLogout not yet implemented");
  }

  private async handlePing(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Always send a basic PONG response with session information
    let pongPayload: any = {
      timestamp: new Date().toISOString(),
    };

    // If client is in an active game, include their current game state
    if (client.gameId && client.playerId) {
      try {
        const game = await Game.findById(client.gameId);
        if (game && game.status === "in_progress") {
          const clientGameModel = constructClientGameModel(game.gameState as any, client.playerId);
          pongPayload = {
            ...pongPayload,
            clientGameModel,
            currentCycle: (game.gameState as any).currentCycle || 0,
          };
          logger.info(`Sending PONG with updated game state to session ${client.sessionId}`);
        }
      } catch (error) {
        logger.error("Error getting game state for PING response:", error);
      }
    }

    this.sendToClient(clientId, new Message(MESSAGE_TYPE.PONG, pongPayload));
  }

  // Helper methods for game management
  private async sendUpdatedGameListToLobbyPlayers(gameDoc: any): Promise<void> {
    logger.debug("sendUpdatedGameListToLobbyPlayers for game:", gameDoc._id);

    try {
      // Get the complete updated games list instead of just the single game
      const games = await GameController.listLobbyGames({ sessionId: "system" });
      const messageForPlayers = new Message(MESSAGE_TYPE.GAME_LIST_UPDATED, { games });

      const chatRoom = await GameController.getChatRoomWithSessions(null);
      if (chatRoom) {
        for (const session of chatRoom.sessions) {
          this.broadcastToSession(session.sessionId, messageForPlayers);
        }
      }
    } catch (error) {
      logger.error("sendUpdatedGameListToLobbyPlayers error:", error);
    }
  }

  private broadcastToOtherPlayersInGame(game: IGame, sessionId: string, message: Message<any>): void {
    const playersBySessionKey = this.getOtherPlayersBySessionKeyFromGame(game, sessionId);
    this.broadcast(playersBySessionKey, message);
  }

  private getOtherPlayersBySessionKeyFromGame(
    game: IGame,
    currentPlayerSessionKey: string | null,
  ): Record<string, any> {
    const playersBySessionKey: Record<string, any> = {};
    for (const player of game.players) {
      if (player.sessionId && player.sessionId !== currentPlayerSessionKey) {
        playersBySessionKey[player.sessionId] = player;
      }
    }
    return playersBySessionKey;
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
      // Check if this is a human player in an active game
      if (client.gameId && client.playerId) {
        await this.handlePlayerDisconnection(client);
      }

      // Update session status
      await Session.findOneAndUpdate({ sessionId: client.sessionId }, { connectionStatus: "disconnected" });

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
      logger.error("Error handling disconnection:", error);
    }
  }

  private async handlePlayerDisconnection(client: IConnectedClient): Promise<void> {
    const game = await Game.findById(client.gameId);
    if (!game || game.status !== "in_progress") return;

    // Check if this is a human player
    const player = game.players?.find((p) => p.sessionId === client.sessionId);
    if (!player || player.isAI) return;

    // Notify other players about the disconnection (don't change game state)
    await this.notifyForPlayerDisconnection(game, player);
  }

  private async notifyForPlayerDisconnection(game: IGame, disconnectedPlayer: any): Promise<void> {
    // Just notify all connected players - don't change game status
    const gameRoom = this.gameRooms.get(game.id);
    if (gameRoom) {
      for (const sessionId of gameRoom) {
        const clientId = this.getClientIdBySessionId(sessionId);
        if (clientId) {
          this.sendToClient(
            clientId,
            new Message(MESSAGE_TYPE.PLAYER_DISCONNECTED, {
              playerName: disconnectedPlayer.name,
              gameId: game.id,
            }),
          );
        }
      }
    }

    logger.info(`Notified players about ${disconnectedPlayer.name} disconnection in game ${game.id}`);
  }

  private async areAllHumanPlayersConnected(game: IGame): Promise<boolean> {
    const gameRoom = this.gameRooms.get(game.id);
    if (!gameRoom) return false;

    const humanPlayers = game.players?.filter((p) => !p.isAI) || [];
    return humanPlayers.every((player) => player.sessionId && gameRoom.has(player.sessionId));
  }

  private async resetGameSnapshotTime(game: IGame): Promise<void> {
    try {
      // Reset the game snapshot time to prevent time jump when resuming
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as ModelData);

      // Use the engine's resetGameSnapshotTime function
      const updatedGameModel = resetGameSnapshotTime(gameModelData);

      // Save the updated game state
      game.gameState = updatedGameModel.modelData;
      await persistGame(game);

      logger.info(`Reset snapshot time for game ${game.id} to prevent time jumps`);
    } catch (error) {
      logger.error("Error resetting game snapshot time:", error);
    }
  }

  private async handleGameOverConditions(gameId: string, result: AdvanceGameClockResult, game: IGame): Promise<void> {
    try {
      logger.info(`Handling game over conditions for game ${gameId}`);

      // Mark game as completed if it has ended
      if (result.gameEndConditions.gameEnded) {
        game.status = "completed";
        logger.info(`Game ${gameId} has ended`);
      }

      // Handle destroyed players
      for (const destroyedPlayer of result.destroyedPlayers) {
        await this.handlePlayerDestruction(gameId, destroyedPlayer, game);
      }

      // If game has ended, handle game over for all players
      if (result.gameEndConditions.gameEnded) {
        await this.handleGameOver(gameId, result.gameEndConditions, game);
      }
    } catch (error) {
      logger.error("Error handling game over conditions:", error);
    }
  }

  private async handlePlayerDestruction(gameId: string, destroyedPlayer: PlayerData, game: IGame): Promise<void> {
    try {
      logger.info(`Player ${destroyedPlayer.name} (${destroyedPlayer.id}) has been destroyed in game ${gameId}`);

      // Find the corresponding database player
      const dbPlayer = game.players?.find((p) => p.Id === destroyedPlayer.id);
      if (!dbPlayer) {
        logger.warn(`Could not find database player for destroyed player ${destroyedPlayer.id}`);
        return;
      }

      // Calculate end game score for destroyed player
      const ownedPlanets = {}; // Empty since player is destroyed
      const score = EngineGameController.calculateEndGamePoints(
        game.gameState as ModelData,
        destroyedPlayer,
        ownedPlanets,
        false, // playerWon = false for destroyed players
      );

      // Send GAME_OVER message to destroyed player if they're human
      if (dbPlayer.sessionId && !dbPlayer.isAI) {
        const clientId = this.sessionLookup.get(dbPlayer.sessionId);
        if (clientId) {
          const gameOverMessage = new Message(MESSAGE_TYPE.GAME_OVER, {
            winningPlayer: null,
            playerWon: false,
            score,
            gameData: null, // No game data needed for destroyed players
            allHumansDestroyed: false,
          });

          this.sendToClient(clientId, gameOverMessage);
          logger.info(`Sent GAME_OVER message to destroyed player ${destroyedPlayer.name}`);
        }
      }
    } catch (error) {
      logger.error("Error handling player destruction:", error);
    }
  }

  private async handleGameOver(gameId: string, gameEndConditions: GameEndConditions, game: IGame): Promise<void> {
    try {
      logger.info(`Handling game over for game ${gameId}`);

      const gameRoom = this.gameRooms.get(gameId);
      if (!gameRoom) {
        logger.warn(`No game room found for completed game ${gameId}`);
        return;
      }

      // Send GAME_OVER messages to all remaining players
      for (const sessionId of gameRoom) {
        const clientId = this.sessionLookup.get(sessionId);
        if (!clientId) {
          continue;
        }

        const client = this.clients.get(clientId);
        if (!client || !client.playerId) {
          continue;
        }

        const dbPlayer = game.players?.find((p) => p.sessionId === sessionId);
        if (!dbPlayer) {
          continue;
        }

        // Determine if this player won
        const playerWon = gameEndConditions.winningPlayer?.id === client.playerId;

        // Calculate final score
        const gameModelData = GameModel.constructGridWithModelData(game.gameState as ModelData);
        const player = gameModelData.modelData.players.find((p) => p.id === client.playerId);
        if (!player) {
          continue;
        }

        const ownedPlanets = gameModelData.modelData.planets
          .filter((p) => player.ownedPlanetIds.includes(p.id))
          .reduce((acc, planet) => {
            acc[planet.id] = planet;
            return acc;
          }, {} as any);

        const score = EngineGameController.calculateEndGamePoints(
          game.gameState as ModelData,
          player,
          ownedPlanets,
          playerWon,
        );

        // Send GAME_OVER message
        const gameOverMessage = new Message(MESSAGE_TYPE.GAME_OVER, {
          winningPlayer: gameEndConditions.winningPlayer
            ? {
                id: gameEndConditions.winningPlayer.id,
                name: gameEndConditions.winningPlayer.name,
                position: dbPlayer.position,
              }
            : null,
          playerWon,
          score,
          gameData: constructClientGameModel(game.gameState as ModelData, client.playerId),
          allHumansDestroyed: gameEndConditions.allHumansDestroyed,
        });

        this.sendToClient(clientId, gameOverMessage);
        logger.info(`Sent GAME_OVER message to player ${dbPlayer.name} (won: ${playerWon})`);
      }

      // Clean up game room
      this.gameRooms.delete(gameId);
      this.chatRooms.delete(gameId);

      logger.info(`Game ${gameId} completed and cleaned up`);
    } catch (error) {
      logger.error("Error handling game over:", error);
    }
  }

  private getClientBySessionId(sessionId: string): IConnectedClient | null {
    const clientId = this.sessionLookup.get(sessionId);
    if (!clientId) return null;
    return this.clients.get(clientId) || null;
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
