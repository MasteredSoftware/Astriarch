import { get } from 'svelte/store';
import {
	MESSAGE_TYPE,
	Message,
	type IMessage,
	type IGame,
	type ServerGameOptions,
	type IEventNotificationsPayload,
	type EventNotification,
	EventNotificationType,
	isCreateGameResponse,
	isJoinGameResponse,
	isListGamesResponse,
	isStartGameResponse,
	isGameStateUpdate,
	isErrorMessage
} from 'astriarch-engine';

// Import the main game stores to update them when receiving multiplayer game state
import { clientGameModel, isGameRunning, gameActions } from '$lib/stores/gameStore';
import type { ClientModelData } from 'astriarch-engine';

// Import multiplayer store types and functionality from the centralized store
import {
	multiplayerGameStore,
	type ChatMessage,
	type MultiplayerGameState
} from '$lib/stores/multiplayerGameStore';

// Re-export types from engine for convenience
export type { IGame, ServerGameOptions };

// WebSocket connection management
class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private messageQueue: IMessage<unknown>[] = [];
	private isConnecting = false;
	private pingInterval: number | null = null;
	private readonly pingIntervalMs = 20000; // 20 seconds (less than backend's 30s timeout)

	constructor(private gameStore: typeof multiplayerGameStore) {}

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

					// Start the ping interval to keep the session alive
					this.startPingInterval();

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
					this.stopPingInterval();
					this.attemptReconnect();
				};

				this.ws.onerror = (error) => {
					console.error('WebSocket error:', error);
					this.isConnecting = false;
					this.gameStore.addNotification({
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
				type: 'error',
				message: 'Failed to reconnect to server after multiple attempts',
				timestamp: Date.now()
			});
		}
	}

	private handleEventNotifications(events: EventNotification[]) {
		for (const event of events) {
			// Convert EventNotificationType to a user-friendly notification type
			let notificationType:
				| 'info'
				| 'success'
				| 'warning'
				| 'error'
				| 'battle'
				| 'research'
				| 'construction'
				| 'fleet'
				| 'planet'
				| 'diplomacy' = 'info';

			switch (event.type) {
				case EventNotificationType.ResearchComplete:
				case EventNotificationType.ResearchStolen:
				case EventNotificationType.ResearchQueueEmpty:
					notificationType = 'research';
					break;
				case EventNotificationType.ImprovementBuilt:
				case EventNotificationType.ShipBuilt:
				case EventNotificationType.ImprovementDemolished:
					notificationType = 'construction';
					break;
				case EventNotificationType.DefendedAgainstAttackingFleet:
				case EventNotificationType.AttackingFleetLost:
				case EventNotificationType.PlanetCaptured:
				case EventNotificationType.PlanetLost:
					notificationType = 'battle';
					break;
				case EventNotificationType.PopulationGrowth:
				case EventNotificationType.PopulationStarvation:
				case EventNotificationType.PlanetLostDueToStarvation:
					notificationType = 'planet';
					break;
				case EventNotificationType.InsufficientFood:
				case EventNotificationType.FoodShortageRiots:
				case EventNotificationType.CitizensProtesting:
					notificationType = 'warning';
					break;
				case EventNotificationType.TradesExecuted:
					notificationType = 'success';
					break;
				case EventNotificationType.TradesNotExecuted:
					notificationType = 'error';
					break;
				default:
					notificationType = 'info';
			}

			this.gameStore.addNotification({
				type: notificationType,
				message: event.message,
				timestamp: Date.now()
			});
		}
	}

	private handleMessage(message: IMessage<unknown>) {
		console.log('Received message:', message);

		switch (message.type) {
			case MESSAGE_TYPE.LIST_GAMES:
				if (isListGamesResponse(message)) {
					this.gameStore.setAvailableGames(message.payload.games);
				} else {
					console.warn('LIST_GAMES payload missing games array:', message.payload);
				}
				break;

			case MESSAGE_TYPE.GAME_LIST_UPDATED:
				if (isListGamesResponse(message)) {
					this.gameStore.setAvailableGames(message.payload.games);
				} else {
					console.warn('GAME_LIST_UPDATED payload missing games array:', message.payload);
				}
				break;

			case MESSAGE_TYPE.GAME_STATE_UPDATE:
				if (isGameStateUpdate(message)) {
					if (message.payload.clientGameModel) {
						// Update the client game model with the real-time data from server
						const updatedClientGameModel = message.payload.clientGameModel as ClientModelData;
						clientGameModel.set(updatedClientGameModel);
						this.gameStore.setGameState(updatedClientGameModel);
						console.log('Received real-time game state update from server');
					} else if (message.payload.changes) {
						this.gameStore.applyChanges(message.payload.changes);
					} else {
						this.gameStore.setGameState(message.payload.gameState);

						// Fallback - update the main game stores if needed
						if (message.payload.gameState) {
							const gameState = message.payload.gameState as ClientModelData;
							clientGameModel.set(gameState);
							console.log('Updated client game state with fallback format');
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

						// Update the main game stores for multiplayer
						if (message.payload.gameState) {
							// The server sends a ClientModelData (player-specific view of the game)
							const clientGameState = message.payload.gameState as ClientModelData;
							clientGameModel.set(clientGameState);
							isGameRunning.set(true);
							gameActions.selectHomePlanet();

							// For multiplayer, we don't have access to the full GameModelData on the client
							// The clientGameModel contains everything the player needs to see
							console.log('Multiplayer game started! Updated client game state.');

							// Start the client-side game loop for real-time updates
							// Note: In multiplayer, time advancement happens on the server
							// The client loop only updates the UI and sends player actions
							gameActions.resumeGame();
						}

						this.gameStore.addNotification({
							type: 'success',
							message: 'Game started!',
							timestamp: Date.now()
						});
					} else {
						this.gameStore.addNotification({
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
						type: 'success',
						message: `Game created successfully!`,
						timestamp: Date.now()
					});
				} else if (isErrorMessage(message)) {
					this.gameStore.addNotification({
						type: 'error',
						message: message.payload.error || 'Failed to create game',
						timestamp: Date.now()
					});
				} else {
					console.warn('Unexpected CREATE_GAME payload format:', message.payload);
					this.gameStore.addNotification({
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

			case MESSAGE_TYPE.EVENT_NOTIFICATIONS: {
				const eventData = message.payload as IEventNotificationsPayload;
				this.handleEventNotifications(eventData.events);
				break;
			}

			case MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED:
				this.gameStore.addNotification({
					type: 'info',
					message: `Player activity updated`,
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.GAME_OVER:
				this.gameStore.addNotification({
					type: 'info',
					message: `Game has ended`,
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE:
				// Handle build queue update response
				if (
					message.payload &&
					typeof message.payload === 'object' &&
					'success' in message.payload
				) {
					const payload = message.payload as {
						success: boolean;
						error?: string;
						gameData?: unknown;
					};
					if (payload.success) {
						this.gameStore.addNotification({
							type: 'success',
							message: 'Build queue updated successfully',
							timestamp: Date.now()
						});

						// Update game state if provided
						if (payload.gameData) {
							this.gameStore.setGameState(payload.gameData);
						}
					} else {
						this.gameStore.addNotification({
							type: 'error',
							message: payload.error || 'Failed to update build queue',
							timestamp: Date.now()
						});
					}
				} else {
					console.warn('Unexpected UPDATE_PLANET_BUILD_QUEUE payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.SEND_SHIPS:
				// Handle send ships response
				if (message.payload && typeof message.payload === 'object') {
					if ('error' in message.payload) {
						const errorPayload = message.payload as { error?: string };
						this.gameStore.addNotification({
							type: 'error',
							message: errorPayload.error || 'Failed to send ships',
							timestamp: Date.now()
						});
					} else {
						this.gameStore.addNotification({
							type: 'success',
							message: 'Ships sent successfully',
							timestamp: Date.now()
						});
					}
				} else {
					// Success case - ships sent successfully
					this.gameStore.addNotification({
						type: 'success',
						message: 'Ships sent successfully',
						timestamp: Date.now()
					});
				}
				break;

			case MESSAGE_TYPE.ERROR:
				if (isErrorMessage(message)) {
					this.gameStore.addNotification({
						type: 'error',
						message: message.payload.error || 'An error occurred',
						timestamp: Date.now()
					});
				} else {
					console.warn('Unexpected ERROR payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.PONG:
				// Server responded to our ping - session is alive
				console.log('Received pong from server');

				// Check if PONG includes updated game state
				if (message.payload && typeof message.payload === 'object') {
					const payload = message.payload as Record<string, unknown>;

					if (payload.clientGameModel) {
						console.log('PONG included updated game state, updating client model');

						// Update the main game store with the fresh data from the server
						clientGameModel.set(payload.clientGameModel as ClientModelData);

						// Update game running state if needed
						const currentGameRunning = get(isGameRunning);
						if (payload.clientGameModel && !currentGameRunning) {
							isGameRunning.set(true);
						}

						// Optionally update current cycle if provided
						if (payload.currentCycle !== undefined) {
							// You could add a currentCycle store if needed
							console.log('Current game cycle:', payload.currentCycle);
						}
					}
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

	createGame(gameOptions: ServerGameOptions) {
		// Get current player name from store or use a default
		let currentPlayerName = 'Player';
		const unsubscribe = this.gameStore.subscribe((state: MultiplayerGameState) => {
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
				gameSpeed: 3, // Default to no time limit
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
		const unsubscribe = this.gameStore.subscribe((state: MultiplayerGameState) => {
			currentGameId = state.gameId || '';
		});
		unsubscribe();

		if (!currentGameId) {
			this.gameStore.addNotification({
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
			gameSpeed: number;
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
				gameSpeed: gameOptions.gameSpeed,
				opponentOptions: gameOptions.opponentOptions
			},
			playerName: gameOptions.playerName
		};

		console.log('Sending CHANGE_GAME_OPTIONS with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.CHANGE_GAME_OPTIONS, payload));
	}

	// Game actions
	sendGameAction(actionType: string, actionData: unknown) {
		this.send(new Message(MESSAGE_TYPE.END_TURN, { actionType, actionData }));
	}

	updatePlanetBuildQueue(
		gameId: string,
		planetId: number,
		action: 'add' | 'remove',
		productionItem?: unknown,
		index?: number
	) {
		const payload = {
			gameId,
			planetId,
			action,
			productionItem,
			index
		};

		console.log('Sending UPDATE_PLANET_BUILD_QUEUE with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.UPDATE_PLANET_BUILD_QUEUE, payload));
	}

	updatePlanetWorkerAssignments(
		gameId: string,
		planetId: number,
		farmerDiff: number,
		minerDiff: number,
		builderDiff: number
	) {
		const payload = {
			gameId,
			planetId,
			farmerDiff,
			minerDiff,
			builderDiff
		};

		console.log('Sending UPDATE_PLANET_OPTIONS with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.UPDATE_PLANET_OPTIONS, payload));
	}

	sendShips(
		gameId: string,
		planetIdSource: number,
		planetIdDest: number,
		shipsByType: {
			scouts: number[];
			destroyers: number[];
			cruisers: number[];
			battleships: number[];
		}
	) {
		const payload = {
			gameId,
			planetIdSource,
			planetIdDest,
			data: shipsByType
		};

		console.log('Sending SEND_SHIPS with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.SEND_SHIPS, payload));
	}

	private startPingInterval() {
		this.stopPingInterval(); // Clear any existing interval
		this.pingInterval = window.setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				console.log('Sending ping to keep session alive');
				this.send(new Message(MESSAGE_TYPE.PING, {}));
			}
		}, this.pingIntervalMs);
	}

	private stopPingInterval() {
		if (this.pingInterval !== null) {
			window.clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	disconnect() {
		this.stopPingInterval();
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.gameStore.reset();
	}
}

// Create singleton instances
export const webSocketService = new WebSocketService(multiplayerGameStore);

// Export connection utility
export function connectToGame(url?: string) {
	return webSocketService.connect(url);
}
