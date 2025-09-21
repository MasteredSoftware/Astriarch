<script lang="ts">
	import { Text, AvailablePlanetProductionItem } from '$lib/components/astriarch';
	import {
		clientGameModel,
		gameActions,
		selectedPlanet,
		selectedPlanetId
	} from '$lib/stores/gameStore';
	import { webSocketService } from '$lib/services/websocket';
	import { GameTools } from 'astriarch-engine/src/utils/gameTools';
	import {
		PlanetProductionItem,
		CanBuildResult
	} from 'astriarch-engine/src/engine/planetProductionItem';
	import { Planet } from 'astriarch-engine/src/engine/planet';
	import { Research } from 'astriarch-engine/src/engine/research';
	import {
		PlanetImprovementType,
		CitizenWorkerType,
		type PlanetData
	} from 'astriarch-engine/src/model/planet';
	import { StarShipType, type StarshipAdvantageData } from 'astriarch-engine/src/model/fleet';
	import { ResearchType } from 'astriarch-engine/src/model/research';
	import type { ClientModelData, ClientPlanet } from 'astriarch-engine/src/model/clientModel';

	// Interface for ship build elements in the availableShips array
	interface AvailableShip {
		type: StarShipType;
		name: string;
		description: string;
		cost: {
			energy: number;
			ore: number;
			iridium: number;
		};
		isCustom: boolean;
		customShipData?: StarshipAdvantageData;
	}

	$: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
	$: planetList = Object.values(planets);

	// Use the central selected planet from gameStore
	$: currentSelectedPlanet = $selectedPlanet;

	// Check if the selected planet is an owned planet (has PlanetData structure)
	$: isOwnedPlanet = currentSelectedPlanet && 'planetaryFleet' in currentSelectedPlanet;

	// Calculate current worker assignments for the selected planet
	$: workerAssignments = isFullPlanetData(currentSelectedPlanet)
		? Planet.countPopulationWorkerTypes(currentSelectedPlanet)
		: { farmers: 0, miners: 0, builders: 0 };

	// Helper to check if planet is a full PlanetData (owned planet)
	function isFullPlanetData(planet: PlanetData | ClientPlanet | null): planet is PlanetData {
		return (
			planet !== null && 'population' in planet && 'resources' in planet && 'buildQueue' in planet
		);
	}

	// Helper function for worker assignment changes
	function adjustWorkerAssignment(workerType: CitizenWorkerType, delta: number) {
		if (!currentSelectedPlanet) return;

		const farmerDiff = workerType === CitizenWorkerType.Farmer ? delta : 0;
		const minerDiff = workerType === CitizenWorkerType.Miner ? delta : 0;
		const builderDiff = workerType === CitizenWorkerType.Builder ? delta : 0;

		webSocketService.updatePlanetWorkerAssignments(
			currentSelectedPlanet.id,
			farmerDiff,
			minerDiff,
			builderDiff
		);
	}

	function selectPlanet(planet?: PlanetData) {
		gameActions.selectPlanet(planet?.id || null);
	}

	function addBuildingToQueue(buildingType: PlanetImprovementType) {
		if (!currentSelectedPlanet || !$clientGameModel) return;

		const item = PlanetProductionItem.constructPlanetImprovement(buildingType);

		// Use engine validation - only proceeds if sufficient resources
		const success = gameActions.addToPlanetBuildQueueOptimistic(currentSelectedPlanet.id, item);

		if (!success) {
			console.warn(
				'Insufficient resources to build:',
				GameTools.planetImprovementTypeToFriendlyName(buildingType)
			);
			// Could add user notification here
			return;
		}

		try {
			// Send WebSocket message to add item to build queue
			webSocketService.updatePlanetBuildQueue(currentSelectedPlanet.id, 'add', item);

			console.log(
				'Added building to queue:',
				GameTools.planetImprovementTypeToFriendlyName(buildingType)
			);
		} catch (error) {
			console.error('Failed to add building to queue:', error);
			// TODO: Revert optimistic update on error
		}
	}

	function addShipToQueue(shipType: StarShipType, customShipData?: StarshipAdvantageData) {
		if (!currentSelectedPlanet || !$clientGameModel) return;

		const item = PlanetProductionItem.constructStarShipInProduction(shipType, customShipData);

		// Use engine validation - only proceeds if sufficient resources
		const success = gameActions.addToPlanetBuildQueueOptimistic(currentSelectedPlanet.id, item);

		if (!success) {
			console.warn(
				'Insufficient resources to build:',
				GameTools.starShipTypeToFriendlyName(shipType, Boolean(customShipData))
			);
			// Could add user notification here
			return;
		}

		try {
			// Send WebSocket message to add item to build queue
			webSocketService.updatePlanetBuildQueue(currentSelectedPlanet.id, 'add', item);

			console.log(
				'Added ship to queue:',
				GameTools.starShipTypeToFriendlyName(shipType, Boolean(customShipData))
			);
		} catch (error) {
			console.error('Failed to add ship to queue:', error);
			// TODO: Revert optimistic update on error
		}
	}

	function removeFromBuildQueue(itemIndex: number) {
		if (!currentSelectedPlanet || !$clientGameModel) return;

		// Remove from build queue with engine refund handling
		const success = gameActions.removeFromPlanetBuildQueueOptimistic(
			currentSelectedPlanet.id,
			itemIndex
		);

		if (!success) {
			console.warn('Failed to remove item from build queue at index:', itemIndex);
			return;
		}

		try {
			// Send WebSocket message to remove item from build queue
			webSocketService.updatePlanetBuildQueue(currentSelectedPlanet.id, 'remove', {
				index: itemIndex
			});

			console.log('Removed item from build queue at index:', itemIndex);
		} catch (error) {
			console.error('Failed to remove item from build queue:', error);
			// TODO: Revert optimistic update on error
		}
	}

	// Available building types with descriptions
	const buildingTypes = [
		{ type: PlanetImprovementType.Farm, description: 'Increases food production' },
		{ type: PlanetImprovementType.Mine, description: 'Increases ore and iridium production' },
		{ type: PlanetImprovementType.Factory, description: 'Increases production rate' },
		{ type: PlanetImprovementType.Colony, description: 'Increases population capacity' }
	];

	const shipTypes = [
		{ type: StarShipType.SystemDefense, description: 'Basic planetary defense unit' },
		{ type: StarShipType.Scout, description: 'Fast exploration vessel' },
		{ type: StarShipType.Destroyer, description: 'Light combat vessel' },
		{ type: StarShipType.Cruiser, description: 'Medium combat vessel' },
		{ type: StarShipType.Battleship, description: 'Heavy combat vessel' },
		{ type: StarShipType.SpacePlatform, description: 'Massive defensive structure' }
	];

	// Custom ship research type mappings
	const customShipResearchMapping: Partial<Record<StarShipType, ResearchType>> = {
		[StarShipType.SystemDefense]: ResearchType.NEW_SHIP_TYPE_DEFENDER,
		[StarShipType.Scout]: ResearchType.NEW_SHIP_TYPE_SCOUT,
		[StarShipType.Destroyer]: ResearchType.NEW_SHIP_TYPE_DESTROYER,
		[StarShipType.Cruiser]: ResearchType.NEW_SHIP_TYPE_CRUISER,
		[StarShipType.Battleship]: ResearchType.NEW_SHIP_TYPE_BATTLESHIP
	};

	// Check if a custom ship type has been researched
	function isCustomShipResearched(shipType: StarShipType): boolean {
		if (!$clientGameModel?.mainPlayer?.research) return false;

		const researchType = customShipResearchMapping[shipType];
		if (!researchType) return false;

		const researchProgress =
			$clientGameModel.mainPlayer.research.researchProgressByType[researchType];
		return researchProgress && researchProgress.currentResearchLevel >= 0;
	}

	// Get custom ship research data for a ship type
	function getCustomShipData(shipType: StarShipType): StarshipAdvantageData | null {
		if (!$clientGameModel?.mainPlayer?.research) return null;

		const researchType = customShipResearchMapping[shipType];
		if (!researchType) return null;

		const researchProgress =
			$clientGameModel.mainPlayer.research.researchProgressByType[researchType];
		return (researchProgress?.data as StarshipAdvantageData) || null;
	}

	// Generate available buildings with proper costs from engine
	$: availableBuildings = buildingTypes.map(({ type, description }) => {
		const productionItem = PlanetProductionItem.constructPlanetImprovement(type);
		return {
			type,
			name: GameTools.planetImprovementTypeToFriendlyName(type),
			description,
			cost: {
				energy: productionItem.energyCost,
				ore: productionItem.oreCost,
				iridium: productionItem.iridiumCost
			}
		};
	});

	// Generate available ships with proper costs from engine
	$: availableShips = (() => {
		const ships: AvailableShip[] = [];

		// Add standard ships
		for (const { type, description } of shipTypes) {
			const productionItem = PlanetProductionItem.constructStarShipInProduction(type);
			ships.push({
				type,
				name: GameTools.starShipTypeToFriendlyName(type, false),
				description,
				cost: {
					energy: productionItem.energyCost,
					ore: productionItem.oreCost,
					iridium: productionItem.iridiumCost
				},
				isCustom: false,
				customShipData: undefined
			});
		}

		// Add custom ships that have been researched
		for (const { type, description } of shipTypes) {
			// Skip space platforms - they don't have custom variants
			if (type === StarShipType.SpacePlatform) continue;

			if (isCustomShipResearched(type)) {
				const customShipData = getCustomShipData(type);
				if (customShipData) {
					const productionItem = PlanetProductionItem.constructStarShipInProduction(
						type,
						customShipData
					);

					// Get advantage/disadvantage info for description
					let advantageText = '';
					if (customShipData.advantageAgainst && customShipData.disadvantageAgainst) {
						const advantageAgainst = GameTools.starShipTypeToFriendlyName(
							customShipData.advantageAgainst,
							false
						);
						const disadvantageAgainst = GameTools.starShipTypeToFriendlyName(
							customShipData.disadvantageAgainst,
							false
						);
						advantageText = ` • Advantage vs ${advantageAgainst}, Weak vs ${disadvantageAgainst}`;
					}

					ships.push({
						type,
						name: GameTools.starShipTypeToFriendlyName(type, true),
						description: description + advantageText,
						cost: {
							energy: productionItem.energyCost,
							ore: productionItem.oreCost,
							iridium: productionItem.iridiumCost
						},
						isCustom: true,
						customShipData
					});
				}
			}
		}

		return ships;
	})();

	// Check if buildings can be built using engine validation
	$: buildingAvailability =
		isFullPlanetData(currentSelectedPlanet) && $clientGameModel?.mainPlayer
			? buildingTypes.map(({ type }) => {
					const productionItem = PlanetProductionItem.constructPlanetImprovement(type);
					const validation = PlanetProductionItem.canBuild(
						currentSelectedPlanet,
						$clientGameModel.mainPlayer,
						planets,
						productionItem
					);
					return {
						type,
						enabled: validation.result === CanBuildResult.CanBuild,
						reason: validation.reason
					};
				})
			: [];

	// Check if ships can be built using engine validation
	$: shipAvailability =
		isFullPlanetData(currentSelectedPlanet) && $clientGameModel?.mainPlayer
			? availableShips.map((ship) => {
					const productionItem = PlanetProductionItem.constructStarShipInProduction(
						ship.type,
						ship.customShipData || undefined
					);
					const validation = PlanetProductionItem.canBuild(
						currentSelectedPlanet,
						$clientGameModel.mainPlayer,
						planets,
						productionItem
					);
					return {
						type: ship.type,
						isCustom: ship.isCustom,
						enabled: validation.result === CanBuildResult.CanBuild,
						reason: validation.reason
					};
				})
			: [];
