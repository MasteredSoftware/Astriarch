import { writable } from 'svelte/store';
import type { IGame } from '$lib/services/websocket';
import { PlayerStorage } from '$lib/utils/playerStorage';

// WebSocket multiplayer game state interface
export interface MultiplayerGameState {
	sessionId: string | null;
	gameId: string | null;
	currentPlayer: string | null;
	playerName: string | null;
	playerPosition: number | null; // Store the player position returned by the backend
	connected: boolean;
	gameJoined: boolean;
	currentView: 'welcome' | 'lobby' | 'game_options' | 'game';
	availableGames: IGame[];
	selectedGame: IGame | null;
	selectedPlanet: string | null;
	selectedFleet: string | null;
	gameOver: GameOverState | null;
	gamePaused: boolean;
	pauseReason: string | null;
	playerEliminatedModal: PlayerEliminatedModalState | null;
}

// Game over state
export interface GameOverState {
	gameEnded: boolean;
	playerWon: boolean;
	finalScore: number;
	winningPlayer: {
		id: string;
		name: string;
		position: number;
	} | null;
	allHumansDestroyed: boolean;
}

// Player eliminated modal state (for both resignation and destruction)
export interface PlayerEliminatedModalState {
	show: boolean;
	playerName: string;
	playerId: string;
	reason: 'resigned' | 'destroyed';
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
		| 'chat';
	message: string;
	timestamp: number;
	actionText?: string;
	actionType?: string;
	duration?: number; // Duration in milliseconds before auto-removal (default: 5000ms)
}

// Create the multiplayer game store
function createMultiplayerGameStore() {
	const initialState: MultiplayerGameState = {
		sessionId: null,
		gameId: null,
		currentPlayer: null,
		playerName: PlayerStorage.getPlayerNameWithFallback('Player'), // Load from localStorage
		playerPosition: null,
		connected: false,
		gameJoined: false,
		currentView: 'welcome',
		availableGames: [],
		selectedGame: null,
		selectedPlanet: null,
		selectedFleet: null,
		gameOver: null,
		gamePaused: false,
		pauseReason: null,
		playerEliminatedModal: null
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
		setConnected: (connected: boolean) =>
			update((store) => ({
				...store,
				connected
			})),

		setSessionId: (sessionId: string) =>
			update((store) => ({
				...store,
				sessionId
			})),

		setPlayerName: (playerName: string) => {
			// Save to localStorage for persistence
			PlayerStorage.setPlayerName(playerName);

			return update((store) => ({
				...store,
				playerName
			}));
		},

		setPlayerPosition: (playerPosition: number | null) =>
			update((store) => ({
				...store,
				playerPosition
			})),

		// Game state actions - removed setGameModel as game data should come from gameStore
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

		setGameJoined: (gameJoined: boolean) =>
			update((store) => ({
				...store,
				gameJoined
			})),

		setCurrentView: (currentView: 'lobby' | 'game_options' | 'game') =>
			update((store) => ({
				...store,
				currentView
			})),

		// Lobby management
		setAvailableGames: (games: IGame[]) =>
			update((store) => ({
				...store,
				availableGames: games
			})),

		setSelectedGame: (game: IGame | null) =>
			update((store) => ({
				...store,
				selectedGame: game
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

		// Game over actions
		setGameOver: (gameOverState: GameOverState) =>
			update((store) => ({
				...store,
				gameOver: gameOverState
			})),

		// Game pause actions
		setGamePaused: (paused: boolean, reason?: string) =>
			update((store) => ({
				...store,
				gamePaused: paused,
				pauseReason: paused ? reason || null : null
			})),

		// Player eliminated modal actions
		setPlayerEliminatedModal: (modalState: PlayerEliminatedModalState | null) =>
			update((store) => ({
				...store,
				playerEliminatedModal: modalState
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
				id: `notification-${Date.now()}-${Math.random()}`,
				duration: notification.duration ?? 5000 // Default to 5 seconds
			};
			notifications.update((prev) => [...prev, newNotification]);

			// Set up auto-removal timer if enabled
			if (newNotification.duration) {
				setTimeout(() => {
					notifications.update((prev) => prev.filter((n) => n.id !== newNotification.id));
				}, newNotification.duration);
			}
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
