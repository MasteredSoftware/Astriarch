<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { 
    gameStarted, 
    notifications, 
    resourceData, 
    population, 
    gameTime, 
    isGameRunning,
    gameActions 
  } from '$lib/stores/gameStore';
  import { currentView, navigationActions } from '$lib/stores/navigationStore';
  
  import {
    TopOverview,
    NavigationController,
    Button,
    Text
  } from '$lib/components/astriarch';

  // Import game view components
  import FleetCommandView from '$lib/components/game-views/FleetCommandView.svelte';
  import PlanetOverviewView from '$lib/components/game-views/PlanetOverviewView.svelte';
  import ResearchLabView from '$lib/components/game-views/ResearchLabView.svelte';
  import DiplomacyView from '$lib/components/game-views/DiplomacyView.svelte';

  // Dynamically import GalaxyCanvas to avoid SSR issues with Konva
  let GalaxyCanvas: any = null;

  $: if (browser && !GalaxyCanvas) {
    import('$lib/components/galaxy/GalaxyCanvas.svelte').then(module => {
      GalaxyCanvas = module.default;
    });
  }

  let navigationItems = [
    { label: "Galaxy View", onclick: () => navigationActions.setView('galaxy') },
    { label: "Fleet Command", onclick: () => navigationActions.setView('fleet') },
    { label: "Planet Overview", onclick: () => navigationActions.setView('planets') },
    { label: "Research Lab", onclick: () => navigationActions.setView('research') },
    { label: "Diplomacy", onclick: () => navigationActions.setView('diplomacy') }
  ];

  onMount(() => {
    console.log('Astriarch game component mounted');
  });

  onDestroy(() => {
    // Pause the game when component is destroyed to stop animation frame
    gameActions.pauseGame();
  });
</script>

<svelte:head>
  <title>Astriarch - Space Strategy Game</title>
  <meta name="description" content="Command fleets, manage planets, and conquer the galaxy in this epic space strategy game." />
</svelte:head>

