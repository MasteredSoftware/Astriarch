<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { clientGameModel, gameGrid, gameActions } from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import type { ClientModelData, Grid } from 'astriarch-engine';
	import { PlanetHappinessType, PlanetImprovementType } from 'astriarch-engine/src/model/planet';
	import Konva from 'konva';
	import { DrawnPlanet } from './DrawnPlanet';
	import { DrawnFleet } from './DrawnFleet';

	let canvasContainer: HTMLDivElement;
	let stage: Konva.Stage;
	let galaxyLayer: Konva.Layer;
	let fleetLayer: Konva.Layer;
	let uiLayer: Konva.Layer;

	let drawnPlanets: Map<number, DrawnPlanet> = new Map();
	let drawnFleets: Map<number, DrawnFleet> = new Map();
	let currentGrid: Grid | null = null;

	let animationFrameId: number;
	let isInitialized = false;

	onMount(() => {
		initializeCanvas();
		startRenderLoop();
		isInitialized = true;
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		stage?.destroy();
	});

	function initializeCanvas() {
		console.log('Initializing GalaxyCanvas...');

		// Get galaxy dimensions from the grid when available
		const grid = $gameGrid;
		const galaxyWidth = grid ? 621 : 800; // Default fallback
		const galaxyHeight = grid ? 480 : 600; // Default fallback

		console.log('Galaxy dimensions:', { galaxyWidth, galaxyHeight, hasGrid: !!grid });

		if (grid) {
			currentGrid = grid;
			console.log('Grid loaded with', grid.hexes.length, 'hexes');
		}

		// Create Konva stage with proper galaxy dimensions
		stage = new Konva.Stage({
			container: canvasContainer,
			width: window.innerWidth - 300, // Account for UI panels
			height: window.innerHeight - 200, // Account for top bar and navigation
			draggable: false // Disable panning the galaxy view
		});

		// Create layers (back to front rendering order)
		galaxyLayer = new Konva.Layer();
		fleetLayer = new Konva.Layer();
		uiLayer = new Konva.Layer();

		stage.add(galaxyLayer);
		stage.add(fleetLayer);
		stage.add(uiLayer);

		// Add space background with proper galaxy bounds
		createSpaceBackground(galaxyWidth, galaxyHeight);

		// Center the view on the galaxy
		const scale =
			Math.min((window.innerWidth - 300) / galaxyWidth, (window.innerHeight - 200) / galaxyHeight) *
			0.8; // Leave some padding

		stage.scale({ x: scale, y: scale });
		stage.position({
			x: (window.innerWidth - 300 - galaxyWidth * scale) / 2,
			y: (window.innerHeight - 200 - galaxyHeight * scale) / 2
		});

		// Handle window resize
		window.addEventListener('resize', handleResize);

		console.log('GalaxyCanvas initialization complete');
	}

	function createSpaceBackground(galaxyWidth = 1000, galaxyHeight = 800) {
		// Create background that covers the entire galaxy area
		const background = new Konva.Rect({
			x: 0,
			y: 0,
			width: galaxyWidth,
			height: galaxyHeight,
			fill: '#000011'
		});
		galaxyLayer.add(background);

		// Add hex grid if we have the grid data
		if (currentGrid) {
			createHexGrid();
		}

		// Add some stars for atmosphere
		for (let i = 0; i < 100; i++) {
			const star = new Konva.Circle({
				x: Math.random() * galaxyWidth,
				y: Math.random() * galaxyHeight,
				radius: Math.random() * 1.5 + 0.5,
				fill: `rgba(255, 255, 255, ${Math.random() * 0.6 + 0.4})`,
				shadowColor: 'white',
				shadowBlur: Math.random() * 2
			});
			galaxyLayer.add(star);
		}
	}

	function createHexGrid() {
		if (!currentGrid) return;

		// Draw hex grid using the original hexagon point calculation

		for (const hex of currentGrid.hexes) {
			// Use the hex data or fall back to original constants
			const width = hex.data.width;
			const height = hex.data.height;
			const side = hex.data.side;
			const x = hex.data.x;
			const y = hex.data.y;

			// Calculate hexagon points using the original algorithm
			// This creates the non-regular hexagon shape that tessellates properly
			const x1 = (width - side) / 2;
			const y1 = height / 2;

			const points = [
				x1 + x,
				y, // Top left point
				x1 + side + x,
				y, // Top right point
				width + x,
				y1 + y, // Right point
				x1 + side + x,
				height + y, // Bottom right point
				x1 + x,
				height + y, // Bottom left point
				x,
				y1 + y // Left point
			];

			// Create the hexagon outline
			const hexShape = new Konva.Line({
				points: points,
				stroke: 'rgba(0, 255, 255, 0.15)',
				strokeWidth: 1,
				fill: 'transparent',
				closed: true
			});
			galaxyLayer.add(hexShape);

			// Add hex labels for debugging (smaller and more subtle)
			const label = new Konva.Text({
				x: hex.midPoint.x - 8,
				y: hex.midPoint.y - 4,
				text: hex.data.id.toString(),
				fontSize: 7,
				fill: 'rgba(0, 255, 255, 0.2)',
				align: 'center',
				fontFamily: 'monospace'
			});
			galaxyLayer.add(label);
		}
	}

	function handleResize() {
		if (stage) {
			stage.width(window.innerWidth - 300);
			stage.height(window.innerHeight - 200);
		}
	}

	function startRenderLoop() {
		function render() {
			updateGameObjects();
			animationFrameId = requestAnimationFrame(render);
		}
		render();
	}

	function updateGameObjects() {
		if (!$clientGameModel) {
			return;
		}

		// Update grid reference if changed
		const grid = $gameGrid;
		if (grid && currentGrid !== grid) {
			currentGrid = grid;
			console.log('Grid updated, recreating background');
			// Recreate background with hex grid
			galaxyLayer.destroyChildren();
			const galaxyWidth = 621;
			const galaxyHeight = 480;
			createSpaceBackground(galaxyWidth, galaxyHeight);
		}

		// Update planets
		updatePlanets($clientGameModel);

		// Update fleets
		updateFleets($clientGameModel);

		// Redraw layers if needed
		galaxyLayer.batchDraw();
		fleetLayer.batchDraw();
	}

	function updatePlanets(gameModel: ClientModelData) {
		const allPlanetsToRender = new Set<number>();

		// First, render all owned planets (these have full PlanetData)
		for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
			allPlanetsToRender.add(planet.id);

			let drawnPlanet = drawnPlanets.get(planet.id);

			if (!drawnPlanet) {
				console.log('Creating new DrawnPlanet for owned planet:', planet.id, planet.name);
				drawnPlanet = new DrawnPlanet(planet, gameModel);
				drawnPlanets.set(planet.id, drawnPlanet);
				galaxyLayer.add(drawnPlanet.group);

				// Add click handler for planet selection
				drawnPlanet.onClick(handlePlanetClick);
			}

			drawnPlanet.update(gameModel);
		}

		// Then, render known but unowned planets (ClientPlanet data)
		for (const clientPlanet of gameModel.clientPlanets) {
			// Skip if we already rendered it as an owned planet
			if (allPlanetsToRender.has(clientPlanet.id)) continue;

			allPlanetsToRender.add(clientPlanet.id);

			let drawnPlanet = drawnPlanets.get(clientPlanet.id);

			if (!drawnPlanet) {
				console.log(
					'Creating new DrawnPlanet for client planet:',
					clientPlanet.id,
					clientPlanet.name
				);
				// Convert ClientPlanet to PlanetData with sensible defaults
				const planetData = {
					...clientPlanet,
					type: clientPlanet.type || 1, // Default to Dead if unknown
					population: [],
					resources: { food: 0, energy: 0, ore: 0, iridium: 0, research: 0, production: 0 },
					buildQueue: [],
					builtImprovements: {
						1: 0, // Colony
						2: 0, // Factory
						3: 0, // Farm
						4: 0 // Mine
					},
					maxImprovements: 5,
					planetaryFleet: {
						starships: [],
						locationHexMidPoint: null,
						travelingFromHexMidPoint: null,
						destinationHexMidPoint: null,
						parsecsToDestination: null,
						totalTravelDistance: null
					},
					outgoingFleets: [],
					planetHappiness: 1, // PlanetHappinessType.Normal
					starshipTypeLastBuilt: null,
					starshipCustomShipLastBuilt: false,
					buildLastStarship: false,
					waypointBoundingHexMidPoint: null
				};

				drawnPlanet = new DrawnPlanet(planetData, gameModel);
				drawnPlanets.set(clientPlanet.id, drawnPlanet);
				galaxyLayer.add(drawnPlanet.group);

				// Add click handler for planet selection
				drawnPlanet.onClick(handlePlanetClick);
			}

			drawnPlanet.update(gameModel);
		}

		// Clean up planets that are no longer visible
		for (const [planetId, drawnPlanet] of drawnPlanets.entries()) {
			if (!allPlanetsToRender.has(planetId)) {
				drawnPlanet.group.remove();
				drawnPlanet.group.destroy();
				drawnPlanets.delete(planetId);
			}
		}
	}

	function updateFleets(gameModel: ClientModelData) {
		// Clear existing fleets that are no longer active
		const activeFleetIds = new Set<number>();

		// Update fleets in transit for main player
		gameModel.mainPlayer.fleetsInTransit.forEach((fleet, index) => {
			const fleetId = index; // Use index as ID for now
			activeFleetIds.add(fleetId);

			let drawnFleet = drawnFleets.get(fleetId);

			if (!drawnFleet) {
				drawnFleet = new DrawnFleet(fleet, gameModel);
				drawnFleets.set(fleetId, drawnFleet);
				fleetLayer.add(drawnFleet.group);
			}

			drawnFleet.update(gameModel);
		});

		// Remove fleets that are no longer active
		for (const [fleetId, drawnFleet] of drawnFleets.entries()) {
			if (!activeFleetIds.has(fleetId)) {
				drawnFleet.group.remove();
				drawnFleet.destroyFleet();
				drawnFleets.delete(fleetId);
			}
		}
	}

	// Handle galaxy interaction
	function handleStageClick(e: any) {
		const pos = stage.getPointerPosition();
		console.log('Galaxy clicked at:', pos);
		// TODO: Implement planet selection, fleet commands, etc.
	}

	// Handle planet clicks for fleet command destination selection
	function handlePlanetClick(drawnPlanet: DrawnPlanet) {
		const planetData = drawnPlanet.getPlanetData();
		console.log('Planet clicked:', planetData.name, planetData.id);

		// Check if we're in destination selection mode
		const fleetState = $fleetCommandStore;
		if (fleetState.isSelectingDestination) {
			// Prevent selecting source planet as destination
			if (planetData.id === fleetState.sourcePlanetId) {
				console.log('Cannot select source planet as destination');
				return;
			}

			// Set the destination planet
			fleetCommandStore.setDestinationPlanet(planetData.id);
			console.log('Destination planet selected:', planetData.name);
		} else {
			// Normal planet selection - always select the planet to show info
			gameActions.selectPlanet(planetData.id);
			const gameModel = $clientGameModel;
			if (gameModel && gameModel.mainPlayerOwnedPlanets[planetData.id]) {
				console.log('Selected owned planet:', planetData.name);
			} else {
				console.log('Selected unowned planet:', planetData.name, '- showing info');
			}
		}
	}

	// Subscribe to fleet command state to update cursor
	$: {
		if (canvasContainer) {
			if ($fleetCommandStore.isSelectingDestination) {
				canvasContainer.style.cursor = 'crosshair';
			} else {
				canvasContainer.style.cursor = 'grab';
			}
		}
	}
</script>

<div
	bind:this={canvasContainer}
	class="galaxy-canvas h-full w-full rounded-lg border border-cyan-500/20 bg-black"
	on:click={handleStageClick}
	on:keydown
	role="button"
	tabindex="0"
	aria-label="Galaxy map - Click to interact with planets and fleets"
></div>

<style>
	.galaxy-canvas {
		cursor: grab;
	}

	.galaxy-canvas:active {
		cursor: grabbing;
	}
</style>
