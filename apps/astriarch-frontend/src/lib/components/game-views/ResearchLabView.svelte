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
	import { clientGameModel, researchProgress, currentResearchType, researchPercent } from '$lib/stores/gameStore';

	const gameState = $derived($multiplayerGameStore);
	const clientModel = $derived($clientGameModel); // Use clientGameModel from gameStore instead
	const currentPlayer = $derived(gameState.currentPlayer);

	// Find the current player's data directly from clientModel (which contains the player data)
	const player = $derived(clientModel?.mainPlayer); // Use mainPlayer directly from clientModel
	const currentResearchPercent = $derived($researchPercent);
	const energyPercent = $derived(1 - currentResearchPercent);
	// Use reactive stores for research data instead of accessing directly
	const progressData = $derived($researchProgress);
	const currentType = $derived($currentResearchType);

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
		player?.research && currentType
			? Research.estimateTurnsRemainingInQueue(player.research, totalCreditsFromPlanets)
			: 999
	);

	// Get research level data for progress bar
	const currentResearchLevelData = $derived(
		currentType && progressData && progressData[currentType]
			? Research.getResearchLevelData(progressData[currentType])
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
	let selectedCustomShipType = $state<ResearchType | null>(null);

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
		currentType &&
			[
				ResearchType.NEW_SHIP_TYPE_DEFENDER,
				ResearchType.NEW_SHIP_TYPE_SCOUT,
				ResearchType.NEW_SHIP_TYPE_DESTROYER,
				ResearchType.NEW_SHIP_TYPE_CRUISER,
				ResearchType.NEW_SHIP_TYPE_BATTLESHIP
			].includes(currentType)
	);

	const currentResearchInfo = $derived.by(() => {
		const returnVal =
			currentType && progressData && progressData[currentType]
				? {
						name: Research.researchProgressToString(progressData[currentType]),
						type: currentType,
						progress: progressData[currentType],
						levelData: currentResearchLevelData,
						cyclesRemaining: cyclesRemaining
					}
				: null;
		return returnVal;
	});

	function renderResourceBar(percentage: number, color: string) {
		const filledBars = Math.round(percentage * 20);
		const bars = [];
		for (let i = 0; i < 20; i++) {
			bars.push(i < filledBars);
		}
		return bars;
	}

	const energyBars = $derived(renderResourceBar(energyPercent, '#e2c631'));
	const researchBars = $derived(renderResourceBar(currentResearchPercent, '#00ffa3'));

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

	// Function to get the current level for a research type (for level indicators)
	function getResearchLevel(researchType: ResearchType): number {
		if (!progressData || !progressData[researchType]) return 0;
		// Convert from engine level (-1 to 9) to display level (0 to 10)
		return progressData[researchType].currentResearchLevel + 1;
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

	// Function to submit a ship research item with advantage/disadvantage data
	function submitShipResearchItem(researchType: ResearchType) {
		const shipData: Record<string, unknown> = {};

		// Convert string values to StarShipType enum values
		const stringToShipType = {
			defender: StarShipType.SystemDefense,
			scout: StarShipType.Scout,
			destroyer: StarShipType.Destroyer,
			cruiser: StarShipType.Cruiser,
			battleship: StarShipType.Battleship
		};

		// Add advantage/disadvantage data if selected
		if (advantageAgainst) {
			shipData.advantageAgainst =
				stringToShipType[advantageAgainst as keyof typeof stringToShipType];
		}
		if (disadvantageAgainst) {
			shipData.disadvantageAgainst =
				stringToShipType[disadvantageAgainst as keyof typeof stringToShipType];
		}

		// Submit with the ship customization data
		submitResearchItem(researchType, shipData);

		// Clear the selected custom ship type since we've now submitted it
		selectedCustomShipType = null;
		advantageAgainst = '';
		disadvantageAgainst = '';
	}

	// Function to handle selecting a custom ship type (but not submitting yet)
	function selectCustomShipResearch(researchType: ResearchType) {
		// If this ship type is already being researched, don't allow selection for editing
		if (currentType === researchType) {
			return;
		}

		// If clicking on the same selected ship type, deselect it
		if (selectedCustomShipType === researchType) {
			selectedCustomShipType = null;
			advantageAgainst = '';
			disadvantageAgainst = '';
			return;
		}

		selectedCustomShipType = researchType;
		// Reset the advantage/disadvantage selections when selecting a new ship type
		advantageAgainst = '';
		disadvantageAgainst = '';
	}

	// Function to submit the currently selected custom ship research
	function submitSelectedCustomShipResearch() {
		if (selectedCustomShipType) {
			submitShipResearchItem(selectedCustomShipType);
		}
	}

	// Function to update current ship research with new advantage/disadvantage settings
	function updateCurrentShipResearch() {
		if (currentType && isCustomShipResearch) {
			submitShipResearchItem(currentType);
		}
	}

	// Function to start a new ship research (used when no research is currently active)
	function startNewShipResearch() {
		// We need to know which ship type the user wants to research
		// For now, we could default to a common ship type or require selection
		// Let's use scout as a default example, but this might need refinement
		if (advantageAgainst || disadvantageAgainst) {
			submitShipResearchItem(ResearchType.NEW_SHIP_TYPE_SCOUT);
		}
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
						{Math.round(currentResearchPercent * 100)}%
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
									class="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border transition-colors hover:border-cyan-500/40 hover:bg-gray-600/50 {selectedCustomShipType ===
										ship.researchType || currentType === ship.researchType
										? 'border-2 border-cyan-500 bg-gray-700'
										: 'border-transparent bg-gray-700/50'}"
									on:click={() => selectCustomShipResearch(ship.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage
										type={ship.icon}
										size={32}
										class="text-cyan-400"
										style="filter: drop-shadow(0px 0px 18px rgba(125,251,255,0.25));"
									/>

									<!-- Level Indicator -->
									{#if getResearchLevel(ship.researchType) > 0}
										<div class="absolute right-0 bottom-0">
											<span
												class="inline-block min-w-[14px] px-1 py-0.5 text-center text-[10px] leading-none font-bold text-[#23BDFF]"
											>
												{getResearchLevel(ship.researchType)}
											</span>
										</div>
									{/if}
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
									class="relative h-12 w-12 rounded-lg {currentType === improvement.researchType
										? 'border-2 border-cyan-500 bg-gray-700'
										: 'bg-gray-700/50'} flex cursor-pointer items-center justify-center transition-colors hover:bg-gray-600/50"
									on:click={() => submitResearchItem(improvement.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage type={improvement.icon} size={32} />

									<!-- Level Indicator -->
									{#if getResearchLevel(improvement.researchType) > 0}
										<div class="absolute right-0 bottom-0">
											<span
												class="inline-block min-w-[14px] px-1 py-0.5 text-center text-[10px] leading-none font-bold text-[#23BDFF]"
											>
												{getResearchLevel(improvement.researchType)}
											</span>
										</div>
									{/if}
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
									class="relative h-12 w-12 rounded-lg {currentType === infra.researchType
										? 'border-2 border-cyan-500 bg-gray-700'
										: 'bg-gray-700/50'} flex cursor-pointer items-center justify-center transition-colors hover:bg-gray-600/50"
									on:click={() => submitResearchItem(infra.researchType)}
									role="button"
									tabindex="0"
								>
									<IconImage type={infra.icon} size={32} />

									<!-- Level Indicator -->
									{#if getResearchLevel(infra.researchType) > 0}
										<div class="absolute right-0 bottom-0">
											<span
												class="min-w-[14px] px-1 py-0.5 text-center text-[10px] leading-none font-bold text-[#23BDFF]"
											>
												{getResearchLevel(infra.researchType)}
											</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>

					<!-- Conditional Right Section -->
					<div class="flex flex-1 flex-col">
						{#if selectedCustomShipType && !isCustomShipResearch}
							<!-- Custom Ship: Advantage/Disadvantage Section (for new ship selection) -->
							<div class="mb-4 flex flex-col">
								<Text class="astriarch-body-16-semibold" style="margin-bottom: 16px;">
									Configuring {shipTypes.find((s) => s.researchType === selectedCustomShipType)
										?.name} Research
								</Text>

								<div class="flex">
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
							</div>

							<div class="mt-auto flex">
								<Button onclick={submitSelectedCustomShipResearch} label="RESEARCH SHIP" />
							</div>
						{:else if currentResearchInfo}
							<!-- Currently Researching Section (for both standard and custom ship research) -->
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
											Estimated turns remaining: {currentResearchInfo.cyclesRemaining < 999
												? currentResearchInfo.cyclesRemaining
												: 'Infinity'}
										</Text>
										{#if currentResearchInfo.levelData}
											<Text class="astriarch-body-12" style="margin-top: 4px; opacity: 0.7;">
												Progress: {(currentResearchInfo.levelData.percentComplete * 100).toFixed(
													1
												)}% complete
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
									<Button onclick={cancelResearchItem}>CANCEL RESEARCH</Button>
								</div>
							</div>
						{:else}
							<!-- Default: No research selected -->
							<div class="flex h-full flex-col items-center justify-center">
								<Text
									class="astriarch-body-14"
									style="text-align: center; margin-bottom: 16px; opacity: 0.8;"
								>
									No active research project. Click on a research area below to have your scientists
									and engineers start researching in that area.
								</Text>
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
