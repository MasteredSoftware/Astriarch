import { writable } from 'svelte/store';
import {
	MESSAGE_TYPE,
	Message,
	type IMessage,
	type IGame,
	type IGameOptions,
	isCreateGameResponse,
	isJoinGameResponse,
	isListGamesResponse,
	isStartGameResponse,
	isGameStateUpdate,
	isErrorMessage
} from 'astriarch-engine';

// Import the main game stores to update them when receiving multiplayer game state
import { gameModel, gameStarted } from '$lib/stores/gameStore';
import type { GameModelData } from 'astriarch-engine';

// Additional types specific to this service
export interface IOpponentOption {
	name: string;
	type: number; // -2 = closed, -1 = open, positive number = AI difficulty
}

// Re-export types from engine for convenience
export type { IGame, IGameOptions };

// Interfaces for game data - imported from engine
// IGame, IGameOptions now imported from astriarch-engine

// Store for WebSocket multiplayer game state
interface MultiplayerGameState {
	sessionId: string | null;
	gameId: string | null;
	currentPlayer: string | null;
	playerName: string | null;
	connected: boolean;
	gameJoined: boolean;
	currentView: 'lobby' | 'game_options' | 'game';
	availableGames: IGame[];
	selectedGame: IGame | null;
	gameState: unknown | null; // Will be converted to engine format later
}

// Chat and notifications
export interface ChatMessage {
	id: string;
	playerId: string;
	playerName: string;
	message: string;
	timestamp: number;
}

export interface GameNotification {
	id: string;
	type:
		| 'info'
		| 'success'
		| 'warning'
		| 'error'
		| 'battle'
		| 'research'
		| 'construction'
		| 'fleet'
		| 'planet'
		| 'diplomacy';
	message: string;
	timestamp: number;
	actionText?: string;
	actionType?: string;
}

// Helper function to ensure game data has proper structure
function validateGameData(games: unknown[]): IGame[] {
	return games.map((game: unknown) => {
		const g = game as Record<string, unknown>;
		return {
			_id: (g._id as string) || '',
			name: (g.name as string) || 'Unnamed Game',
			players: Array.isArray(g.players) ? g.players : [],
			gameOptions: (g.gameOptions as IGameOptions) || {
				galaxySize: 'medium',
				planetsPerSystem: 4,
				gameSpeed: 'normal',
				distributePlanetsEvenly: true,
				quickStart: false,
				maxPlayers: 4
			},
			status: (g.status as 'waiting' | 'in_progress' | 'completed') || 'waiting',
			createdAt: g.createdAt ? new Date(g.createdAt as string) : new Date(),
			lastActivity: g.lastActivity ? new Date(g.lastActivity as string) : new Date()
		};
	});
}

