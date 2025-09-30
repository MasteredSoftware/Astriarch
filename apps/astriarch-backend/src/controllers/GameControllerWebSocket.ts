import config from "config";
import { ServerGameModel, IGame, IPlayer } from "../models/Game";
import { SessionModel } from "../models/Session";
import { logger } from "../utils/logger";
import { persistGame } from "../database/DocumentPersistence";
import * as engine from "astriarch-engine";
import { getPlayerId } from "../utils/player-id-helper";
import {
  GameModel,
  Fleet,
  StarShipType,
  ResearchType,
  TradingCenter,
  TradeType,
  TradingCenterResourceType,
} from "astriarch-engine";

export interface GameSettings {
  maxPlayers?: number;
  gameType?: string;
  isPrivate?: boolean;
}

export interface CreateGameData {
  name: string;
  players: Array<{
    name: string;
    sessionId: string;
    position: number;
  }>;
}

export interface JoinGameData {
  gameId: string;
  sessionId: string;
  playerName: string;
}

export interface StartGameData {
  sessionId: string;
  gameId: string;
  gameOptions?: any;
}

export interface ResumeGameData {
  sessionId: string;
  gameId: string;
}

export interface GameResult {
  success: boolean;
  error?: string;
  errorType?: string;
  game?: IGame;
  playerPosition?: number;
  playerId?: string;
  gameData?: any;
  player?: IPlayer;
  // End turn specific properties
  allPlayersFinished?: boolean;
  endOfTurnMessages?: any[];
  destroyedClientPlayers?: any[];
}

/**
 * GameController that matches the old app.js architecture
 * This provides WebSocket-compatible methods for game management
 */
export class GameController {
  // ==========================================
  // Game Management Methods (like old app.js)
  // ==========================================

  /**
   * List games available in the lobby
   * Same logic as old game: find any game that is not started, or the current player is already in
   */
  static async listLobbyGames(options: { sessionId: string }): Promise<any[]> {
    try {
      // Find any game that is not started, or the current player is already in
      // This matches the old game_controller.js query exactly
      const query = {
        $or: [
          { status: "waiting_for_players" }, // Not started games (anyone can join)
          {
            $and: [
              { status: "in_progress" }, // Started but not ended
              { "players.sessionId": options.sessionId }, // Current player is in this game
              { "players.destroyed": { $ne: true } }, // Player is not destroyed
            ],
          },
        ],
      };

      const games = await ServerGameModel.find(query).sort({ lastActivity: -1 }).limit(20);

      // Transform to match old app.js format - clean up docs, don't send sessionId to client
      return games.map((game) => this.getGameSummaryFromGameDoc(game));
    } catch (error) {
      logger.error("Error listing lobby games:", error);
      throw error;
    }
  }

