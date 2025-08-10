<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Text, Button } from '$lib/components/astriarch';
	import { webSocketService, multiplayerGameStore, type IGame } from '$lib/services/websocket';
	import GameList from './GameList.svelte';
	import GameDetails from './GameDetails.svelte';
	import CreateGameForm, { type GameOptions } from './CreateGameForm.svelte';

	let games: IGame[] = [];
	let selectedGame: IGame | null = null;
	let showCreateGame = false;
	let isConnected = false;
	let currentView = 'lobby'; // 'lobby' | 'game_options' | 'game'
	let gameJoined = false;
	let gameId = '';
	let currentGame: IGame | null = null;

	let unsubscribeWebSocket: (() => void) | null = null;

	onMount(() => {
		console.log('LobbyView mounted');
		// Subscribe to multiplayer game store state
		unsubscribeWebSocket = multiplayerGameStore.subscribe((state) => {
			console.log('Store state updated:', state);
			isConnected = state.connected;
			// Update games list when we receive game updates
			games = state.availableGames;
			
			// Handle view transitions
			currentView = state.currentView;
			gameJoined = state.gameJoined;
			gameId = state.gameId || '';
			
			// Find current game if we have a gameId
			if (gameId) {
				currentGame = games.find(game => game._id === gameId) || null;
			}
		});

		// Connect if not already connected
		if (!isConnected) {
			console.log('Attempting to connect to WebSocket...');
			webSocketService.connect();
		}

		// Request initial games list
		requestGamesList();
	});

	onDestroy(() => {
		if (unsubscribeWebSocket) {
			unsubscribeWebSocket();
		}
	});

	function requestGamesList() {
		if (isConnected) {
			webSocketService.listGames();
		}
	}

	function handleGameSelect(event: CustomEvent<IGame>) {
		selectedGame = event.detail;
	}

	function handleJoinGame(event: CustomEvent<IGame>) {
		const game = event.detail;
		webSocketService.joinGame(game._id);
	}

	function handleSpectateGame(event: CustomEvent<IGame>) {
		const game = event.detail;
		// For now, spectate works the same as join - the backend will handle the difference
		webSocketService.joinGame(game._id);
	}

	function handleCreateGame() {
		console.log('Create game button clicked, showCreateGame:', showCreateGame);
		showCreateGame = true;
		console.log('showCreateGame now set to:', showCreateGame);
	}

	function handleCreateGameSubmit(event: CustomEvent<GameOptions>) {
		const gameOptions = event.detail;
		webSocketService.createGame(gameOptions);
		showCreateGame = false;
	}

	function handleCreateGameCancel() {
		showCreateGame = false;
	}

	function handleStartGame() {
		webSocketService.startGame();
	}

	function handleBackToLobby() {
		multiplayerGameStore.setCurrentView('lobby');
		multiplayerGameStore.setGameJoined(false);
		multiplayerGameStore.setGameId(null);
		currentGame = null;
		requestGamesList();
	}
</script>

