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

	import { TopOverview, NavigationController, Button, Text } from '$lib/components/astriarch';

	// Import game view components
	import FleetCommandView from '$lib/components/game-views/FleetCommandView.svelte';
	import PlanetOverviewView from '$lib/components/game-views/PlanetOverviewView.svelte';
	import ResearchLabView from '$lib/components/game-views/ResearchLabView.svelte';
	import DiplomacyView from '$lib/components/game-views/DiplomacyView.svelte';

	// Import lobby components
	import { LobbyView } from '$lib/components/lobby';

	// Dynamically import GalaxyCanvas to avoid SSR issues with Konva
	let GalaxyCanvas: any = null;

	// UI state
	let showLobby = false;

	$: if (browser && !GalaxyCanvas) {
		import('$lib/components/galaxy/GalaxyCanvas.svelte').then((module) => {
			GalaxyCanvas = module.default;
		});
	}

	let navigationItems = [
		{ label: 'Planets', onclick: () => navigationActions.setView('planets') },
		{ label: 'Research', onclick: () => navigationActions.setView('research') },
		{ label: 'Trading', onclick: () => navigationActions.setView('trading') },
		{ label: 'Fleet Command', onclick: () => navigationActions.setView('fleet') },
		{ label: 'Activity', onclick: () => navigationActions.setView('activity') }
	];

	function handleShowLobby() {
		showLobby = true;
	}

	function handleBackToMain() {
		showLobby = false;
	}

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
	<meta
		name="description"
		content="Command fleets, manage planets, and conquer the galaxy in this epic space strategy game."
	/>
</svelte:head>

<main
	class="min-h-screen overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white"
