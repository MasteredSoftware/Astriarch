<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import {
		clientGameModel,
		resourceData,
		population,
		gameTime,
		isGameRunning,
		gameActions
	} from '$lib/stores/gameStore';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';

	// Get the notifications store from the multiplayerGameStore
	const { notifications } = multiplayerGameStore;
	import { currentView, navigationActions } from '$lib/stores/navigationStore';

	import { TopOverview, NavigationController, Button, Text } from '$lib/components/astriarch';
	import { Logo } from '$lib/components/atoms';

	// Import game view components
	import FleetCommandView from '$lib/components/game-views/FleetCommandView.svelte';
	import PlanetOverviewView from '$lib/components/game-views/PlanetOverviewView.svelte';
	import ResearchLabView from '$lib/components/game-views/ResearchLabView.svelte';
	import DiplomacyView from '$lib/components/game-views/DiplomacyView.svelte';
	import PlanetInfoPanel from '$lib/components/game-views/PlanetInfoPanel.svelte';

	// Import lobby components
	import { LobbyView } from '$lib/components/lobby';

	// Dynamically import GalaxyCanvas to avoid SSR issues with Konva
	let GalaxyCanvas: any = null;

	// UI state
	let showLobby = false;

	// Computed values
	$: gameStarted = $clientGameModel !== null;

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
		console.log('Astriarch game component destroyed');
	});

	// Helper functions for notifications
	function getNotificationColor(type: string): string {
		switch (type) {
			case 'research':
				return '#3B82F6'; // Blue
			case 'construction':
				return '#10B981'; // Green
			case 'battle':
				return '#EF4444'; // Red
			case 'planet':
				return '#8B5CF6'; // Purple
			case 'fleet':
				return '#06B6D4'; // Cyan
			case 'warning':
				return '#F59E0B'; // Yellow
			case 'error':
				return '#EF4444'; // Red
			case 'success':
				return '#10B981'; // Green
			case 'diplomacy':
				return '#EC4899'; // Pink
			default:
				return '#00FFFF'; // Cyan
		}
	}

	function getNotificationTypeLabel(type: string): string {
		switch (type) {
			case 'research':
				return 'RESEARCH';
			case 'construction':
				return 'CONSTRUCTION';
			case 'battle':
				return 'BATTLE';
			case 'planet':
				return 'PLANET';
			case 'fleet':
				return 'FLEET';
			case 'warning':
				return 'WARNING';
			case 'error':
				return 'ERROR';
			case 'success':
				return 'SUCCESS';
			case 'diplomacy':
				return 'DIPLOMACY';
			default:
				return 'INFO';
		}
	}

	function formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);

		if (seconds < 60) return `${seconds}s`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h`;
	}
</script>

<svelte:head>
	<title>Astriarch - Space Strategy Game</title>
	<meta
		name="description"
		content="Command fleets, manage planets, and conquer the galaxy in this epic space strategy game."
	/>
</svelte:head>

<main class="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white">
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
	<header class="relative z-10 p-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<Logo size="lg" variant="primary" />

				<!-- Game time info - only show when game is started -->
				{#if gameStarted}
					<div class="flex flex-col items-center">
						<Text style="font-size: 14px; color: #94A3B8; margin-left: 16px;">
							Cycle {$gameTime.cycle} • {$gameTime.timeString}
						</Text>
						<Text style="font-size: 14px; color: #94A3B8; margin-left: 16px;">
							Stardate {$gameTime.stardate}
						</Text>
					</div>
					<!-- Resource Overview -->
					<div class="mb-6 flex justify-center">
						<TopOverview resourceData={$resourceData} population={$population} />
					</div>
				{/if}
			</div>

			<div class="flex items-center space-x-4">
				{#if gameStarted}
					<Text
						style="font-size: 12px; color: {$isGameRunning
							? '#10B981'
							: '#EF4444'}; margin-left: 8px;"
					>
						{$isGameRunning ? '● RUNNING' : '⏸ PAUSED'}
					</Text>
					<Button
						label={$isGameRunning ? 'Pause Game' : 'Resume Game'}
						size="md"
						variant={$isGameRunning ? 'outline' : 'primary'}
						onclick={$isGameRunning ? gameActions.pauseGame : gameActions.resumeGame}
					/>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Game Area -->
	<div class="relative z-10 flex-1">
		{#if gameStarted}
			<!-- Game View -->
			<div class="flex h-[calc(100vh-80px)] flex-col">
				<!-- Central Game Content Area with Galaxy Canvas as background -->
				<div class="relative mx-4 flex-1 overflow-hidden rounded-lg">
					<!-- Galaxy Canvas - Always visible as background (client-side only) -->
					<div class="absolute inset-0">
						{#if GalaxyCanvas}
							<svelte:component this={GalaxyCanvas} />
						{/if}
					</div>

					<!-- Info Panel - Top Left -->
					<div
						class="absolute top-4 left-4 z-20 max-h-80 w-64 overflow-y-auto rounded-lg border border-cyan-500/30 bg-black/80 backdrop-blur-sm"
					>
						<PlanetInfoPanel />
					</div>

					<!-- Overlay Panels for different views -->
					{#if $currentView === 'fleet'}
						<div
							class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm"
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
				<div class="mt-1">
					<NavigationController items={navigationItems} />
				</div>
			</div>
		{:else if showLobby}
			<!-- Multiplayer Lobby -->
			<div class="flex h-[calc(100vh-200px)] flex-col">
				<div class="flex items-center justify-between px-4">
					<Button label="← Back to Main" size="sm" variant="outline" onclick={handleBackToMain} />
				</div>
				<div class="flex-1">
					<LobbyView />
				</div>
			</div>
		{:else}
			<!-- Welcome Screen -->
			<div class="flex h-[calc(100vh-200px)] items-center justify-center">
				<div class="mx-auto max-w-2xl p-8 text-center">
					<div class="mb-6 flex justify-center">
						<Logo size="xl" variant="primary" />
					</div>
					<Text style="font-size: 20px; color: #94A3B8; margin-bottom: 32px; line-height: 1.6;">
						Command vast fleets across the galaxy in real-time. Manage planetary resources and
						populations. Research advanced technologies. Forge alliances or crush your enemies.
					</Text>
					<Text style="font-size: 16px; color: #64748B; margin-bottom: 48px;">
						The galaxy awaits your strategic genius in this real-time space conquest.
					</Text>
					<div class="flex justify-center">
						<Button
							label="Join Multiplayer Game"
							size="lg"
							variant="primary"
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
				<div
					class="cursor-pointer rounded-lg border border-cyan-500/40 bg-black/80 p-3 backdrop-blur-sm transition-opacity hover:opacity-80"
					on:click={() => multiplayerGameStore.dismissNotification(notification.id)}
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<Text
								style="color: {getNotificationColor(
									notification.type
								)}; font-size: 12px; font-weight: bold;"
							>
								{getNotificationTypeLabel(notification.type)}
							</Text>
							<Text style="color: #FFFFFF; font-size: 11px; margin-top: 2px;">
								{notification.message}
							</Text>
						</div>
						<Text style="color: #888888; font-size: 10px;">
							{formatTimestamp(notification.timestamp)}
						</Text>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>