// Create the multiplayer game store
function createMultiplayerGameStore() {
	const initialState: MultiplayerGameState = {
		sessionId: null,
		gameId: null,
		currentPlayer: null,
		playerName: null,
		connected: false,
		gameJoined: false,
		currentView: 'lobby',
		availableGames: [],
		selectedGame: null,
		gameState: null
	};

	const { subscribe, set, update } = writable(initialState);

	// Separate stores for chat and notifications
	const chatMessages = writable<ChatMessage[]>([]);
	const notifications = writable<GameNotification[]>([]);

	return {
		subscribe,
		set,
		update,
		chatMessages,
		notifications,

		// Connection management
		setConnected: (connected: boolean) => update((store) => ({ ...store, connected })),
		setSessionId: (sessionId: string) => update((store) => ({ ...store, sessionId })),
		setPlayerName: (playerName: string) => update((store) => ({ ...store, playerName })),

		// Game management
		setGameId: (gameId: string | null) => update((store) => ({ ...store, gameId })),
		setCurrentPlayer: (currentPlayer: string | null) =>
			update((store) => ({ ...store, currentPlayer })),
		setGameJoined: (gameJoined: boolean) => update((store) => ({ ...store, gameJoined })),
		setCurrentView: (currentView: 'lobby' | 'game_options' | 'game') =>
			update((store) => ({ ...store, currentView })),

		// Lobby management
		setAvailableGames: (games: IGame[]) => update((store) => ({ ...store, availableGames: games })),
		setSelectedGame: (game: IGame | null) => update((store) => ({ ...store, selectedGame: game })),

		// Game state
		setGameState: (gameState: unknown) => update((store) => ({ ...store, gameState })),
		applyChanges: (changes: unknown) =>
			update((store) => {
				// Apply incremental changes to game state
				if (store.gameState && changes) {
					return {
						...store,
						gameState: {
							...(store.gameState as Record<string, unknown>),
							...(changes as Record<string, unknown>)
						}
					};
				}
				return store;
			}),

		// Chat management
		addChatMessage: (message: ChatMessage) => {
			chatMessages.update((messages) => [...messages, message]);
		},
		clearChatMessages: () => {
			chatMessages.set([]);
		},

		// Notification management
		addNotification: (notification: GameNotification) => {
			notifications.update((notifs) => [...notifs, notification]);
		},
		removeNotification: (id: string) => {
			notifications.update((notifs) => notifs.filter((n) => n.id !== id));
		},
		clearNotifications: () => {
			notifications.set([]);
		},

		// Game time updates
		updateGameTime: (gameTime: number) =>
			update((store) => {
				if (store.gameState) {
					return {
						...store,
						gameState: {
							...store.gameState,
							gameTime
						}
					};
				}
				return store;
			}),

		// Reset everything
		reset: () => {
			set(initialState);
			chatMessages.set([]);
			notifications.set([]);
		}
	};
}

