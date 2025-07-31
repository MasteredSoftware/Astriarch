<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { multiplayerGameStore, webSocketService, type IGame, type IGameOptions } from '$lib/services/websocket';

  let gameState: any = null;
  let availableGames: IGame[] = [];
  let selectedGame: IGame | null = null;
  let createGameForm = false;
  let playerName = '';

  // Default game options based on old codebase
  let newGameOptions: IGameOptions = {
    galaxySize: 'medium',
    planetsPerSystem: 4,
    gameSpeed: 'normal',
    distributePlanetsEvenly: true,
    quickStart: false,
    maxPlayers: 4
  };

  const unsubscribe = multiplayerGameStore.subscribe((state) => {
    gameState = state;
    availableGames = state?.availableGames || [];
    selectedGame = state?.selectedGame || null;
  });

  onMount(() => {
    // Request game list when component loads
    webSocketService.listGames();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      webSocketService.listGames();
    }, 5000);

    return () => clearInterval(interval);
  });

  onDestroy(() => {
    unsubscribe();
  });

  function selectGame(game: IGame) {
    multiplayerGameStore.setSelectedGame(game);
  }

  function joinGame() {
    if (selectedGame && playerName.trim()) {
      webSocketService.joinGame(selectedGame._id, playerName.trim());
    }
  }

  function createGame() {
    if (playerName.trim()) {
      multiplayerGameStore.setPlayerName(playerName.trim());
      webSocketService.createGame(newGameOptions);
      createGameForm = false;
    }
  }

  function refreshGames() {
    webSocketService.listGames();
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleString();
  }
</script>