  /**
   * Create a new game (WebSocket version)
   */
  static async createGame(gameData: CreateGameData): Promise<any> {
    try {
      const gameOptions = {
        systemsToGenerate: 4,
        planetsPerSystem: 4,
        galaxySize: engine.GalaxySizeOption.SMALL,
        distributePlanetsEvenly: true,
        quickStart: false,
        gameSpeed: engine.GameSpeed.NORMAL,
        version: "2.0",
      };
      const playerId = getPlayerId(gameData.players[0].position);
      const gameModel = engine.createGame(playerId, gameData.players[0].name, gameOptions);

      const defaultGameOptions = engine.getDefaultServerGameOptions({});

      // Create database record matching old app.js structure
      const game = new ServerGameModel({
        name: gameData.name,
        hostPlayerName: gameData.players[0]?.name || "Unknown",
        players: gameData.players.map((p) => ({
          name: p.name,
          sessionId: p.sessionId,
          position: p.position,
          Id: `player_${p.position}`, // Generate player ID
          isActive: true,
          isAI: false,
        })),
        gameOptions: defaultGameOptions,
        gameState: gameModel.modelData,
        status: "waiting_for_players",
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      await persistGame(game);
      logger.info(`Game "${gameData.name}" created by ${gameData.players[0]?.name}:`, game._id);
      return game;
    } catch (error) {
      logger.error("Error creating game:", error);
      throw error;
    }
  }

  /**
   * Join an existing game (WebSocket version)
   */
  static async joinGame(data: JoinGameData): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Check if player already in game
      const existingPlayer = game.players?.find((p) => p.sessionId === data.sessionId);
      if (existingPlayer) {
        return {
          success: true,
          game,
          playerPosition: existingPlayer.position,
          playerId: existingPlayer.Id,
        };
      }

      // Check if game is full
      if (game.players && game.players.length >= (game.gameOptions?.systemsToGenerate || 4)) {
        return { success: false, error: "Game is full" };
      }

      // Add player to game
      const playerPosition = game.players ? game.players.length : 0;
      const playerId = getPlayerId(playerPosition);

      const newPlayer = {
        name: data.playerName,
        sessionId: data.sessionId,
        position: playerPosition,
        Id: playerId,
        isActive: true,
        isAI: false,
      };

      if (!game.players) {
        game.players = [];
      }
      game.players.push(newPlayer);
      game.lastActivity = new Date();

      await persistGame(game);

      logger.info(`${data.playerName} joined game ${data.gameId} as player ${playerPosition}`);
      return {
        success: true,
        game,
        playerPosition,
        playerId,
      };
    } catch (error) {
      logger.error("Error joining game:", error);
      return { success: false, error: "Failed to join game" };
    }
  }