// WebSocket connection management
class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private messageQueue: IMessage<unknown>[] = [];
	private isConnecting = false;

	constructor(private gameStore: ReturnType<typeof createMultiplayerGameStore>) {}

	connect(url: string = 'ws://localhost:8001'): Promise<void> {
		if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
			return Promise.resolve();
		}

		this.isConnecting = true;

		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(url);

				this.ws.onopen = () => {
					console.log('WebSocket connected');
					this.isConnecting = false;
					this.reconnectAttempts = 0;
					this.gameStore.setConnected(true);

					// Set a default player name if none exists
					this.gameStore.setPlayerName('Player');

					// Send queued messages
					while (this.messageQueue.length > 0) {
						const message = this.messageQueue.shift();
						if (message) {
							this.send(message);
						}
					}

					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message: IMessage<unknown> = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('Failed to parse WebSocket message:', error);
					}
				};

				this.ws.onclose = () => {
					console.log('WebSocket disconnected');
					this.isConnecting = false;
					this.gameStore.setConnected(false);
					this.attemptReconnect();
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.isConnecting = false;
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'error',
						message: 'WebSocket connection error',
						timestamp: Date.now()
					});
					reject(error);
				};
			} catch (error) {
				this.isConnecting = false;
				reject(error);
			}
		});
	}

	private attemptReconnect() {
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			console.log(
				`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
			);

			setTimeout(() => {
				this.connect().catch((error) => {
					console.error('Reconnection failed:', error);
				});
			}, this.reconnectDelay * this.reconnectAttempts);
		} else {
			this.gameStore.addNotification({
				id: Date.now().toString(),
				type: 'error',
				message: 'Failed to reconnect to server after multiple attempts',
				timestamp: Date.now()
			});
		}
	}

	private handleMessage(message: IMessage<unknown>) {
		console.log('Received message:', message);

		switch (message.type) {
			case MESSAGE_TYPE.LIST_GAMES:
				if (isListGamesResponse(message)) {
					this.gameStore.setAvailableGames(validateGameData(message.payload.games));
				} else {
					console.warn('LIST_GAMES payload missing games array:', message.payload);
				}
				break;

			case MESSAGE_TYPE.GAME_LIST_UPDATED:
				if (isListGamesResponse(message)) {
					this.gameStore.setAvailableGames(validateGameData(message.payload.games));
				} else {
					console.warn('GAME_LIST_UPDATED payload missing games array:', message.payload);
				}
				break;

			case MESSAGE_TYPE.GAME_STATE_UPDATE:
				if (isGameStateUpdate(message)) {
					if (message.payload.changes) {
						this.gameStore.applyChanges(message.payload.changes);
					} else {
						this.gameStore.setGameState(message.payload.gameState);

						// Update the main game stores
						if (message.payload.gameState) {
							const gameState = message.payload.gameState as GameModelData;
							gameModel.set(gameState);
							gameStarted.set(true);
							console.log('Updated main game stores with multiplayer game state');
						}
					}
				} else {
					console.warn('Unexpected GAME_STATE_UPDATE payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.START_GAME:
				if (isStartGameResponse(message)) {
					if (message.payload.success) {
						this.gameStore.setCurrentView('game');
						this.gameStore.setGameState(message.payload.gameState);

						// update main game stores
						if (message.payload.gameState) {
							// Update the main game stores so that GalaxyCanvas and other components can access the data
							const gameState = message.payload.gameState as GameModelData;
							gameModel.set(gameState);
							gameStarted.set(true);
							console.log('Updated main game stores with multiplayer game state');
						}

						this.gameStore.addNotification({
							id: Date.now().toString(),
							type: 'success',
							message: 'Game started!',
							timestamp: Date.now()
						});
					} else {
						this.gameStore.addNotification({
							id: Date.now().toString(),
							type: 'error',
							message: message.payload.error || 'Failed to start game',
							timestamp: Date.now()
						});
					}
				} else {
					console.warn('Unexpected START_GAME payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.CREATE_GAME:
				if (isCreateGameResponse(message)) {
					this.gameStore.setGameId(message.payload.gameId);
					this.gameStore.setGameJoined(true);
					this.gameStore.setCurrentView('game_options');
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'success',
						message: `Game created successfully!`,
						timestamp: Date.now()
					});
				} else if (isErrorMessage(message)) {
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'error',
						message: message.payload.error || 'Failed to create game',
						timestamp: Date.now()
					});
				} else {
					console.warn('Unexpected CREATE_GAME payload format:', message.payload);
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'error',
						message: 'Unexpected response from server',
						timestamp: Date.now()
					});
				}
				break;

			case MESSAGE_TYPE.JOIN_GAME:
				if (isJoinGameResponse(message)) {
					if (message.payload.success) {
						this.gameStore.setGameId(message.payload.gameId || '');
						this.gameStore.setGameJoined(true);
						this.gameStore.setCurrentView('game_options');
					} else {
						this.gameStore.addNotification({
							id: Date.now().toString(),
							type: 'error',
							message: message.payload.error || 'Failed to join game',
							timestamp: Date.now()
						});
					}
				} else {
					console.warn('Unexpected JOIN_GAME payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.CHANGE_GAME_OPTIONS:
				// Game options have been updated
				console.log('Received CHANGE_GAME_OPTIONS:', message.payload);
				// The game options are updated and will be reflected in the lobby and game options view
				this.gameStore.addNotification({
					id: Date.now().toString(),
					type: 'info',
					message: 'Game options updated',
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.CHAT_MESSAGE: {
				const chatData = message.payload as unknown as ChatMessage;
				this.gameStore.addChatMessage(chatData);
				break;
			}

			case MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED:
				this.gameStore.addNotification({
					id: Date.now().toString(),
					type: 'info',
					message: `Player activity updated`,
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.GAME_OVER:
				this.gameStore.addNotification({
					id: Date.now().toString(),
					type: 'info',
					message: `Game has ended`,
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.ERROR:
				if (isErrorMessage(message)) {
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'error',
						message: message.payload.error || 'An error occurred',
						timestamp: Date.now()
					});
				} else {
					console.warn('Unexpected ERROR payload format:', message.payload);
				}
				break;

			default:
				console.log('Unhandled message type:', message.type);
		}
	}

	send(message: IMessage<unknown>) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			// Queue message for when connection is established
			this.messageQueue.push(message);

			if (!this.isConnecting) {
				this.connect().catch((error) => {
					console.error('Failed to connect for sending message:', error);
					this.gameStore.addNotification({
						id: Date.now().toString(),
						type: 'error',
						message: 'Failed to send message - not connected',
						timestamp: Date.now()
					});
				});
			}
		}
	}

	// Game-specific methods
	listGames() {
		this.send(new Message(MESSAGE_TYPE.LIST_GAMES, {}));
	}

	createGame(gameOptions: IGameOptions) {
		// Get current player name from store or use a default
		let currentPlayerName = 'Player';
		const unsubscribe = this.gameStore.subscribe((state) => {
			currentPlayerName = state.playerName || 'Player';
		});
		unsubscribe();

		console.log('Creating game with player name:', currentPlayerName);

		// Send both game name and player name as the backend expects
		const payload: Record<string, unknown> = {
			name: gameOptions.name || 'Unnamed Game',
			playerName: currentPlayerName,
			gameOptions: {
				name: gameOptions.name || 'Unnamed Game',
				mainPlayerName: currentPlayerName,
				systemsToGenerate: 4, // Default to 4 systems
				planetsPerSystem: gameOptions.planetsPerSystem || 4,
				galaxySize:
					typeof gameOptions.galaxySize === 'string'
						? gameOptions.galaxySize === 'Small'
							? 2
							: gameOptions.galaxySize === 'Medium'
								? 3
								: gameOptions.galaxySize === 'Large'
									? 4
									: 4
						: gameOptions.galaxySize || 4,
				distributePlanetsEvenly: gameOptions.distributePlanetsEvenly ?? true,
				quickStart: gameOptions.quickStart ?? false,
				turnTimeLimitSeconds: 0, // Default to no time limit
				opponentOptions: [
					{ name: '', type: -1 }, // Player 2: Open
					{ name: '', type: -2 }, // Player 3: Closed
					{ name: '', type: -2 } // Player 4: Closed
				]
			}
		};

		console.log('Sending CREATE_GAME with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.CREATE_GAME, payload));
	}

	joinGame(gameId: string, playerName?: string) {
		this.send(new Message(MESSAGE_TYPE.JOIN_GAME, { gameId, playerName }));
	}

	startGame() {
		// Get current game ID from store
		let currentGameId = '';
		const unsubscribe = this.gameStore.subscribe((state) => {
			currentGameId = state.gameId || '';
		});
		unsubscribe();

		if (!currentGameId) {
			this.gameStore.addNotification({
				id: Date.now().toString(),
				type: 'error',
				message: 'No game selected to start',
				timestamp: Date.now()
			});
			return;
		}

		this.send(new Message(MESSAGE_TYPE.START_GAME, { gameId: currentGameId }));
	}

	leaveGame() {
		this.send(new Message(MESSAGE_TYPE.EXIT_RESIGN, {}));
	}

	sendChatMessage(message: string) {
		this.send(new Message(MESSAGE_TYPE.CHAT_MESSAGE, { message }));
	}

	changeGameOptions(
		gameId: string,
		gameOptions: {
			name: string;
			playerName: string;
			systemsToGenerate: number;
			planetsPerSystem: number;
			galaxySize: number;
			distributePlanetsEvenly: boolean;
			quickStart: boolean;
			turnTimeLimitSeconds: number;
			opponentOptions: Array<{ name: string; type: number }>;
		}
	) {
		const payload = {
			gameId,
			gameOptions: {
				name: gameOptions.name,
				mainPlayerName: gameOptions.playerName,
				systemsToGenerate: gameOptions.systemsToGenerate,
				planetsPerSystem: gameOptions.planetsPerSystem,
				galaxySize: gameOptions.galaxySize,
				distributePlanetsEvenly: gameOptions.distributePlanetsEvenly,
				quickStart: gameOptions.quickStart,
				turnTimeLimitSeconds: gameOptions.turnTimeLimitSeconds,
				opponentOptions: gameOptions.opponentOptions
			},
			playerName: gameOptions.playerName
		};

		console.log('Sending CHANGE_GAME_OPTIONS with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, payload));
	}

	// Game actions (placeholder for actual game commands)
	sendGameAction(actionType: string, actionData: unknown) {
		this.send(new Message(MESSAGE_TYPE.END_TURN, { actionType, actionData }));
	}

	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.gameStore.reset();
	}
}

// Create singleton instances
export const multiplayerGameStore = createMultiplayerGameStore();
export const webSocketService = new WebSocketService(multiplayerGameStore);

// Export connection utility
export function connectToGame(url?: string) {
	return webSocketService.connect(url);
}