<div class="lobby-container">
  <div class="lobby-header">
    <h1>Astriarch Game Lobby</h1>
    <div class="connection-status" class:connected={gameState?.connected}>
      {gameState?.connected ? 'Connected' : 'Disconnected'}
    </div>
  </div>

  <div class="lobby-content">
    <!-- Game List Panel -->
    <div class="games-panel">
      <div class="panel-header">
        <h2>Available Games</h2>
        <button on:click={refreshGames} class="btn-refresh">Refresh</button>
        <button on:click={() => createGameForm = !createGameForm} class="btn-create">
          {createGameForm ? 'Cancel' : 'Create Game'}
        </button>
      </div>

      {#if createGameForm}
        <div class="create-game-form">
          <h3>Create New Game</h3>
          <div class="form-group">
            <label for="playerName">Your Name:</label>
            <input 
              id="playerName"
              type="text" 
              bind:value={playerName} 
              placeholder="Enter your name"
              required
            />
          </div>
          
          <div class="form-group">
            <label for="galaxySize">Galaxy Size:</label>
            <select id="galaxySize" bind:value={newGameOptions.galaxySize}>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div class="form-group">
            <label for="maxPlayers">Max Players:</label>
            <select id="maxPlayers" bind:value={newGameOptions.maxPlayers}>
              <option value={2}>2 Players</option>
              <option value={3}>3 Players</option>
              <option value={4}>4 Players</option>
              <option value={6}>6 Players</option>
            </select>
          </div>

          <div class="form-group">
            <label for="planetsPerSystem">Planets per System:</label>
            <input 
              id="planetsPerSystem"
              type="number" 
              bind:value={newGameOptions.planetsPerSystem} 
              min="1" 
              max="10"
            />
          </div>

          <div class="form-group">
            <label for="gameSpeed">Game Speed:</label>
            <select id="gameSpeed" bind:value={newGameOptions.gameSpeed}>
              <option value="slow">Slow</option>
              <option value="normal">Normal</option>
              <option value="fast">Fast</option>
            </select>
          </div>

          <div class="form-group checkbox">
            <label>
              <input 
                type="checkbox" 
                bind:checked={newGameOptions.distributePlanetsEvenly}
              />
              Distribute Planets Evenly
            </label>
          </div>

          <div class="form-group checkbox">
            <label>
              <input 
                type="checkbox" 
                bind:checked={newGameOptions.quickStart}
              />
              Quick Start
            </label>
          </div>

          <div class="form-actions">
            <button on:click={createGame} class="btn-primary" disabled={!playerName.trim()}>
              Create Game
            </button>
            <button on:click={() => createGameForm = false} class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="games-list">
          {#if availableGames.length > 0}
            {#each availableGames as game (game._id)}
              <div 
                class="game-item" 
                class:selected={selectedGame?._id === game._id}
                on:click={() => selectGame(game)}
                role="button"
                tabindex="0"
                on:keydown={(e) => e.key === 'Enter' && selectGame(game)}
              >
                <div class="game-name">{game.name}</div>
                <div class="game-players">{game.players?.length || 0}/{game.gameOptions?.maxPlayers || 0} players</div>
                <div class="game-status status-{game.status}">{game.status}</div>
                <div class="game-created">Created: {formatDate(game.createdAt)}</div>
              </div>
            {/each}
          {:else}
            <div class="no-games">
              No games available. Create a new game to get started!
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Game Details Panel -->
    <div class="details-panel">
      {#if selectedGame}
        <div class="game-details">
          <h2>{selectedGame.name}</h2>
          
          <div class="detail-section">
            <h3>Game Status</h3>
            <p class="status status-{selectedGame.status}">{selectedGame.status}</p>
          </div>

          <div class="detail-section">
            <h3>Players ({selectedGame.players?.length || 0}/{selectedGame.gameOptions?.maxPlayers || 0})</h3>
            <div class="players-list">
              {#each selectedGame.players || [] as player}
                <div class="player-item">
                  <span class="player-name">{player.name}</span>
                  <span class="player-status" class:connected={player.connected}>
                    {player.connected ? '●' : '○'}
                  </span>
                </div>
              {/each}
            </div>
          </div>

          {#if selectedGame.gameOptions}
            <div class="detail-section">
              <h3>Game Options</h3>
              <div class="options-grid">
                <div class="option">
                  <label>Galaxy Size:</label>
                  <span>{selectedGame.gameOptions.galaxySize}</span>
                </div>
                <div class="option">
                  <label>Planets per System:</label>
                  <span>{selectedGame.gameOptions.planetsPerSystem}</span>
                </div>
                <div class="option">
                  <label>Game Speed:</label>
                  <span>{selectedGame.gameOptions.gameSpeed}</span>
                </div>
                <div class="option">
                  <label>Even Distribution:</label>
                  <span>{selectedGame.gameOptions.distributePlanetsEvenly ? 'Yes' : 'No'}</span>
                </div>
                <div class="option">
                  <label>Quick Start:</label>
                  <span>{selectedGame.gameOptions.quickStart ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          {/if}

          <div class="detail-section">
            <h3>Game Information</h3>
            <p><strong>Created:</strong> {formatDate(selectedGame.createdAt)}</p>
            <p><strong>Last Activity:</strong> {formatDate(selectedGame.lastActivity)}</p>
          </div>

          <div class="join-section">
            {#if selectedGame.status === 'waiting'}
              <div class="join-form">
                <input 
                  type="text" 
                  bind:value={playerName} 
                  placeholder="Enter your name"
                  required
                />
                <button 
                  on:click={joinGame} 
                  class="btn-join"
                  disabled={!playerName.trim() || (selectedGame.players?.length || 0) >= (selectedGame.gameOptions?.maxPlayers || 4)}
                >
                  Join Game
                </button>
              </div>
            {:else}
              <p class="game-unavailable">This game is not available for joining.</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="no-selection">
          <h2>Select a Game</h2>
          <p>Choose a game from the list to view details and join.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .lobby-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: Arial, sans-serif;
  }

  .lobby-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
    padding-bottom: 20px;
    border-bottom: 2px solid #333;
  }

  .lobby-header h1 {
    color: #fff;
    margin: 0;
  }

  .connection-status {
    padding: 8px 16px;
    border-radius: 4px;
    font-weight: bold;
    background-color: #ff4444;
    color: white;
  }

  .connection-status.connected {
    background-color: #44ff44;
    color: black;
  }

  .lobby-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
  }

  .games-panel, .details-panel {
    background-color: #222;
    border-radius: 8px;
    padding: 20px;
    color: #fff;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .panel-header h2 {
    margin: 0;
    color: #fff;
  }

  .btn-refresh, .btn-create {
    padding: 8px 16px;
    margin-left: 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .btn-refresh {
    background-color: #666;
    color: white;
  }

  .btn-create {
    background-color: #4CAF50;
    color: white;
  }

  .btn-refresh:hover, .btn-create:hover {
    opacity: 0.8;
  }

  .create-game-form {
    background-color: #333;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
  }

  .create-game-form h3 {
    margin-top: 0;
    color: #fff;
  }

  .form-group {
    margin-bottom: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 5px;
    color: #ccc;
    font-weight: bold;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
  }

  .form-group.checkbox input {
    margin-right: 8px;
  }

  .form-group input, .form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid #555;
    border-radius: 4px;
    background-color: #444;
    color: #fff;
  }

  .form-actions {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }

  .btn-primary {
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .btn-primary:disabled {
    background-color: #666;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #666;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .games-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .game-item {
    background-color: #333;
    padding: 15px;
    margin-bottom: 10px;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .game-item:hover {
    background-color: #444;
  }

  .game-item.selected {
    background-color: #4CAF50;
    color: black;
  }

  .game-name {
    font-weight: bold;
    font-size: 16px;
    margin-bottom: 5px;
  }

  .game-players, .game-created {
    font-size: 12px;
    color: #ccc;
  }

  .game-item.selected .game-players,
  .game-item.selected .game-created {
    color: #333;
  }

  .game-status {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: bold;
    display: inline-block;
    margin: 5px 0;
  }

  .status-waiting {
    background-color: #ff9800;
    color: black;
  }

  .status-in_progress {
    background-color: #2196F3;
    color: white;
  }

  .status-completed {
    background-color: #666;
    color: white;
  }

  .no-games {
    text-align: center;
    color: #ccc;
    font-style: italic;
    padding: 40px;
  }

  .game-details h2 {
    color: #fff;
    margin-top: 0;
  }

  .detail-section {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid #444;
  }

  .detail-section:last-child {
    border-bottom: none;
  }

  .detail-section h3 {
    color: #ccc;
    margin-bottom: 10px;
  }

  .players-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .player-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    background-color: #333;
    border-radius: 4px;
  }

  .player-name {
    color: #fff;
  }

  .player-status {
    font-size: 18px;
    color: #ff4444;
  }

  .player-status.connected {
    color: #44ff44;
  }

  .options-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .option {
    display: flex;
    justify-content: space-between;
  }

  .option label {
    color: #ccc;
    font-weight: bold;
  }

  .option span {
    color: #fff;
  }

  .join-section {
    margin-top: 20px;
  }

  .join-form {
    display: flex;
    gap: 10px;
  }

  .join-form input {
    flex: 1;
    padding: 10px;
    border: 1px solid #555;
    border-radius: 4px;
    background-color: #444;
    color: #fff;
  }

  .btn-join {
    background-color: #4CAF50;
    color: white;
    padding: 10px 20px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }

  .btn-join:disabled {
    background-color: #666;
    cursor: not-allowed;
  }

  .game-unavailable {
    color: #ccc;
    font-style: italic;
  }

  .no-selection {
    text-align: center;
    color: #ccc;
    padding: 40px;
  }

  .no-selection h2 {
    color: #fff;
  }

  /* Dark theme styling */
  body {
    background-color: #111;
    color: #fff;
  }
</style>
