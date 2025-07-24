<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameStore, playerPlanets, playerFleets, allPlayers } from '../../stores/gameStore';
  import { webSocketService } from '../../services/websocket';
  import GameCanvas from './GameCanvas.svelte';
  import PlanetView from './PlanetView.svelte';
  import ResearchView from './ResearchView.svelte';
  import FleetView from './FleetView.svelte';
  import ChatPanel from './ChatPanel.svelte';
  import NotificationPanel from './NotificationPanel.svelte';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  import { TopOverview } from '../astriarch';
  
  let gameId = '';
  let playerName = '';
  let connectionState = 'disconnected';
  let lastError: string | null = null;
  let showConnectDialog = true;
  
  // Subscribe to connection state
  let connectionStateUnsubscribe: () => void;
  let errorUnsubscribe: () => void;
  
  onMount(() => {
    connectionStateUnsubscribe = webSocketService.getConnectionState().subscribe(state => {
      connectionState = state;
      if (state === 'connected') {
        showConnectDialog = false;
      }
    });
    
    errorUnsubscribe = webSocketService.getLastError().subscribe(error => {
      lastError = error;
    });
  });
  
  onDestroy(() => {
    connectionStateUnsubscribe?.();
    errorUnsubscribe?.();
    webSocketService.disconnect();
  });
  
  async function connect() {
    if (!gameId.trim() || !playerName.trim()) {
      lastError = 'Please enter both Game ID and Player Name';
      return;
    }
    
    try {
      await webSocketService.connect('ws://localhost:8001');
      webSocketService.joinGame(gameId.trim(), playerName.trim());
      gameStore.setCurrentPlayer(playerName.trim());
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }
  
  function disconnect() {
    webSocketService.leaveGame();
    webSocketService.disconnect();
    showConnectDialog = true;
    gameId = '';
    playerName = '';
  }
  
  function handlePlanetClick(event: CustomEvent) {
    const { planetId } = event.detail;
    gameStore.selectPlanet(planetId);
  }
  
  function handleFleetClick(event: CustomEvent) {
    const { fleetId } = event.detail;
    gameStore.selectFleet(fleetId);
  }
  
  function toggleView(view: string) {
    gameStore.setCurrentView(view as any);
  }
  
  // Get current game state
  $: currentView = $gameStore.currentView;
  $: gameState = $gameStore.gameState;
  $: selectedPlanet = $gameStore.selectedPlanet;
  $: selectedFleet = $gameStore.selectedFleet;
  $: notifications = $gameStore.notifications;
  $: chatMessages = $gameStore.chatMessages;
  $: myPlanets = $playerPlanets;
  $: myFleets = $playerFleets;
  $: players = $allPlayers;
</script>

<div class="game-interface">
  {#if showConnectDialog}
    <!-- Connection Dialog -->
    <div class="connect-overlay">
      <Card class="connect-dialog">
        <div class="connect-header">
          <h2>Connect to Astriarch Game</h2>
        </div>
        <div class="connect-form">
          <div class="form-group">
            <label for="gameId">Game ID:</label>
            <input 
              id="gameId" 
              type="text" 
              bind:value={gameId} 
              placeholder="Enter game ID"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label for="playerName">Player Name:</label>
            <input 
              id="playerName" 
              type="text" 
              bind:value={playerName} 
              placeholder="Enter your name"
              class="form-input"
            />
          </div>
          {#if lastError}
            <div class="error-message">{lastError}</div>
          {/if}
          <div class="connect-actions">
            <Button 
              on:click={connect} 
              disabled={connectionState === 'connecting' || !gameId.trim() || !playerName.trim()}
            >
              {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  {:else}
    <!-- Main Game Interface -->
    <div class="game-layout">
      <!-- Top Status Bar -->
      <div class="top-bar">
        <TopOverview>
          <div class="status-section">
            <div class="connection-status">
              <span class="status-indicator status-{connectionState}"></span>
              <span>Connected as {playerName}</span>
            </div>
            {#if gameState}
              <div class="game-time">
                Time: {Math.floor(gameState.gameTime / 1000)}s
              </div>
            {/if}
          </div>
          <div class="actions-section">
            <Button size="small" variant="secondary" on:click={() => gameStore.toggleChat()}>
              Chat ({chatMessages.length})
            </Button>
            <Button size="small" variant="secondary" on:click={() => gameStore.toggleNotifications()}>
              Alerts ({notifications.length})
            </Button>
            <Button size="small" variant="destructive" on:click={disconnect}>
              Disconnect
            </Button>
          </div>
        </TopOverview>
      </div>
      
      <!-- Main Content Area -->
      <div class="main-content">
        <!-- Left Sidebar - Game Navigation -->
        <div class="left-sidebar">
          <Card class="nav-card">
            <h3>Game Views</h3>
            <div class="nav-buttons">
              <Button 
                variant={currentView === 'game' ? 'default' : 'secondary'} 
                size="small" 
                on:click={() => toggleView('game')}
              >
                Galaxy Map
              </Button>
              <Button 
                variant={currentView === 'research' ? 'default' : 'secondary'} 
                size="small" 
                on:click={() => toggleView('research')}
              >
                Research Lab
              </Button>
              <Button 
                variant={currentView === 'diplomacy' ? 'default' : 'secondary'} 
                size="small" 
                on:click={() => toggleView('diplomacy')}
              >
                Diplomacy
              </Button>
            </div>
          </Card>
          
          <!-- Player Planets -->
          <Card class="planets-card">
            <h3>My Planets ({myPlanets.length})</h3>
            <div class="planets-list">
              {#each myPlanets as planet}
                <button 
                  class="planet-item" 
                  class:selected={selectedPlanet === planet.id}
                  on:click={() => gameStore.selectPlanet(planet.id)}
                >
                  <div class="planet-name">Planet {planet.id}</div>
                  <div class="planet-stats">
                    <span>Pop: {planet.population}</span>
                    <span>Ore: {planet.resources.ore}</span>
                  </div>
                </button>
              {/each}
            </div>
          </Card>
          
          <!-- Player Fleets -->
          <Card class="fleets-card">
            <h3>My Fleets ({myFleets.length})</h3>
            <div class="fleets-list">
              {#each myFleets as fleet}
                <button 
                  class="fleet-item"
                  class:selected={selectedFleet === fleet.id}
                  on:click={() => gameStore.selectFleet(fleet.id)}
                >
                  <div class="fleet-name">Fleet {fleet.id}</div>
                  <div class="fleet-stats">
                    <span>Ships: {Object.values(fleet.ships).reduce((sum, count) => sum + count, 0)}</span>
                    <span>Status: {fleet.status}</span>
                  </div>
                </button>
              {/each}
            </div>
          </Card>
        </div>
        
        <!-- Center Area - Main View -->
        <div class="center-area">
          {#if currentView === 'game'}
            <GameCanvas 
              on:planetClick={handlePlanetClick}
              on:fleetClick={handleFleetClick}
            />
          {:else if currentView === 'research'}
            <ResearchView />
          {:else if currentView === 'fleet'}
            <FleetView />
          {:else}
            <div class="placeholder-view">
              <h2>{currentView} View</h2>
              <p>This view is coming soon!</p>
            </div>
          {/if}
        </div>
        
        <!-- Right Sidebar - Players and Stats -->
        <div class="right-sidebar">
          <Card class="players-card">
            <h3>Players ({players.length})</h3>
            <div class="players-list">
              {#each players as player}
                <div class="player-item" class:current={player.id === $gameStore.currentPlayer}>
                  <div class="player-name">{player.name}</div>
                  <div class="player-stats">
                    <span class="player-status" class:active={player.isActive}></span>
                    <span>{player.isAI ? 'AI' : 'Human'}</span>
                  </div>
                </div>
              {/each}
            </div>
          </Card>
          
          <!-- Quick Stats -->
          {#if gameState && $gameStore.currentPlayer}
            {@const currentPlayer = gameState.players[$gameStore.currentPlayer]}
            {#if currentPlayer}
              <Card class="stats-card">
                <h3>Research Progress</h3>
                <div class="research-stats">
                  <div class="research-item">
                    <span>Attack:</span>
                    <span>{currentPlayer.research.attack}</span>
                  </div>
                  <div class="research-item">
                    <span>Defense:</span>
                    <span>{currentPlayer.research.defense}</span>
                  </div>
                  <div class="research-item">
                    <span>Propulsion:</span>
                    <span>{currentPlayer.research.propulsion}</span>
                  </div>
                </div>
              </Card>
            {/if}
          {/if}
        </div>
      </div>
      
      <!-- Overlay Panels -->
      {#if selectedPlanet}
        <PlanetView />
      {/if}
      
      {#if $gameStore.showChat}
        <ChatPanel />
      {/if}
      
      {#if $gameStore.showNotifications}
        <NotificationPanel />
      {/if}
    </div>
  {/if}
</div>

<style>
  .game-interface {
    width: 100vw;
    height: 100vh;
    background: var(--background);
    color: var(--foreground);
    overflow: hidden;
  }
  
  .connect-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .connect-dialog {
    width: 400px;
    max-width: 90%;
    background: var(--background);
    border: 2px solid var(--border);
  }
  
  .connect-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
  }
  
  .connect-header h2 {
    margin: 0;
    color: var(--foreground);
  }
  
  .connect-form {
    padding: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: var(--foreground);
  }
  
  .form-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--background);
    color: var(--foreground);
    font-size: 1rem;
  }
  
  .form-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
  }
  
  .error-message {
    background: var(--destructive);
    color: var(--destructive-foreground);
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  
  .connect-actions {
    display: flex;
    justify-content: center;
  }
  
  .game-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  
  .top-bar {
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }
  
  .status-section {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  
  .status-connected {
    background: var(--success);
  }
  
  .status-connecting {
    background: var(--warning);
  }
  
  .status-disconnected,
  .status-error {
    background: var(--destructive);
  }
  
  .actions-section {
    display: flex;
    gap: 0.5rem;
  }
  
  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  
  .left-sidebar,
  .right-sidebar {
    width: 250px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: var(--muted);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }
  
  .right-sidebar {
    border-right: none;
    border-left: 1px solid var(--border);
  }
  
  .center-area {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background: var(--background);
    overflow: hidden;
  }
  
  .nav-card h3,
  .planets-card h3,
  .fleets-card h3,
  .players-card h3,
  .stats-card h3 {
    margin: 0 0 1rem 0;
    color: var(--foreground);
    font-size: 0.9rem;
    font-weight: 600;
  }
  
  .nav-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
  }
  
  .planets-list,
  .fleets-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .planet-item,
  .fleet-item {
    background: none;
    border: none;
    padding: 0.5rem;
    text-align: left;
    border-radius: 4px;
    cursor: pointer;
    color: var(--foreground);
    border: 1px solid transparent;
  }
  
  .planet-item:hover,
  .fleet-item:hover {
    background: var(--muted);
  }
  
  .planet-item.selected,
  .fleet-item.selected {
    background: var(--primary);
    color: var(--primary-foreground);
  }
  
  .planet-name,
  .fleet-name {
    font-weight: 600;
    font-size: 0.9rem;
  }
  
  .planet-stats,
  .fleet-stats {
    font-size: 0.8rem;
    color: var(--muted-foreground);
    display: flex;
    gap: 0.5rem;
  }
  
  .players-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
  }
  
  .player-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--muted);
    border-radius: 4px;
  }
  
  .player-item.current {
    border: 1px solid var(--primary);
  }
  
  .player-name {
    font-weight: 600;
  }
  
  .player-stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }
  
  .player-status {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted-foreground);
  }
  
  .player-status.active {
    background: var(--success);
  }
  
  .research-stats {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .research-item {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
  }
  
  .placeholder-view {
    text-align: center;
    color: var(--muted-foreground);
  }
  
  .placeholder-view h2 {
    margin-bottom: 0.5rem;
    color: var(--foreground);
  }
</style>