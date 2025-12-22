import { writable, derived } from 'svelte/store';
import {
	advanceClientGameModelTime,
	getPlayerTotalResources,
	getPlayerTotalResourceProductionPerTurn,
	getPlayerTotalPopulation,
	Grid,
	Player,
	Planet,
	type ClientModelData,
	type PlanetProductionItemData,
	ResearchType,
	GALAXY_WIDTH,
	GALAXY_HEIGHT
} from 'astriarch-engine';
import type { ClientPlanet } from 'astriarch-engine/src/model/clientModel';
import type { PlanetData } from 'astriarch-engine/src/model/planet';
import { webSocketService } from '$lib/services/websocket';
import {
	convertClientNotificationToUINotification,
	isBuildCompletionNotification
} from '$lib/utils/notificationUtils';
import { multiplayerGameStore } from '$lib/stores/multiplayerGameStore';

// Game state stores
export const clientGameModel = writable<ClientModelData | null>(null);
export const gameGrid = writable<Grid | null>(null);
export const notifications = writable<string[]>([]);
export const isGameRunning = writable<boolean>(true);
export const selectedPlanetId = writable<number | null>(null);

// Resource data derived from client game model
export const resourceData = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) {
		return {
			total: {
				food: 0,
				energy: 0,
				research: 0,
				ore: 0,
				iridium: 0,
				production: 0
			},
			perTurn: {
				food: 0,
				energy: 0,
				research: 0,
				ore: 0,
				iridium: 0,
				production: 0
			}
		};
	}

	// Get actual resources from the game model using the correct API
	const totalResources = getPlayerTotalResources(
		$clientGameModel.mainPlayer,
		$clientGameModel.mainPlayerOwnedPlanets
	);
	const perTurnResources = getPlayerTotalResourceProductionPerTurn(
		$clientGameModel.mainPlayer,
		$clientGameModel.mainPlayerOwnedPlanets
	);

	// Calculate total population to show net food production (after consumption)
	const totalPopulation = getPlayerTotalPopulation(
		$clientGameModel.mainPlayer,
		$clientGameModel.mainPlayerOwnedPlanets
	);

	const foodDiffPerTurn = perTurnResources.food - totalPopulation;
	const totalFoodAmount = totalResources.food;

	// Calculate food color based on old game logic
	let foodColor = 'green';
	if (foodDiffPerTurn < 0) {
		if (foodDiffPerTurn + totalFoodAmount < totalPopulation) {
			foodColor = 'red'; // We're going to starve
		} else {
			foodColor = 'yellow'; // Losing food but won't starve yet
		}
	} else if (
		totalFoodAmount < totalPopulation ||
		foodDiffPerTurn + totalFoodAmount < totalPopulation
	) {
		foodColor = 'orange'; // Gaining food but will still starve
	}

	return {
		total: totalResources,
		perTurn: {
			...perTurnResources,
			// Subtract population consumption from food production to show net gain/loss
			food: foodDiffPerTurn
		},
		colors: {
			food: foodColor
		}
	};
});

// Population derived from client game model
export const population = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return 0;

	return getPlayerTotalPopulation(
		$clientGameModel.mainPlayer,
		$clientGameModel.mainPlayerOwnedPlanets
	);
});

// Current cycle derived from client game model
export const currentCycle = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return 0;
	return $clientGameModel.currentCycle;
});

// Research progress derived from client game model (creates new objects for reactivity)
export const researchProgress = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return {};
	// Create new objects to ensure Svelte reactivity works with nested mutations
	const progress = $clientGameModel.mainPlayer.research.researchProgressByType;
	const computed: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(progress)) {
		computed[key] = { ...value };
	}
	return computed;
});

// Current research type derived from client game model
export const currentResearchType = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return null;
	return $clientGameModel.mainPlayer.research.researchTypeInQueue;
});

// Research percent derived from client game model
export const researchPercent = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return 0;
	return $clientGameModel.mainPlayer.research.researchPercent || 0;
});

// Current game speed derived from client game model
export const currentGameSpeed = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel) return 3; // Default to normal speed
	return $clientGameModel.gameOptions.gameSpeed || 3;
});

// Current game speed as number (1-5) for UI display
export const currentGameSpeedNumber = derived(currentGameSpeed, ($gameSpeed) => {
	// GameSpeed enum values map directly to numbers 1-5
	return $gameSpeed;
});

