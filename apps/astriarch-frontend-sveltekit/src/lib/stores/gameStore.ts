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
	ResearchType
} from 'astriarch-engine';

// Galaxy constants (from engine's GameModel)
const GALAXY_WIDTH = 621.0;
const GALAXY_HEIGHT = 480.0;

// Game state stores
export const clientGameModel = writable<ClientModelData | null>(null);
export const gameGrid = writable<Grid | null>(null);
export const notifications = writable<string[]>([]);
export const isGameRunning = writable<boolean>(true);

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

	return {
		total: totalResources,
		perTurn: perTurnResources
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

// Friendly time display derived from current cycle
export const gameTime = derived(currentCycle, ($currentCycle) => {
	// Convert cycles to a more meaningful time representation
	const hours = Math.floor($currentCycle / 100); // Rough conversion
	const minutes = Math.floor(($currentCycle % 100) * 0.6); // Convert to 60-minute scale
	return {
		cycle: $currentCycle,
		timeString: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
		stardate: (2387 + $currentCycle * 0.001).toFixed(3)
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

// Game actions
export const gameActions = {
	clearNotifications() {
		notifications.set([]);
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
			const updatedClientGameModel = advanceClientGameModelTime(cgm, grid);
			clientGameModel.set(updatedClientGameModel);
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