  /**
   * Start a game (WebSocket version)
   */
  static async startGame(data: StartGameData): Promise<GameResult> {
    try {
      // Find game by gameId from the payload
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Verify the session is associated with this game
      const player = game.players?.find((p) => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: "Player not found in this game" };
      }

      // Add computer players based on opponentOptions
      const gameOptions = game.gameOptions;
      const allPlayers = [...(game.players || [])]; // Start with existing human players

      if (gameOptions?.opponentOptions) {
        let computerNumber = 1;

        for (let i = 0; i < gameOptions.opponentOptions.length; i++) {
          const opponentOption = gameOptions.opponentOptions[i];
          const playerType = opponentOption.type;

          if (playerType > 0) {
            // Computer player (1=Easy, 2=Normal, 3=Hard, 4=Expert)
            const computerPlayer = {
              name: `Computer ${computerNumber++}`,
              sessionId: undefined, // Computer players don't have sessions
              position: i + 1, // Positions start from 1 (host is 0)
              Id: getPlayerId(i + 1),
              isActive: true,
              isAI: true,
            };
            allPlayers.push(computerPlayer);
          }
          // playerType === 0 means Human player (should already be in the game)
          // playerType === -1 means Open slot (no player added)
          // playerType === -2 means Closed slot (no player added)
        }
      }

      // Validate we have enough players to start
      if (allPlayers.length < 2) {
        return { success: false, error: "Not enough players to start game" };
      }

      // Create the engine players array
      const enginePlayers = [];
      for (const dbPlayer of allPlayers) {
        if (dbPlayer.isAI) {
          // Create computer player with appropriate AI level
          const aiLevel = gameOptions?.opponentOptions?.[dbPlayer.position - 1]?.type || 2; // Default to Normal
          enginePlayers.push(
            engine.Player.constructPlayer(
              dbPlayer.Id,
              aiLevel, // AI difficulty level maps to PlayerType enum
              dbPlayer.name,
              engine.playerColors[dbPlayer.position] || engine.playerColors[0],
            ),
          );
        } else {
          // Create human player
          enginePlayers.push(
            engine.Player.constructPlayer(
              dbPlayer.Id,
              engine.PlayerType.Human,
              dbPlayer.name,
              engine.playerColors[dbPlayer.position] || engine.playerColors[0],
            ),
          );
        }
      }

      // Create the game model with all players
      const gameModel = engine.GameModel.constructData(enginePlayers, {
        systemsToGenerate: gameOptions?.systemsToGenerate || 4,
        planetsPerSystem: gameOptions?.planetsPerSystem || 4,
        galaxySize: gameOptions?.galaxySize || engine.GalaxySizeOption.SMALL,
        distributePlanetsEvenly: gameOptions?.distributePlanetsEvenly ?? true,
        quickStart: gameOptions?.quickStart ?? false,
        gameSpeed: gameOptions?.gameSpeed || engine.GameSpeed.NORMAL,
        version: "2.0",
      });

      // Update the game with the complete player list and game state
      game.players = allPlayers;
      game.gameState = gameModel.modelData;
      game.status = "in_progress";
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Game ${game._id} started with ${allPlayers.length} players (${allPlayers.filter((p) => !p.isAI).length} human, ${allPlayers.filter((p) => p.isAI).length} computer)`,
      );
      return {
        success: true,
        game,
      };
    } catch (error) {
      logger.error("Error starting game:", error);
      return { success: false, error: "Failed to start game" };
    }
  }

  /**
   * Resume a game (WebSocket version)
   */
  static async resumeGame(data: ResumeGameData): Promise<GameResult> {
    try {
      const game = await ServerGameModel.findById(data.gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      const player = game.players?.find((p) => p.sessionId === data.sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      return {
        success: true,
        gameData: game.gameState,
        player,
      };
    } catch (error) {
      logger.error("Error resuming game:", error);
      return { success: false, error: "Failed to resume game" };
    }
  }

  // ==========================================
  // Game Action Methods (to be implemented)
  // ==========================================

  static async updateGameOptions(data: {
    sessionId: string;
    gameId: string;
    gameOptions: any;
    playerName?: string;
  }): Promise<GameResult> {
    try {
      const { sessionId, gameId, gameOptions, playerName } = data;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Check if the player is the host (first player)
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Only the host (position 0) can change game options
      if (player.position !== 0) {
        return { success: false, error: "Only the game host can change options" };
      }

      // Update game options
      game.gameOptions = {
        ...game.gameOptions,
        ...gameOptions,
      };

      // Update game name if provided
      if (gameOptions.name) {
        game.name = gameOptions.name;
      }

      // Update main player name if provided
      if (playerName && player) {
        player.name = playerName;
        game.hostPlayerName = playerName;
      }

      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(`Game options updated for game ${gameId}`);
      return { success: true, game };
    } catch (error) {
      logger.error("Error updating game options:", error);
      return { success: false, error: "Failed to update game options" };
    }
  }

  static async changePlayerName(data: { sessionId: string; gameId: string; playerName: string }): Promise<GameResult> {
    try {
      const { sessionId, gameId, playerName } = data;

      if (!playerName || playerName.trim() === "") {
        return { success: false, error: "Player name cannot be empty" };
      }

      // Limit name to 20 characters like the old game
      const trimmedName = playerName.substring(0, 20);

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find the player making the request
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Update the player's name
      player.name = trimmedName;

      // Update the corresponding game options based on player position
      if (player.position === 0) {
        // Host player - update mainPlayerName and hostPlayerName
        game.gameOptions.mainPlayerName = trimmedName;
        game.hostPlayerName = trimmedName;
      } else {
        // Non-host player - update the corresponding opponentOptions entry
        const opponentIndex = player.position - 1;
        if (game.gameOptions.opponentOptions && game.gameOptions.opponentOptions[opponentIndex]) {
          game.gameOptions.opponentOptions[opponentIndex].name = trimmedName;
        }
      }

      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Player name changed to "${trimmedName}" for player at position ${player.position} in game ${gameId}`,
      );
      return { success: true, game };
    } catch (error) {
      logger.error("Error changing player name:", error);
      return { success: false, error: "Failed to change player name" };
    }
  }

  static async sendShips(sessionId: string, data: any): Promise<GameResult> {
    try {
      const { gameId, planetIdSource, planetIdDest, data: shipsByType } = data;

      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the source planet in the game state
      const sourcePlanet = gameModel.planets?.find((p: any) => p.id === planetIdSource);
      if (!sourcePlanet) {
        return { success: false, error: "Source planet not found" };
      }

      // Find the destination planet in the game state
      const destinationPlanet = gameModel.planets?.find((p: any) => p.id === planetIdDest);
      if (!destinationPlanet) {
        return { success: false, error: "Destination planet not found" };
      }

      const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Check if this player owns the source planet
      const ownsSourcePlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetIdSource);
      if (!ownsSourcePlanet) {
        return { success: false, error: "You do not own the source planet" };
      }

      // Validate that we have ships to send
      const totalShipsToSend =
        shipsByType.scouts.length +
        shipsByType.destroyers.length +
        shipsByType.cruisers.length +
        shipsByType.battleships.length;

      if (totalShipsToSend === 0) {
        return { success: false, error: "No ships selected to send" };
      }

      // Create a helper function to split fleet by specific ship IDs
      const splitFleetWithShipIds = (
        fleet: any,
        scoutIds: number[],
        destroyerIds: number[],
        cruiserIds: number[],
        battleshipIds: number[],
      ) => {
        const newFleet = Fleet.generateFleet([], fleet.locationHexMidPoint);

        const moveShipsToFleet = (shipIds: number[], targetType: any) => {
          for (const shipId of shipIds) {
            const shipIndex = fleet.starships.findIndex((s: any) => s.id === shipId && s.type === targetType);
            if (shipIndex !== -1) {
              const ship = fleet.starships.splice(shipIndex, 1)[0];
              newFleet.starships.push(ship);
            }
          }
        };

        moveShipsToFleet(scoutIds, StarShipType.Scout);
        moveShipsToFleet(destroyerIds, StarShipType.Destroyer);
        moveShipsToFleet(cruiserIds, StarShipType.Cruiser);
        moveShipsToFleet(battleshipIds, StarShipType.Battleship);

        return newFleet;
      };

      // Split the fleet with the specific ship IDs
      const newFleet = splitFleetWithShipIds(
        sourcePlanet.planetaryFleet,
        shipsByType.scouts,
        shipsByType.destroyers,
        shipsByType.cruisers,
        shipsByType.battleships,
      );

      // Set the destination for the new fleet
      Fleet.setDestination(
        newFleet,
        gameModelData.grid,
        sourcePlanet.boundingHexMidPoint,
        destinationPlanet.boundingHexMidPoint,
      );

      // Add the fleet to the source planet's outgoing fleets
      sourcePlanet.outgoingFleets.push(newFleet);

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Player ${player.Id} sent ${totalShipsToSend} ships from planet ${planetIdSource} to planet ${planetIdDest} in game ${gameId}`,
      );

      return {
        success: true,
        game,
        gameData: gameModel,
      };
    } catch (error) {
      logger.error("SendShips error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  static async startUpdatePlanet(data: any, payload: any): Promise<GameResult> {
    // TODO: Implement planet update start
    logger.warn("startUpdatePlanet not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async updatePlanetOptions(sessionId: string, payload: any): Promise<GameResult> {
    try {
      const { gameId, planetId, farmerDiff, minerDiff, builderDiff } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the planet in the game state
      const planet = gameModel.planets?.find((p: any) => p.id === planetId);
      if (!planet) {
        return { success: false, error: "Planet not found" };
      }

      const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Check if this planet exists in the player's owned planets
      const ownsPlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetId);

      if (!ownsPlanet) {
        return { success: false, error: "You do not own this planet" };
      }

      // Update worker assignments using the new engine method that handles rebalancing
      engine.Planet.updatePopulationWorkerTypes(planet, gamePlayer, farmerDiff || 0, minerDiff || 0, builderDiff || 0);

      // Save the updated game state
      game.gameState = gameModel;
      await persistGame(game);

      return { success: true, game };
    } catch (error) {
      logger.error("updatePlanetOptions error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred while updating planet options",
      };
    }
  }

  static async updatePlanetBuildQueue(sessionId: string, payload: any): Promise<GameResult> {
    try {
      const { gameId, planetId, action, productionItem } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      // Construct a proper GameModel with grid from the gameState data
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData; // The actual game state

      // Find the planet in the game state
      const planet = gameModel.planets?.find((p: any) => p.id === planetId);
      if (!planet) {
        return { success: false, error: "Planet not found" };
      }

      const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Check if this planet exists in the player's owned planets
      const ownsPlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetId);

      if (!ownsPlanet) {
        return { success: false, error: "You do not own this planet" };
      }

      // Handle different actions
      if (action === "add") {
        // Add item to build queue using engine method
        const planetById = gameModel.planets.reduce((acc: any, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const gamePlayer = gameModel.players?.find((p: any) => p.id === player.Id);
        if (!gamePlayer) {
          return { success: false, error: "Player not found in game state" };
        }
        const clientGameModel = engine.constructClientGameModel(gameModel, player.Id);
        // Use engine method to add to queue and spend resources
        const canBuild = engine.Player.enqueueProductionItemAndSpendResourcesIfPossible(
          clientGameModel,
          gameModelData.grid, // Use the grid from GameModelData
          planet,
          productionItem,
        );

        if (!canBuild) {
          return { success: false, error: "Not enough resources to build item" };
        }

        // Save the updated game state
        game.gameState = gameModel;
        game.lastActivity = new Date();

        // Use data access layer to save with automatic Mixed field handling
        await persistGame(game);

        return {
          success: true,
          game,
          gameData: gameModel,
        };
      } else if (action === "remove") {
        // TODO: Implement remove from queue
        return { success: false, error: "Remove from queue not yet implemented" };
      } else {
        return { success: false, error: "Invalid action" };
      }
    } catch (error) {
      logger.error("UpdatePlanetBuildQueue error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  static async clearWaypoint(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement waypoint clearing
    logger.warn("clearWaypoint not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  static async adjustResearchPercent(sessionId: string, payload: any): Promise<GameResult> {
    try {
      if (!payload || typeof payload.researchPercent !== "number") {
        return { success: false, error: "Invalid research percent value" };
      }

      if (payload.researchPercent < 0 || payload.researchPercent > 1) {
        return { success: false, error: "Research percent must be between 0% and 100%" };
      }

      const { gameId } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the player in the game model
      const gamePlayer = gameModel.players.find((p) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Update the player's research percent
      if (!gamePlayer.research) {
        gamePlayer.research = {
          researchPercent: 0,
          researchProgressByType: {},
          researchTypeInQueue: null,
        };
      }

      gamePlayer.research.researchPercent = payload.researchPercent;

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(`Player ${player.name} adjusted research percent to ${Math.round(payload.researchPercent * 100)}%`);
      return { success: true, game, gameData: gameModel };
    } catch (error) {
      logger.error("Error adjusting research percent:", error);
      return { success: false, error: "Failed to adjust research percent" };
    }
  }

  static async submitResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    try {
      if (!payload || !payload.researchItem || typeof payload.researchItem.type !== "number") {
        return { success: false, error: "Invalid research item" };
      }

      const { gameId } = payload;
      const { type: researchType, data: researchData } = payload.researchItem;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the player in the game model
      const gamePlayer = gameModel.players.find((p) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Get the research progress for this type
      const researchProgress = gamePlayer.research.researchProgressByType[researchType as ResearchType];
      if (!researchProgress) {
        return { success: false, error: "Research type not found" };
      }

      // Update research progress data with advantage/disadvantage data (for custom ships)
      if (researchData) {
        logger.info(`Updating research type ${researchType} with data:`, researchData);
        engine.Research.updateResearchTypeProgressData(researchProgress, researchData);
        logger.info(
          `Research progress after update - base points: ${researchProgress.researchPointsBase}, data:`,
          researchProgress.data,
        );
      }

      // Set the research type in queue
      gamePlayer.research.researchTypeInQueue = researchType;

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(`Player ${player.name} started researching ${researchType}`);
      return { success: true, game, gameData: gameModel };
    } catch (error) {
      logger.error("Error submitting research item:", error);
      return { success: false, error: "Failed to start research" };
    }
  }

  static async cancelResearchItem(sessionId: string, payload: any): Promise<GameResult> {
    try {
      const { gameId } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the player in the game model
      const gamePlayer = gameModel.players.find((p) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Clear the research queue
      if (gamePlayer.research) {
        gamePlayer.research.researchTypeInQueue = null;
      }

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(`Player ${player.name} cancelled research`);
      return { success: true, game, gameData: gameModel };
    } catch (error) {
      logger.error("Error cancelling research item:", error);
      return { success: false, error: "Failed to cancel research" };
    }
  }

  static async submitTrade(sessionId: string, payload: any): Promise<GameResult> {
    try {
      if (
        !payload ||
        !payload.gameId ||
        !payload.planetId ||
        typeof payload.tradeType !== "number" ||
        typeof payload.resourceType !== "number" ||
        typeof payload.amount !== "number"
      ) {
        return { success: false, error: "Invalid trade data" };
      }

      const { gameId, planetId, tradeType, resourceType, amount } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the player in the game model
      const gamePlayer = gameModel.players.find((p) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Find the planet in the game model
      const planet = gameModel.planets?.find((p: any) => p.id === planetId);
      if (!planet) {
        return { success: false, error: "Planet not found" };
      }

      // Verify player owns the planet
      const ownsPlanet = GameModel.isPlanetOwnedByPlayer(gamePlayer, planetId);
      if (!ownsPlanet) {
        return { success: false, error: "Player does not own this planet" };
      }

      // Create the trade using the engine
      const trade = TradingCenter.constructTrade(
        gamePlayer.id,
        planetId,
        tradeType as TradeType,
        resourceType as TradingCenterResourceType,
        amount,
        5, // 5 second delay
      );

      // Add trade to the trading center
      gameModel.tradingCenter.currentTrades.push(trade);

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(
        `Player ${player.name} submitted trade: ${TradeType[tradeType]} ${amount} ${TradingCenterResourceType[resourceType]}`,
      );
      return { success: true, game, gameData: gameModel };
    } catch (error) {
      logger.error("Error submitting trade:", error);
      return { success: false, error: "Failed to submit trade" };
    }
  }

  static async cancelTrade(sessionId: string, payload: any): Promise<GameResult> {
    try {
      if (!payload || !payload.gameId || !payload.tradeId) {
        return { success: false, error: "Invalid cancellation data - gameId and tradeId required" };
      }

      const { gameId, tradeId } = payload;

      // Find the game
      const game = await ServerGameModel.findById(gameId);
      if (!game) {
        return { success: false, error: "Game not found" };
      }

      // Find player by sessionId
      const player = game.players?.find((p) => p.sessionId === sessionId);
      if (!player) {
        return { success: false, error: "Player not found in game" };
      }

      // Get the current game state
      const gameModelData = GameModel.constructGridWithModelData(game.gameState as any);
      const gameModel = gameModelData.modelData;

      // Find the player in the game model
      const gamePlayer = gameModel.players.find((p) => p.id === player.Id);
      if (!gamePlayer) {
        return { success: false, error: "Player not found in game state" };
      }

      // Cancel the trade using the engine
      const cancelled = TradingCenter.cancelTrade(gameModel.tradingCenter, tradeId, gamePlayer.id);

      if (!cancelled) {
        return { success: false, error: "Trade not found or cannot be cancelled" };
      }

      // Save the updated game state
      game.gameState = gameModel;
      game.lastActivity = new Date();
      await persistGame(game);

      logger.info(`Player ${player.name} cancelled trade ${tradeId}`);
      return { success: true, game, gameData: gameModel };
    } catch (error) {
      logger.error("Error cancelling trade:", error);
      return { success: false, error: "Failed to cancel trade" };
    }
  }

  static async exitResign(sessionId: string, payload: any): Promise<GameResult> {
    // TODO: Implement exit/resign
    logger.warn("exitResign not yet implemented");
    return { success: false, error: "Not implemented" };
  }

  // ==========================================
  // Chat and Session Management
  // ==========================================

  static async getChatRoomWithSessions(gameId: string | null): Promise<any> {
    try {
      if (gameId === null) {
        // Lobby chat room - return all sessions not in games
        const sessions = await SessionModel.find({
          $or: [{ gameId: { $exists: false } }, { gameId: null }],
        });
        return { sessions };
      } else {
        // Game-specific chat room
        const sessions = await SessionModel.find({ gameId });
        return { sessions };
      }
    } catch (error) {
      logger.error("Error getting chat room with sessions:", error);
      return null;
    }
  }

  static async joinChatRoom(gameId: string | null, session: any): Promise<any> {
    // TODO: Implement chat room joining like old app.js
    logger.warn("joinChatRoom not yet implemented");
    return null;
  }

  static async leaveChatRoom(sessionId: string, broadcast: boolean): Promise<any> {
    // TODO: Implement chat room leaving like old app.js
    logger.warn("leaveChatRoom not yet implemented");
    return null;
  }

  // ==========================================
  // Utility Methods (like old app.js)
  // ==========================================

  /**
   * Converts a game document from the database to a game summary for the frontend
   * This matches the IGame interface expected by the frontend
   * Like the old game, we clean up the docs - we don't need to send everything to the client
   */
  static getGameSummaryFromGameDoc(gameDoc: any): any {
    const summary = {
      _id: gameDoc._id.toString(),
      name: gameDoc.name || "Unnamed Game",
      hostPlayerName: gameDoc.hostPlayerName, // Include host information
      status: gameDoc.status || "waiting",
      players: [] as any[], // Will be populated below without sessionId
      gameOptions: gameDoc.gameOptions || {
        systemsToGenerate: 4,
        planetsPerSystem: 4,
        galaxySize: 4,
        distributePlanetsEvenly: true,
        quickStart: false,
        gameSpeed: 3,
        opponentOptions: [
          { name: "", type: -1 }, // Player 2: Open
          { name: "", type: -2 }, // Player 3: Closed
          { name: "", type: -2 }, // Player 4: Closed
        ],
      },
      createdAt: gameDoc.createdAt,
      lastActivity: gameDoc.lastActivity,
      started: gameDoc.status === "in_progress",
      ended: gameDoc.status === "completed",
    };

    // Clean up player data - only send name and position, NOT sessionId
    // This matches the old game_controller.js logic (line 280-283)
    // Also add 'connected' field based on 'isActive' for frontend compatibility
    if (gameDoc.players) {
      for (const player of gameDoc.players) {
        summary.players.push({
          name: player.name,
          position: player.position,
          connected: player.isActive || false, // Map isActive to connected for frontend
        });
      }
    }

    return summary;
  }

  // ==========================================
  // Session Management
  // ==========================================

  static async touchSession(sessionId: string): Promise<void> {
    try {
      await SessionModel.findOneAndUpdate({ sessionId }, { lastActivity: new Date() }, { upsert: true });
    } catch (error) {
      logger.error("TouchSession Error:", error);
    }
  }

  static async cleanupExpiredSessions(timeout: number): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - timeout);
      const result = await SessionModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} expired sessions`);
      }
    } catch (error) {
      logger.error("Error cleaning up expired sessions:", error);
    }
  }

  // ==========================================
  // Legacy Cleanup Methods
  // ==========================================

  static async cleanupOldGames(): Promise<void> {
    try {
      const cleanupConfig = config.get("game.cleanup") as any;
      const maxAge = cleanupConfig?.max_age_hours || 24;
      const cutoffDate = new Date(Date.now() - maxAge * 60 * 60 * 1000);

      const result = await ServerGameModel.deleteMany({
        lastActivity: { $lt: cutoffDate },
        status: { $ne: "in_progress" },
      });

      if (result.deletedCount > 0) {
        logger.info(`Cleaned up ${result.deletedCount} old games`);
      }
    } catch (error) {
      logger.error("Error during game cleanup:", error);
    }
  }

  static startGameCleanup(): void {
    try {
      const cleanupConfig = config.get("game.cleanup") as any;

      if (cleanupConfig && cleanupConfig.enabled) {
        setInterval(
          async () => {
            await GameController.cleanupOldGames();
          },
          (cleanupConfig.check_interval_seconds || 3600) * 1000,
        );

        logger.info("Game cleanup scheduler started");
      }
    } catch (error) {
      logger.warn("Game cleanup config not found, skipping cleanup scheduler");
    }
  }
}
