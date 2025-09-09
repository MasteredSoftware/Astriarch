<script lang="ts">
	import { Text, Button, IconImage, Dropdown } from '$lib/components/astriarch';
	import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';
	import { webSocketService } from '$lib/services/websocket';
	import { ResearchType } from 'astriarch-engine/src/model/research';
	import { StarShipType } from 'astriarch-engine/src/model/fleet';
	import { Research } from 'astriarch-engine/src/engine/research';
	import { Planet } from 'astriarch-engine/src/engine/planet';
	import type { IconImageType } from '$lib/components/astriarch/types';

	// No need to import SVG icons individually anymore

	// Get game data from the main game store (for clientGameModel)
	// and connection state from multiplayer store (for lobby/connection info)
	import { clientGameModel } from '$lib/stores/gameStore';

	const gameState = $derived($multiplayerGameStore);
	const clientModel = $derived($clientGameModel); // Use clientGameModel from gameStore instead
	const currentPlayer = $derived(gameState.currentPlayer);

	// Find the current player's data directly from clientModel (which contains the player data)
	const player = $derived(clientModel?.mainPlayer); // Use mainPlayer directly from clientModel
	const researchPercent = $derived(player?.research?.researchPercent || 0);
	const energyPercent = $derived(1 - researchPercent);
	const researchProgress = $derived(player?.research?.researchProgressByType || {});
	const currentResearchType = $derived(player?.research?.researchTypeInQueue);

	// Calculate total credits generated per turn from planets for research estimation
	const totalCreditsFromPlanets = $derived(
		clientModel?.mainPlayerOwnedPlanets && player
			? Object.values(clientModel.mainPlayerOwnedPlanets).reduce((total, planet) => {
					return total + Planet.getTaxRevenueAtMaxPercent(planet, player);
				}, 0)
			: 0
	);

	// Estimate cycles remaining for current research
	const cyclesRemaining = $derived(
		player?.research && currentResearchType
			? Research.estimateTurnsRemainingInQueue(player.research, totalCreditsFromPlanets)
			: 999
	);

	// Get research level data for progress bar
	const currentResearchLevelData = $derived(
		currentResearchType && researchProgress[currentResearchType]
			? Research.getResearchLevelData(researchProgress[currentResearchType])
			: null
	);

	// Research categories for display
	const shipTypes = [
		{
			type: StarShipType.SystemDefense,
			name: 'Defender',
			researchType: ResearchType.NEW_SHIP_TYPE_DEFENDER,
			icon: 'defender' as IconImageType
		},
		{
			type: StarShipType.Scout,
			name: 'Scout',
			researchType: ResearchType.NEW_SHIP_TYPE_SCOUT,
			icon: 'scout' as IconImageType
		},
		{
			type: StarShipType.Destroyer,
			name: 'Destroyer',
			researchType: ResearchType.NEW_SHIP_TYPE_DESTROYER,
			icon: 'destroyer' as IconImageType
		},
		{
			type: StarShipType.Cruiser,
			name: 'Cruiser',
			researchType: ResearchType.NEW_SHIP_TYPE_CRUISER,
			icon: 'cruiser' as IconImageType
		},
		{
			type: StarShipType.Battleship,
			name: 'Battleship',
			researchType: ResearchType.NEW_SHIP_TYPE_BATTLESHIP,
			icon: 'battleship' as IconImageType
		}
	];

	const improvements = [
		{
			name: 'Attack',
			researchType: ResearchType.COMBAT_IMPROVEMENT_ATTACK,
			icon: 'ship_attack' as IconImageType
		},
		{
			name: 'Defense',
			researchType: ResearchType.COMBAT_IMPROVEMENT_DEFENSE,
			icon: 'ship_defense' as IconImageType
		},
		{
			name: 'Propulsion',
			researchType: ResearchType.PROPULSION_IMPROVEMENT,
			icon: 'ship_speed' as IconImageType
		}
	];

	const infrastructure = [
		{
			name: 'Farms',
			researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS,
			icon: 'farm' as IconImageType
		},
		{
			name: 'Mines',
			researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES,
			icon: 'mine' as IconImageType
		},
		{
			name: 'Colonies',
			researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES,
			icon: 'colony' as IconImageType
		},
		{
			name: 'Factories',
			researchType: ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES,
			icon: 'factory' as IconImageType
		},
		{
			name: 'Space Platforms',
			researchType: ResearchType.SPACE_PLATFORM_IMPROVEMENT,
			icon: 'space_platform' as IconImageType
		}
	];

	// Custom ship design state
	let advantageAgainst = $state('');
	let disadvantageAgainst = $state('');

	// Dropdown options for ship types
	const shipTypeOptions = [
		{ value: 'defender', label: 'Defender' },
		{ value: 'scout', label: 'Scout' },
		{ value: 'destroyer', label: 'Destroyer' },
		{ value: 'cruiser', label: 'Cruiser' },
		{ value: 'battleship', label: 'Battleship' }
	];

	// Check if current research is a custom ship
	const isCustomShipResearch = $derived(
		currentResearchType &&
			[
				ResearchType.NEW_SHIP_TYPE_DEFENDER,
				ResearchType.NEW_SHIP_TYPE_SCOUT,
				ResearchType.NEW_SHIP_TYPE_DESTROYER,
				ResearchType.NEW_SHIP_TYPE_CRUISER,
				ResearchType.NEW_SHIP_TYPE_BATTLESHIP
			].includes(currentResearchType)
	);

	const currentResearchInfo = $derived(
		currentResearchType && researchProgress[currentResearchType]
			? {
					name: Research.researchProgressToString(researchProgress[currentResearchType]),
					type: currentResearchType,
					progress: researchProgress[currentResearchType],
					levelData: currentResearchLevelData,
					cyclesRemaining: cyclesRemaining
				}
			: null
	);

	function renderResourceBar(percentage: number, color: string) {
		const filledBars = Math.round(percentage * 20);
		const bars = [];
		for (let i = 0; i < 20; i++) {
			bars.push(i < filledBars);
		}
		return bars;
	}

	const energyBars = $derived(renderResourceBar(energyPercent, '#e2c631'));
	const researchBars = $derived(renderResourceBar(researchPercent, '#00ffa3'));

	// Function to get the appropriate icon for a research type
	function getResearchIcon(researchType: ResearchType): IconImageType {
		// Find in improvements
		const improvement = improvements.find((imp) => imp.researchType === researchType);
		if (improvement) return improvement.icon;

		// Find in infrastructure
		const infra = infrastructure.find((inf) => inf.researchType === researchType);
		if (infra) return infra.icon;

		// Find in ship types
		const ship = shipTypes.find((s) => s.researchType === researchType);
		if (ship) return ship.icon;

		// Default to research icon
		return 'research';
	}

	// Function to send research percent adjustment to server
	function adjustResearchPercent(newPercent: number) {
		// Clamp between 0 and 1
		const clampedPercent = Math.max(0, Math.min(1, newPercent));

		// Send WebSocket message to server using the service method
		webSocketService.adjustResearchPercent(clampedPercent);
	}

	// Function to submit a research item to the server
	function submitResearchItem(researchType: ResearchType, data: Record<string, unknown> = {}) {
		// Send WebSocket message to server using the service method
		webSocketService.submitResearchItem(researchType, data);
	}

	// Function to cancel current research
	function cancelResearchItem() {
		// Send WebSocket message to server using the service method
		webSocketService.cancelResearchItem();
	}

	// Handle dropdown selections for custom ship design
	function handleAdvantageSelection(shipType: string) {
		advantageAgainst = shipType;
	}

	function handleDisadvantageSelection(shipType: string) {
		disadvantageAgainst = shipType;
	}

	// Handle clicking on resource bars
	function handleBarClick(event: MouseEvent, isResearchBar: boolean) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const barWidth = rect.width;

		// Calculate which bar was clicked (0-19 for 20 bars)
		const barIndex = Math.floor((clickX / barWidth) * 20);
		const newPercent = (barIndex + 1) / 20; // +1 to make it 1-20 range, then divide by 20

		if (isResearchBar) {
			adjustResearchPercent(newPercent);
		} else {
			// Energy bar - set research to complement of energy
			adjustResearchPercent(1 - newPercent);
		}
	}
