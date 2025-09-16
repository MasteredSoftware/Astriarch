<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Text, Button } from '$lib/components/astriarch';
	import { webSocketService, type IGame } from '$lib/services/websocket';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import GameList from './GameList.svelte';
	import GameDetails from './GameDetails.svelte';
	import GameOptionsView from './GameOptionsView.svelte';
	import { getDefaultServerGameOptions } from 'astriarch-engine';

	let games: IGame[] = [];
	let selectedGame: IGame | null = null;
	let isConnected = false;
	let currentView = 'lobby'; // 'lobby' | 'game_options' | 'game'
	let gameJoined = false;
	let gameId = '';
	let currentGame: IGame | null = null;
	let currentPlayerName = '';
	let currentPlayerPosition = 0;
	let isCurrentPlayerHost = false;
	let didCreateCurrentGame = false; // Track if we created the current game

	let unsubscribeWebSocket: (() => void) | null = null;

	onMount(() => {
		console.log('LobbyView mounted');
		// Subscribe to multiplayer game store state
		unsubscribeWebSocket = multiplayerGameStore.subscribe((state) => {
			console.log('Store state updated:', state);
			const wasConnected = isConnected;
			isConnected = state.connected;
			currentPlayerName = state.playerName || '';
			console.log('Store updated - currentPlayerName:', currentPlayerName);
			console.log('Store updated - playerPosition:', state.playerPosition);

			// Update games list when we receive game updates
			games = state.availableGames;

			// Handle view transitions
			currentView = state.currentView;
			gameJoined = state.gameJoined;
			gameId = state.gameId || '';

			// Find current game if we have a gameId
			if (gameId) {
				currentGame = games.find((game) => game._id === gameId) || null;
				console.log('Current game updated:', currentGame);

				// Use the player position from the store (set by backend responses)
				if (currentGame && state.playerPosition !== null) {
					currentPlayerPosition = state.playerPosition;
					isCurrentPlayerHost = currentPlayerPosition === 0;
					console.log(
						'Using stored player position:',
						currentPlayerPosition,
						'Is host:',
						isCurrentPlayerHost
					);
				}
			}

			// Request games list when connection is first established
			if (!wasConnected && isConnected) {
				console.log('WebSocket connected, requesting games list...');
				requestGamesList();
			}
		});

		// Connect if not already connected
		if (!isConnected) {
			console.log('Attempting to connect to WebSocket...');
			webSocketService.connect();
		} else {
			// Already connected, request games list immediately
			requestGamesList();
		}
	});

	onDestroy(() => {
		if (unsubscribeWebSocket) {
			unsubscribeWebSocket();
		}
	});

	function requestGamesList() {
		if (isConnected) {
			console.log('Requesting games list...');
			webSocketService.listGames();
		} else {
			console.log('Cannot request games list - WebSocket not connected');
		}
	}

	function handleGameSelect(event: CustomEvent<IGame>) {
		selectedGame = event.detail;
	}

	function handleJoinGame(event: CustomEvent<IGame>) {
		const game = event.detail;
		// Track that we are joining (not creating) this game
		didCreateCurrentGame = false;
		webSocketService.joinGame(game._id);
	}

	function handleSpectateGame(event: CustomEvent<IGame>) {
		const game = event.detail;
		// For now, spectate works the same as join - the backend will handle the difference
		webSocketService.joinGame(game._id);
	}

	function handleResumeGame(event: CustomEvent<IGame>) {
		const game = event.detail;
		console.log('Resuming game:', game._id);
		webSocketService.resumeGame(game._id);
	}

	function handleCreateGame() {
		console.log('Create game button clicked - creating game directly');
		console.log('Connected:', isConnected);
		console.log('Current view:', currentView);

		if (!isConnected) {
			console.log('Cannot create game - not connected to server');
			return;
		}

		// Track that we are creating this game (so we know we're the host)
		didCreateCurrentGame = true;

		// Create game with default options - this will trigger transition to game_options view
		const defaultGameOptions = getDefaultServerGameOptions({});

		console.log('Calling webSocketService.createGame with options:', defaultGameOptions);
		webSocketService.createGame(defaultGameOptions);
	}

	function handleStartGame() {
		webSocketService.startGame();
	}

	function handleBackToLobby() {
		multiplayerGameStore.setCurrentView('lobby');
		multiplayerGameStore.setGameJoined(false);
		multiplayerGameStore.setGameId(null);
		multiplayerGameStore.setPlayerPosition(null); // Reset player position
		currentGame = null;
		didCreateCurrentGame = false; // Reset the flag
		requestGamesList();
	}
