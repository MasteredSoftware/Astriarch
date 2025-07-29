<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { multiplayerGameStore, webSocketService, connectToGame } from '$lib/services/websocket';
  import LobbyView from '$lib/components/LobbyView.svelte';
  import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';

  let gameState: any;
  let connecting = false;
  let connectionError = '';

  const unsubscribe = multiplayerGameStore.subscribe((state) => {
    gameState = state;
  });

  onMount(async () => {
    connecting = true;
    connectionError = '';
    
    try {
      await connectToGame();
      console.log('Connected to WebSocket server');
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      connectionError = 'Failed to connect to server. Please check if the server is running.';
    } finally {
      connecting = false;
    }
  });

  onDestroy(() => {
    unsubscribe();
    webSocketService.disconnect();
  });

  function retry() {
    connecting = true;
    connectionError = '';
    
    connectToGame().then(() => {
      console.log('Reconnected to WebSocket server');
    }).catch((error) => {
      console.error('Failed to reconnect:', error);
      connectionError = 'Failed to reconnect to server.';
    }).finally(() => {
      connecting = false;
    });
  }
</script>

<svelte:head>
  <title>Astriarch - Multiplayer Server</title>
</svelte:head>

<div class="server-interface">
  <header class="server-header">
    <div class="header-content">
      <div class="server-title">
        <h1>Astriarch Multiplayer Server</h1>
        <p class="subtitle">Game lobby and multiplayer interface</p>
      </div>
      <ConnectionStatus />
    </div>
  </header>

  <main class="server-main">
    {#if connecting}
      <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Connecting to server...</p>
      </div>
    {:else if connectionError}
      <div class="error-screen">
        <div class="error-icon">⚠️</div>
        <h2>Connection Error</h2>
        <p>{connectionError}</p>
        <button on:click={retry} class="retry-button">
          Try Again
        </button>
        <div class="help-text">
          <p>Make sure the Astriarch backend server is running:</p>
          <code>cd apps/astriarch-backend && pnpm run dev</code>
        </div>
      </div>
    {:else if gameState?.currentView === 'lobby'}
      <LobbyView />
    {:else if gameState?.currentView === 'game_options'}
      <div class="game-options-view">
        <h2>Game Options</h2>
        <p>Waiting for game to start...</p>
        <p>Game ID: {gameState?.gameId}</p>
        {#if gameState?.selectedGame}
          <p>Players: {gameState.selectedGame.players.length}/{gameState.selectedGame.gameOptions?.maxPlayers}</p>
        {/if}
        <button on:click={() => webSocketService.startGame()}>
          Start Game
        </button>
        <button on:click={() => {
          multiplayerGameStore.setCurrentView('lobby');
          webSocketService.leaveGame();
        }}>
          Leave Game
        </button>
      </div>
    {:else if gameState?.currentView === 'game'}
      <div class="game-view">
        <h2>Game Interface</h2>
        <p>Game in progress...</p>
        <p>Game ID: {gameState?.gameId}</p>
        <p>Player: {gameState?.playerName}</p>
        
        <!-- Placeholder for actual game interface -->
        <div class="game-placeholder">
          <p>Game interface will be implemented here</p>
          <p>This will show the actual Astriarch game board, planets, fleets, etc.</p>
        </div>
        
        <button on:click={() => {
          multiplayerGameStore.setCurrentView('lobby');
          webSocketService.leaveGame();
        }}>
          Leave Game
        </button>
      </div>
    {:else}
      <div class="unknown-view">
        <h2>Unknown State</h2>
        <p>Current view: {gameState?.currentView}</p>
        <button on:click={() => multiplayerGameStore.setCurrentView('lobby')}>
          Return to Lobby
        </button>
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #111;
    color: #fff;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }

  .server-interface {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .server-header {
    background-color: #222;
    border-bottom: 3px solid #4CAF50;
    padding: 20px 0;
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .server-title h1 {
    margin: 0;
    color: #4CAF50;
    font-size: 28px;
  }

  .subtitle {
    margin: 5px 0 0 0;
    color: #ccc;
    font-size: 14px;
  }

  .server-main {
    flex: 1;
    padding: 20px;
  }

  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: #ccc;
  }

  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 3px solid #333;
    border-top: 3px solid #4CAF50;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  .error-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    text-align: center;
    color: #ccc;
  }

  .error-icon {
    font-size: 64px;
    margin-bottom: 20px;
  }

  .error-screen h2 {
    color: #ff4444;
    margin-bottom: 10px;
  }

  .retry-button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    margin: 20px 0;
  }

  .retry-button:hover {
    background-color: #45a049;
  }

  .help-text {
    margin-top: 20px;
    padding: 15px;
    background-color: #333;
    border-radius: 8px;
    border-left: 4px solid #4CAF50;
  }

  .help-text code {
    background-color: #444;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    color: #4CAF50;
  }

  .game-options-view, .game-view, .unknown-view {
    max-width: 800px;
    margin: 0 auto;
    padding: 40px;
    background-color: #222;
    border-radius: 12px;
    text-align: center;
  }

  .game-options-view h2, .game-view h2, .unknown-view h2 {
    color: #4CAF50;
    margin-bottom: 20px;
  }

  .game-options-view p, .game-view p, .unknown-view p {
    color: #ccc;
    margin-bottom: 10px;
  }

  .game-options-view button, .game-view button, .unknown-view button {
    background-color: #4CAF50;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    margin: 10px;
  }

  .game-options-view button:hover, .game-view button:hover, .unknown-view button:hover {
    background-color: #45a049;
  }

  .game-placeholder {
    background-color: #333;
    border: 2px dashed #666;
    border-radius: 8px;
    padding: 40px;
    margin: 20px 0;
    color: #888;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      gap: 20px;
      text-align: center;
    }

    .server-main {
      padding: 10px;
    }

    .game-options-view, .game-view, .unknown-view {
      padding: 20px;
    }
  }
</style>