<script lang="ts">
	import { Text, AvailablePlanetProductionItem, Dialog } from '$lib/components/astriarch';
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
		PlanetProductionItemType,
		CitizenWorkerType,
		type PlanetData,
		type PlanetProductionItemData
	} from 'astriarch-engine/src/model/planet';
	import { StarShipType, type StarshipAdvantageData } from 'astriarch-engine/src/model/fleet';
	import { ResearchType } from 'astriarch-engine/src/model/research';
	import type { ClientModelData, ClientPlanet } from 'astriarch-engine/src/model/clientModel';

	// Dialog state for colony demolition confirmation
	let showColonyDemolishDialog = $state(false);
	let pendingColonyDemolish: {
		improvementType: PlanetImprovementType;
		currentMaxPop: number;
		newMaxPop: number;
		popLoss: number;
	} | null = $state(null);

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

	// Derived values that depend on store values
	// Note: We use $selectedPlanet directly in template for reactivity
	let planets = $derived($clientGameModel?.mainPlayerOwnedPlanets || {});
	let planetList = $derived(Object.values(planets));

	// Check if the selected planet is an owned planet (has PlanetData structure)
	let isOwnedPlanet = $derived($selectedPlanet && 'planetaryFleet' in $selectedPlanet);

	// Calculate current worker assignments for the selected planet
	let workerAssignments = $derived(
		isFullPlanetData($selectedPlanet)
			? Planet.countPopulationWorkerTypes($selectedPlanet)
			: { farmers: 0, miners: 0, builders: 0 }
	);

	// Calculate resource generation for the selected planet
	let resourceGeneration = $derived(
		isFullPlanetData($selectedPlanet) && $clientGameModel?.mainPlayer
			? Planet.getPlanetWorkerResourceGeneration($selectedPlanet, $clientGameModel.mainPlayer)
			: null
	);

	// Calculate population contentment for the selected planet
	let populationByContentment = $derived(
		isFullPlanetData($selectedPlanet)
			? Planet.getPopulationByContentment($selectedPlanet)
			: { protesting: [], content: [] }
	);

	// Helper to check if planet is a full PlanetData (owned planet)
	function isFullPlanetData(planet: PlanetData | ClientPlanet | null): planet is PlanetData {
		return (
			planet !== null && 'population' in planet && 'resources' in planet && 'buildQueue' in planet
		);
	}

	// Helper function for worker assignment changes
	function adjustWorkerAssignment(workerType: CitizenWorkerType, delta: number) {
		if (!$selectedPlanet) return;

		const farmerDiff = workerType === CitizenWorkerType.Farmer ? delta : 0;
		const minerDiff = workerType === CitizenWorkerType.Miner ? delta : 0;
		const builderDiff = workerType === CitizenWorkerType.Builder ? delta : 0;

		webSocketService.updatePlanetWorkerAssignments(
			$selectedPlanet.id,
			farmerDiff,
			minerDiff,
			builderDiff
		);
	}

	function selectPlanet(planet?: PlanetData) {
		gameActions.selectPlanet(planet?.id || null);
	}

	function addBuildingToQueue(buildingType: PlanetImprovementType) {
		if (!$selectedPlanet || !$clientGameModel) return;

		const item = PlanetProductionItem.constructPlanetImprovement(buildingType);

		// Validate before sending (client-side validation only - server is authoritative)
		const validation = PlanetProductionItem.canBuild(
			$selectedPlanet,
			$clientGameModel.mainPlayer,
			$clientGameModel.mainPlayerOwnedPlanets,
			item
		);

		if (validation.result !== CanBuildResult.CanBuild) {
			console.warn(
				'Cannot build:',
				GameTools.planetImprovementTypeToFriendlyName(buildingType),
				validation.reason
			);
			return;
		}

		// Send command to server - server will mutate and broadcast events
		webSocketService.updatePlanetBuildQueue($selectedPlanet.id, 'add', item);
	}

	function addShipToQueue(shipType: StarShipType, customShipData?: StarshipAdvantageData) {
		if (!$selectedPlanet || !$clientGameModel) return;

		const item = PlanetProductionItem.constructStarShipInProduction(shipType, customShipData);

		// Validate before sending (client-side validation only - server is authoritative)
		const validation = PlanetProductionItem.canBuild(
			$selectedPlanet,
			$clientGameModel.mainPlayer,
			$clientGameModel.mainPlayerOwnedPlanets,
			item
		);

		if (validation.result !== CanBuildResult.CanBuild) {
			console.warn(
				'Cannot build:',
				GameTools.starShipTypeToFriendlyName(shipType, Boolean(customShipData)),
				validation.reason
			);
			return;
		}

		// Send command to server - server will mutate and broadcast events
		webSocketService.updatePlanetBuildQueue($selectedPlanet.id, 'add', item);
	}

	function removeFromBuildQueue(itemIndex: number) {
		if (!$selectedPlanet || !$clientGameModel) return;

		// Validate index is valid
		if (itemIndex < 0 || itemIndex >= $selectedPlanet.buildQueue.length) {
			console.warn('Invalid build queue index:', itemIndex);
			return;
		}

		// Send command to server - server will mutate and broadcast events
		webSocketService.updatePlanetBuildQueue($selectedPlanet.id, 'remove', undefined, itemIndex);
	}

	function demolishImprovement(improvementType: PlanetImprovementType) {
		if (!$selectedPlanet || !$clientGameModel || !isFullPlanetData($selectedPlanet)) return;

		// Check if we have any built improvements of this type
		const builtCount = $selectedPlanet.builtImprovements?.[improvementType] || 0;

		// Count how many demolish orders are already in queue
		const demolishInQueue =
			$selectedPlanet.buildQueue?.filter(
				(item: PlanetProductionItemData) =>
					item.itemType === PlanetProductionItemType.PlanetImprovementToDestroy &&
					item.improvementData?.type === improvementType
			).length || 0;

		if (builtCount - demolishInQueue <= 0) {
			console.warn('No improvements of this type available to demolish');
			return;
		}

		// Special handling for Colony demolition - check if it will cause population loss
		if (improvementType === PlanetImprovementType.Colony) {
			const currentMaxPop = Planet.maxPopulation($selectedPlanet);
			const newMaxPop = currentMaxPop - 1;
			const currentPop = $selectedPlanet.population?.length || 0;

			if (currentPop > newMaxPop) {
				const popLoss = currentPop - newMaxPop;
				// Show confirmation dialog instead of blocking confirm
				pendingColonyDemolish = {
					improvementType,
					currentMaxPop,
					newMaxPop,
					popLoss
				};
				showColonyDemolishDialog = true;
				return;
			}
		}

		// Proceed with demolition
		executeDemolish(improvementType);
	}

	function executeDemolish(improvementType: PlanetImprovementType) {
		if (!$selectedPlanet || !$clientGameModel) return;

		// Create demolish item
		const demolishItem = PlanetProductionItem.constructPlanetImprovementToDestroy(improvementType);

		// Send command to server - server will mutate and broadcast events
		webSocketService.updatePlanetBuildQueue($selectedPlanet.id, 'demolish', demolishItem);
	}

	function handleColonyDemolishConfirm() {
		if (pendingColonyDemolish) {
			executeDemolish(pendingColonyDemolish.improvementType);
		}
		showColonyDemolishDialog = false;
		pendingColonyDemolish = null;
	}

	function handleColonyDemolishCancel() {
		showColonyDemolishDialog = false;
		pendingColonyDemolish = null;
	}

	function canDemolish(improvementType: PlanetImprovementType): boolean {
		if (!$selectedPlanet || !isFullPlanetData($selectedPlanet)) return false;

		const builtCount = $selectedPlanet.builtImprovements?.[improvementType] || 0;
		const demolishInQueue =
			$selectedPlanet.buildQueue?.filter(
				(item: PlanetProductionItemData) =>
					item.itemType === PlanetProductionItemType.PlanetImprovementToDestroy &&
					item.improvementData?.type === improvementType
			).length || 0;

		return builtCount - demolishInQueue > 0;
	}

	function updateBuildLastStarship(buildLastStarship: boolean) {
		if (!$selectedPlanet) return;

		try {
			// Send WebSocket message to update planet buildLastStarship option
			webSocketService.updatePlanetOptions($selectedPlanet.id, { buildLastStarship });

			console.log('Updated buildLastStarship setting:', buildLastStarship);
		} catch (error) {
			console.error('Failed to update buildLastStarship setting:', error);
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
	let availableBuildings = $derived(
		buildingTypes.map(({ type, description }) => {
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
		})
	);

	// Generate available ships with proper costs from engine
	let availableShips = $derived(
		(() => {
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
		})()
	);

	// Check if buildings can be built using engine validation
	let buildingAvailability = $derived(
		isFullPlanetData($selectedPlanet) && $clientGameModel?.mainPlayer
			? buildingTypes.map(({ type }) => {
					const productionItem = PlanetProductionItem.constructPlanetImprovement(type);
					const validation = PlanetProductionItem.canBuild(
						$selectedPlanet,
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
			: []
	);

	// Check if ships can be built using engine validation
	let shipAvailability = $derived(
		isFullPlanetData($selectedPlanet) && $clientGameModel?.mainPlayer
			? availableShips.map((ship) => {
					const productionItem = PlanetProductionItem.constructStarShipInProduction(
						ship.type,
						ship.customShipData || undefined
					);
					const validation = PlanetProductionItem.canBuild(
						$selectedPlanet,
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
			: []
	);
</script>

<div class="flex h-full flex-col bg-slate-900/95 backdrop-blur-sm">
	{#if $selectedPlanet && isOwnedPlanet}
		<!-- Planet Header Summary -->
		<div class="flex-shrink-0 border-b border-cyan-500/20 bg-slate-800/50 p-3">
			<div id="selected-planet-header" class="flex items-center justify-between gap-6">
				<!-- Left: Planet Name & Info -->
				<div class="flex items-center space-x-4">
					<h2 class="text-astriarch-headline-24 text-astriarch-primary">
						{$selectedPlanet.name}
					</h2>
					<span class="text-astriarch-body-14 text-astriarch-ui-light-grey">
						{GameTools.planetTypeToFriendlyName($selectedPlanet.type || 1)}
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
						{#if isFullPlanetData($selectedPlanet)}
							Pop: {$selectedPlanet.population?.length || 0} | Max: {$selectedPlanet.maxImprovements +
								($selectedPlanet.builtImprovements?.[2] || 0)}
						{:else}
							Planet Info: Limited View
						{/if}
					</div>
				</div>

				<!-- Middle: Resources -->
				<div class="flex items-center space-x-3">
					<span class="text-xs text-slate-400">Resources:</span>
					{#if isFullPlanetData($selectedPlanet)}
						<div class="flex space-x-2 text-xs">
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-food"
									>{($selectedPlanet.resources?.food || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">F</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-food"
									>{($selectedPlanet.resources?.production || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">P</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-energy"
									>{($selectedPlanet.resources?.energy || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">E</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-ore"
									>{($selectedPlanet.resources?.ore || 0).toFixed(1)}</span
								>
								<span class="text-astriarch-ui-light-grey text-xs">O</span>
							</div>
							<div class="flex items-center space-x-1 rounded bg-slate-800/30 px-2 py-1">
								<span class="text-astriarch-iridium"
									>{($selectedPlanet.resources?.iridium || 0).toFixed(1)}</span
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
					{#if isFullPlanetData($selectedPlanet)}
						<div class="flex flex-wrap gap-1 text-xs">
							{#if $selectedPlanet.builtImprovements?.[PlanetImprovementType.Farm] > 0}
								<span
									class="flex items-center gap-1 rounded bg-slate-800/30 px-2 py-1 text-green-400"
								>
									Farm: {$selectedPlanet.builtImprovements[PlanetImprovementType.Farm]}
									{#if canDemolish(PlanetImprovementType.Farm)}
										<button
											class="ml-1 text-red-400 hover:text-red-300"
											onclick={() => demolishImprovement(PlanetImprovementType.Farm)}
											title="Demolish Farm"
										>
											✕
										</button>
									{/if}
								</span>
							{/if}
							{#if $selectedPlanet.builtImprovements?.[PlanetImprovementType.Mine] > 0}
								<span
									class="flex items-center gap-1 rounded bg-slate-800/30 px-2 py-1 text-orange-400"
								>
									Mine: {$selectedPlanet.builtImprovements[PlanetImprovementType.Mine]}
									{#if canDemolish(PlanetImprovementType.Mine)}
										<button
											class="ml-1 text-red-400 hover:text-red-300"
											onclick={() => demolishImprovement(PlanetImprovementType.Mine)}
											title="Demolish Mine"
										>
											✕
										</button>
									{/if}
								</span>
							{/if}
							{#if $selectedPlanet.builtImprovements?.[PlanetImprovementType.Factory] > 0}
								<span
									class="flex items-center gap-1 rounded bg-slate-800/30 px-2 py-1 text-blue-400"
								>
									Factory: {$selectedPlanet.builtImprovements[PlanetImprovementType.Factory]}
									{#if canDemolish(PlanetImprovementType.Factory)}
										<button
											class="ml-1 text-red-400 hover:text-red-300"
											onclick={() => demolishImprovement(PlanetImprovementType.Factory)}
											title="Demolish Factory"
										>
											✕
										</button>
									{/if}
								</span>
							{/if}
							{#if $selectedPlanet.builtImprovements?.[PlanetImprovementType.Colony] > 0}
								<span
									class="flex items-center gap-1 rounded bg-slate-800/30 px-2 py-1 text-purple-400"
								>
									Colony: {$selectedPlanet.builtImprovements[PlanetImprovementType.Colony]}
									{#if canDemolish(PlanetImprovementType.Colony)}
										<button
											class="ml-1 text-red-400 hover:text-red-300"
											onclick={() => demolishImprovement(PlanetImprovementType.Colony)}
											title="Demolish Colony"
										>
											✕
										</button>
									{/if}
								</span>
							{/if}
							{#if !$selectedPlanet.builtImprovements || Object.values($selectedPlanet.builtImprovements).every((count) => count === 0)}
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
					<div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
					<div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
								>{isFullPlanetData($selectedPlanet)
									? $selectedPlanet.population?.length || 0
									: 0}</span
							>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-slate-400">Content:</span>
							<span class="text-green-400">{populationByContentment.content.length}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-slate-400">Protesting:</span>
							<span class="text-red-400">{populationByContentment.protesting.length}</span>
						</div>
					</div>
				</div>

				<!-- Resource Production -->
				<div class="mb-4">
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Resource Production per Turn
					</h4>
					{#if resourceGeneration}
						<div class="space-y-2 text-xs">
							<div class="flex justify-between rounded bg-slate-800/30 p-2">
								<span class="text-green-400">Food:</span>
								<span class="text-white"
									>+{resourceGeneration.amountPerTurn.food.toFixed(1)} / year</span
								>
							</div>
							<div class="flex justify-between rounded bg-slate-800/30 p-2">
								<span class="text-yellow-400">Energy:</span>
								<span class="text-white">
									{#if $clientGameModel?.mainPlayer && isFullPlanetData($selectedPlanet)}
										+{Planet.getTaxRevenueAtMaxPercent(
											$selectedPlanet,
											$clientGameModel.mainPlayer
										).toFixed(1)} / year
									{:else}
										+0.0 / year
									{/if}
								</span>
							</div>
							<div class="flex justify-between rounded bg-slate-800/30 p-2">
								<span class="text-orange-400">Ore:</span>
								<span class="text-white"
									>+{resourceGeneration.amountPerTurn.ore.toFixed(1)} / year</span
								>
							</div>
							<div class="flex justify-between rounded bg-slate-800/30 p-2">
								<span class="text-purple-400">Iridium:</span>
								<span class="text-white"
									>+{resourceGeneration.amountPerTurn.iridium.toFixed(1)} / year</span
								>
							</div>
							<div class="flex justify-between rounded bg-slate-800/30 p-2">
								<span class="text-blue-400">Production:</span>
								<span class="text-white"
									>+{resourceGeneration.amountPerTurn.production.toFixed(1)} / year</span
								>
							</div>
						</div>
					{:else}
						<div class="text-xs text-slate-500">Resource generation not available</div>
					{/if}
				</div>

				<!-- Resource Production per Worker -->
				<div class="mb-4">
					<h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
						Production per Worker
					</h4>
					{#if resourceGeneration}
						<div class="space-y-2 text-xs">
							{#if workerAssignments.farmers > 0}
								<div class="flex justify-between rounded bg-slate-800/30 p-2">
									<span class="text-green-400">Food (per Farmer):</span>
									<span class="text-white"
										>+{resourceGeneration.amountPerWorkerPerTurn.food.toFixed(1)} / turn</span
									>
								</div>
							{/if}
							{#if workerAssignments.miners > 0}
								<div class="flex justify-between rounded bg-slate-800/30 p-2">
									<span class="text-orange-400">Ore (per Miner):</span>
									<span class="text-white"
										>+{resourceGeneration.amountPerWorkerPerTurn.ore.toFixed(1)} / turn</span
									>
								</div>
								<div class="flex justify-between rounded bg-slate-800/30 p-2">
									<span class="text-purple-400">Iridium (per Miner):</span>
									<span class="text-white"
										>+{resourceGeneration.amountPerWorkerPerTurn.iridium.toFixed(1)} / turn</span
									>
								</div>
							{/if}
							{#if workerAssignments.builders > 0}
								<div class="flex justify-between rounded bg-slate-800/30 p-2">
									<span class="text-blue-400">Production (per Builder):</span>
									<span class="text-white"
										>+{resourceGeneration.amountPerWorkerPerTurn.production.toFixed(1)} / turn</span
									>
								</div>
							{/if}
							{#if workerAssignments.farmers === 0 && workerAssignments.miners === 0 && workerAssignments.builders === 0}
								<div class="text-xs text-slate-500">No workers assigned</div>
							{/if}
						</div>
					{:else}
						<div class="text-xs text-slate-500">Resource generation not available</div>
					{/if}
				</div>
			</div>

			<!-- Column 3: Build Queue -->
			<div class="flex-1 overflow-y-auto p-3">
				<div class="mb-2 flex items-center justify-between">
					<h3 class="text-astriarch-body-16-semibold text-astriarch-primary">Build Queue</h3>
					{#if isFullPlanetData($selectedPlanet)}
						<div class="flex items-center space-x-2">
							<label class="flex cursor-pointer items-center space-x-1 text-xs text-slate-300">
								<input
									type="checkbox"
									class="form-checkbox h-3 w-3 rounded border-slate-500 bg-slate-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900"
									checked={$selectedPlanet.buildLastStarship}
									onchange={(e) => {
										const target = e.target as HTMLInputElement;
										updateBuildLastStarship(target.checked);
									}}
								/>
								<span>Build Last Ship</span>
							</label>
						</div>
					{/if}
				</div>

				{#if isFullPlanetData($selectedPlanet) && $selectedPlanet.buildQueue && $selectedPlanet.buildQueue.length > 0}
					<div class="space-y-2">
						{#each $selectedPlanet.buildQueue as item, index}
							<div class="rounded border border-slate-600/50 bg-slate-800/50 p-2">
								<div class="mb-1 flex items-center justify-between text-xs">
									<div class="flex items-center space-x-2">
										{#if item.itemType === PlanetProductionItemType.PlanetImprovementToDestroy}
											<span class="text-red-400">🔨</span>
										{/if}
										<div
											class="font-medium {item.itemType ===
											PlanetProductionItemType.PlanetImprovementToDestroy
												? 'text-red-400'
												: 'text-cyan-400'}"
										>
											{#if item.itemType === PlanetProductionItemType.PlanetImprovementToDestroy && item.improvementData?.type}
												Demolish {GameTools.planetImprovementTypeToFriendlyName(
													item.improvementData.type
												)}
											{:else if item.itemType === 1 && item.improvementData?.type}
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
												class="h-1.5 rounded-full {item.itemType ===
												PlanetProductionItemType.PlanetImprovementToDestroy
													? 'bg-red-500'
													: 'bg-cyan-500'}"
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
											{item.turnsToComplete === 1
												? '1 year'
												: `${item.turnsToComplete || '?'} years`}
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
	{:else if $selectedPlanet && !isOwnedPlanet}
		<!-- Selected planet is not owned -->
		<div class="flex h-full items-center justify-center">
			<div class="text-center">
				<Text style="color: #94A3B8; font-size: 14px;"
					>Planet "{$selectedPlanet.name}" is not under your control</Text
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

<!-- Colony Demolition Confirmation Dialog -->
<Dialog
	open={showColonyDemolishDialog}
	title="Confirm Colony Demolition"
	variant="warning"
	size="small"
	style="default"
	cancelButtonText="Cancel"
	saveButtonText="Demolish"
	onCancel={handleColonyDemolishCancel}
	onSave={handleColonyDemolishConfirm}
>
	{#if pendingColonyDemolish}
		<div class="space-y-3">
			<p class="text-yellow-400">⚠️ Warning: This action will cause population loss!</p>
			<div class="space-y-2 text-sm">
				<p>
					Demolishing this Colony will reduce max population from
					<span class="font-bold text-white">{pendingColonyDemolish.currentMaxPop}</span>
					to
					<span class="font-bold text-white">{pendingColonyDemolish.newMaxPop}</span>.
				</p>
				<p class="text-red-400">
					You will lose <span class="font-bold">{pendingColonyDemolish.popLoss}</span>
					population immediately.
				</p>
				<p class="mt-4 text-slate-400">Are you sure you want to proceed?</p>
			</div>
		</div>
	{/if}
</Dialog>
