import { writable, derived, get } from 'svelte/store';

// Core game state interfaces
export interface Position {
	x: number;
	y: number;
}

export interface Planet {
	id: string;
	position: Position;
	playerId?: string;
	playerName?: string;
	population: number;
	resources: {
		food: number;
		ore: number;
		iridium: number;
	};
	buildings: {
		farms: number;
		mines: number;
		factories: number;
		spacePlatforms: number;
	};
	buildQueue?: Array<{
		type: string;
		turnsRemaining: number;
	}>;
}

export interface Fleet {
	id: string;
	playerId: string;
	playerName?: string;
	position: Position;
	destination?: {
		planetId: string;
		arrivalTime: number;
	};
	ships: {
		scouts: number;
		destroyers: number;
		cruisers: number;
		battleships: number;
	};
	status: 'in_transit' | 'arrived' | 'defending' | 'attacking';
	orders: string;
}

export interface Player {
	id: string;
	name: string;
	isAI: boolean;
	isActive: boolean;
	resources: {
		credits: number;
		food: number;
		ore: number;
		iridium: number;
	};
	research: {
		attack: number;
		defense: number;
		propulsion: number;
	};
}

export interface GameState {
	gameId: string;
	gameTime: number;
	planets: Record<string, Planet>;
	fleets: Record<string, Fleet>;
	players: Record<string, Player>;
	currentTurn?: number;
}

export interface ChatMessage {
	id: string;
	playerId: string;
	playerName: string;
	message: string;
	timestamp: number;
}

export interface Notification {
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

export interface GameStoreState {
	gameId: string | null;
	currentPlayer: string | null;
	currentView: 'lobby' | 'game' | 'planet' | 'research' | 'diplomacy' | 'fleet';
	gameState: GameState | null;
	selectedPlanet: string | null;
	selectedFleet: string | null;
	chatMessages: ChatMessage[];
	notifications: Notification[];
	showChat: boolean;
	showNotifications: boolean;
}

// Create the main game store
function createGameStore() {
	const initialState: GameStoreState = {
		gameId: null,
		currentPlayer: null,
		currentView: 'game',
		gameState: null,
		selectedPlanet: null,
		selectedFleet: null,
		chatMessages: [],
		notifications: [],
		showChat: false,
		showNotifications: false
	};

	const { subscribe, set, update } = writable(initialState);

	return {
		subscribe,
		set,
		update,

		// Game state actions
		setGameState: (gameState: GameState) =>
			update((store) => {
				// Add default positions to planets if they don't exist
				if (gameState.planets) {
					Object.keys(gameState.planets).forEach((planetId, index) => {
						const planet = gameState.planets[planetId];
						if (!planet.position) {
							// Generate a default position in a grid layout
							const gridSize = Math.ceil(Math.sqrt(Object.keys(gameState.planets).length));
							const row = Math.floor(index / gridSize);
							const col = index % gridSize;
							planet.position = {
								x: 100 + col * 150,
								y: 100 + row * 150
							};
						}
					});
				}

				return {
					...store,
					gameState
				};
			}),

		setCurrentPlayer: (playerId: string) =>
			update((store) => ({
				...store,
				currentPlayer: playerId
			})),

		setCurrentView: (view: GameStoreState['currentView']) =>
			update((store) => ({
				...store,
				currentView: view
			})),

		setGameId: (gameId: string | null) =>
			update((store) => ({
				...store,
				gameId
			})),

		updateGameTime: (gameTime: number) =>
			update((store) => ({
				...store,
				gameState: store.gameState
					? {
							...store.gameState,
							gameTime
						}
					: null
			})),

		applyChanges: (changes: {
			planets?: Record<string, Planet>;
			fleets?: Record<string, Fleet>;
			players?: Record<string, Player>;
		}) =>
			update((store) => {
				if (!store.gameState) return store;

				// Apply changes to the game state
				const newGameState = { ...store.gameState };

				if (changes.planets) {
					newGameState.planets = { ...newGameState.planets, ...changes.planets };
				}

				if (changes.fleets) {
					newGameState.fleets = { ...newGameState.fleets, ...changes.fleets };
				}

				if (changes.players) {
					newGameState.players = { ...newGameState.players, ...changes.players };
				}

				return {
					...store,
					gameState: newGameState
				};
			}),

		// Selection actions
		selectPlanet: (planetId: string | null) =>
			update((store) => ({
				...store,
				selectedPlanet: planetId,
				currentView: planetId ? 'planet' : store.currentView
			})),

		selectFleet: (fleetId: string | null) =>
			update((store) => ({
				...store,
				selectedFleet: fleetId,
				currentView: fleetId ? 'fleet' : store.currentView
			})),

		// Chat actions
		addChatMessage: (message: ChatMessage) =>
			update((store) => ({
				...store,
				chatMessages: [...store.chatMessages, message]
			})),

		toggleChat: () =>
			update((store) => ({
				...store,
				showChat: !store.showChat
			})),

		// Notification actions
		addNotification: (notification: Omit<Notification, 'id'>) =>
			update((store) => ({
				...store,
				notifications: [
					...store.notifications,
					{
						...notification,
						id: `notification-${Date.now()}-${Math.random()}`
					}
				]
			})),

		dismissNotification: (notificationId: string) =>
			update((store) => ({
				...store,
				notifications: store.notifications.filter((n) => n.id !== notificationId)
			})),

		clearNotifications: () =>
			update((store) => ({
				...store,
				notifications: []
			})),

		toggleNotifications: () =>
			update((store) => ({
				...store,
				showNotifications: !store.showNotifications
			})),

		// Reset actions
		reset: () => set(initialState)
	};
}

export const gameStore = createGameStore();

// Derived stores for specific data
export const currentPlanet = derived(gameStore, ($store) => {
	if (!$store.selectedPlanet || !$store.gameState) return null;
	return $store.gameState.planets[$store.selectedPlanet] || null;
});

export const currentFleet = derived(gameStore, ($store) => {
	if (!$store.selectedFleet || !$store.gameState) return null;
	return $store.gameState.fleets[$store.selectedFleet] || null;
});

export const playerPlanets = derived(gameStore, ($store) => {
	if (!$store.currentPlayer || !$store.gameState || !$store.gameState.planets) return [];
	return Object.values($store.gameState.planets).filter(
		(planet) => planet.playerId === $store.currentPlayer
	);
});

export const playerFleets = derived(gameStore, ($store) => {
	if (!$store.currentPlayer || !$store.gameState || !$store.gameState.fleets) return [];
	return Object.values($store.gameState.fleets).filter(
		(fleet) => fleet.playerId === $store.currentPlayer
	);
});

export const allPlayers = derived(gameStore, ($store) => {
	if (!$store.gameState || !$store.gameState.players) return [];
	return Object.values($store.gameState.players);
});

export const currentPlayerData = derived(gameStore, ($store) => {
	if (!$store.currentPlayer || !$store.gameState) return null;
	return $store.gameState.players[$store.currentPlayer] || null;
});

// Helper function to get current store value
export function getGameStore() {
	return get(gameStore);
}