>
	<!-- Space Background Effect -->
	<div class="fixed inset-0 opacity-20">
		<div
			class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900 via-slate-900 to-black"
		></div>
		<!-- Add some "stars" -->
		<div class="absolute top-10 left-10 h-1 w-1 rounded-full bg-white opacity-60"></div>
		<div class="absolute top-32 left-64 h-1 w-1 rounded-full bg-white opacity-40"></div>
		<div class="absolute top-48 right-32 h-1 w-1 rounded-full bg-cyan-400 opacity-80"></div>
		<div class="absolute bottom-32 left-32 h-1 w-1 rounded-full bg-white opacity-50"></div>
		<div class="absolute right-48 bottom-48 h-1 w-1 rounded-full bg-white opacity-70"></div>
	</div>

	<!-- Top HUD -->
	<header class="relative z-10 p-4">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<Text
					style="font-size: 32px; font-weight: bold; color: #00FFFF; text-shadow: 0 0 10px rgba(0,255,255,0.5);"
				>
					ASTRIARCH
				</Text>
				<Text style="font-size: 14px; color: #94A3B8; margin-left: 16px;">
					Cycle {$gameTime.cycle} • {$gameTime.timeString} • Stardate {$gameTime.stardate}
				</Text>
				{#if $gameStarted}
					<Text
						style="font-size: 12px; color: {$isGameRunning
							? '#10B981'
							: '#EF4444'}; margin-left: 8px;"
					>
						{$isGameRunning ? '● RUNNING' : '⏸ PAUSED'}
					</Text>
				{/if}
			</div>

			{#if $gameStarted}
				<Button
					label={$isGameRunning ? 'Pause Game' : 'Resume Game'}
					size="md"
					variant={$isGameRunning ? 'outline' : 'primary'}
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
					<Button
						label="Multiplayer Lobby"
						size="lg"
						variant="outline"
						onclick={handleShowLobby}
					/>
					<a href="/test/websocket" class="text-sm text-cyan-400 underline hover:text-cyan-300">
						WebSocket Test
					</a>
				</div>
			{/if}
		</div>

		<!-- Resource Overview -->
		{#if $gameStarted}
			<div class="mb-6 flex justify-center">
				<TopOverview resourceData={$resourceData} population={$population} />
			</div>
		{/if}
	</header>

	<!-- Main Game Area -->
	<div class="relative z-10 flex-1">
		{#if $gameStarted}
			<!-- Game View -->
			<div class="flex h-[calc(100vh-200px)] flex-col">
				<!-- Central Game Content Area with Galaxy Canvas as background -->
				<div class="relative mx-4 flex-1 overflow-hidden rounded-lg">
					<!-- Galaxy Canvas - Always visible as background (client-side only) -->
					<div class="absolute inset-0">
						{#if GalaxyCanvas}
							<svelte:component this={GalaxyCanvas} />
						{/if}
					</div>

					<!-- Overlay Panels for different views -->
					{#if $currentView === 'fleet'}
						<div
							class="absolute top-4 right-4 max-h-[calc(100%-2rem)] w-96 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/80 backdrop-blur-sm"
						>
							<FleetCommandView />
						</div>
					{:else if $currentView === 'planets'}
						<div
							class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm"
						>
							<PlanetOverviewView />
						</div>
					{:else if $currentView === 'research'}
						<div
							class="absolute top-4 right-4 max-h-[calc(100%-2rem)] w-96 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/80 backdrop-blur-sm"
						>
							<ResearchLabView />
						</div>
					{:else if $currentView === 'activity'}
						<div
							class="absolute top-4 right-4 max-h-[calc(100%-2rem)] w-96 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/80 backdrop-blur-sm"
						>
							<DiplomacyView />
						</div>
					{/if}
				</div>

				<!-- Bottom Navigation -->
				<div class="mt-4">
					<NavigationController items={navigationItems} />
				</div>
			</div>
		{:else if showLobby}
			<!-- Multiplayer Lobby -->
			<div class="flex h-[calc(100vh-200px)] flex-col">
				<div class="mb-4 flex items-center justify-between px-4">
					<Button
						label="← Back to Main"
						size="sm"
						variant="outline"
						onclick={handleBackToMain}
					/>
				</div>
				<div class="flex-1">
					<LobbyView />
				</div>
			</div>
		{:else}
			<!-- Welcome Screen -->
			<div class="flex h-[calc(100vh-200px)] items-center justify-center">
				<div class="mx-auto max-w-2xl p-8 text-center">
					<Text
						style="font-size: 48px; font-weight: bold; color: #00FFFF; margin-bottom: 24px; text-shadow: 0 0 20px rgba(0,255,255,0.5);"
					>
						ASTRIARCH
					</Text>
					<Text style="font-size: 20px; color: #94A3B8; margin-bottom: 32px; line-height: 1.6;">
						Command vast fleets across the galaxy in real-time. Manage planetary resources and
						populations. Research advanced technologies. Forge alliances or crush your enemies.
					</Text>
					<Text style="font-size: 16px; color: #64748B; margin-bottom: 48px;">
						The galaxy awaits your strategic genius in this real-time space conquest.
					</Text>
					<div class="flex justify-center space-x-4">
						<Button
							label="Begin Your Conquest"
							size="lg"
							variant="primary"
							onclick={gameActions.startNewGame}
						/>
						<Button
							label="Join Multiplayer"
							size="lg"
							variant="outline"
							onclick={handleShowLobby}
						/>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Notifications Panel -->
	{#if $notifications.length > 0}
		<div class="fixed right-4 bottom-4 z-20 max-w-sm space-y-2">
			{#each $notifications.slice(-5) as notification, i}
				<div class="rounded-lg border border-cyan-500/40 bg-black/80 p-3 backdrop-blur-sm">
					<Text style="color: #00FFFF; font-size: 12px;">
						{notification}
					</Text>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Debug: Test page link -->
	<div class="fixed bottom-4 left-4 z-20">
		<a href="/test" class="text-xs text-slate-500 transition-colors hover:text-cyan-400">
			Component Test Page
		</a>
	</div>
</main>