</script>

<!-- Horizontal layout similar to Planet View -->
<div class="relative h-80 w-full">
	<!-- Background with glass effect -->
	<div
		class="absolute inset-0 rounded bg-gradient-to-b from-white/10 to-gray-800/0 backdrop-blur-md"
	></div>

	<!-- Title -->
	<!-- <div class="absolute left-8 top-8">
		<Text class="astriarch-headline-32">
			Research
		</Text>
	</div> -->

	<div class="absolute inset-0 flex">
		<!-- Left Section: Allocated Resources -->
		<div class="h-80 w-[461px] p-8">
			<div class="h-full rounded bg-gradient-to-b from-white/10 to-gray-800/0 p-8 backdrop-blur-md">
				<Text class="astriarch-headline-24" style="margin-bottom: 16px;">Allocated resources</Text>

				<!-- Energy Bar -->
				<div class="mb-8">
					<div class="mb-4 flex items-center">
						<div class="mr-4 flex h-8 w-8 items-center justify-center">
							<IconImage type="energy" size={24} />
						</div>
						<Text class="astriarch-body-16-semibold">Energy</Text>
						<Text class="astriarch-body-16-semibold" style="margin-left: auto;">
							{Math.round(energyPercent * 100)}%
						</Text>
					</div>

					<div
						class="ml-9 flex cursor-pointer gap-1"
						on:click={(e) => handleBarClick(e, false)}
						role="button"
						tabindex="0"
					>
						{#each energyBars as filled}
							<div
								class="h-12 w-4 rounded-sm {filled
									? 'shadow-glow-white bg-yellow-500'
									: 'bg-white/10'} transition-colors hover:bg-yellow-400"
							></div>
						{/each}
					</div>
				</div>

				<!-- Research Bar -->
				<div class="mb-8">
					<div class="mb-4 flex items-center">
						<div class="mr-4 flex h-8 w-8 items-center justify-center">
							<IconImage type="research" size={24} />
						</div>
						<Text class="astriarch-body-16-semibold">Research</Text>
						<Text class="astriarch-body-16-semibold" style="margin-left: auto;">
							{Math.round(researchPercent * 100)}%
						</Text>
					</div>

					<div
						class="ml-9 flex cursor-pointer gap-1"
						on:click={(e) => handleBarClick(e, true)}
						role="button"
						tabindex="0"
					>
						{#each researchBars as filled}
							<div
								class="h-12 w-4 rounded-sm {filled
									? 'shadow-glow-white bg-green-500'
									: 'bg-white/10'} transition-colors hover:bg-green-400"
							></div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- Right Section: Research Options -->
		<div class="ml-8 h-80 flex-1 p-8">
			<div class="h-full rounded bg-gradient-to-b from-white/10 to-gray-800/0 p-8 backdrop-blur-md">
				<Text class="astriarch-headline-24" style="margin-bottom: 16px;">
					Custom ships and research improvements
				</Text>

				<div class="flex h-40">
					<!-- Create Ships Column -->
					<div class="mr-16 flex flex-col items-center">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
							Create Ships
						</Text>

						<div class="grid grid-cols-2 gap-2">
							{#each shipTypes as ship}
								<div
									class="flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border border-transparent bg-gray-700/50 transition-colors hover:border-cyan-500/40 hover:bg-gray-600/50"
									on:click={() => submitResearchItem(ship.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage
										type={ship.icon}
										size={32}
										class="text-cyan-400"
										style="filter: drop-shadow(0px 0px 18px rgba(125,251,255,0.25));"
									/>
								</div>
							{/each}
						</div>
					</div>

					<!-- Ships Column -->
					<div class="mr-16 flex flex-col items-center">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">Ships</Text>

						<div class="grid grid-cols-1 gap-2">
							{#each improvements as improvement}
								<div
									class="h-12 w-12 rounded-lg {currentResearchType === improvement.researchType
										? 'border-2 border-cyan-500 bg-gray-700'
										: 'bg-gray-700/50'} flex cursor-pointer items-center justify-center transition-colors hover:bg-gray-600/50"
									on:click={() => submitResearchItem(improvement.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage type={improvement.icon} size={32} />
								</div>
							{/each}
						</div>
					</div>

					<!-- Buildings -->
					<div class="mr-16 flex flex-col items-center">
						<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">Buildings</Text>

						<div class="grid grid-cols-2 gap-2">
							{#each infrastructure as infra}
								<div
									class="h-12 w-12 rounded-lg {currentResearchType === infra.researchType
										? 'border-2 border-cyan-500 bg-gray-700'
										: 'bg-gray-700/50'} flex cursor-pointer items-center justify-center transition-colors hover:bg-gray-600/50"
									on:click={() => submitResearchItem(infra.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage type={infra.icon} size={32} />
								</div>
							{/each}
						</div>
					</div>

					<!-- Conditional Right Section -->
					<div class="flex flex-1 flex-col">
						{#if isCustomShipResearch}
							<!-- Custom Ship: Advantage/Disadvantage Section -->
							<div class="mb-4 flex">
								<div class="mr-4 flex-1">
									<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
										Advantage against
									</Text>

									<Dropdown
										options={shipTypeOptions}
										value={advantageAgainst}
										placeholder="Select ship type"
										variant="secondary"
										onSelect={handleAdvantageSelection}
									/>
								</div>

								<div class="flex-1">
									<Text
										style="font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 14px; color: #FFFFFF; line-height: 24px; letter-spacing: 0.07px; margin-bottom: 16px;"
									>
										Disadvantage against
									</Text>

									<Dropdown
										options={shipTypeOptions}
										value={disadvantageAgainst}
										placeholder="Select ship type"
										variant="secondary"
										onSelect={handleDisadvantageSelection}
									/>
								</div>
							</div>

							<div class="mt-auto flex">
								<Button
									style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 24px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px; margin-right: 16px;"
								>
									RESEARCH SHIPS
								</Button>

								<Button
									style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;"
								>
									OKAY
								</Button>
							</div>
						{:else if currentResearchInfo && !isCustomShipResearch}
							<!-- Standard Research: Currently Researching Section -->
							<div class="flex flex-col">
								<Text class="astriarch-body-16-semibold" style="margin-bottom: 16px;">
									Currently researching
								</Text>

								<div class="mb-6 flex items-start">
									<div class="mr-4 flex h-8 w-8 items-center justify-center">
										<IconImage type={getResearchIcon(currentResearchInfo.type)} size={32} />
									</div>

									<div class="flex flex-col">
										<Text class="astriarch-body-14" style="margin-bottom: 4px;">
											{currentResearchInfo.name}.
										</Text>
										<Text class="astriarch-body-14">
											Estimating turns remaining: {currentResearchInfo.cyclesRemaining < 999
												? currentResearchInfo.cyclesRemaining
												: 'Infinity'}
										</Text>
										{#if currentResearchInfo.levelData}
											<Text class="astriarch-body-12" style="margin-top: 4px; opacity: 0.7;">
												Progress: {Math.round(currentResearchInfo.levelData.percentComplete * 100)}%
												complete
											</Text>
											<!-- Progress bar -->
											<div class="mt-2 flex gap-1">
												{#each Array(20) as _, i}
													<div
														class="h-2 w-2 rounded-sm"
														style="background-color: {i <
														Math.round(currentResearchInfo.levelData.percentComplete * 20)
															? '#00ffff'
															: '#333'}"
													></div>
												{/each}
											</div>
										{/if}
									</div>
								</div>

								<div class="mt-auto flex gap-4">
									<Button
										on:click={cancelResearchItem}
										style="background: #ff4444; color: #ffffff; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;"
									>
										CANCEL RESEARCH
									</Button>
									<Button
										style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;"
									>
										OKAY
									</Button>
								</div>
							</div>
						{:else}
							<!-- Default: No research selected -->
							<div class="mb-4 flex">
								<div class="mr-4 flex-1">
									<Text class="astriarch-body-14-semibold" style="margin-bottom: 16px;">
										Advantage against
									</Text>

									<Dropdown
										options={shipTypeOptions}
										value={advantageAgainst}
										placeholder="Select ship type"
										variant="secondary"
										onSelect={handleAdvantageSelection}
									/>
								</div>

								<div class="flex-1">
									<Text
										style="font-family: 'Orbitron', sans-serif; font-weight: 600; font-size: 14px; color: #FFFFFF; line-height: 24px; letter-spacing: 0.07px; margin-bottom: 16px;"
									>
										Disadvantage against
									</Text>

									<Dropdown
										options={shipTypeOptions}
										value={disadvantageAgainst}
										placeholder="Select ship type"
										variant="secondary"
										onSelect={handleDisadvantageSelection}
									/>
								</div>
							</div>

							<div class="mt-auto flex">
								<Button
									style="background: linear-gradient(135deg, #00ffff, #0080ff); color: #00ffff; border: none; padding: 12px 24px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase; text-shadow: rgba(0,0,0,0.15) 0px 0px 8px; margin-right: 16px;"
								>
									RESEARCH SHIPS
								</Button>

								<Button
									style="background: #00ffff; color: #1b1f25; border: none; padding: 12px 16px; border-radius: 4px; font-family: 'Orbitron', sans-serif; font-weight: 800; font-size: 14px; letter-spacing: 2px; text-transform: uppercase;"
								>
									OKAY
								</Button>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.shadow-glow-white {
		box-shadow: 0px 0px 14px rgba(255, 255, 255, 0.24);
	}
</style>