</script>

<div class="lobby-container {currentView === 'lobby' ? 'lobby-view' : 'game-options-view'}">
	<!-- Connection Status -->
	{#if !isConnected}
		<div class="connection-status">
			<Text style="color: #F59E0B; font-size: 14px;">Connecting to server...</Text>
		</div>
	{/if}

	<!-- Lobby Header -->
	{#if currentView === 'lobby'}
		<header class="lobby-header">
			<Text
				style="font-size: 32px; font-weight: bold; color: #00FFFF; text-shadow: 0 0 10px rgba(0,255,255,0.5);"
			>
				ASTRIARCH LOBBY
			</Text>
			<Text style="font-size: 16px; color: #94A3B8; margin-top: 8px;">
				Join an existing game or create a new one
			</Text>
			<!-- Debug Info -->
			<div style="margin-top: 1rem; font-size: 12px; color: #888;">
				Debug: Connected: {isConnected}, Current View: {currentView}, Games: {games.length}, Game
				ID: {gameId}
			</div>
		</header>
	{/if}

	<!-- Main Content -->
	<div class="lobby-content">
		{#if currentView === 'lobby'}
			<!-- Regular Lobby View -->
			<!-- Game Selection Interface -->
			<div class="game-selection">
				<!-- Left Panel - Game List -->
				<div class="game-list-panel">
					<div class="panel-header">
						<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
							Available Games ({games.length})
						</Text>
						<Button
							label="Create New Game"
							size="md"
							variant="primary"
							onclick={handleCreateGame}
							disabled={!isConnected}
						/>
					</div>
					<div class="panel-content">
						<GameList {games} {selectedGame} on:gameSelect={handleGameSelect} />
					</div>
				</div>

				<!-- Right Panel - Game Details -->
				<div class="game-details-panel">
					<div class="panel-header">
						<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">Game Details</Text>
					</div>
					<div class="panel-content">
						<GameDetails
							game={selectedGame}
							on:joinGame={handleJoinGame}
							on:spectateGame={handleSpectateGame}
							on:resumeGame={handleResumeGame}
						/>
					</div>
				</div>
			</div>
		{:else if currentView === 'game_options'}
			<!-- Game Options Configuration View -->
			{#if currentGame && gameId}
				<GameOptionsView
					{gameId}
					gameOptions={currentGame.gameOptions}
					playerPosition={currentPlayerPosition}
					isHost={isCurrentPlayerHost}
					connectedPlayers={currentGame.players || []}
					on:startGame={handleStartGame}
					on:backToLobby={handleBackToLobby}
				/>
			{:else}
				<div style="text-align: center; padding: 2rem;">
					<Text style="color: #F59E0B;">Loading game configuration...</Text>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.lobby-container {
		height: 100vh;
		color: white;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
		display: flex;
		flex-direction: column;
	}

	.lobby-container.lobby-view {
		padding: 2rem;
	}

	.lobby-container.game-options-view {
		padding: 0;
	}

	.connection-status {
		position: fixed;
		top: 1rem;
		right: 1rem;
		padding: 0.5rem 1rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid #f59e0b;
		border-radius: 6px;
		z-index: 100;
	}

	.lobby-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.lobby-content {
		position: relative;
		max-width: 1200px;
		margin: 0 auto;
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.game-selection {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		flex: 1;
	}

	.game-list-panel,
	.game-details-panel {
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		display: flex;
		flex-direction: column;
		min-height: 0; /* Allow flex items to shrink */
	}

	.panel-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid rgba(0, 255, 255, 0.2);
		background: rgba(0, 255, 255, 0.05);
	}

	.panel-content {
		flex: 1;
		padding: 1rem 1.5rem;
		overflow-y: auto;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.lobby-container {
			padding: 1rem;
		}

		.game-selection {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.panel-header {
			flex-direction: column;
			gap: 0.5rem;
			align-items: stretch;
		}
	}
</style>