// Friendly time display derived from current cycle
export const gameTime = derived(currentCycle, ($currentCycle) => {
	// Convert cycles to a more meaningful time representation
	const truncatedCycle = Math.floor($currentCycle) + 1;
	return {
		cycle: truncatedCycle,
		stardate: 3000 + truncatedCycle
	};
});
export const currentResearch = derived(clientGameModel, ($clientGameModel) => {
	if (!$clientGameModel || !$clientGameModel.mainPlayer.research.researchTypeInQueue) {
		return 'Nothing';
	}

	const researchType = $clientGameModel.mainPlayer.research.researchTypeInQueue;
	const researchNames: Record<number, string> = {
		[ResearchType.NEW_SHIP_TYPE_DEFENDER]: 'Defender Ship',
		[ResearchType.NEW_SHIP_TYPE_SCOUT]: 'Scout Ship',
		[ResearchType.NEW_SHIP_TYPE_DESTROYER]: 'Destroyer Ship',
		[ResearchType.NEW_SHIP_TYPE_CRUISER]: 'Cruiser Ship',
		[ResearchType.NEW_SHIP_TYPE_BATTLESHIP]: 'Battleship',
		[ResearchType.COMBAT_IMPROVEMENT_ATTACK]: 'Combat Attack',
		[ResearchType.COMBAT_IMPROVEMENT_DEFENSE]: 'Combat Defense',
		[ResearchType.PROPULSION_IMPROVEMENT]: 'Propulsion',
		[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FARMS]: 'Farm Efficiency',
		[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_MINES]: 'Mine Efficiency',
		[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_COLONIES]: 'Colony Growth',
		[ResearchType.BUILDING_EFFICIENCY_IMPROVEMENT_FACTORIES]: 'Factory Efficiency',
		[ResearchType.SPACE_PLATFORM_IMPROVEMENT]: 'Space Platforms'
	};

	return researchNames[researchType] || 'Unknown Research';
});

// Selected planet derived from selectedPlanetId and clientGameModel
export const selectedPlanet = derived(
	[selectedPlanetId, clientGameModel],
	([$selectedPlanetId, $clientGameModel]): PlanetData | ClientPlanet | null => {
		if (!$selectedPlanetId || !$clientGameModel) return null;

		// First check if it's an owned planet (full PlanetData)
		const ownedPlanet = $clientGameModel.mainPlayerOwnedPlanets[$selectedPlanetId];
		if (ownedPlanet) {
			return ownedPlanet;
		}

		// Then check if it's a known client planet (ClientPlanet)
		const clientPlanet = $clientGameModel.clientPlanets.find((p) => p.id === $selectedPlanetId);
		if (clientPlanet) {
			return clientPlanet;
		}

		return null;
	}
);

// Game actions
export const gameActions = {
	clearNotifications() {
		notifications.set([]);
	},

	// Planet selection actions
	selectPlanet(planetId: number | null) {
		console.log('gameActions.selectPlanet called with ID:', planetId);
		selectedPlanetId.set(planetId);
	},

	selectHomePlanet() {
		const cgm = get(clientGameModel);

		const homePlanetId = cgm?.mainPlayer.homePlanetId;
		if (!homePlanetId) {
			selectedPlanetId.set(null);
			return;
		}

		selectedPlanetId.set(homePlanetId);
	},

	pauseGame() {
		isGameRunning.set(false);
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
	},

	resumeGame() {
		isGameRunning.set(true);
		startGameLoop();
	},

	// Game speed adjustment with optimistic update
	setGameSpeed(newSpeed: number) {
		const cgm = get(clientGameModel);
		if (!cgm) return;

		// Convert number (1-5) to GameSpeed enum
		const gameSpeedMap = {
			1: 1, // GameSpeed.SLOWEST
			2: 2, // GameSpeed.SLOW
			3: 3, // GameSpeed.NORMAL
			4: 4, // GameSpeed.FAST
			5: 5 // GameSpeed.FASTEST
		};

		const gameSpeedEnum = gameSpeedMap[newSpeed as keyof typeof gameSpeedMap];
		if (!gameSpeedEnum) return;

		// Optimistic update - immediately update the client game model
		const updatedCgm = {
			...cgm,
			gameOptions: {
				...cgm.gameOptions,
				gameSpeed: gameSpeedEnum
			}
		};
		clientGameModel.set(updatedCgm);

		// Send to server for persistence and broadcast
		webSocketService.setGameSpeed(gameSpeedEnum);
	},

	// Validate with engine then add item to planet's build queue if resources are sufficient
	addToPlanetBuildQueueOptimistic(planetId: number, item: PlanetProductionItemData): boolean {
		const cgm = get(clientGameModel);
		if (!cgm || !cgm.mainPlayerOwnedPlanets[planetId]) return false;

		const grid = get(gameGrid);
		if (!grid) return false;

		const planet = cgm.mainPlayerOwnedPlanets[planetId];

		// Use engine validation to check if we can build this item
		const canBuild = Player.enqueueProductionItemAndSpendResourcesIfPossible(
			cgm,
			grid,
			planet,
			item
		);

		if (canBuild) {
			// The engine method already updated the planet's build queue and spent resources
			// We need to trigger a store update to notify components
			clientGameModel.update((current) => (current ? { ...current } : null));
		}

		return canBuild;
	},

	// Remove item from planet's build queue with refund
	removeFromPlanetBuildQueueOptimistic(planetId: number, itemIndex: number): boolean {
		const cgm = get(clientGameModel);
		if (!cgm || !cgm.mainPlayerOwnedPlanets[planetId]) return false;

		const planet = cgm.mainPlayerOwnedPlanets[planetId];

		// Use engine method to remove item and handle refund
		const success = Planet.removeBuildQueueItemForRefund(planet, itemIndex);

		if (success) {
			// Trigger a store update to notify components
			clientGameModel.update((current) => (current ? { ...current } : null));
		}

		return success;
	}
};

