import { get } from 'svelte/store';
import {
	MESSAGE_TYPE,
	Message,
	type IMessage,
	type IGame,
	type ServerGameOptions,
	isCreateGameResponse,
	isJoinGameResponse,
	isListGamesResponse,
	isStartGameResponse,
	isGameStateUpdate,
	isErrorMessage,
	isGameSpeedAdjustment,
	isChatMessage,
	type GameCommand,
	type ClientEvent,
	ClientEventType,
	GameCommandType,
	EventApplicator,
	calculateRollingEventChecksum,
	type PlanetProductionItemData,
	type PlanetaryConflictData,
	TradeType,
	Player,
	CommandProcessor
} from 'astriarch-engine';
import {
	calculateClientModelChecksum,
	calculateClientModelChecksumComponents
} from 'astriarch-engine/src/utils/stateChecksum';

// Import the main game stores to update them when receiving multiplayer game state
import { activityStore } from '$lib/stores/activityStore';
import { clientGameModel, isGameRunning, gameActions, gameGrid } from '$lib/stores/gameStore';
import { PlayerStorage } from '$lib/utils/playerStorage';
import type {
	AdjustResearchPercentCommand,
	CancelResearchItemCommand,
	CancelTradeCommand,
	ClearWaypointCommand,
	ClientModelData,
	DemolishImprovementCommand,
	FleetAttackFailedEvent,
	FleetDefenseSuccessEvent,
	PlanetCapturedEvent,
	PlanetLostEvent,
	ProductionItemQueuedEvent,
	QueueProductionItemCommand,
	RemoveProductionItemCommand,
	SendShipsCommand,
	SetWaypointCommand,
	SubmitResearchItemCommand,
	SubmitTradeCommand,
	TradesProcessedEvent,
	UpdatePlanetOptionsCommand,
	UpdatePlanetWorkerAssignmentsCommand
} from 'astriarch-engine'; // Import multiplayer store types and functionality from the centralized store
import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';

// Import audio service for game music
import { audioService } from '$lib/services/audioService';

// Import environment configuration
import { getBackendWsUrl, getHealthCheckUrl, config } from '$lib/config/environment';

// Re-export types from engine for convenience
export type { IGame, ServerGameOptions };