</script>

<div class="flex h-full flex-col bg-slate-900/95 backdrop-blur-sm">
	{#if currentSelectedPlanet && isOwnedPlanet}
		<!-- Planet Header Summary -->
		<div class="flex-shrink-0 border-b border-cyan-500/20 bg-slate-800/50 p-3">
			<div id="selected-planet-header" class="flex items-center justify-between gap-6">
				<!-- Left: Planet Name & Info -->
				<div class="flex items-center space-x-4">
					<h2 class="text-astriarch-headline-24 text-astriarch-primary">
						{currentSelectedPlanet.name}
					</h2>
					<span class="text-astriarch-body-14 text-astriarch-ui-light-grey">
						{GameTools.planetTypeToFriendlyName(currentSelectedPlanet.type || 1)}
					</span>
					{#if planetList.length > 1}
						<select
							class="rounded border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white"
							onchange={(e) => {
								const target = e.target as HTMLSelectElement;
								selectPlanet(planetList.find((p) => p.id === parseInt(target.value)));
							}}
							value={$selectedPlanetId}
						>
							{#each planetList as planet}
								<option value={planet.id}>{planet.name}</option>
							{/each}
						</select>
					{/if}
					<div class="text-xs text-slate-400">
						{#if isFullPlanetData(currentSelectedPlanet)}
							Pop: {currentSelectedPlanet.population?.length || 0} | Max: {currentSelectedPlanet.maxImprovements +
								(currentSelectedPlanet.builtImprovements?.[2] || 0)}
						{:else}
							Planet Info: Limited View
						{/if}
					</div>
				</div>

				<!-- Middle: Resources -->
				<div class="flex items-center space-x-3">
					<span class="text-xs text-slate-400">Resources:</span>
					{#if isFullPlanetData(currentSelectedPlanet)}
						<div class="flex space-x-2 text-xs">
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-food"
									>{(currentSelectedPlanet.resources?.food || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">F</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-food"
									>{(currentSelectedPlanet.resources?.production || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">P</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-energy"
									>{(currentSelectedPlanet.resources?.energy || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">E</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-ore"
									>{(currentSelectedPlanet.resources?.ore || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">O</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-iridium"
									>{(currentSelectedPlanet.resources?.iridium || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">I</span>
							</div>
						</div>
					{:else}
						<span class="text-xs text-slate-500">Resources not available</span>
					{/if}
				</div>

				<!-- Right: Improvements -->
				<div class="flex items-center space-x-3">
					<span class="text-xs text-slate-400">Improvements:</span>
					{#if isFullPlanetData(currentSelectedPlanet)}
						<div class="flex flex-wrap gap-1 text-xs">
							{#if currentSelectedPlanet.builtImprovements?.[PlanetImprovementType.Farm] > 0}
								<span class="rounded bg-slate-800/30 px-2 py-1 text-green-400">
									Farm: {currentSelectedPlanet.builtImprovements[PlanetImprovementType.Farm]}
								</span>
							{/if}
							{#if currentSelectedPlanet.builtImprovements?.[PlanetImprovementType.Mine] > 0}
								<span class="rounded bg-slate-800/30 px-2 py-1 text-orange-400">
									Mine: {currentSelectedPlanet.builtImprovements[PlanetImprovementType.Mine]}
								</span>
							{/if}
							{#if currentSelectedPlanet.builtImprovements?.[PlanetImprovementType.Factory] > 0}
								<span class="rounded bg-slate-800/30 px-2 py-1 text-blue-400">
									Factory: {currentSelectedPlanet.builtImprovements[PlanetImprovementType.Factory]}
								</span>
							{/if}
							{#if currentSelectedPlanet.builtImprovements?.[PlanetImprovementType.Colony] > 0}
								<span class="rounded bg-slate-800/30 px-2 py-1 text-purple-400">
									Colony: {currentSelectedPlanet.builtImprovements[PlanetImprovementType.Colony]}
								</span>
							{/if}
							{#if !currentSelectedPlanet.builtImprovements || Object.values(currentSelectedPlanet.builtImprovements).every((count) => count === 0)}
								<span class="text-xs text-slate-500">None</span>
							{/if}
						</div>
					{:else}
						<span class="text-xs text-slate-500">Improvements not available</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Three Column Layout -->
		<div class="flex min-h-0 flex-1">
			<!-- Column 1: Available Items to Build -->
			<div class="flex-1 overflow-y-auto border-r border-cyan-500/20 p-3">
				<h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">Build Items</h3>

				<!-- Buildings Section -->
				<div class="mb-4">
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Buildings
					</h4>
					<div class="grid grid-cols-4 gap-2">
						{#each availableBuildings as building, index}
							{@const availability = buildingAvailability.find((a) => a.type === building.type)}
							<AvailablePlanetProductionItem
								name={building.name}
								description={building.description}
								cost={building.cost}
								enabled={availability?.enabled ?? false}
								onClick={() => addBuildingToQueue(building.type)}
							/>
						{/each}
					</div>
				</div>

				<!-- Ships Section -->
				<div>
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Starships
					</h4>
					<div class="grid grid-cols-4 gap-2">
						{#each availableShips as ship}
							{@const availability = shipAvailability.find(
								(a) => a.type === ship.type && a.isCustom === ship.isCustom
							)}
							<AvailablePlanetProductionItem
								name={ship.name}
								description={ship.description}
								cost={ship.cost}
								enabled={availability?.enabled ?? false}
								onClick={() => addShipToQueue(ship.type, ship.customShipData)}
							/>
						{/each}
					</div>
				</div>
			</div>

			<!-- Column 2: Resources per Turn & Worker Management -->
			<div class="flex-1 overflow-y-auto border-r border-cyan-500/20 p-3">
				<h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">
					Workers & Production
				</h3>

				<!-- Worker Assignment -->
				<div>
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Worker Assignment
					</h4>
					<div class="space-y-2 text-xs">
						<div class="flex items-center justify-between rounded bg-slate-800/30 p-2">
							<span class="text-green-400">Farmers:</span>
							<div class="flex items-center space-x-1">
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Farmer, -1)}>-</button
								>
								<span class="w-6 text-center text-white">{workerAssignments.farmers}</span>
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Farmer, 1)}>+</button
								>
							</div>
						</div>
						<div class="flex items-center justify-between rounded bg-slate-800/30 p-2">
							<span class="text-orange-400">Miners:</span>
							<div class="flex items-center space-x-1">
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Miner, -1)}>-</button
								>
								<span class="w-6 text-center text-white">{workerAssignments.miners}</span>
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Miner, 1)}>+</button
								>
							</div>
						</div>
						<div class="flex items-center justify-between rounded bg-slate-800/30 p-2">
							<span class="text-blue-400">Builders:</span>
							<div class="flex items-center space-x-1">
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Builder, -1)}>-</button
								>
								<span class="w-6 text-center text-white">{workerAssignments.builders}</span>
								<button
									class="h-5 w-5 rounded bg-slate-600 text-xs hover:bg-slate-500"
									onclick={() => adjustWorkerAssignment(CitizenWorkerType.Builder, 1)}>+</button
								>
							</div>
						</div>
					</div>

					<!-- Total Population Summary -->
					<div class="mt-3 border-t border-slate-700/50 pt-2">
						<div class="flex justify-between text-xs">
							<span class="text-slate-400">Total Population:</span>
							<span class="text-white"
								>{isFullPlanetData(currentSelectedPlanet)
									? currentSelectedPlanet.population?.length || 0
									: 0}</span
							>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-slate-400">Unassigned:</span>
							<span class="text-white"
								>{Math.max(
									0,
									(isFullPlanetData(currentSelectedPlanet)
										? currentSelectedPlanet.population?.length || 0
										: 0) -
										(workerAssignments.farmers +
											workerAssignments.miners +
											workerAssignments.builders)
								)}</span
							>
						</div>
					</div>
				</div>

				<!-- Resource Production -->
				<div class="mb-4">
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Resource Production per Turn
					</h4>
					<div class="space-y-2 text-xs">
						<div class="flex justify-between rounded bg-slate-800/30 p-2">
							<span class="text-green-400">Food:</span>
							<span class="text-white">+2.4 / turn</span>
						</div>
						<div class="flex justify-between rounded bg-slate-800/30 p-2">
							<span class="text-yellow-400">Energy:</span>
							<span class="text-white">+3.6 / turn</span>
						</div>
						<div class="flex justify-between rounded bg-slate-800/30 p-2">
							<span class="text-orange-400">Ore:</span>
							<span class="text-white">+1.8 / turn</span>
						</div>
						<div class="flex justify-between rounded bg-slate-800/30 p-2">
							<span class="text-purple-400">Iridium:</span>
							<span class="text-white">+0.9 / turn</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Column 3: Build Queue -->
			<div class="flex-1 overflow-y-auto p-3">
				<h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">Build Queue</h3>

				{#if isFullPlanetData(currentSelectedPlanet) && currentSelectedPlanet.buildQueue && currentSelectedPlanet.buildQueue.length > 0}
					<div class="space-y-2">
						{#each currentSelectedPlanet.buildQueue as item, index}
							<div class="rounded border border-slate-600/50 bg-slate-800/50 p-2">
								<div class="mb-1 flex items-center justify-between text-xs">
									<div class="font-medium text-cyan-400">
										{#if item.itemType === 1 && item.improvementData?.type}
											{GameTools.planetImprovementTypeToFriendlyName(item.improvementData.type)}
										{:else if item.itemType === 2 && item.starshipData?.type}
											{GameTools.starShipTypeToFriendlyName(
												item.starshipData.type,
												Boolean(item.starshipData.customShipData)
											)}
										{:else}
											Unknown Item
										{/if}
									</div>
									<button
										class="text-xs text-red-400 hover:text-red-300"
										onclick={() => removeFromBuildQueue(index)}>✕</button
									>
								</div>

								<div class="mb-2 text-xs text-slate-400">
									{index === 0 ? 'Building...' : `Queue position ${index + 1}`}
								</div>

								{#if index === 0}
									<!-- Progress bar for current item -->
									<div class="mb-2">
										<div class="h-1.5 w-full rounded-full bg-slate-700">
											<div
												class="h-1.5 rounded-full bg-cyan-500 transition-all duration-300"
												style="width: {Math.min(
													100,
													((item.productionCostComplete || 0) / (item.baseProductionCost || 1)) *
														100
												)}%"
											></div>
										</div>
									</div>
								{/if}

								<div class="flex justify-between text-xs">
									<span class="text-slate-400">
										{(item.productionCostComplete || 0).toFixed(1)}/{Math.round(
											item.baseProductionCost || 1
										)}
									</span>
									{#if index === 0}
										<span class="text-slate-400">
											{item.turnsToComplete || '?'} turns
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="py-8 text-center">
						<Text style="color: #94A3B8; font-size: 12px;">Build queue is empty</Text>
						<Text style="color: #64748B; font-size: 10px; margin-top: 4px;">
							Select items from the left to build
						</Text>
					</div>
				{/if}
			</div>
		</div>
	{:else if currentSelectedPlanet && !isOwnedPlanet}
		<!-- Selected planet is not owned -->
		<div class="flex h-full items-center justify-center">
			<div class="text-center">
				<Text style="color: #94A3B8; font-size: 14px;"
					>Planet "{currentSelectedPlanet.name}" is not under your control</Text
				>
				<Text style="color: #64748B; font-size: 12px; margin-top: 4px;">
					Only owned planets can be managed here
				</Text>
			</div>
		</div>
	{:else}
		<!-- No Planet Selected -->
		<div class="flex h-full items-center justify-center">
			<div class="text-center">
				<Text style="color: #94A3B8; font-size: 14px;">No planets under your control</Text>
				<Text style="color: #64748B; font-size: 12px; margin-top: 4px;">
					Expand your empire to manage planets
				</Text>
			</div>
		</div>
	{/if}
</div>
