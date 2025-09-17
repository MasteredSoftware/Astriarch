<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { clientGameModel, gameGrid, gameActions, selectedPlanetId } from '$lib/stores/gameStore';
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
	let drawnFleets: Map<string, DrawnFleet> = new Map();
	let currentGrid: Grid | null = null;

	let animationFrameId: number;
	let isInitialized = false;

	// Pan and zoom state
	let zoomLevel = 1;
	let panX = 0;
	let panY = 0;
	const MIN_ZOOM = 0.3;
	const MAX_ZOOM = 3.0;
	const ZOOM_SPEED = 1.1;

	// Handle planet selection changes
	$: if ($selectedPlanetId !== null) {
		updatePlanetSelection($selectedPlanetId);
	} else {
		clearPlanetSelection();
	}

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
			draggable: true // Enable panning the galaxy view
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

		// Initialize zoom state
		zoomLevel = scale;
		updatePanPosition();

		// Handle window resize
		window.addEventListener('resize', handleResize);

		// Add zoom and pan event listeners
		stage.on('wheel', handleZoom);
		stage.on('dragmove', updatePanPosition);

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
			const oldWidth = stage.width();
			const oldHeight = stage.height();
			const newWidth = window.innerWidth - 300;
			const newHeight = window.innerHeight - 200;

			stage.width(newWidth);
			stage.height(newHeight);

			// Maintain relative position after resize
			const pos = stage.position();
			const widthRatio = newWidth / oldWidth;
			const heightRatio = newHeight / oldHeight;

			stage.position({
				x: pos.x * widthRatio,
				y: pos.y * heightRatio
			});

			updatePanPosition();
		}
	}

	function handleZoom(e: any) {
		e.evt.preventDefault();

		const oldScale = stage.scaleX();
		const pointer = stage.getPointerPosition();

		if (!pointer) return;

		const scaleBy = ZOOM_SPEED;
		const newScale =
			e.evt.deltaY > 0
				? Math.max(oldScale / scaleBy, MIN_ZOOM)
				: Math.min(oldScale * scaleBy, MAX_ZOOM);

		// Zoom toward the mouse pointer
		const newPos = {
			x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
			y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale)
		};

		stage.scale({ x: newScale, y: newScale });
		stage.position(newPos);

		zoomLevel = newScale;
		updatePanPosition();
	}

	function updatePanPosition() {
		const pos = stage.position();
		panX = pos.x;
		panY = pos.y;
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
		// Clear all existing fleets and remake them from current game state
		// This matches the approach used in the old system and ensures animations
		// continue properly after game state refreshes
		for (const drawnFleet of drawnFleets.values()) {
			drawnFleet.group.remove();
			drawnFleet.destroyFleet();
		}
		drawnFleets.clear();

		// Create drawn fleets for all fleets in transit
		gameModel.mainPlayer.fleetsInTransit.forEach((fleet, index) => {
			const fleetId = index.toString(); // Simple index-based ID
			const drawnFleet = new DrawnFleet(fleet, gameModel);
			drawnFleets.set(fleetId, drawnFleet);
			fleetLayer.add(drawnFleet.group);
		});

		// TODO: Add support for outgoing fleets from owned planets
		// for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
		//     planet.outgoingFleets.forEach((fleet, index) => {
		//         const fleetId = `outgoing_${planet.id}_${index}`;
		//         const drawnFleet = new DrawnFleet(fleet, gameModel);
		//         drawnFleets.set(fleetId, drawnFleet);
		//         fleetLayer.add(drawnFleet.group);
		//     });
		// }
	}

	// Handle galaxy interaction with hex-based planet selection
	function handleStageClick(e: any) {
		const stagePos = stage.getPointerPosition();
		if (!stagePos || !currentGrid) return;

		// Convert stage coordinates to galaxy layer coordinates
		// This accounts for pan/zoom transformations
		const layerPos = galaxyLayer.getRelativePointerPosition();
		if (!layerPos) return;

		console.log('Galaxy clicked at stage pos:', stagePos, 'layer pos:', layerPos);

		// Find the hex that contains this click position (using layer coordinates)
		const clickedHex = currentGrid.getHexAt(layerPos);
		if (!clickedHex) {
			console.log('No hex found at click position');
			return;
		}

		console.log('Clicked hex:', clickedHex.data.id, 'at midpoint:', clickedHex.midPoint);

		// Find if there's a planet at this hex location
		const gameModel = $clientGameModel;
		if (!gameModel) return;

		// Look for a planet at this hex midpoint
		let planetAtHex: any = null;

		// Check owned planets first
		for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
			if (
				planet.boundingHexMidPoint.x === clickedHex.midPoint.x &&
				planet.boundingHexMidPoint.y === clickedHex.midPoint.y
			) {
				planetAtHex = planet;
				break;
			}
		}

		// If not found in owned planets, check known planets
		if (!planetAtHex) {
			for (const clientPlanet of gameModel.clientPlanets) {
				if (
					clientPlanet.boundingHexMidPoint.x === clickedHex.midPoint.x &&
					clientPlanet.boundingHexMidPoint.y === clickedHex.midPoint.y
				) {
					planetAtHex = clientPlanet;
					break;
				}
			}
		}

		if (planetAtHex) {
			console.log('Found planet at hex:', planetAtHex.name, planetAtHex.id);
			handlePlanetSelection(planetAtHex);
		} else {
			console.log('No planet found at clicked hex');
			// Clear planet selection when clicking empty space
			gameActions.selectPlanet(null);
		}
	}

	// Handle planet selection for fleet command destination selection and normal planet selection
	function handlePlanetSelection(planetData: any) {
		console.log('Planet selected:', planetData.name, planetData.id);

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

	// Planet selection management functions
	function updatePlanetSelection(selectedId: number) {
		// Clear all previous selections
		drawnPlanets.forEach((drawnPlanet) => {
			drawnPlanet.setSelected(false);
		});

		// Set the newly selected planet
		const selectedPlanet = drawnPlanets.get(selectedId);
		if (selectedPlanet) {
			selectedPlanet.setSelected(true);
		}
	}

	function clearPlanetSelection() {
		// Clear all planet selections
		drawnPlanets.forEach((drawnPlanet) => {
			drawnPlanet.setSelected(false);
		});
	}
</script>

<div
	bind:this={canvasContainer}
	class="galaxy-canvas relative h-full w-full rounded-lg border border-cyan-500/20 bg-black"
	on:click={handleStageClick}
	on:keydown
	role="button"
	tabindex="0"
	aria-label="Galaxy map - Click to interact with planets and fleets"
>
	<!-- Zoom level indicator -->
	<div
		class="absolute top-4 right-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400"
	>
		Zoom: {Math.round(zoomLevel * 100)}%
	</div>

	<!-- Controls hint -->
	<div
		class="absolute bottom-4 left-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400/70"
	>
		Mouse wheel: zoom • Drag: pan
	</div>
</div>

<style>
	.galaxy-canvas {
		cursor: grab;
		user-select: none; /* Prevent text selection during dragging */
	}

	.galaxy-canvas:active {
		cursor: grabbing;
	}

	/* Show crosshair when selecting destination */
	.galaxy-canvas.destination-mode {
		cursor: crosshair !important;
	}
</style>