// WebSocket connection management
class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private messageQueue: IMessage<unknown>[] = []; // Queue for outgoing messages
	private incomingMessageQueue: IMessage<unknown>[] = []; // Queue for incoming messages
	private isProcessingMessage = false; // Flag to prevent concurrent incoming message processing
	private isSendingMessage = false; // Flag to prevent concurrent outgoing message sending
	private isConnecting = false;
	private pingInterval: number | null = null;
	private readonly pingIntervalMs = 20000; // 20 seconds (less than backend's 30s timeout)
	private gameSyncInterval: number | null = null;
	private readonly gameSyncIntervalMs = 10000; // 10 seconds for game state synchronization
	private autoQueuePending = false; // True when waiting for auto-queue command response
	private autoQueueRequested = false; // True when auto-queue check is needed
	private pendingCommands = new Map<
		string,
		{ timestamp: number; type: GameCommandType; events: ClientEvent[]; acked: boolean }
	>(); // Track optimistically applied commands

	constructor(private gameStore: typeof multiplayerGameStore) {}

	// Helper method to get current gameId from store
	private getCurrentGameId(): string | null {
		return get(this.gameStore).gameId;
	}

	// Helper method to get current gameId with error handling
	private requireGameId(): string {
		const gameId = this.getCurrentGameId();
		if (!gameId) {
			throw new Error('No active game session - gameId not found in store');
		}
		return gameId;
	}

	// Helper method to check if current player is the host (position 0)
	private isHost(): boolean {
		const storeState = get(this.gameStore);
		return storeState.playerPosition === 0;
	}

	// Helper method to establish session via HTTP before WebSocket connection
	private async establishSession(): Promise<void> {
		try {
			// Make a simple HTTP request to the health endpoint to establish a session
			// This will create a session and set the connect.sid cookie
			const response = await fetch(getHealthCheckUrl(), {
				method: 'GET',
				credentials: 'include' // Important: include cookies in the request
			});

			if (!response.ok) {
				console.warn('Failed to establish session via health check:', response.status);
			} else {
				console.log('Session established via HTTP health check');
			}
		} catch (error) {
			console.warn('Error establishing session:', error);
		}
	}

	connect(url?: string): Promise<void> {
		if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
			return Promise.resolve();
		}

		this.isConnecting = true;

		// Use provided URL or default to environment configuration
		const wsUrl = url || getBackendWsUrl();

		// First establish a session via HTTP, then connect WebSocket
		return this.establishSession().then(() => {
			return new Promise<void>((resolve, reject) => {
				try {
					this.ws = new WebSocket(wsUrl);

					this.ws.onopen = () => {
						console.log('WebSocket connected');
						this.isConnecting = false;
						this.reconnectAttempts = 0;
						this.gameStore.setConnected(true);

						// Start the ping interval to keep the session alive
						this.startPingInterval();

						// Load player name from localStorage, or use default
						const storedPlayerName = PlayerStorage.getPlayerNameWithFallback('Player');
						this.gameStore.setPlayerName(storedPlayerName);

						// Process queued messages using the queue system
						if (this.messageQueue.length > 0) {
							this.processNextOutgoingMessage();
						}

						resolve();
					};

					this.ws.onmessage = (event) => {
						try {
							const message: IMessage<unknown> = JSON.parse(event.data);
							// Queue incoming message for sequential processing
							this.enqueueIncomingMessage(message);
						} catch (error) {
							console.error('Failed to parse WebSocket message:', error);
						}
					};

					this.ws.onclose = () => {
						console.log('WebSocket disconnected');
						this.isConnecting = false;
						this.gameStore.setConnected(false);
						this.stopPingInterval();
						this.stopGameSyncInterval();
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

	/**
	 * Enqueue an incoming message and process it sequentially.
	 * This prevents race conditions when multiple messages arrive simultaneously.
	 */
	private enqueueIncomingMessage(message: IMessage<unknown>) {
		this.incomingMessageQueue.push(message);
		this.processNextIncomingMessage();
	}

	/**
	 * Process the next message in the queue if not already processing.
	 * This ensures messages are handled one at a time, in order.
	 */
	private async processNextIncomingMessage() {
		// If already processing a message, wait for it to complete
		if (this.isProcessingMessage) {
			return;
		}

		// Get next message from queue
		const message = this.incomingMessageQueue.shift();
		if (!message) {
			return;
		}

		// Mark as processing to prevent concurrent execution
		this.isProcessingMessage = true;

		try {
			await this.handleMessage(message);
		} catch (error) {
			console.error('Error processing message:', error);
		} finally {
			// Mark as done and process next message
			this.isProcessingMessage = false;

			// Process next message if any are queued
			if (this.incomingMessageQueue.length > 0) {
				this.processNextIncomingMessage();
			}
		}
	}

	private logEventChainBreakdown(
		events: ClientEvent[],
		previousChecksum: string,
		expectedChecksum: string
	): void {
		// Only log detailed breakdown if explicitly enabled (can be noisy in production)
		if (!config.logEventChainDesyncErrors) {
			return;
		}

		console.error('🚨 EVENT CHAIN DESYNC DETECTED! 🚨');
		console.error(`Server event checksum: ${expectedChecksum}`);
		console.error(`Previous checksum: ${previousChecksum}`);
		console.error(`Number of events: ${events.length}`);

		// Log each event and calculate individual checksums to identify where chain breaks
		console.error('\n📋 EVENT CHAIN BREAKDOWN:');
		let rollingChecksum = previousChecksum;
		events.forEach((event, index) => {
			// Calculate checksum for this single event
			const eventChecksum = calculateRollingEventChecksum([event], rollingChecksum);
			const eventJson = JSON.stringify(event);
			const eventSize = eventJson.length;

			console.error(`\n  Event ${index + 1}/${events.length}:`);
			console.error(`    Type: ${event.type}`);
			console.error(`    Input checksum: ${rollingChecksum}`);
			console.error(`    Output checksum: ${eventChecksum}`);
			console.error(`    Event size: ${eventSize} bytes`);
			console.error(`    Event data:`, JSON.stringify(event.data, null, 2));

			// Update rolling checksum for next event
			rollingChecksum = eventChecksum;
		});

		const finalChecksum = calculateRollingEventChecksum(events, previousChecksum);
		console.error(`\n  Final client checksum: ${finalChecksum}`);
		console.error(`  Expected server checksum: ${expectedChecksum}`);
		console.error(`  Match: ${finalChecksum === expectedChecksum ? '✓' : '✗'}`);
	}

	private validateStateChecksum(
		currentModel: ClientModelData,
		serverChecksum?: string,
		serverChecksumComponents?: { planets: string; fleets: string }
	): void {
		// Only validate if checksum is provided and validation is enabled
		if (!serverChecksum || !config.enableClientModelChecksumValidation) {
			return;
		}

		try {
			const ourStateChecksum = calculateClientModelChecksum(currentModel);
			if (ourStateChecksum !== serverChecksum) {
				console.error('🚨 STATE DESYNC DETECTED! 🚨');
				console.error(`Server state checksum: ${serverChecksum}`);
				console.error(`Client state checksum: ${ourStateChecksum}`);

				// Calculate component checksums to identify which part diverged
				const ourComponents = calculateClientModelChecksumComponents(currentModel);
				console.error('State checksum breakdown:');
				console.error('CLIENT:');
				console.error('- Planets hash:', ourComponents.planets);
				console.error('- Fleets hash:', ourComponents.fleets);
				if (serverChecksumComponents) {
					console.error('SERVER:');
					console.error('- Planets hash:', serverChecksumComponents.planets);
					console.error('- Fleets hash:', serverChecksumComponents.fleets);

					// If fleet hash differs, show the stored FLEET_DEFENSE_SUCCESS data
					if (ourComponents.fleets !== serverChecksumComponents.fleets) {
						console.error('\n🔍 FLEET HASH MISMATCH - FULL STATE COMPARISON:');

						// Show client planetary fleets
						console.error('\n📱 CLIENT PLANETARY FLEETS:');
						Object.keys(currentModel.mainPlayerOwnedPlanets)
							.map(Number)
							.sort((a, b) => a - b)
							.forEach((planetId) => {
								const planet = currentModel.mainPlayerOwnedPlanets[planetId];
								if (planet && planet.planetaryFleet && planet.planetaryFleet.starships.length > 0) {
									console.error(`  Planet ${planetId} (${planet.name}):`);
									console.error(`    Composition Hash: ${planet.planetaryFleet.compositionHash}`);
									console.error(
										`    Ships:`,
										JSON.stringify(
											planet.planetaryFleet.starships.map((s) => ({
												id: s.id,
												type: s.type
											}))
										)
									);
								}
							});

						// Show client fleets in transit
						console.error('\n📱 CLIENT FLEETS IN TRANSIT:');
						currentModel.mainPlayer.fleetsInTransit.forEach((fleet) => {
							console.error(`  Fleet ${fleet.id}:`);
							console.error(`    Composition Hash: ${fleet.compositionHash}`);
							console.error(
								`    Ships:`,
								JSON.stringify(
									fleet.starships.map((s) => ({
										id: s.id,
										type: s.type
									}))
								)
							);
						});

						// Show outgoing fleets from all planets
						console.error('\n📱 CLIENT OUTGOING FLEETS FROM PLANETS:');
						Object.keys(currentModel.mainPlayerOwnedPlanets)
							.map(Number)
							.sort((a, b) => a - b)
							.forEach((planetId) => {
								const planet = currentModel.mainPlayerOwnedPlanets[planetId];
								if (planet && planet.outgoingFleets && planet.outgoingFleets.length > 0) {
									planet.outgoingFleets.forEach((fleet) => {
										console.error(`  Planet ${planetId} → Fleet ${fleet.id}:`);
										console.error(`    Composition Hash: ${fleet.compositionHash}`);
										console.error(
											`    Ships:`,
											JSON.stringify(
												fleet.starships.map((s) => ({
													id: s.id,
													type: s.type
												}))
											)
										);
									});
								}
							});

						// Show all FLEET_DEFENSE_SUCCESS events if available
						const allFDS = (globalThis as Record<string, unknown>)['__allFleetDefenseSuccess'];
						if (allFDS && Array.isArray(allFDS) && allFDS.length > 0) {
							console.error(`\n⚔️ ALL ${allFDS.length} FLEET_DEFENSE_SUCCESS EVENTS:`);
							allFDS.forEach((fds: unknown, index: number) => {
								const fdsData = fds as Record<string, unknown>;
								console.error(`\n  Event ${index + 1}:`);
								console.error('    Planet ID:', fdsData['planetId']);
								console.error('    Attacking Fleet ID:', fdsData['attackingFleetId']);
								console.error(
									'    Planet fleet BEFORE:',
									JSON.stringify(fdsData['planetFleetBefore'])
								);
								console.error('    Planet fleet hash BEFORE:', fdsData['planetFleetHashBefore']);
								console.error(
									'    Winning fleet FROM SERVER:',
									JSON.stringify(fdsData['winningFleetFromServer'])
								);
								console.error('    Winning fleet hash:', fdsData['winningFleetHash']);
								console.error(
									'    Planet fleet AFTER:',
									JSON.stringify(fdsData['planetFleetAfter'])
								);
								console.error('    Planet fleet hash AFTER:', fdsData['planetFleetHashAfter']);
								console.error(
									'    Fleets in transit BEFORE:',
									JSON.stringify(fdsData['fleetsInTransitBefore'])
								);
								console.error(
									'    Fleets in transit AFTER:',
									JSON.stringify(fdsData['fleetsInTransitAfter'])
								);
							});
							// Clear the array for next batch of events
							(globalThis as Record<string, unknown>)['__allFleetDefenseSuccess'] = [];
						}
					}
				}

				// Show notification to user
				this.gameStore.addNotification({
					type: 'error',
					message: 'Game state desync detected - requesting full resync',
					timestamp: Date.now()
				});

				// Request full state sync to recover
				this.requestStateSync();
			} else {
				console.debug('State checksum valid ✓', ourStateChecksum);
			}
		} catch (error) {
			console.error('Error calculating state checksum:', error);
		}
	}

	private tradesProcessedEventToNotifications(event: TradesProcessedEvent): void {
		const { data } = event;

		// Summarize all executed and non-executed trades
		const resourcesBought = { food: 0, ore: 0, iridium: 0, energySpent: 0, tradeCount: 0 };
		const resourcesSold = { food: 0, ore: 0, iridium: 0, energyEarned: 0, tradeCount: 0 };
		const resourcesNotBought = { food: 0, ore: 0, iridium: 0, energySpent: 0, tradeCount: 0 };
		const resourcesNotSold = { food: 0, ore: 0, iridium: 0, energyEarned: 0, tradeCount: 0 };

		for (const tradeResult of data.tradesProcessed) {
			const { executedStatus } = tradeResult;

			let rbTarget = resourcesNotBought;
			let rsTarget = resourcesNotSold;
			if (executedStatus.executed) {
				rbTarget = resourcesBought;
				rsTarget = resourcesSold;
			}

			if (executedStatus.tradeType === TradeType.BUY) {
				rbTarget.food += executedStatus.foodAmount;
				rbTarget.ore += executedStatus.oreAmount;
				rbTarget.iridium += executedStatus.iridiumAmount;
				rbTarget.energySpent += executedStatus.tradeEnergyAmount;
				rbTarget.tradeCount++;
			} else {
				// SELL
				rsTarget.food += executedStatus.foodAmount;
				rsTarget.ore += executedStatus.oreAmount;
				rsTarget.iridium += executedStatus.iridiumAmount;
				rsTarget.energyEarned += executedStatus.tradeEnergyAmount;
				rsTarget.tradeCount++;
			}
		}

		// Create message for executed trades
		if (resourcesBought.tradeCount || resourcesSold.tradeCount) {
			const tradeCount = resourcesBought.tradeCount + resourcesSold.tradeCount;
			let message =
				tradeCount > 1 ? `${tradeCount} Trades Executed,` : `${tradeCount} Trade Executed,`;

			if (resourcesBought.energySpent) {
				message += ` Spent ${resourcesBought.energySpent.toFixed(2)} energy buying:`;
				if (resourcesBought.food) message += ` ${resourcesBought.food} food,`;
				if (resourcesBought.ore) message += ` ${resourcesBought.ore} ore,`;
				if (resourcesBought.iridium) message += ` ${resourcesBought.iridium} iridium,`;
			}

			if (resourcesSold.energyEarned) {
				message += ` Earned ${resourcesSold.energyEarned.toFixed(2)} energy selling:`;
				if (resourcesSold.food) message += ` ${resourcesSold.food} food,`;
				if (resourcesSold.ore) message += ` ${resourcesSold.ore} ore,`;
				if (resourcesSold.iridium) message += ` ${resourcesSold.iridium} iridium,`;
			}

			message = message.replace(/,$/, ''); // Remove trailing comma

			this.gameStore.addNotification({
				type: 'success',
				message,
				timestamp: Date.now()
			});
		}

		// Create separate notification for non-executed trades if any
		if (resourcesNotBought.tradeCount || resourcesNotSold.tradeCount) {
			const failedTradeCount = resourcesNotBought.tradeCount + resourcesNotSold.tradeCount;
			let failedMessage =
				failedTradeCount > 1
					? `${failedTradeCount} Trades Not Executed,`
					: `${failedTradeCount} Trade Not Executed,`;

			if (resourcesNotBought.tradeCount) {
				failedMessage += ` Could not Buy:`;
				if (resourcesNotBought.food) failedMessage += ` ${resourcesNotBought.food} food,`;
				if (resourcesNotBought.ore) failedMessage += ` ${resourcesNotBought.ore} ore,`;
				if (resourcesNotBought.iridium) failedMessage += ` ${resourcesNotBought.iridium} iridium,`;
			}

			if (resourcesNotSold.tradeCount) {
				failedMessage += ` Could not Sell:`;
				if (resourcesNotSold.food) failedMessage += ` ${resourcesNotSold.food} food,`;
				if (resourcesNotSold.ore) failedMessage += ` ${resourcesNotSold.ore} ore,`;
				if (resourcesNotSold.iridium) failedMessage += ` ${resourcesNotSold.iridium} iridium,`;
			}

			failedMessage = failedMessage.replace(/,$/, ''); // Remove trailing comma

			// Add failed trades notification separately
			this.gameStore.addNotification({
				type: 'warning',
				message: failedMessage,
				timestamp: Date.now()
			});
		}
	}

	private convertClientEventToNotification(event: ClientEvent): void {
		let notificationType:
			| 'info'
			| 'success'
			| 'warning'
			| 'error'
			| 'battle'
			| 'research'
			| 'construction'
			| 'fleet'
			| 'planet' = 'info';
		let message = '';

		switch (event.type) {
			// Command response events (typically don't need UI notifications)
			case ClientEventType.PRODUCTION_ITEM_QUEUED: {
				// Check if this was an auto-queued command response
				const queuedEvent = event as ProductionItemQueuedEvent;
				if (queuedEvent.data?.metadata?.autoQueued) {
					// This was our auto-queue command - mark as complete and check again
					this.autoQueuePending = false;
					console.log('Auto-queue command completed - checking for next eligible planet');
					//NOTE: throttle auto-queue messages to give server time to process and avoid desync issues if quickly building defenders
					setTimeout(() => this.processAutoQueue(), 100);
				}
				return;
			}
			case ClientEventType.PRODUCTION_ITEM_REMOVED:
			case ClientEventType.FLEET_LAUNCHED:
			case ClientEventType.WAYPOINT_SET:
			case ClientEventType.WAYPOINT_CLEARED:
			case ClientEventType.RESEARCH_QUEUED:
			case ClientEventType.RESEARCH_CANCELLED:
			case ClientEventType.RESEARCH_PERCENT_ADJUSTED:
			case ClientEventType.TRADE_SUBMITTED:
			case ClientEventType.TRADE_CANCELLED:
			case ClientEventType.PLANET_WORKER_ASSIGNMENTS_UPDATED:
			case ClientEventType.PLANET_OPTIONS_UPDATED:
				// These are command confirmations - no UI notification needed
				return;

			// Server-only events that may need UI notifications
			case ClientEventType.TRADES_PROCESSED:
				this.tradesProcessedEventToNotifications(event as TradesProcessedEvent);
				return;
			case ClientEventType.PLANET_CAPTURED: {
				notificationType = 'battle';
				const { data } = event as PlanetCapturedEvent;
				message = `Planet ${data.planetName} captured`;
				if (data.previousOwnerName) {
					message += ` from ${data.previousOwnerName}`;
				}
				break;
			}
			case ClientEventType.PLANET_LOST: {
				notificationType = 'battle';
				const { data } = event as PlanetLostEvent;
				message = `Planet ${data.planetName} lost to ${data.newOwnerName}`;
				break;
			}
			case ClientEventType.FLEET_ATTACK_FAILED: {
				notificationType = 'battle';
				const { data } = event as FleetAttackFailedEvent;
				message = `Fleet destroyed attacking ${data.planetName}`;
				if (data.defenderName) {
					message += ` owned by ${data.defenderName}`;
				}
				break;
			}
			case ClientEventType.FLEET_DEFENSE_SUCCESS: {
				notificationType = 'battle';
				const { data } = event as FleetDefenseSuccessEvent;
				message = `Successfully defended ${data.planetName} against ${data.attackerName}`;
				break;
			}
			case ClientEventType.RESEARCH_STOLEN: {
				notificationType = 'research';
				const data = event.data as {
					researchName: string;
					planetName: string;
					wasVictim: boolean;
					thiefPlayerName?: string;
					victimPlayerName?: string;
				};
				message = data.wasVictim
					? `${data.researchName} was stolen by ${data.thiefPlayerName} at ${data.planetName}`
					: `You stole ${data.researchName} from ${data.victimPlayerName} at ${data.planetName}`;
				break;
			}
			default:
				console.warn('Unknown ClientEventType:', event.type);
				return;
		}

		if (!message) {
			return;
		}
		const notification = {
			type: notificationType,
			message,
			timestamp: Date.now()
		};

		// For battle events with conflict data, add to activity store with full event data
		const isBattleEvent =
			event.type === ClientEventType.FLEET_ATTACK_FAILED ||
			event.type === ClientEventType.FLEET_DEFENSE_SUCCESS ||
			event.type === ClientEventType.PLANET_CAPTURED ||
			event.type === ClientEventType.PLANET_LOST;

		if (
			isBattleEvent &&
			event.data &&
			typeof event.data === 'object' &&
			'conflictData' in event.data
		) {
			const eventData = event.data as Record<string, unknown>;
			activityStore.addNotificationWithEventData(
				notification,
				event, // Pass the full ClientEvent
				undefined, // No ClientNotification
				eventData['conflictData'] as unknown as PlanetaryConflictData // Pass the PlanetaryConflictData
			);
		} else {
			// For non-battle events, add to the game store notification system
			// (which will be picked up by activityStore subscription)
			this.gameStore.addNotification(notification);
		}
	}

	private async handleMessage(message: IMessage<unknown>) {
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
					// Only process if we're actually in a game
					const currentGameId = get(this.gameStore).gameId;
					if (!currentGameId) {
						console.log('Ignoring GAME_STATE_UPDATE - not in a game');
						break;
					}

					if (message.payload.clientGameModel) {
						// Update the client game model with the real-time data from server
						const updatedClientGameModel = message.payload.clientGameModel as ClientModelData;

						clientGameModel.set(updatedClientGameModel);

						// Clear the flag to allow future time advancement requests
						gameActions.clearServerTimeAdvancementFlag();
					}
				} else {
					console.warn('Unexpected GAME_STATE_UPDATE payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.START_GAME:
				if (isStartGameResponse(message)) {
					if (message.payload.success) {
						this.gameStore.setCurrentView('game');

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

						// Start game sync interval if this player is the host
						this.startGameSyncInterval();
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

			case MESSAGE_TYPE.RESUME_GAME:
				// Handle resume game response - similar to START_GAME but for existing games
				if (message.payload && typeof message.payload === 'object') {
					const payload = message.payload as {
						clientGameModel?: ClientModelData;
						playerPosition?: number;
						sessionId?: string;
					};
					if (payload.clientGameModel) {
						this.gameStore.setCurrentView('game');

						// Store session ID if provided
						if (payload.sessionId && typeof payload.sessionId === 'string') {
							this.gameStore.setSessionId(payload.sessionId);
						}

						// Update the main game stores for multiplayer
						const clientGameState = payload.clientGameModel as ClientModelData;
						clientGameModel.set(clientGameState);

						// Don't automatically set game as running - wait for server to tell us
						// if the game is paused or resumed based on player connectivity
						gameActions.selectHomePlanet();

						this.gameStore.addNotification({
							type: 'success',
							message: 'Rejoined game successfully!',
							timestamp: Date.now()
						});

						console.log(
							'Game rejoined successfully! Updated client game state. Waiting for server status...'
						);

						// If player position is provided, update it
						if (typeof payload.playerPosition === 'number') {
							this.gameStore.setPlayerPosition(payload.playerPosition);
						}

						// Start game sync interval if this player is the host and game is in progress
						this.startGameSyncInterval();
					} else {
						this.gameStore.addNotification({
							type: 'error',
							message: 'Failed to resume game - invalid response',
							timestamp: Date.now()
						});
					}
				} else {
					console.warn('Unexpected RESUME_GAME payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.CREATE_GAME:
				if (isCreateGameResponse(message)) {
					this.gameStore.setGameId(message.payload.gameId);
					this.gameStore.setGameJoined(true);
					this.gameStore.setCurrentView('game_options');

					// Game creator is always at position 0 (following old game pattern)
					this.gameStore.setPlayerPosition(0);
					console.log('Created game as host at position 0');

					// As the host, we may need to start sync interval when the game actually starts
					// (The interval will only start if we're in an active game)

					// Store session ID if provided
					const payload = message.payload as unknown as Record<string, unknown>;
					if (payload['sessionId'] && typeof payload['sessionId'] === 'string') {
						this.gameStore.setSessionId(payload['sessionId']);
					}

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

						// Store player position if provided (following old game pattern)
						const payload = message.payload as unknown as Record<string, unknown>;
						if (typeof payload['playerPosition'] === 'number') {
							this.gameStore.setPlayerPosition(payload['playerPosition']);
							console.log('Joined game at player position:', payload['playerPosition']);
						}

						// Store session ID if provided
						if (payload['sessionId'] && typeof payload['sessionId'] === 'string') {
							this.gameStore.setSessionId(payload['sessionId']);
						}

						this.gameStore.addNotification({
							type: 'success',
							message: 'Successfully joined game!',
							timestamp: Date.now()
						});
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

				// The backend automatically sends updated game list to lobby players
				// so the current game will be updated with new options

				this.gameStore.addNotification({
					type: 'info',
					message: 'Game options updated',
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.CHANGE_PLAYER_NAME:
				// Player name has been updated
				console.log('Received CHANGE_PLAYER_NAME:', message.payload);

				// The backend automatically sends updated game list to lobby players
				// so the current game will be updated with the new player name

				this.gameStore.addNotification({
					type: 'info',
					message: 'Player name updated',
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.CHAT_MESSAGE: {
				if (isChatMessage(message)) {
					const chatData = message.payload;
					this.gameStore.addChatMessage(chatData);
				}
				break;
			}

			case MESSAGE_TYPE.CHAT_ROOM_SESSIONS_UPDATED:
				this.gameStore.addNotification({
					type: 'info',
					message: `Player activity updated`,
					timestamp: Date.now()
				});
				break;

			case MESSAGE_TYPE.GAME_OVER: {
				console.log('Game over:', message.payload);

				// Extract game over information
				const gameOverData = message.payload as {
					winningPlayer?: { id: string; name: string; position: number } | null;
					playerWon: boolean;
					score: number;
					gameData?: unknown;
					allHumansDestroyed: boolean;
				};
				const currentPlayerPosition = get(multiplayerGameStore).playerPosition;

				// Determine if current player won
				const playerWon =
					gameOverData.winningPlayer &&
					gameOverData.winningPlayer.position === currentPlayerPosition;

				// Play end game music
				if (audioService) {
					audioService.endGame();
				}

				// Set game over state
				multiplayerGameStore.setGameOver({
					gameEnded: true,
					playerWon: playerWon || false,
					finalScore: gameOverData.score || 0,
					winningPlayer: gameOverData.winningPlayer || null,
					allHumansDestroyed: gameOverData.allHumansDestroyed || false
				});

				// Add notification
				const gameOverMessage = playerWon
					? 'Congratulations! You won the game!'
					: gameOverData.allHumansDestroyed
						? 'Game Over - All human players have been destroyed!'
						: `Game Over - ${gameOverData.winningPlayer?.name || 'Unknown'} wins!`;

				multiplayerGameStore.addNotification({
					type: playerWon ? 'success' : 'info',
					message: gameOverMessage,
					timestamp: Date.now(),
					duration: 10000 // Show for 10 seconds
				});
				break;
			}

			case MESSAGE_TYPE.PLAYER_ELIMINATED:
				if (
					message.payload &&
					typeof message.payload === 'object' &&
					'playerName' in message.payload &&
					'reason' in message.payload
				) {
					const payload = message.payload as {
						playerName: string;
						playerId: string;
						gameId: string;
						reason: 'resigned' | 'destroyed';
					};

					// Show a modal to inform the player about the elimination
					this.gameStore.setPlayerEliminatedModal({
						show: true,
						playerName: payload.playerName,
						playerId: payload.playerId,
						reason: payload.reason
					});

					// Also add a notification for the activity log
					const notificationMessage =
						payload.reason === 'resigned'
							? `${payload.playerName} has resigned from the game`
							: `${payload.playerName} has been destroyed`;

					this.gameStore.addNotification({
						type: 'warning',
						message: notificationMessage,
						timestamp: Date.now()
					});
				}
				break;

			case MESSAGE_TYPE.PLAYER_DISCONNECTED:
				if (
					message.payload &&
					typeof message.payload === 'object' &&
					'playerName' in message.payload
				) {
					const payload = message.payload as { playerName: string; gameId: string };
					this.gameStore.addNotification({
						type: 'warning',
						message: `${payload.playerName} has disconnected. Game paused.`,
						timestamp: Date.now()
					});
					// Set the game paused state (will be followed by GAME_PAUSED message with reason)
					this.gameStore.setGamePaused(true, 'waiting_for_players');
					// Pause the client-side game loop
					gameActions.pauseGame();
					// Stop game sync interval when game is paused
					this.stopGameSyncInterval();
				}
				break;

			case MESSAGE_TYPE.GAME_PAUSED:
				if (message.payload && typeof message.payload === 'object' && 'reason' in message.payload) {
					const payload = message.payload as { reason: string; gameId: string };
					const displayReason =
						payload.reason === 'waiting_for_players'
							? 'waiting for disconnected player to reconnect'
							: payload.reason;

					this.gameStore.addNotification({
						type: 'warning',
						message: `Game paused - ${displayReason}`,
						timestamp: Date.now()
					});

					// Set the game paused state to show the modal
					this.gameStore.setGamePaused(true, payload.reason);

					// Pause the client-side game loop and set game as not running
					isGameRunning.set(false);
					gameActions.pauseGame();
					// Stop game sync interval when game is paused
					this.stopGameSyncInterval();
				}
				break;

			case MESSAGE_TYPE.GAME_RESUMED:
				if (message.payload && typeof message.payload === 'object' && 'gameId' in message.payload) {
					this.gameStore.addNotification({
						type: 'success',
						message: 'All players reconnected. Game resumed.',
						timestamp: Date.now()
					});

					// Clear the game paused state to hide the modal
					this.gameStore.setGamePaused(false);

					// Resume the client-side game loop and set game as running
					isGameRunning.set(true);
					gameActions.resumeGame();
					// Start game sync interval if this player is the host
					this.startGameSyncInterval();
				}
				break;

			case MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT:
				if (isGameSpeedAdjustment(message)) {
					const { newSpeed, playerId } = message.payload;

					// Update the client game model's game speed directly
					const currentClientModel = get(clientGameModel);
					if (currentClientModel) {
						const updatedClientModel = {
							...currentClientModel,
							gameOptions: {
								...currentClientModel.gameOptions,
								gameSpeed: newSpeed
							}
						};
						clientGameModel.set(updatedClientModel);
					}

					// Optional: Show notification about who changed the speed
					if (playerId) {
						this.gameStore.addNotification({
							type: 'info',
							message: `Game speed changed to ${newSpeed}`,
							timestamp: Date.now()
						});
					}
				}
				break;

			case MESSAGE_TYPE.PLAYER_RECONNECTED:
				if (
					message.payload &&
					typeof message.payload === 'object' &&
					'playerName' in message.payload
				) {
					const payload = message.payload as {
						playerName: string;
						gameId: string;
						allPlayersConnected?: boolean;
					};
					if (payload.allPlayersConnected) {
						this.gameStore.addNotification({
							type: 'success',
							message: `All players have reconnected. You can now resume the game.`,
							timestamp: Date.now()
						});
					} else {
						this.gameStore.addNotification({
							type: 'info',
							message: `${payload.playerName} has reconnected.`,
							timestamp: Date.now()
						});
					}
				}
				break;

			case MESSAGE_TYPE.CLIENT_EVENT: {
				// Handle new event-driven architecture messages
				const payload = message.payload as {
					events: ClientEvent[];
					stateChecksum?: string;
					clientModelChecksum?: string;
					checksumComponents?: { planets: string; fleets: string };
					currentCycle: number;
				};
				console.log(`Received ${payload.events.length} client events from server`);

				// CRITICAL: Pause game loop to prevent race conditions during event application
				// The client game loop can modify the model (health regeneration, etc.) which would
				// cause checksum mismatches if it runs between event application and validation
				console.log('⏸️ Pausing game loop for event processing');
				gameActions.pauseGame();

				// Get current client model
				const currentModel = get(clientGameModel);
				if (!currentModel) {
					console.warn('No client model available to apply events');
					gameActions.resumeGame(); // Resume game loop before exiting
					break;
				}

				// Get the grid for event application (needed for fleet distance calculations)
				const grid = get(gameGrid);

				// Check if these events were already applied optimistically
				const eventsToApply: ClientEvent[] = [];
				const matchedCommandIds = new Set<string>();

				for (const event of payload.events) {
					let wasOptimisticallyApplied = false;

					// Check if this event matches any pending command
					for (const [commandId, pendingCommand] of this.pendingCommands.entries()) {
						// Match by event type and basic data (simplified matching)
						const matchingEvent = pendingCommand.events.find((e) => {
							if (e.type !== event.type) return false;

							// For most events, matching type is sufficient since they're player-specific
							// and we only have one pending command of each type at a time
							// More sophisticated matching could compare event.data fields if needed
							return true;
						});

						if (matchingEvent) {
							console.log(
								`🔄 Event ${event.type} matches pending command [${commandId}] - skipping re-application`
							);
							wasOptimisticallyApplied = true;
							matchedCommandIds.add(commandId);
							break;
						}
					}

					if (!wasOptimisticallyApplied) {
						eventsToApply.push(event);
					}
				}

				// Remove matched commands from pending (server confirmed them)
				for (const commandId of matchedCommandIds) {
					const pending = this.pendingCommands.get(commandId);
					console.log(
						`✅ Server confirmed optimistic command [${commandId}] of type ${pending?.type}`
					);
					this.pendingCommands.delete(commandId);
				}

				// Apply only non-optimistic events to the client model
				console.log(
					`\n📦 Processing events: ${payload.events.length} total, ${eventsToApply.length} to apply (${payload.events.length - eventsToApply.length} already applied optimistically):`
				);
				payload.events.forEach((e, i) =>
					console.log(
						`  ${i + 1}. ${e.type} ${eventsToApply.includes(e) ? '' : '[SKIP - optimistic]'}`
					)
				);

				for (const event of eventsToApply) {
					const ownedPlanetsBefore = Object.keys(currentModel.mainPlayerOwnedPlanets)
						.map(Number)
						.sort();
					console.log(`\n⚙️ Applying event: ${event.type}`);
					console.log(`   Owned planets BEFORE: [${ownedPlanetsBefore.join(', ')}]`);

					EventApplicator.applyEvent(currentModel, event, grid!);

					const ownedPlanetsAfter = Object.keys(currentModel.mainPlayerOwnedPlanets)
						.map(Number)
						.sort();
					console.log(`   Owned planets AFTER:  [${ownedPlanetsAfter.join(', ')}]`);

					// Convert event to user notification
					this.convertClientEventToNotification(event);
				}

				// Still convert ALL events to notifications (even optimistically applied ones need notifications)
				for (const event of payload.events) {
					if (!eventsToApply.includes(event)) {
						this.convertClientEventToNotification(event);
					}
				}

				// Validate event checksum if provided (for player commands)
				if (payload.stateChecksum) {
					const previousChecksum = currentModel.mainPlayer.lastEventChecksum || '';
					try {
						const ourChecksum = calculateRollingEventChecksum(payload.events, previousChecksum);
						if (ourChecksum !== payload.stateChecksum) {
							this.logEventChainBreakdown(payload.events, previousChecksum, payload.stateChecksum);

							this.gameStore.addNotification({
								type: 'error',
								message: 'Game sync error - requesting full resync',
								timestamp: Date.now()
							});
							this.requestStateSync();
						} else {
							console.debug('Event chain valid ✓', ourChecksum);
						}

						// CRITICAL: Always update to server's checksum to prevent cascade of false positives
						// If there was a desync, future events should chain from server's authoritative state
						// This prevents the next message from using the same stale checksum
						currentModel.mainPlayer.lastEventChecksum = payload.stateChecksum;
					} catch (error) {
						console.error('Error calculating rolling checksum:', error);
					}
				}

				// Validate state checksum if provided - do this BEFORE updating the store
				// so the game loop doesn't advance the state while we're validating
				// NOTE: This can be disabled via PUBLIC_ENABLE_CHECKSUM_VALIDATION env var (default: disabled)
				this.validateStateChecksum(
					currentModel,
					payload.clientModelChecksum,
					payload.checksumComponents
				);

				// Update the store after all validation is complete
				clientGameModel.set(currentModel);

				// Resume game loop now that events are applied and store is updated
				console.log('▶️ Resuming game loop after event processing');
				gameActions.resumeGame();

				// Clear the flag to allow future time advancement requests
				gameActions.clearServerTimeAdvancementFlag();

				break;
			}

			case MESSAGE_TYPE.COMMAND_ACK: {
				// Handle command acknowledgment from server
				const payload = message.payload as { commandId: string; timestamp: number };
				const pending = this.pendingCommands.get(payload.commandId);

				if (pending) {
					const latency = Date.now() - pending.timestamp;
					console.log(
						`✅ Command ACK received for [${payload.commandId}] type ${pending.type} (latency: ${latency}ms)`
					);
					// Mark as acked to prevent timeout warning
					pending.acked = true;
					// Don't delete yet - wait for events to match and confirm
					// Events will remove from pending map when they match
				} else {
					// Command not in pending map - likely already confirmed via CLIENT_EVENT
					// This is a normal race condition when ACK arrives after events
					console.debug(
						`ACK received for [${payload.commandId}] - already confirmed via events`
					);
				}
				break;
			}

			case MESSAGE_TYPE.ERROR:
				if (isErrorMessage(message)) {
					const errorMessage =
						message.payload.message || message.payload.error || 'An error occurred';

					// Check if this error indicates a possible desync
					if (message.payload.possibleDesync) {
						console.error('⚠️ POSSIBLE DESYNC DETECTED - Requesting full state sync');
						console.error('Error code:', message.payload.errorCode);
						console.error('Error message:', errorMessage);

						// Request full state sync from server
						this.requestStateSync();

						// Show notification to user
						this.gameStore.addNotification({
							type: 'warning',
							message: `${errorMessage} - Syncing with server...`,
							timestamp: Date.now()
						});
					} else {
						// Normal error - just show notification
						this.gameStore.addNotification({
							type: 'error',
							message: errorMessage,
							timestamp: Date.now()
						});
					}
				} else {
					console.warn('Unexpected ERROR payload format:', message.payload);
				}
				break;

			case MESSAGE_TYPE.PONG:
				// Server responded to our ping - session is alive
				console.log('Received pong from server', message.payload);
				break;

			case MESSAGE_TYPE.ADVANCE_GAME_TIME:
				// Handle server time advancement response (events already received via CLIENT_EVENT)
				console.log('Game time advanced successfully');
				// Clear the flag to allow future time advancement requests
				gameActions.clearServerTimeAdvancementFlag();
				break;

			case MESSAGE_TYPE.SYNC_STATE:
				// Handle server state sync response (full state already received via GAME_STATE_UPDATE)
				console.log('Received synchronized game state from server');
				break;

			default:
				console.log('Unhandled message type:', message.type);
		}
	}

	send(message: IMessage<unknown>) {
		// Always queue outgoing messages to ensure they're sent in order
		this.messageQueue.push(message);

		// If not connected, attempt to connect
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
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
		} else {
			// Process the queue if connected and not already sending
			this.processNextOutgoingMessage();
		}
	}

	/**
	 * Process the next outgoing message in the queue.
	 * This ensures messages are sent one at a time, in order.
	 */
	private processNextOutgoingMessage() {
		// If already sending a message, wait for it to complete
		if (this.isSendingMessage) {
			return;
		}

		// Check if we're still connected
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return;
		}

		// Get next message from queue
		const message = this.messageQueue.shift();
		if (!message) {
			return;
		}

		// Mark as sending to prevent concurrent sends
		this.isSendingMessage = true;

		try {
			this.ws.send(JSON.stringify(message));
		} catch (error) {
			console.error('Error sending message:', error);
		} finally {
			// Mark as done and process next message
			this.isSendingMessage = false;

			// Process next message if any are queued
			if (this.messageQueue.length > 0) {
				// Use setTimeout to avoid deep call stacks and allow other operations
				setTimeout(() => this.processNextOutgoingMessage(), 0);
			}
		}
	}

	// Game-specific methods
	listGames() {
		this.send(new Message(MESSAGE_TYPE.LIST_GAMES, {}));
	}

	createGame(gameOptions: ServerGameOptions) {
		// Use player name from store first (localStorage), fallback to game options or default
		// This ensures we use the saved player name instead of always resetting to 'Player'
		const storedPlayerName = get(this.gameStore).playerName;
		const playerName =
			storedPlayerName && storedPlayerName !== 'Player'
				? storedPlayerName
				: gameOptions.mainPlayerName || 'Player';

		// Update the store with the actual player name being used
		this.gameStore.setPlayerName(playerName);

		console.log('Creating game with player name:', playerName); // Send both game name and player name as the backend expects
		const payload: Record<string, unknown> = {
			name: gameOptions.name || 'Unnamed Game',
			playerName: playerName,
			gameOptions: {
				name: gameOptions.name || 'Unnamed Game',
				mainPlayerName: playerName,
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
				gameSpeed: gameOptions.gameSpeed,
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
		// Get current player name from store or use a default
		const currentPlayerName = playerName || get(this.gameStore).playerName || 'Player';
		this.send(new Message(MESSAGE_TYPE.JOIN_GAME, { gameId, playerName: currentPlayerName }));
	}

	startGame() {
		try {
			const gameId = this.requireGameId();
			console.log('Starting game:', gameId);
			this.send(new Message(MESSAGE_TYPE.START_GAME, { gameId }));
		} catch (error) {
			console.error('Failed to start game:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to start',
				timestamp: Date.now()
			});
		}
	}

	resumeGame(gameId: string) {
		console.log('Resuming game:', gameId);
		this.gameStore.setGameId(gameId);
		this.send(new Message(MESSAGE_TYPE.RESUME_GAME, { gameId }));
	}

	exitResignGame() {
		this.stopGameSyncInterval();
		this.send(new Message(MESSAGE_TYPE.EXIT_RESIGN, {}));
	}

	sendChatMessage(message: string) {
		try {
			const gameId = this.requireGameId();
			const payload = {
				gameId,
				message: message.trim()
			};

			console.log('Sending CHAT_MESSAGE with payload:', payload);
			this.send(new Message(MESSAGE_TYPE.CHAT_MESSAGE, payload));
		} catch (error) {
			console.error('Failed to send chat message:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot send chat message - no active game session',
				timestamp: Date.now()
			});
		}
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

	changePlayerName(gameId: string, playerName: string) {
		const trimmedName = playerName.substring(0, 20); // Limit to 20 characters like old game

		const payload = {
			gameId,
			playerName: trimmedName
		};

		// Update local store (which will also save to localStorage)
		this.gameStore.setPlayerName(trimmedName);

		console.log('Sending CHANGE_PLAYER_NAME with payload:', payload);
		this.send(new Message(MESSAGE_TYPE.CHANGE_PLAYER_NAME, payload));
	}

	updatePlanetBuildQueue(
		planetId: number,
		action: 'add' | 'remove' | 'demolish',
		productionItem?: PlanetProductionItemData,
		index?: number,
		autoQueued = false
	) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			// Determine command type based on action
			let command: GameCommand;

			if (action === 'add' && productionItem) {
				command = {
					type: GameCommandType.QUEUE_PRODUCTION_ITEM,
					playerId,
					timestamp: Date.now(),
					planetId,
					productionItem,
					metadata: autoQueued ? { autoQueued: true } : undefined
				} as QueueProductionItemCommand;
			} else if (action === 'remove' && typeof index === 'number') {
				command = {
					type: GameCommandType.REMOVE_PRODUCTION_ITEM,
					playerId,
					timestamp: Date.now(),
					planetId,
					index
				} as RemoveProductionItemCommand;
			} else if (action === 'demolish' && productionItem) {
				command = {
					type: GameCommandType.DEMOLISH_IMPROVEMENT,
					playerId,
					timestamp: Date.now(),
					planetId,
					productionItem
				} as DemolishImprovementCommand;
			} else {
				throw new Error(`Invalid build queue action: ${action}`);
			}

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to update planet build queue:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot update build queue - no active game session',
				timestamp: Date.now()
			});
		}
	}

	setGameSpeed(newSpeed: number) {
		try {
			const gameId = this.requireGameId();
			const payload = {
				gameId,
				newSpeed
			};

			console.log('Sending GAME_SPEED_ADJUSTMENT with payload:', payload);
			this.send(new Message(MESSAGE_TYPE.GAME_SPEED_ADJUSTMENT, payload));
		} catch (error) {
			console.error('Failed to set game speed:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot adjust game speed - no active game session',
				timestamp: Date.now()
			});
		}
	}

	updatePlanetWorkerAssignments(
		planetId: number,
		farmerDiff: number,
		minerDiff: number,
		builderDiff: number
	) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.UPDATE_PLANET_WORKER_ASSIGNMENTS,
				playerId,
				timestamp: Date.now(),
				planetId,
				workers: {
					farmerDiff,
					minerDiff,
					builderDiff
				}
			} as UpdatePlanetWorkerAssignmentsCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to update planet worker assignments:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot update worker assignments - no active game session',
				timestamp: Date.now()
			});
		}
	}

	updatePlanetOptions(planetId: number, options: { buildLastStarship?: boolean }) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.UPDATE_PLANET_OPTIONS,
				playerId,
				timestamp: Date.now(),
				planetId,
				options
			} as UpdatePlanetOptionsCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to update planet options:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot update planet options - no active game session',
				timestamp: Date.now()
			});
		}
	}

	/**
	 * Request an auto-queue check. Sets a flag that will be processed when no auto-queue is pending.
	 */
	public requestAutoQueueCheck() {
		this.autoQueueRequested = true;
		this.processAutoQueue();
	}

	/**
	 * Process the auto-queue by checking eligibility and sending ONE command at a time.
	 * After each command response, this will be called again to check for the next eligible planet.
	 * This prevents resource conflicts and ordering issues.
	 */
	private processAutoQueue() {
		// Don't process if we're already waiting for a response
		if (this.autoQueuePending) {
			console.log('Auto-queue already pending - waiting for response');
			return;
		}

		// Don't process if no check was requested
		if (!this.autoQueueRequested) {
			return;
		}

		try {
			const currentModel = get(clientGameModel);
			if (!currentModel) {
				this.autoQueueRequested = false;
				return;
			}

			const eligiblePlanets = Player.getEligibleBuildLastShipPlanetList(currentModel);

			const firstEligiblePlanet = eligiblePlanets[0];
			if (firstEligiblePlanet) {
				// Send command for ONLY the first eligible planet
				const { planetId, productionItem } = firstEligiblePlanet;
				console.log(
					`Auto-queuing ship on planet ${planetId} (${eligiblePlanets.length} total eligible)`
				);

				// Mark as pending before sending
				this.autoQueuePending = true;

				// Send ONE command with auto-queue marker
				this.updatePlanetBuildQueue(planetId, 'add', productionItem, undefined, true);
			} else {
				// No more eligible planets - clear the request flag
				console.log('No more planets eligible for auto-queue');
				this.autoQueueRequested = false;
			}
		} catch (error) {
			console.error('Error processing auto-queue:', error);
			this.autoQueuePending = false;
			this.autoQueueRequested = false;
		}
	}

	/**
	 * Send a game command using the new event-driven architecture with optimistic updates
	 */
	sendCommand(command: GameCommand) {
		try {
			const gameId = this.requireGameId();
			const cgm = get(clientGameModel);
			const grid = get(gameGrid);

			if (!cgm || !grid) {
				throw new Error('No game model or grid available');
			}

			// Generate UUID for command tracking
			command.commandId = crypto.randomUUID();

			// Add client's current cycle for drift compensation
			command.clientCycle = cgm.currentCycle;

			// OPTIMISTIC EXECUTION: Execute CommandProcessor locally before sending
			console.log(`🎯 Executing command optimistically: ${command.type}`, command);

			// Call CommandProcessor with client model
			// NOTE: processCommand mutates cgm directly for optimistic updates
			// We don't need to apply the returned events - those are for the server to broadcast
			const result = CommandProcessor.processCommand(cgm, grid, command);

			if (!result.success) {
				// Command validation failed - show error immediately, don't send to server
				console.error('❌ Command validation failed:', result.error);
				this.gameStore.addNotification({
					type: 'error',
					message: result.error?.message || 'Command failed validation',
					timestamp: Date.now()
				});
				return;
			}

			// CommandProcessor already mutated cgm for the optimistic update
			// Update the store immediately for instant UI feedback
			console.log(`✅ Command successful, model already mutated by CommandProcessor`);
			clientGameModel.set(cgm);

			// Track this command as pending
			this.pendingCommands.set(command.commandId, {
				timestamp: Date.now(),
				type: command.type,
				events: result.events,
				acked: false
			});

			// Send command to server for authoritative processing
			const payload = {
				gameId,
				command
			};

			console.log(`📤 Sending GAME_COMMAND to server: ${command.type} [${command.commandId}]`);
			this.send(new Message(MESSAGE_TYPE.GAME_COMMAND, payload));

			// Set timeout to warn if command not ACKed within 10 seconds
			setTimeout(() => {
				const pending = this.pendingCommands.get(command.commandId);
				if (pending && !pending.acked) {
					console.warn(`⚠️ Command ${command.type} [${command.commandId}] not ACKed after 10s`);
				}
			}, 10000);
		} catch (error) {
			console.error('Failed to send game command:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot send command - no active game session',
				timestamp: Date.now()
			});
		}
	}

	// ==========================================
	// Legacy Methods (migrated to commands - keeping for compatibility)
	// ==========================================

	setWaypoint(planetId: number, waypointPlanetId: number) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.SET_WAYPOINT,
				playerId,
				timestamp: Date.now(),
				planetId,
				waypointPlanetId
			} as SetWaypointCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to set waypoint:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot set waypoint - no active game session',
				timestamp: Date.now()
			});
		}
	}

	clearWaypoint(planetId: number) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.CLEAR_WAYPOINT,
				playerId,
				timestamp: Date.now(),
				planetId
			} as ClearWaypointCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to clear waypoint:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot clear waypoint - no active game session',
				timestamp: Date.now()
			});
		}
	}

	sendShips(
		planetIdSource: number,
		planetIdDest: number,
		shipsByType: {
			scouts: string[];
			destroyers: string[];
			cruisers: string[];
			battleships: string[];
		}
	) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			// Send command with ship IDs (user selected specific ships)
			const command: SendShipsCommand = {
				type: GameCommandType.SEND_SHIPS,
				playerId,
				timestamp: Date.now(),
				fromPlanetId: planetIdSource,
				toPlanetId: planetIdDest,
				shipIds: {
					scouts: shipsByType.scouts,
					destroyers: shipsByType.destroyers,
					cruisers: shipsByType.cruisers,
					battleships: shipsByType.battleships
				}
			};

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to send ships:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot send ships - no active game session',
				timestamp: Date.now()
			});
		}
	}

	requestGameTimeAdvancement() {
		try {
			// Debounce: Only send request if we're not already waiting for a response
			if (gameActions.isAwaitingServerTimeAdvancement()) {
				console.log('Already waiting for server time advancement response - ignoring request');
				return;
			}

			const gameId = this.requireGameId();
			console.log('Requesting game time advancement for game:', gameId);

			// Set flag to prevent duplicate requests
			gameActions.setServerTimeAdvancementFlag(true);

			const payload = { gameId };
			this.send(new Message(MESSAGE_TYPE.ADVANCE_GAME_TIME, payload));
		} catch (error) {
			console.error('Failed to request game time advancement:', error);
			// Clear flag on error so we can retry
			gameActions.clearServerTimeAdvancementFlag();
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot advance game time - no active game session',
				timestamp: Date.now()
			});
		}
	}

	requestStateSync() {
		try {
			const gameId = this.requireGameId();
			console.log('Requesting server state synchronization for game:', gameId);
			const payload = { gameId };
			this.send(new Message(MESSAGE_TYPE.SYNC_STATE, payload));
		} catch (error) {
			console.error('Failed to request state sync:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'Cannot sync state - no active game session',
				timestamp: Date.now()
			});
		}
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

	private startGameSyncInterval() {
		// Only start sync interval if player is the host and there's an active game
		if (!this.isHost() || !this.getCurrentGameId()) {
			return;
		}

		this.stopGameSyncInterval(); // Clear any existing interval
		console.log('Starting game time advancement interval (host player)');

		this.gameSyncInterval = window.setInterval(() => {
			if (
				this.ws &&
				this.ws.readyState === WebSocket.OPEN &&
				this.getCurrentGameId() &&
				this.isHost()
			) {
				console.log('Sending ADVANCE_GAME_TIME to advance game time for AI players');
				this.requestGameTimeAdvancement();
			} else {
				// Stop interval if conditions are no longer met
				this.stopGameSyncInterval();
			}
		}, this.gameSyncIntervalMs);
	}

	private stopGameSyncInterval() {
		if (this.gameSyncInterval !== null) {
			console.log('Stopping game sync interval');
			window.clearInterval(this.gameSyncInterval);
			this.gameSyncInterval = null;
		}
	}

	// Research methods
	adjustResearchPercent(researchPercent: number) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.ADJUST_RESEARCH_PERCENT,
				playerId,
				timestamp: Date.now(),
				researchPercent: Math.max(0, Math.min(1, researchPercent))
			} as AdjustResearchPercentCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to adjust research percent:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to adjust research',
				timestamp: Date.now()
			});
		}
	}

	submitResearchItem(researchType: number, data: Record<string, unknown> = {}) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.SUBMIT_RESEARCH_ITEM,
				playerId,
				timestamp: Date.now(),
				researchType,
				data
			} as SubmitResearchItemCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to submit research item:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to start research',
				timestamp: Date.now()
			});
		}
	}

	cancelResearchItem() {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.CANCEL_RESEARCH_ITEM,
				playerId,
				timestamp: Date.now()
			} as CancelResearchItemCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to cancel research item:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to cancel research',
				timestamp: Date.now()
			});
		}
	}

	// Trading methods
	submitTrade(planetId: number, tradeType: number, resourceType: number, amount: number) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			// Map numeric resource type to string
			const resourceTypeMap: Record<number, string> = {
				1: 'food',
				2: 'ore',
				3: 'iridium'
			};

			// Map trade type to action
			const action = tradeType === 1 ? 'buy' : 'sell';

			const command: GameCommand = {
				type: GameCommandType.SUBMIT_TRADE,
				playerId,
				timestamp: Date.now(),
				planetId,
				tradeData: {
					resourceType: resourceTypeMap[resourceType] || 'food',
					amount,
					action
				}
			} as SubmitTradeCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to submit trade:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to submit trade',
				timestamp: Date.now()
			});
		}
	}

	cancelTrade(tradeId: string) {
		try {
			const cgm = get(clientGameModel);
			if (!cgm) {
				throw new Error('No game model available');
			}
			const playerId = cgm.mainPlayer.id;

			const command: GameCommand = {
				type: GameCommandType.CANCEL_TRADE,
				playerId,
				timestamp: Date.now(),
				tradeId
			} as CancelTradeCommand;

			this.sendCommand(command);
		} catch (error) {
			console.error('Failed to cancel trade:', error);
			this.gameStore.addNotification({
				type: 'error',
				message: 'No game selected to cancel trade',
				timestamp: Date.now()
			});
		}
	}

	disconnect() {
		this.stopPingInterval();
		this.stopGameSyncInterval();
		this.autoQueuePending = false;
		this.autoQueueRequested = false;
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