<main class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white overflow-hidden">
  <!-- Space Background Effect -->
  <div class="fixed inset-0 opacity-20">
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black"></div>
    <!-- Add some "stars" -->
    <div class="absolute top-10 left-10 w-1 h-1 bg-white rounded-full opacity-60"></div>
    <div class="absolute top-32 left-64 w-1 h-1 bg-white rounded-full opacity-40"></div>
    <div class="absolute top-48 right-32 w-1 h-1 bg-cyan-400 rounded-full opacity-80"></div>
    <div class="absolute bottom-32 left-32 w-1 h-1 bg-white rounded-full opacity-50"></div>
    <div class="absolute bottom-48 right-48 w-1 h-1 bg-white rounded-full opacity-70"></div>
  </div>

  <!-- Top HUD -->
  <header class="relative z-10 p-4">
    <div class="flex justify-between items-center mb-4">
      <div class="flex items-center space-x-4">
        <Text style="font-size: 32px; font-weight: bold; color: #00FFFF; text-shadow: 0 0 10px rgba(0,255,255,0.5);">
          ASTRIARCH
        </Text>
        <Text style="font-size: 14px; color: #94A3B8; margin-left: 16px;">
          Cycle {$gameTime.cycle} • {$gameTime.timeString} • Stardate {$gameTime.stardate}
        </Text>
        {#if $gameStarted}
          <Text style="font-size: 12px; color: {$isGameRunning ? '#10B981' : '#EF4444'}; margin-left: 8px;">
            {$isGameRunning ? '● RUNNING' : '⏸ PAUSED'}
          </Text>
        {/if}
      </div>
      
      {#if $gameStarted}
        <Button 
          label={$isGameRunning ? "Pause Game" : "Resume Game"} 
          size="md" 
          variant={$isGameRunning ? "outline" : "primary"}
          onclick={$isGameRunning ? gameActions.pauseGame : gameActions.resumeGame}
        />
      {:else}
        <div class="flex items-center space-x-4">
          <Button 
            label="Start New Game" 
            size="lg" 
            variant="primary"
            onclick={gameActions.startNewGame}
          />
          <a href="/test/websocket" class="text-cyan-400 hover:text-cyan-300 text-sm underline">
            WebSocket Test
          </a>
        </div>
      {/if}
    </div>

    <!-- Resource Overview -->
    {#if $gameStarted}
      <div class="flex justify-center mb-6">
        <TopOverview resourceData={$resourceData} population={$population} />
      </div>
    {/if}
  </header>

  <!-- Main Game Area -->
  <div class="relative z-10 flex-1">
    {#if $gameStarted}
      <!-- Game View -->
      <div class="h-[calc(100vh-200px)] flex flex-col">
        <!-- Central Game Content Area with Galaxy Canvas as background -->
        <div class="flex-1 relative mx-4 rounded-lg overflow-hidden">
          <!-- Galaxy Canvas - Always visible as background (client-side only) -->
          <div class="absolute inset-0">
            {#if GalaxyCanvas}
              <svelte:component this={GalaxyCanvas} />
            {/if}
          </div>
          
          <!-- Overlay Panels for different views -->
          {#if $currentView === 'fleet'}
            <div class="absolute top-4 right-4 w-96 max-h-[calc(100%-2rem)] bg-black/80 backdrop-blur-sm border border-cyan-500/40 rounded-lg overflow-hidden">
              <FleetCommandView />
            </div>
          {:else if $currentView === 'planets'}
            <div class="absolute bottom-4 left-4 right-4 h-1/2 bg-black/90 backdrop-blur-sm border border-cyan-500/40 rounded-lg overflow-hidden">
              <PlanetOverviewView />
            </div>
          {:else if $currentView === 'research'}
            <div class="absolute top-4 right-4 w-96 max-h-[calc(100%-2rem)] bg-black/80 backdrop-blur-sm border border-cyan-500/40 rounded-lg overflow-hidden">
              <ResearchLabView />
            </div>
          {:else if $currentView === 'diplomacy'}
            <div class="absolute top-4 right-4 w-96 max-h-[calc(100%-2rem)] bg-black/80 backdrop-blur-sm border border-cyan-500/40 rounded-lg overflow-hidden">
              <DiplomacyView />
            </div>
          {/if}
        </div>

        <!-- Bottom Navigation -->
        <div class="mt-4">
          <NavigationController items={navigationItems} />
        </div>
      </div>
    {:else}
      <!-- Welcome Screen -->
      <div class="flex items-center justify-center h-[calc(100vh-200px)]">
        <div class="text-center max-w-2xl mx-auto p-8">
          <Text style="font-size: 48px; font-weight: bold; color: #00FFFF; margin-bottom: 24px; text-shadow: 0 0 20px rgba(0,255,255,0.5);">
            ASTRIARCH
          </Text>
          <Text style="font-size: 20px; color: #94A3B8; margin-bottom: 32px; line-height: 1.6;">
            Command vast fleets across the galaxy in real-time. Manage planetary resources and populations. 
            Research advanced technologies. Forge alliances or crush your enemies.
          </Text>
          <Text style="font-size: 16px; color: #64748B; margin-bottom: 48px;">
            The galaxy awaits your strategic genius in this real-time space conquest.
          </Text>
          <Button 
            label="Begin Your Conquest" 
            size="lg" 
            variant="primary"
            onclick={gameActions.startNewGame}
          />
        </div>
      </div>
    {/if}
  </div>

  <!-- Notifications Panel -->
  {#if $notifications.length > 0}
    <div class="fixed bottom-4 right-4 max-w-sm space-y-2 z-20">
      {#each $notifications.slice(-5) as notification, i}
        <div class="bg-black/80 border border-cyan-500/40 rounded-lg p-3 backdrop-blur-sm">
          <Text style="color: #00FFFF; font-size: 12px;">
            {notification}
          </Text>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Debug: Test page link -->
  <div class="fixed bottom-4 left-4 z-20">
    <a href="/test" class="text-xs text-slate-500 hover:text-cyan-400 transition-colors">
      Component Test Page
    </a>
  </div>
</main>
