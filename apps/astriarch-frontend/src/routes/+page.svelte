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
	import type { MultiplayerGameState } from '$lib/stores/multiplayerGameStore';

	// Get the notifications store from the multiplayerGameStore
	const { notifications } = multiplayerGameStore;

	// Create a reactive value for the multiplayer game state
	let multiplayerState = $state<MultiplayerGameState | undefined>();

	import { currentView, navigationActions } from '$lib/stores/navigationStore';
	import { audioActions, currentAudioPhase } from '$lib/stores/audioStore';

	import {
		TopOverview,
		NavigationController,
		Button,
		Text,
		Notification
	} from '$lib/components/astriarch';
	import NotificationItem from '$lib/components/astriarch/notification/NotificationItem.svelte';
	import TaskNotificationPanel from '$lib/components/astriarch/notification/TaskNotificationPanel.svelte';
	import { Logo } from '$lib/components/atoms';

	// Import game view components
	import FleetCommandView from '$lib/components/game-views/FleetCommandView.svelte';
	import PlanetOverviewView from '$lib/components/game-views/PlanetOverviewView.svelte';
	import ResearchLabView from '$lib/components/game-views/ResearchLabView.svelte';
	import TradingCenterView from '$lib/components/game-views/TradingCenterView.svelte';
	import ActivityView from '$lib/components/game-views/ActivityView.svelte';
	import PlanetInfoPanel from '$lib/components/game-views/PlanetInfoPanel.svelte';
	import GameOverModal from '$lib/components/game/GameOverModal.svelte';
	import GamePausedModal from '$lib/components/game/GamePausedModal.svelte';
	import PlayerEliminatedModal from '$lib/components/modals/PlayerEliminatedModal.svelte';
	import ExitGameDialog from '$lib/components/game/ExitGameDialog.svelte';

	// Import lobby components
	import { LobbyView } from '$lib/components/lobby';

	// Import websocket service
	import { webSocketService } from '$lib/services/websocket';

	// Dynamically import GalaxyCanvas to avoid SSR issues with Konva
	let GalaxyCanvas: any = $state(null);

	// UI state
	let showExitDialog = $state(false);

	// Computed values
	const gameStarted = $derived($clientGameModel !== null);

	$effect(() => {
		if (browser && !GalaxyCanvas) {
			import('$lib/components/galaxy/GalaxyCanvas.svelte').then((module) => {
				GalaxyCanvas = module.default;
			});
		}
	});

	let navigationItems = [
		{ label: 'Planets', onclick: () => navigationActions.setView('planets') },
		{ label: 'Fleets', onclick: () => navigationActions.setView('fleet') },
		{ label: 'Research', onclick: () => navigationActions.setView('research') },
		{ label: 'Trading', onclick: () => navigationActions.setView('trading') },
		{ label: 'Activity', onclick: () => navigationActions.setView('activity') }
	];

	function handleShowLobby() {
		// Enable audio on first user interaction
		audioActions.enableAudio();
		multiplayerGameStore.setCurrentView('lobby');
	}

	function handleBackToMain() {
		multiplayerGameStore.setCurrentView('lobby');
	}

	function handleExitGame() {
		// Show the exit dialog
		showExitDialog = true;
	}

	function cleanupGameAndReturnToLobby() {
		// Reset game state
		// clientGameModel.set(null);
		// gameActions.pauseGame();

		// // Reset multiplayer store to lobby view
		// multiplayerGameStore.setCurrentView('lobby');
		// multiplayerGameStore.setGameJoined(false);
		// multiplayerGameStore.setGameId(null);
		// multiplayerGameStore.setPlayerPosition(null);

		// NOTE: the above does not fully reset everything correctly and disconnect the user from the game
		// For now just refresh the page to reset everything
		window.location.reload();
	}

	function handleExitToMainMenu() {
		// Return to lobby without resigning
		showExitDialog = false;
		cleanupGameAndReturnToLobby();
	}

	function handleResignCommand() {
		// Send resign message to server - server will respond with GAME_OVER message
		// which will trigger the game over modal
		showExitDialog = false;
		webSocketService.exitResignGame();
	}

	function handleCancelExit() {
		// Just close the dialog
		showExitDialog = false;
	}

	// Game over modal handlers
	function handleGameOverClose() {
		// Clean up game state and return to lobby
		cleanupGameAndReturnToLobby();
	}

	onMount(() => {
		console.log('Astriarch game component mounted');

		// Debug: Add a test notification to see if the system works
		multiplayerGameStore.addNotification({
			type: 'info',
			message: 'Welcome to Astriarch! Event system is active.',
			timestamp: Date.now()
		});

		// Debug: Log notifications store changes
		const unsubscribe = notifications.subscribe((notifs) => {
			console.log('Notifications updated:', notifs);
		});

		return () => unsubscribe();
	});

	// Keep multiplayerState reactive by subscribing to the store
	$effect(() => {
		const unsubscribe = multiplayerGameStore.subscribe((state) => {
			multiplayerState = state;
		});

		return () => unsubscribe();
	});

	// Audio state management based on game phases
	$effect(() => {
		try {
			if (browser && multiplayerState) {
				console.log(
					'Audio effect - multiplayerState.currentView:',
					multiplayerState.currentView,
					'currentAudioPhase:',
					$currentAudioPhase
				);
				// Handle audio phase transitions based on game state
				if (multiplayerState.currentView === 'lobby') {
					// We're in the lobby/menu phase
					// Always call startMenu() when in lobby to ensure music plays after user interaction
					console.log('Starting menu music...');
					audioActions.startMenu();
				} else if (multiplayerState.currentView === 'game' && gameStarted) {
					// We're in the active game phase
					if ($currentAudioPhase !== 'InGame') {
						console.log('Starting game music...');
						audioActions.beginGame();
					}
				}
			}
		} catch (error) {
			console.warn('Audio state management error:', error);
		}
	});

	// Monitor game end state for audio transitions
	$effect(() => {
		try {
			// Check if game is over (no gameStarted but we were previously in game)
			if (browser && !gameStarted && $currentAudioPhase === 'InGame') {
				// Game has ended, transition to game over music
				audioActions.endGame();
			}
		} catch (error) {
			console.warn('Game end audio transition error:', error);
		}
	});

	// Turn-based audio effects
	let previousCycle = $state(-1);
	$effect(() => {
		try {
			if (browser && $clientGameModel && gameStarted) {
				const currentCycle = Math.trunc($clientGameModel.currentCycle);

				// Play turn start sound when cycle advances
				if (previousCycle !== -1 && currentCycle > previousCycle) {
					audioActions.playTurnStart();
					console.log('New turn started, playing turn start sound');
				}

				// Update previous cycle for next comparison
				previousCycle = currentCycle;
			}
		} catch (error) {
			console.warn('Turn-based audio effects error:', error);
		}
	});

	// Chat notification system - notify user of new messages when not on activity tab
	const { chatMessages } = multiplayerGameStore;
	let isLoadingInitialChatHistory = $state(true); // Track when we're loading initial chat history
	let previousChatCount = $state(0); // Track previous chat message count for detecting new messages

	$effect(() => {
		const messageCount = $chatMessages.length;

		// Skip notifications during initial load or if no messages
		if (isLoadingInitialChatHistory || messageCount === 0) {
			previousChatCount = messageCount;
			return;
		}

		// Check if there are new messages (more than before)
		if (messageCount > previousChatCount) {
			const newMessageCount = messageCount - previousChatCount;

			// Only notify if user is not currently on the activity tab
			if ($currentView !== 'activity') {
				// Get the latest message(s) for the notification
				const latestMessage = $chatMessages[$chatMessages.length - 1];
				const notificationMessage =
					newMessageCount === 1
						? `${latestMessage.playerName}: ${
								latestMessage.message.length > 30
									? latestMessage.message.substring(0, 30) + '...'
									: latestMessage.message
							}`
						: `${newMessageCount} new chat messages`;

				multiplayerGameStore.addNotification({
					type: 'chat',
					message: notificationMessage,
					timestamp: Date.now(),
					duration: 4000 // Show for 4 seconds
				});
			}
		}

		previousChatCount = messageCount;
	});

	// Reset chat history loading flag after a brief delay (to allow initial messages to load)
	$effect(() => {
		if ($chatMessages.length > 0 && isLoadingInitialChatHistory) {
			// Wait a bit to ensure initial chat history has fully loaded
			setTimeout(() => {
				isLoadingInitialChatHistory = false;
			}, 1000);
		}
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
			case 'chat':
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
			case 'chat':
				return 'CHAT';
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

<main class="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white">
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
	<header class="relative z-100 p-2">
		<div class="flex items-center justify-between">
			<div class="flex items-center space-x-4">
				<Logo size="lg" variant="primary" />

				<!-- Game time info - only show when game is started -->
				{#if gameStarted}
					<div class="flex flex-col items-center">
						<Text style="font-size: 14px; color: #94A3B8; margin-left: 16px;">
							Stardate {$gameTime.stardate}
						</Text>
					</div>
					<!-- Resource Overview -->
					<div class="flex justify-center">
						<TopOverview
							resourceData={$resourceData}
							population={$population}
							onExitGame={handleExitGame}
						/>
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
				{:else}
					<!-- Debug: Test notification button -->
					<Button
						label="Add Activity"
						size="sm"
						variant="outline"
						onclick={() => {
							const notificationTypes = [
								'info',
								'success',
								'warning',
								'error',
								'battle',
								'research',
								'construction',
								'fleet',
								'planet',
								'chat'
							] as const;
							const randomType =
								notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
							const randomMessage = [
								'Fleet has arrived at destination',
								'Research completed successfully',
								'Planet under attack!',
								'Construction finished',
								'Diplomatic message received',
								'Resources depleted warning',
								'New trade route established'
							][Math.floor(Math.random() * 7)];

							// Random duration between 3-8 seconds
							const randomDuration = Math.floor(Math.random() * 5000) + 3000;

							// This will show as both a popup notification AND be added to the Activity Center
							multiplayerGameStore.addNotification({
								type: randomType,
								message: `${randomMessage} ${Math.floor(Math.random() * 1000)}`,
								timestamp: Date.now(),
								duration: randomDuration
							});
						}}
					/>

					<!-- Debug: Test persistent notification button -->
					<Button
						label="Persistent Alert"
						size="sm"
						variant="outline"
						onclick={() =>
							multiplayerGameStore.addNotification({
								type: 'error',
								message: `Critical alert ${Math.floor(Math.random() * 1000)} - Click to dismiss`,
								timestamp: Date.now()
							})}
					/>
				{/if}
			</div>
		</div>
	</header>

	<!-- Main Game Area -->
	<div class="relative z-10 flex-1">
		{#if multiplayerState?.currentView === 'lobby' || multiplayerState?.currentView === 'game_options'}
			<!-- Multiplayer Lobby -->
			<div class="flex h-[calc(100vh-200px)] flex-col">
				<div class="flex items-center justify-between px-4">
					<Button label="← Back to Main" size="sm" variant="outline" onclick={handleBackToMain} />
				</div>
				<div class="flex-1">
					<LobbyView />
				</div>
			</div>
		{:else if gameStarted}
			<!-- Game View -->
			<div class="flex h-[calc(100vh-80px)] flex-col">
				<!-- Central Game Content Area with Galaxy Canvas as background -->
				<div class="relative mx-4 flex-1 overflow-hidden rounded-lg">
					<!-- Galaxy Canvas - Always visible as background (client-side only) -->
					<div class="absolute inset-0">
						{#if GalaxyCanvas}
							<GalaxyCanvas />
						{/if}
					</div>

					<!-- Info Panel - Top Left -->
					<div
						class="absolute top-4 left-4 z-20 max-h-80 max-w-48 overflow-y-auto rounded-lg border border-cyan-500/30 bg-black/80 backdrop-blur-sm"
					>
						<PlanetInfoPanel />
					</div>

					<!-- Task Notifications Panel - Top Right -->
					<div class="absolute top-4 right-4 z-20">
						<TaskNotificationPanel />
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
							class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm"
						>
							<ResearchLabView />
						</div>
					{:else if $currentView === 'trading'}
						<div
							class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm"
						>
							<TradingCenterView />
						</div>
					{:else if $currentView === 'activity'}
						<div
							class="absolute right-4 bottom-4 left-4 h-1/2 overflow-hidden rounded-lg border border-cyan-500/40 bg-black/90 backdrop-blur-sm"
						>
							<ActivityView />
						</div>
					{/if}
				</div>

				<!-- Bottom Navigation -->
				<div class="mt-1">
					<NavigationController items={navigationItems} />
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
						Real-time multiplayer space strategy game.
					</Text>
					<br />
					<Text style="font-size: 16px; color: #64748B; margin-bottom: 48px;">
						Manage planetary resources, research advanced technologies, crush your enemies with vast
						fleets, and rule the stars.
					</Text>
					<div class="mt-4 flex justify-center">
						<Button label="Play Now" size="lg" variant="primary" onclick={handleShowLobby} />
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Game Over Modal -->
	{#if multiplayerState && multiplayerState.gameOver && multiplayerState.gameOver.gameEnded}
		<GameOverModal gameOverState={multiplayerState.gameOver} onClose={handleGameOverClose} />
	{/if}

	<!-- Game Paused Modal -->
	{#if multiplayerState && multiplayerState.gamePaused}
		<GamePausedModal pauseReason={multiplayerState.pauseReason} />
	{/if}

	<!-- Player Resigned Modal -->
	{#if multiplayerState && multiplayerState.playerEliminatedModal && multiplayerState.playerEliminatedModal.show}
		<PlayerEliminatedModal modalState={multiplayerState.playerEliminatedModal} />
	{/if}

	<!-- Exit Game Dialog -->
	{#if showExitDialog}
		<ExitGameDialog
			onExitToMainMenu={handleExitToMainMenu}
			onResignCommand={handleResignCommand}
			onCancel={handleCancelExit}
		/>
	{/if}

	<!-- Notifications Panel -->
	{#if $notifications.length > 0}
		<div class="fixed right-4 bottom-4 z-20 max-w-sm space-y-2">
			{#each $notifications.slice(-5) as notification, i (notification.id)}
				<NotificationItem
					{notification}
					onDismiss={() => multiplayerGameStore.dismissNotification(notification.id)}
				/>
			{/each}
		</div>
	{:else}
		<!-- Debug: Show when no notifications -->
		<div class="fixed right-4 bottom-4 z-20 text-xs text-gray-400">
			No notifications ({$notifications.length})
		</div>
	{/if}
</main>
