<script lang="ts">
	import { Text, Button } from '$lib/components/astriarch';
	import TabController from '$lib/components/astriarch/tab-controller/TabController.svelte';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import {
		activityLog,
		importantActivities,
		combatActivities,
		activityStore
	} from '$lib/stores/activityStore';
	import { selectedPlanetId, gameActions } from '$lib/stores/gameStore';
	import { onMount } from 'svelte';
	import type { ActivityLogEntry } from '$lib/stores/activityStore';
	import { Fleet, GameTools } from 'astriarch-engine';
	import type { StarshipData } from 'astriarch-engine';
	import { webSocketService } from '$lib/services/websocket';

	// State for tab selection and UI
	let currentTabIndex = $state(0); // Track the current tab index
	let chatMessage = $state('');
	let expandedActivity = $state<string | null>(null);
	let chatScrollContainer: HTMLDivElement;

	// Get chat messages from multiplayer store
	const { chatMessages } = multiplayerGameStore;

	// Define tabs for the TabController with click handlers to track state
	const tabs = [
		{
			label: 'All',
			onclick: () => {
				currentTabIndex = 0;
			}
		},
		{
			label: 'Important',
			onclick: () => {
				currentTabIndex = 1;
			}
		},
		{
			label: 'Combat',
			onclick: () => {
				currentTabIndex = 2;
			}
		}
	];

	// Filter activities based on current tab
	const filteredActivities = $derived(
		(() => {
			switch (currentTabIndex) {
				case 1:
					return $importantActivities;
				case 2:
					return $combatActivities;
				default:
					return $activityLog;
			}
		})()
	);

	function setTab(tabIndex: number) {
		currentTabIndex = tabIndex;
	}

	function toggleActivityExpansion(activityId: string) {
		expandedActivity = expandedActivity === activityId ? null : activityId;
	}

	function handleActivityClick(activity: ActivityLogEntry) {
		// If the activity has planet information, select that planet
		if (activity.planetId !== undefined) {
			gameActions.selectPlanet(activity.planetId ?? null);
		}

		// Toggle expansion to show details
		toggleActivityExpansion(activity.id);
	}

	function formatDetailedTimestamp(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleTimeString() + ' on ' + date.toLocaleDateString();
	}

	function hasAdditionalInfo(activity: ActivityLogEntry): boolean {
		return !!(activity.planetName || activity.conflictData || activity.originalEvent);
	}

	function sendChatMessage() {
		if (chatMessage.trim()) {
			// Send chat message via WebSocket
			webSocketService.sendChatMessage(chatMessage.trim());

			chatMessage = '';
		}
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			sendChatMessage();
		}
	}

	// Function to scroll chat to bottom
	function scrollChatToBottom() {
		if (chatScrollContainer) {
			chatScrollContainer.scrollTop = chatScrollContainer.scrollHeight;
		}
	}

	// Mark activities as read when they're viewed in this tab
	$effect(() => {
		if (filteredActivities.length > 0) {
			const unreadIds = filteredActivities.filter((a) => !a.read).map((a) => a.id);
			if (unreadIds.length > 0) {
				// Mark as read after a short delay to allow user to see them
				setTimeout(() => {
					activityStore.markAsRead(unreadIds);
				}, 1000);
			}
		}
	});

	// Auto-scroll chat to bottom when new messages arrive
	$effect(() => {
		if ($chatMessages.length > 0) {
			// Use setTimeout to ensure DOM has updated before scrolling
			setTimeout(() => {
				scrollChatToBottom();
			}, 0);
		}
	});

	// Add some sample activities when component mounts for testing
	onMount(() => {
		// Add some test activities if the log is empty
		if ($activityLog.length === 0) {
			activityStore.addNotificationWithEventData(
				{
					type: 'research',
					message: 'Research completed: Advanced Propulsion Systems',
					timestamp: Date.now() - 300000 // 5 minutes ago
				},
				{
					playerId: 'player1',
					type: 8, // ResearchComplete
					message: 'Research completed: Advanced Propulsion Systems',
					planet: undefined,
					data: undefined
				}
			);

			activityStore.addNotificationWithEventData(
				{
					type: 'construction',
					message: 'Construction finished on planet Kepler-442b: Orbital Shipyard',
					timestamp: Date.now() - 180000 // 3 minutes ago
				},
				{
					playerId: 'player1',
					type: 4, // ImprovementBuilt
					message: 'Construction finished on planet Kepler-442b: Orbital Shipyard',
					planet: { id: 42, name: 'Kepler-442b' } as any,
					data: undefined
				}
			);

			activityStore.addNotificationWithEventData(
				{
					type: 'battle',
					message: 'Planetary conflict at Sector 7-G: Defending fleet victorious!',
					timestamp: Date.now() - 120000 // 2 minutes ago
				},
				{
					playerId: 'player1',
					type: 13, // DefendedAgainstAttackingFleet
					message: 'Planetary conflict at Sector 7-G: Defending fleet victorious!',
					planet: { id: 7, name: 'Sector 7-G' } as any,
					data: {
						attackingFleetChances: 0.35,
						attackingClientPlayer: { name: 'Enemy Player' } as any,
						defendingClientPlayer: { name: 'You' } as any,
						attackingFleet: {
							starships: [
								{ id: 1, type: 3, health: 100, experienceAmount: 0 }, // Destroyer
								{ id: 2, type: 3, health: 100, experienceAmount: 0 }, // Destroyer
								{ id: 3, type: 2, health: 100, experienceAmount: 0 }, // Scout
								{ id: 4, type: 2, health: 100, experienceAmount: 0 } // Scout
							]
						},
						defendingFleet: {
							starships: [
								{ id: 5, type: 4, health: 100, experienceAmount: 0 }, // Cruiser
								{ id: 6, type: 3, health: 100, experienceAmount: 0 }, // Destroyer
								{ id: 7, type: 1, health: 100, experienceAmount: 0 } // System Defense
							]
						},
						attackingFleetResearchBoost: { attack: 0.1, defense: 0.05 },
						defendingFleetResearchBoost: { attack: 0.05, defense: 0.15 },
						winningFleet: {
							starships: [
								{ id: 5, type: 4, health: 65, experienceAmount: 0 }, // Damaged Cruiser
								{ id: 7, type: 1, health: 30, experienceAmount: 0 } // Heavily damaged System Defense
							]
						},
						resourcesLooted: { food: 0, gold: 0, ore: 0, iridium: 0, research: 0 }
					} as any
				}
			);

			activityStore.addNotificationWithEventData(
				{
					type: 'planet',
					message: 'Planet productivity increased: New mining operations online',
					timestamp: Date.now() - 60000 // 1 minute ago
				},
				{
					playerId: 'player1',
					type: 1, // PopulationGrowth
					message: 'Planet productivity increased: New mining operations online',
					planet: { id: 15, name: 'Mining Station Alpha' } as any,
					data: undefined
				}
			);

			activityStore.addNotificationWithEventData(
				{
					type: 'fleet',
					message: 'Fleet has arrived at destination: Alpha Centauri system',
					timestamp: Date.now() - 30000 // 30 seconds ago
				},
				{
					playerId: 'player1',
					type: 0, // General info
					message: 'Fleet has arrived at destination: Alpha Centauri system',
					planet: { id: 23, name: 'Alpha Centauri Prime' } as any,
					data: undefined
				}
			);

			// Add a planet capture battle example with resource looting
			activityStore.addNotificationWithEventData(
				{
					type: 'battle',
					message: 'Planet captured at Kepler-442b! Victory achieved with heavy losses.',
					timestamp: Date.now() - 300000 // 5 minutes ago
				},
				{
					playerId: 'player1',
					type: 15, // PlanetCaptured
					message: 'Planet captured at Kepler-442b! Victory achieved with heavy losses.',
					planet: { id: 42, name: 'Kepler-442b' } as any,
					data: {
						attackingFleetChances: 0.75,
						attackingClientPlayer: { name: 'You' } as any,
						defendingClientPlayer: { name: 'AI Opponent' } as any,
						attackingFleet: {
							starships: [
								{ id: 10, type: 5, health: 100, experienceAmount: 0 }, // Battleship
								{ id: 11, type: 4, health: 100, experienceAmount: 0 }, // Cruiser
								{ id: 12, type: 4, health: 100, experienceAmount: 0 }, // Cruiser
								{ id: 13, type: 3, health: 100, experienceAmount: 0 }, // Destroyer
								{ id: 14, type: 3, health: 100, experienceAmount: 0 } // Destroyer
							]
						},
						defendingFleet: {
							starships: [
								{ id: 20, type: 6, health: 100, experienceAmount: 0 }, // Space Platform
								{ id: 21, type: 1, health: 100, experienceAmount: 0 }, // System Defense
								{ id: 22, type: 1, health: 100, experienceAmount: 0 }, // System Defense
								{ id: 23, type: 2, health: 100, experienceAmount: 0 } // Scout
							]
						},
						attackingFleetResearchBoost: { attack: 0.15, defense: 0.1 },
						defendingFleetResearchBoost: { attack: 0.0, defense: 0.2 },
						winningFleet: {
							starships: [
								{ id: 10, type: 5, health: 45, experienceAmount: 0 }, // Heavily damaged Battleship
								{ id: 11, type: 4, health: 20, experienceAmount: 0 } // Critically damaged Cruiser
							]
						},
						resourcesLooted: {
							food: 150.5,
							gold: 87.25,
							ore: 45.0,
							iridium: 12.5,
							research: 23.75
						}
					} as any
				}
			);
		}
	});

	function formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const minutes = Math.floor(diff / (1000 * 60));
		if (minutes < 1) return 'now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function getNotificationIcon(type: string): string {
		switch (type) {
			case 'error':
			case 'warning':
				return '⚠';
			case 'battle':
				return '⚔';
			case 'research':
				return '🔬';
			case 'construction':
				return '🏗';
			case 'planet':
				return '🌍';
			case 'fleet':
				return '🚀';
			case 'diplomacy':
				return '🤝';
			default:
				return '●';
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

	function isBattleNotification(activity: ActivityLogEntry): boolean {
		return !!(
			activity.originalEvent &&
			activity.originalEvent.data &&
			(activity.originalEvent.type === 13 || // DefendedAgainstAttackingFleet
				activity.originalEvent.type === 14 || // AttackingFleetLost
				activity.originalEvent.type === 15 || // PlanetCaptured
				activity.originalEvent.type === 19)
		); // PlanetLost
	}

	function formatFleetStrength(fleet: any): number {
		if (!fleet) return 0;
		return Fleet.determineFleetStrength(fleet);
	}

	function getShipTypeName(ship: StarshipData): string {
		const isCustom = Boolean(ship.customShipData);
		return GameTools.starShipTypeToFriendlyName(ship.type, isCustom);
	}

	function formatFleetComposition(fleet: any): string {
		if (!fleet || !fleet.starships || fleet.starships.length === 0) {
			return 'No ships';
		}

		const shipCounts: { [key: string]: number } = {};
		fleet.starships.forEach((ship: any) => {
			const typeName = getShipTypeName(ship);
			shipCounts[typeName] = (shipCounts[typeName] || 0) + 1;
		});

		return Object.entries(shipCounts)
			.map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
			.join(', ');
	}

	function formatResearchBonus(boost: any): string {
		if (!boost) return '';
		const parts = [];
		if (boost.attack > 0) parts.push(`+${(boost.attack * 100).toFixed(0)}% Attack`);
		if (boost.defense > 0) parts.push(`+${(boost.defense * 100).toFixed(0)}% Defense`);
		return parts.length > 0 ? `, ${parts.join(', ')}` : '';
	}

	function formatResourcesLooted(resources: any): string {
		if (!resources) return 'No resources looted';

		const amounts = [];
		if (resources.food > 0) amounts.push(`${resources.food.toFixed(2)} Food`);
		if (resources.gold > 0) amounts.push(`${resources.gold.toFixed(2)} Gold`);
		if (resources.ore > 0) amounts.push(`${resources.ore.toFixed(2)} Ore`);
		if (resources.iridium > 0) amounts.push(`${resources.iridium.toFixed(2)} Iridium`);
		if (resources.research > 0) amounts.push(`${resources.research.toFixed(2)} Research`);

		return amounts.length > 0 ? `Resources looted: ${amounts.join(', ')}` : 'No resources looted';
	}
</script>

<div class="relative h-full w-full bg-gradient-to-b from-slate-900/50 to-black/90 backdrop-blur-sm">
	<!-- Background blur overlay -->
	<div class="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-800/0 opacity-20"></div>

	<!-- Main content container -->
	<div class="relative z-10 flex h-full">
		<!-- Left Panel - Activity Feed -->
		<div class="flex flex-1 flex-col">
			<!-- Header -->
			<div class="p-8 pb-4">
				<h1
					class="font-['Orbitron'] text-[32px] leading-[40px] font-bold tracking-[0.64px] text-white"
				>
					Activity Center
				</h1>
			</div>

			<!-- Tab Controller -->
			<div class="mb-4 px-8">
				<TabController {tabs} size="md">
					<!-- Activity Feed Content -->
					<div class="flex-1 overflow-y-auto">
						<div class="max-h-[268px] space-y-2 overflow-y-auto pr-2">
							{#each filteredActivities as activity (activity.id)}
								<div
									class="w-full max-w-[950px] rounded-[4px] bg-[rgba(27,31,37,0.5)] p-4 {hasAdditionalInfo(
										activity
									)
										? 'cursor-pointer hover:bg-[rgba(27,31,37,0.7)]'
										: ''} transition-colors"
								>
									<!-- Main activity content -->
									<div
										onclick={() => handleActivityClick(activity)}
										role="button"
										tabindex="0"
										onkeypress={(e) => e.key === 'Enter' && handleActivityClick(activity)}
									>
										<!-- Header -->
										<div class="mb-1 flex items-center gap-2 text-[12px]">
											<div class="h-2.5 w-2.5 text-cyan-400">
												{getNotificationIcon(activity.type)}
											</div>
											<span class="font-['Orbitron'] font-semibold tracking-[0.5px] text-white/75">
												{getNotificationTypeLabel(activity.type)}
											</span>
											{#if activity.planetName}
												<span class="font-['Orbitron'] font-normal tracking-[0.5px] text-cyan-400">
													• {activity.planetName}
												</span>
											{/if}
											<span
												class="font-['Orbitron'] font-normal tracking-[3px] text-white/50 uppercase"
											>
												|
											</span>
											<span class="font-['Orbitron'] font-normal tracking-[0.5px] text-white/75">
												{formatTimestamp(activity.timestamp)}
											</span>
											{#if hasAdditionalInfo(activity)}
												<span class="ml-auto text-xs text-cyan-400">
													{expandedActivity === activity.id ? '▼' : '▶'}
												</span>
											{/if}
										</div>
										<!-- Content -->
										<div
											class="font-['Orbitron'] text-[14px] leading-[28px] font-normal tracking-[0.14px] text-white"
										>
											{activity.message}
										</div>
									</div>

									<!-- Expanded details -->
									{#if expandedActivity === activity.id && hasAdditionalInfo(activity)}
										<div class="mt-3 space-y-2 border-t border-cyan-500/20 pt-3">
											<!-- Detailed timestamp -->
											<div class="font-['Orbitron'] text-[12px] text-white/60">
												<strong>Time:</strong>
												{formatDetailedTimestamp(activity.timestamp)}
											</div>

											<!-- Planet details -->
											{#if activity.planetName && activity.planetId !== undefined}
												<div class="font-['Orbitron'] text-[12px] text-cyan-400">
													<strong>Planet:</strong>
													{activity.planetName} (ID: {activity.planetId})
													<button
														class="ml-2 rounded bg-cyan-600/20 px-2 py-1 text-xs hover:bg-cyan-600/30"
														onclick={(e) => {
															e.stopPropagation();
															if (activity.planetId !== undefined) {
																gameActions.selectPlanet(activity.planetId ?? null);
															}
														}}
													>
														View Planet
													</button>
												</div>
											{/if}

											<!-- Detailed battle information for combat notifications -->
											{#if activity.originalEvent && activity.originalEvent.data && isBattleNotification(activity)}
												{@const conflictData = activity.originalEvent.data}
												<div
													class="space-y-3 rounded border border-red-500/30 bg-red-900/20 p-3 font-['Orbitron'] text-[12px] text-white/90"
												>
													<div class="text-[14px] font-bold text-red-400">BATTLE REPORT</div>

													<!-- Resources looted (if applicable) -->
													{#if conflictData.resourcesLooted}
														<div class="text-yellow-400">
															{formatResourcesLooted(conflictData.resourcesLooted)}
														</div>
													{/if}

													<!-- Attacking Fleet -->
													{#if conflictData.attackingFleet}
														<div class="border-l-2 border-red-500 pl-3">
															<div class="font-semibold text-red-300">
																Attacking Fleet (Strength: {formatFleetStrength(
																	conflictData.attackingFleet
																)})
																{#if conflictData.attackingFleetChances}
																	- Win Chance: {Math.round(
																		conflictData.attackingFleetChances * 100
																	)}%
																{/if}
																{formatResearchBonus(conflictData.attackingFleetResearchBoost)}
															</div>
															<div class="mt-1 text-white/70">
																{formatFleetComposition(conflictData.attackingFleet)}
															</div>
														</div>
													{/if}

													<!-- Defending Fleet -->
													{#if conflictData.defendingFleet}
														<div class="border-l-2 border-blue-500 pl-3">
															<div class="font-semibold text-blue-300">
																Defending Fleet (Strength: {formatFleetStrength(
																	conflictData.defendingFleet
																)})
																{formatResearchBonus(conflictData.defendingFleetResearchBoost)}
															</div>
															<div class="mt-1 text-white/70">
																{formatFleetComposition(conflictData.defendingFleet)}
															</div>
														</div>
													{/if}

													<!-- Surviving Fleet -->
													{#if conflictData.winningFleet}
														<div class="border-l-2 border-green-500 pl-3">
															<div class="font-semibold text-green-300">Ships Remaining</div>
															<div class="mt-1 text-white/70">
																{formatFleetComposition(conflictData.winningFleet)}
															</div>
														</div>
													{:else}
														<div class="font-semibold text-red-400">All ships destroyed</div>
													{/if}
												</div>
											{:else if activity.conflictData}
												<!-- Fallback for legacy conflict data -->
												<div class="space-y-1 font-['Orbitron'] text-[12px] text-white/80">
													<div><strong>Battle Details:</strong></div>
													{#if activity.conflictData.attackingFleetChances}
														<div>
															• Attack success chance: {Math.round(
																activity.conflictData.attackingFleetChances * 100
															)}%
														</div>
													{/if}
													{#if activity.conflictData.winningFleet}
														<div>
															• Outcome: {activity.conflictData.winningFleet
																? 'Fleet survived'
																: 'Fleet destroyed'}
														</div>
													{/if}
												</div>
											{/if}

											<!-- Event type details -->
											{#if activity.originalEvent}
												<div class="font-['Orbitron'] text-[12px] text-white/60">
													<strong>Event Type:</strong>
													{activity.originalEvent.type}
													{#if activity.originalEvent.playerId}
														<br /><strong>Player:</strong> {activity.originalEvent.playerId}
													{/if}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							{:else}
								<div class="bg-[rgba(27,31,37,0.5)] rounded-[4px] p-4 w-full max-w-[950px]">
									<div
										class="font-['Orbitron'] font-normal text-[14px] text-white/50 tracking-[0.14px] leading-[28px] text-center"
									>
										No {tabs[currentTabIndex]?.label.toLowerCase() || ''} activities yet
									</div>
								</div>
							{/each}
						</div>
					</div>
				</TabController>
			</div>
		</div>

		<!-- Right Panel - Chat -->
		<div class="relative h-full w-[554px]">
			<!-- Chat background -->
			<div
				class="absolute inset-0 bg-gradient-to-b from-white/10 to-slate-800/0 opacity-50 backdrop-blur-[6px]"
			></div>

			<!-- Chat content -->
			<div class="relative z-10 flex h-full flex-col p-[18px]">
				<!-- Chat messages -->
				<div bind:this={chatScrollContainer} class="mb-4 flex-1 space-y-4 overflow-y-auto">
					{#each $chatMessages as message (message.id)}
						<div
							class="max-w-[331px] rounded-[4px] bg-[rgba(27,31,37,0.5)] p-4 {message.playerName ===
							$multiplayerGameStore.playerName
								? 'ml-auto bg-slate-700/50'
								: ''}"
						>
							<!-- Message header -->
							<div class="mb-1 flex items-center gap-2 text-[12px]">
								<span class="font-['Orbitron'] font-semibold tracking-[0.5px] text-white/75">
									{message.playerName}
								</span>
								<span class="font-['Orbitron'] font-normal tracking-[3px] text-white/50 uppercase">
									|
								</span>
								<span class="font-['Orbitron'] font-normal tracking-[0.5px] text-white/75">
									{formatTimestamp(message.timestamp)}
								</span>
							</div>
							<!-- Message content -->
							<div
								class="font-['Orbitron'] text-[14px] leading-[28px] font-normal tracking-[0.14px] text-white"
							>
								{message.message}
							</div>
						</div>
					{/each}
				</div>

				<!-- Chat input -->
				<div class="flex gap-2">
					<div class="relative flex-1">
						<input
							bind:value={chatMessage}
							onkeypress={handleKeyPress}
							placeholder="Type something here..."
							class="h-12 w-full rounded-[4px] border border-slate-600/30 bg-black/40 px-2 py-3 font-['Orbitron'] text-[14px] font-normal tracking-[0.14px] text-white placeholder-white/50 focus:border-cyan-400/40 focus:outline-none"
						/>
						<div class="absolute top-3 right-2 font-['Orbitron'] text-white">|</div>
					</div>
					<Button onclick={sendChatMessage}>send</Button>
				</div>

				<!-- Chat scrollbar indicator -->
				<div
					class="absolute top-8 right-2 h-[285px] w-1 rounded-full bg-gradient-to-b from-cyan-500/40 to-cyan-300/20"
				></div>
			</div>
		</div>
	</div>
</div>
