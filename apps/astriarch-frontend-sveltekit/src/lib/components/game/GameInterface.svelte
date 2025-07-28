<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameModel, clientGameModel, resourceData, population, gameActions } from '../../stores/gameStore';
  import GameCanvas from './GameCanvas.svelte';
  import PlanetView from './PlanetView.svelte';
  import ResearchView from './ResearchView.svelte';
  import FleetView from './FleetView.svelte';
  import ChatPanel from './ChatPanel.svelte';
  import NotificationPanel from './NotificationPanel.svelte';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  import { TopOverview } from '../astriarch';
  
  let currentView = 'game';
  let selectedPlanet: string | null = null;
  let selectedFleet: string | null = null;
  let showChat = false;
  let showNotifications = false;
  
  // Subscribe to game state
  $: gameStarted = $gameModel !== null;
  $: currentGameModel = $gameModel;
  $: currentClientModel = $clientGameModel;
  
  function startNewGame() {
    gameActions.startNewGame();
  }
  
  function handlePlanetClick(event: CustomEvent) {
    const { planetId } = event.detail;
    selectedPlanet = planetId;
    currentView = 'planet';
  }
  
  function handleFleetClick(event: CustomEvent) {
    const { fleetId } = event.detail;
    selectedFleet = fleetId;
    currentView = 'fleet';
  }
  
  function toggleView(view: string) {
    currentView = view;
  }
  
  function toggleChat() {
    showChat = !showChat;
  }
  
  function toggleNotifications() {
    showNotifications = !showNotifications;
  }
</script>

<div class="game-interface">
  {#if !gameStarted}
    <!-- Game Start Screen -->
    <div class="start-overlay">
      <Card class="start-dialog">
        <div class="start-header">
          <h2>Welcome to Astriarch</h2>
        </div>
        <div class="start-content">
          <p>Ready to conquer the galaxy?</p>
          <div class="start-actions">
            <Button onclick={startNewGame}>
              Start New Game
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
        <TopOverview resourceData={$resourceData} population={$population}>
          <div class="status-section">
            <div class="game-status">
              <span>Astriarch Engine Game</span>
            </div>
          </div>
          <div class="actions-section">
            <Button size="small" variant="secondary" onclick={toggleChat}>
              Chat
            </Button>
            <Button size="small" variant="secondary" onclick={toggleNotifications}>
              Alerts
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
                variant={currentView === 'game' ? 'primary' : 'outline'} 
                size="sm" 
                onclick={() => toggleView('game')}
              >
                Galaxy Map
              </Button>
              <Button 
                variant={currentView === 'research' ? 'primary' : 'outline'} 
                size="sm" 
                onclick={() => toggleView('research')}
              >
                Research Lab
              </Button>
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
        
        <!-- Right Sidebar - Game Info -->
        <div class="right-sidebar">
          <Card class="info-card">
            <h3>Game Status</h3>
            <div class="game-info">
              <p>Engine-based local game</p>
              {#if currentClientModel}
                <p>Cycle: {currentClientModel.currentCycle}</p>
              {/if}
            </div>
          </Card>
        </div>
      </div>
      
      <!-- Overlay Panels -->
      {#if selectedPlanet}
        <PlanetView />
      {/if}
      
      {#if showChat}
        <ChatPanel />
      {/if}
      
      {#if showNotifications}
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
  
  .start-overlay {
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
  
  .start-content {
    padding: 1.5rem;
    text-align: center;
  }
  
  .start-actions {
    margin-top: 1rem;
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
  
  .nav-buttons {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
  }
  
  .game-info {
    padding: 0.75rem;
  }
  
  .game-info p {
    margin: 0.5rem 0;
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