// Helper to get current store values
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
	let value: T;
	const unsubscribe = store.subscribe((v) => (value = v));
	unsubscribe();
	return value!;
}

// Animation frame loop for continuous game time advancement
let animationFrameId: number | null = null;

function startGameLoop() {
	if (animationFrameId !== null) {
		cancelAnimationFrame(animationFrameId);
	}

	function gameLoop() {
		if (!get(isGameRunning)) {
			animationFrameId = null;
			return;
		}

		const cgm = get(clientGameModel);
		const grid = get(gameGrid);

		if (cgm && grid) {
			// Advance the client game model time continuously
			const result = advanceClientGameModelTime(cgm, grid);
			clientGameModel.set(result.clientGameModel);

			// Process notifications from the engine immediately
			if (result.notifications.length > 0) {
				let shouldCheckAutoQueue = false;

				for (const notification of result.notifications) {
					// Convert engine notification to UI notification
					const uiNotification = convertClientNotificationToUINotification(notification);
					if (uiNotification) {
						multiplayerGameStore.addNotification(uiNotification);
					}

					// Check if this is a build completion notification
					if (isBuildCompletionNotification(notification)) {
						shouldCheckAutoQueue = true;
					}
				}

				// Trigger auto-queue check if builds completed
				if (shouldCheckAutoQueue) {
					console.log('Build completion detected in game loop - requesting auto-queue check');
					webSocketService.requestAutoQueueCheck();
				}
			}

			if (result.fleetsArrivingOnUnownedPlanets.length > 0) {
				// request data sync with server
				console.log('Fleets arriving on unowned planets, requesting state synchronization');
				webSocketService.requestStateSync();
			}
		}

		animationFrameId = requestAnimationFrame(gameLoop);
	}

	animationFrameId = requestAnimationFrame(gameLoop);
}

// Construct the grid once when a game is started/resumed
clientGameModel.subscribe((cgm) => {
	const currentGrid = get(gameGrid);

	if (cgm && cgm.gameOptions && !currentGrid) {
		// Only construct grid once when we have game options but no grid yet
		const grid = new Grid(GALAXY_WIDTH, GALAXY_HEIGHT, cgm.gameOptions);
		gameGrid.set(grid);
		console.log('Client-side grid constructed with', grid.hexes.length, 'hexes');
	} else if (!cgm) {
		// Clear the grid when no game model
		gameGrid.set(null);
	}
});

// NOTE: Old EventNotification sync logic removed - now using new ClientEvent architecture
// Time-based events are sent from server via CLIENT_EVENT messages
// No need to subscribe to engine events or trigger full state syncs

// Start the game loop when both client game model and grid are loaded
clientGameModel.subscribe((cgm) => {
	const grid = get(gameGrid);
	if (cgm && grid && get(isGameRunning) && animationFrameId === null) {
		startGameLoop();
	}
});

gameGrid.subscribe((grid) => {
	const cgm = get(clientGameModel);
	if (cgm && grid && get(isGameRunning) && animationFrameId === null) {
		startGameLoop();
	}
});
