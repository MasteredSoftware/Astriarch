import { writable, derived } from 'svelte/store';
import type {
	GameModelData,
	PlayerData,
	FleetData,
	PlanetData,
	ClientModelData
} from 'astriarch-engine';

// WebSocket multiplayer game state interface
export interface MultiplayerGameState {
	gameId: string | null;
	currentPlayer: string | null;
	gameModel: GameModelData | null;
	clientModel: ClientModelData | null;
	connected: boolean;
	selectedPlanet: string | null;
	selectedFleet: string | null;
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

// Create the multiplayer game store
function createMultiplayerGameStore() {
	const initialState: MultiplayerGameState = {
		gameId: null,
		currentPlayer: null,
		gameModel: null,
		clientModel: null,
		connected: false,
		selectedPlanet: null,
		selectedFleet: null
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

		// Game state actions
		setGameModel: (gameModel: GameModelData) =>
			update((store) => ({
				...store,
				gameModel
			})),

		setClientModel: (clientModel: ClientModelData) =>
			update((store) => ({
				...store,
				clientModel
			})),

		setCurrentPlayer: (playerId: string) =>
			update((store) => ({
				...store,
				currentPlayer: playerId
			})),

		setGameId: (gameId: string | null) =>
			update((store) => ({
				...store,
				gameId
			})),

		setConnected: (connected: boolean) =>
			update((store) => ({
				...store,
				connected
			})),

		// Selection actions
		selectPlanet: (planetId: string | null) =>
			update((store) => ({
				...store,
				selectedPlanet: planetId
			})),

		selectFleet: (fleetId: string | null) =>
			update((store) => ({
				...store,
				selectedFleet: fleetId
			})),

		// Chat actions
		addChatMessage: (message: ChatMessage) => {
			chatMessages.update((prev) => [...prev, message]);
		},

		clearChatMessages: () => {
			chatMessages.set([]);
		},

		// Notification actions
		addNotification: (notification: Omit<GameNotification, 'id'>) => {
			const newNotification: GameNotification = {
				...notification,
				id: `notification-${Date.now()}-${Math.random()}`
			};
			notifications.update((prev) => [...prev, newNotification]);
		},

		dismissNotification: (notificationId: string) => {
			notifications.update((prev) => prev.filter((n) => n.id !== notificationId));
		},

		clearNotifications: () => {
			notifications.set([]);
		},

		// Reset actions
		reset: () => {
			set(initialState);
			chatMessages.set([]);
			notifications.set([]);
		}
	};
}

export const multiplayerGameStore = createMultiplayerGameStore();

// Derived stores using engine data
export const currentPlanet = derived(multiplayerGameStore, ($store) => {
	if (!$store.selectedPlanet || !$store.gameModel) return null;
	return (
		$store.gameModel.modelData.planets.find((p) => p.id.toString() === $store.selectedPlanet) ||
		null
	);
});

export const currentFleet = derived(multiplayerGameStore, ($store) => {
	if (!$store.selectedFleet || !$store.clientModel) return null;
	// Fleets in engine are stored differently - need to check structure
	return null; // TODO: implement based on engine fleet structure
});

export const playerPlanets = derived(multiplayerGameStore, ($store) => {
	if (!$store.currentPlayer || !$store.gameModel) return [];

	// Find the current player
	const currentPlayer = $store.gameModel.modelData.players.find(
		(p) => p.id === $store.currentPlayer
	);
	if (!currentPlayer) return [];

	// Filter planets by owned planet IDs
	return (
		$store.gameModel.modelData.planets.filter((planet) =>
			currentPlayer.ownedPlanetIds.includes(planet.id)
		) || []
	);
});

export const playerFleets = derived(multiplayerGameStore, ($store) => {
	if (!$store.currentPlayer || !$store.clientModel) return [];
	// TODO: implement based on engine fleet structure
	return [];
});

export const allPlayers = derived(multiplayerGameStore, ($store) => {
	if (!$store.gameModel) return [];
	return $store.gameModel.modelData.players || [];
});

// Resource data for TopOverview component
export const multiplayerResourceData = derived(multiplayerGameStore, ($store) => {
	if (!$store.clientModel || !$store.currentPlayer) {
		return {
			total: {
				food: 0,
				energy: 0,
				research: 0,
				ore: 0,
				iridium: 0,
				production: 0
			},
			perTurn: {
				food: 0,
				energy: 0,
				research: 0,
				ore: 0,
				iridium: 0,
				production: 0
			}
		};
	}

	// PlayerData doesn't have direct resources, need to calculate from planets
	// For now, return zeros - this would need proper implementation
	return {
		total: {
			food: 0, // Would calculate from player's planets
			energy: 0,
			research: 0,
			ore: 0,
			iridium: 0,
			production: 0
		},
		perTurn: {
			food: 0,
			energy: 0,
			research: 0,
			ore: 0,
			iridium: 0,
			production: 0
		}
	};
});

export const multiplayerPopulation = derived(multiplayerGameStore, ($store) => {
	if (!$store.clientModel || !$store.currentPlayer || !$store.gameModel) return 0;

	// Find the current player
	const currentPlayer = $store.gameModel.modelData.players.find(
		(p) => p.id === $store.currentPlayer
	);
	if (!currentPlayer) return 0;

	// Calculate total population from player's planets
	const playerPlanets = $store.gameModel.modelData.planets.filter((p) =>
		currentPlayer.ownedPlanetIds.includes(p.id)
	);

	return playerPlanets.reduce((sum: number, planet) => {
		return sum + (planet.population?.length || 0);
	}, 0);
});