<div class="lobby-container">
	<!-- Connection Status -->
	{#if !isConnected}
		<div class="connection-status">
			<Text style="color: #F59E0B; font-size: 14px;">
				Connecting to server...
			</Text>
		</div>
	{/if}

	<!-- Lobby Header -->
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
			Debug: Connected: {isConnected}, Show Create Game: {showCreateGame}, Games: {games.length}
		</div>
	</header>

	<!-- Main Content -->
	<div class="lobby-content">
		{#if currentView === 'lobby'}
			<!-- Regular Lobby View -->
			{#if showCreateGame}
				<!-- Create Game Overlay -->
				<div class="create-game-overlay">
					<div class="create-game-modal">
						<CreateGameForm
							on:createGame={handleCreateGameSubmit}
							on:cancel={handleCreateGameCancel}
						/>
					</div>
				</div>
			{/if}

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
						<GameList
							{games}
							{selectedGame}
							on:gameSelect={handleGameSelect}
						/>
					</div>
				</div>

				<!-- Right Panel - Game Details -->
				<div class="game-details-panel">
					<div class="panel-header">
						<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
							Game Details
						</Text>
					</div>
					<div class="panel-content">
						<GameDetails
							game={selectedGame}
							on:joinGame={handleJoinGame}
							on:spectateGame={handleSpectateGame}
						/>
					</div>
				</div>
			</div>
		{:else if currentView === 'game_options'}
			<!-- Game Configuration View (After Creating/Joining Game) -->
			<div class="game-config-view">
				<div class="config-header">
					<Text style="font-size: 24px; color: #00FFFF; font-weight: 700;">
						{currentGame?.name || 'Game Configuration'}
					</Text>
					<Text style="font-size: 14px; color: #94A3B8; margin-top: 0.5rem;">
						Configure game settings and wait for players to join
					</Text>
				</div>

				<div class="config-content">
					<!-- Game Information Panel -->
					<div class="config-panel">
						<div class="panel-header">
							<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
								Game Information
							</Text>
						</div>
						<div class="panel-content">
							{#if currentGame}
								<div class="game-info-grid">
									<div class="info-item">
										<Text style="color: #94A3B8;">Game ID:</Text>
										<Text style="color: #FFFFFF;">{gameId}</Text>
									</div>
									<div class="info-item">
										<Text style="color: #94A3B8;">Status:</Text>
										<Text style="color: #FFFFFF;">{currentGame.status}</Text>
									</div>
									<div class="info-item">
										<Text style="color: #94A3B8;">Players:</Text>
										<Text style="color: #FFFFFF;">{currentGame.players?.length || 0}/{currentGame.gameOptions?.maxPlayers || 4}</Text>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Players Panel -->
					<div class="config-panel">
						<div class="panel-header">
							<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
								Players
							</Text>
						</div>
						<div class="panel-content">
							{#if currentGame?.players}
								<div class="players-list">
									{#each currentGame.players as player, index}
										<div class="player-slot">
											<div class="player-info">
												<Text style="color: #FFFFFF; font-weight: 600;">
													Player {index + 1}: {player.name}
												</Text>
												<Text style="color: #94A3B8; font-size: 12px;">
													{player.connected ? 'Connected' : 'Disconnected'}
												</Text>
											</div>
											<div class="player-status" class:connected={player.connected}>
												{player.connected ? '●' : '○'}
											</div>
										</div>
									{/each}
									
									<!-- Empty slots -->
									{#each Array(Math.max(0, (currentGame.gameOptions?.maxPlayers || 4) - (currentGame.players?.length || 0))) as _, index}
										<div class="player-slot empty">
											<Text style="color: #6B7280;">
												Player {(currentGame.players?.length || 0) + index + 1}: Waiting for player...
											</Text>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>

					<!-- Game Options Panel -->
					{#if currentGame?.gameOptions}
						<div class="config-panel">
							<div class="panel-header">
								<Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
									Game Settings
								</Text>
							</div>
							<div class="panel-content">
								<div class="options-grid">
									<div class="option-item">
										<Text style="color: #94A3B8;">Galaxy Size:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.galaxySize}</Text>
									</div>
									<div class="option-item">
										<Text style="color: #94A3B8;">Planets per System:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.planetsPerSystem}</Text>
									</div>
									<div class="option-item">
										<Text style="color: #94A3B8;">Game Speed:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.gameSpeed}</Text>
									</div>
									<div class="option-item">
										<Text style="color: #94A3B8;">Max Players:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.maxPlayers}</Text>
									</div>
									<div class="option-item">
										<Text style="color: #94A3B8;">Even Distribution:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.distributePlanetsEvenly ? 'Yes' : 'No'}</Text>
									</div>
									<div class="option-item">
										<Text style="color: #94A3B8;">Quick Start:</Text>
										<Text style="color: #FFFFFF;">{currentGame.gameOptions.quickStart ? 'Yes' : 'No'}</Text>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Actions Panel -->
					<div class="config-actions">
						<Button
							label="Back to Lobby"
							size="md"
							variant="outline"
							onclick={handleBackToLobby}
						/>
						<Button
							label="Start Game"
							size="lg"
							variant="primary"
							onclick={handleStartGame}
							disabled={!currentGame || (currentGame.players?.length || 0) < 2}
						/>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.lobby-container {
		min-height: calc(100vh - 80px);
		padding: 2rem;
		color: white;
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
	}

	.connection-status {
		position: fixed;
		top: 1rem;
		right: 1rem;
		padding: 0.5rem 1rem;
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid #F59E0B;
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
	}

	.create-game-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.create-game-modal {
		background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 12px;
		padding: 2rem;
		max-width: 90vw;
		max-height: 90vh;
		overflow-y: auto;
	}

	.game-selection {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
		min-height: 600px;
	}

	.game-list-panel,
	.game-details-panel {
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		overflow: hidden;
		display: flex;
		flex-direction: column;
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

	/* Game Configuration View Styles */
	.game-config-view {
		max-width: 800px;
		margin: 0 auto;
	}

	.config-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.config-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.config-panel {
		border: 1px solid rgba(0, 255, 255, 0.3);
		border-radius: 12px;
		background: rgba(0, 0, 0, 0.4);
		backdrop-filter: blur(10px);
		overflow: hidden;
	}

	.game-info-grid,
	.options-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.info-item,
	.option-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: rgba(0, 255, 255, 0.05);
		border-radius: 6px;
	}

	.players-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.player-slot {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: rgba(0, 255, 255, 0.05);
		border-radius: 8px;
		border: 1px solid rgba(0, 255, 255, 0.1);
	}

	.player-slot.empty {
		background: rgba(107, 114, 128, 0.1);
		border: 1px dashed rgba(107, 114, 128, 0.3);
	}

	.player-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.player-status {
		font-size: 20px;
		color: #EF4444;
	}

	.player-status.connected {
		color: #10B981;
	}

	.config-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid rgba(0, 255, 255, 0.2);
	}

	@media (max-width: 640px) {
		.config-actions {
			flex-direction: column;
			align-items: center;
		}

		.game-info-grid,
		.options-grid {
			grid-template-columns: 1fr;
		}
	}
</style>