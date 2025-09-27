<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { clientGameModel, gameGrid, gameActions, selectedPlanetId } from '$lib/stores/gameStore';
	import { fleetCommandStore } from '$lib/stores/fleetCommandStore';
	import type { ClientModelData, Grid } from 'astriarch-engine';
	import {
		PlanetHappinessType,
		PlanetImprovementType,
		GALAXY_WIDTH,
		GALAXY_HEIGHT
	} from 'astriarch-engine';
	import Konva from 'konva';
	import { DrawnPlanet } from './DrawnPlanet';
	import { DrawnFleet } from './DrawnFleet';
	import { DrawnTravelLine, TravelLineType } from './DrawnTravelLine';

	let canvasContainer: HTMLDivElement;
	let stage: Konva.Stage;
	let galaxyLayer: Konva.Layer;
	let fleetLayer: Konva.Layer;
	let uiLayer: Konva.Layer;

	let drawnPlanets: Map<number, DrawnPlanet> = new Map();
	let drawnFleets: Map<string, DrawnFleet> = new Map();
	let currentGrid: Grid | null = null;

	// Spatial index for fast planet lookups by hex coordinates
	let planetByHexCoords: Map<string, any> = new Map();

	let animationFrameId: number;
	let isInitialized = false;

	// Track pending selection to retry if planet not ready
	let pendingSelectionId: number | null = null;

	// Track the source of planet selection to determine if we should auto-pan
	let lastSelectionWasFromClick = false;

	// Pan and zoom state
	let zoomLevel = 1;
	let panX = 0;
	let panY = 0;
	const MIN_ZOOM = 0.3;
	const MAX_ZOOM = 3.0;
	const ZOOM_SPEED = 1.1;

	// Prospective travel line for fleet command destination previews
	let prospectiveTravelLine: DrawnTravelLine | null = null;
	let hoveredDestinationPlanetId: number | null = null;

	// Handle planet selection changes
	$: if ($selectedPlanetId !== null && isInitialized) {
		updatePlanetSelection($selectedPlanetId, !lastSelectionWasFromClick);
		lastSelectionWasFromClick = false; // Reset after processing
	} else if ($selectedPlanetId !== null && !isInitialized) {
		// Store the selection for when canvas is ready
		pendingSelectionId = $selectedPlanetId;
	} else if (isInitialized) {
		clearPlanetSelection();
		pendingSelectionId = null;
	}

	// Clean up prospective travel line when Fleet Command View is not active
	$: if (!$fleetCommandStore.isViewActive && prospectiveTravelLine) {
		// Hide when Fleet Command View is not active
		if (prospectiveTravelLine.isVisible()) {
			prospectiveTravelLine.animateOut(0.2);
		}
		hoveredDestinationPlanetId = null;
	}

	// Show prospective travel line for confirmed destination in fleet command mode
	// Only show this when we have a confirmed destination AND we're not actively selecting
	$: if (
		$fleetCommandStore.isViewActive &&
		$fleetCommandStore.destinationPlanetId &&
		$fleetCommandStore.sourcePlanetId &&
		!$fleetCommandStore.isSelectingDestination &&
		hoveredDestinationPlanetId === null // Don't interfere with hover previews
	) {
		// Show the confirmed destination line when we have both source and destination, and aren't actively selecting
		showConfirmedDestinationLine();
	}

	// Hide prospective travel line when destination is cleared (e.g., after sending ships)
	// Only trigger this when we're NOT actively selecting destination (i.e., we HAD a destination that got cleared)
	$: if (
		$fleetCommandStore.isViewActive &&
		!$fleetCommandStore.destinationPlanetId &&
		!$fleetCommandStore.isSelectingDestination && // Key addition: don't trigger during active selection
		prospectiveTravelLine &&
		prospectiveTravelLine.isVisible()
	) {
		// Hide the line when destination is cleared but view is still active
		prospectiveTravelLine.animateOut(0.2);
		hoveredDestinationPlanetId = null;
	}

	onMount(() => {
		initializeCanvas();
		startRenderLoop();
		isInitialized = true;

		// Handle any pending selection that came in before initialization
		if (pendingSelectionId !== null) {
			updatePlanetSelection(pendingSelectionId, true); // Auto-pan for pending selections
			pendingSelectionId = null;
		}
	});

	onDestroy(() => {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		// Clean up prospective travel line
		if (prospectiveTravelLine) {
			prospectiveTravelLine.destroy();
			prospectiveTravelLine = null;
		}
		stage?.destroy();
	});

	function initializeCanvas() {
		console.log('Initializing GalaxyCanvas...');

		// Get galaxy dimensions from the grid when available
		const grid = $gameGrid;
		const galaxyWidth = grid ? GALAXY_WIDTH : 800; // Default fallback
		const galaxyHeight = grid ? GALAXY_HEIGHT : 600; // Default fallback

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
		stage.on('mousemove', handleMouseMove);

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
			const galaxyWidth = GALAXY_WIDTH;
			const galaxyHeight = GALAXY_HEIGHT;
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

		// Clear and rebuild the spatial index
		planetByHexCoords.clear();

		// Track if any new planets were created
		let newPlanetsCreated = false;

		// First, render all owned planets (these have full PlanetData)
		for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
			allPlanetsToRender.add(planet.id);

			// Add to spatial index
			const hexKey = `${planet.boundingHexMidPoint.x},${planet.boundingHexMidPoint.y}`;
			planetByHexCoords.set(hexKey, planet);

			let drawnPlanet = drawnPlanets.get(planet.id);

			if (!drawnPlanet) {
				console.log('Creating new DrawnPlanet for owned planet:', planet.id, planet.name);
				drawnPlanet = new DrawnPlanet(planet, gameModel);
				drawnPlanets.set(planet.id, drawnPlanet);
				galaxyLayer.add(drawnPlanet.group);
				newPlanetsCreated = true;
			}

			drawnPlanet.update(gameModel);
		}

		// Then, render known but unowned planets (ClientPlanet data)
		for (const clientPlanet of gameModel.clientPlanets) {
			// Skip if we already rendered it as an owned planet
			if (allPlanetsToRender.has(clientPlanet.id)) continue;

			allPlanetsToRender.add(clientPlanet.id);

			// Add to spatial index
			const hexKey = `${clientPlanet.boundingHexMidPoint.x},${clientPlanet.boundingHexMidPoint.y}`;
			planetByHexCoords.set(hexKey, clientPlanet);

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
				newPlanetsCreated = true;
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

		// If new planets were created and we have a selected planet, make sure it's visually selected
		if (newPlanetsCreated && $selectedPlanetId !== null) {
			updatePlanetSelection($selectedPlanetId, !lastSelectionWasFromClick);
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

	// Handle mouse movement for prospective travel line preview during destination selection
	function handleMouseMove(e: any) {
		// Only handle mouse moves when Fleet Command View is active AND actively selecting destination
		// If we already have a confirmed destination, don't show hover previews
		if (
			!$fleetCommandStore.isViewActive ||
			!$fleetCommandStore.isSelectingDestination ||
			!currentGrid
		) {
			return;
		}

		const stagePos = stage.getPointerPosition();
		if (!stagePos) return;

		// Convert stage coordinates to galaxy layer coordinates
		const layerPos = galaxyLayer.getRelativePointerPosition();
		if (!layerPos) return;

		// Find the hex that contains this mouse position
		const hoveredHex = currentGrid.getHexAt(layerPos);
		if (!hoveredHex) {
			// When not over any hex during destination selection, hide prospective line
			if (prospectiveTravelLine && prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.animateOut(0.2);
			}
			hoveredDestinationPlanetId = null;
			return;
		}

		// Look for a planet at this hex position
		const hexKey = `${hoveredHex.midPoint.x},${hoveredHex.midPoint.y}`;
		const planetAtHex = planetByHexCoords.get(hexKey);

		if (planetAtHex && planetAtHex.id !== $fleetCommandStore.sourcePlanetId) {
			// Found a valid destination planet (not the source planet)
			if (hoveredDestinationPlanetId !== planetAtHex.id) {
				hoveredDestinationPlanetId = planetAtHex.id;
				updateProspectiveTravelLine(planetAtHex);
			}
		} else {
			// No planet or it's the source planet - hide prospective line
			if (prospectiveTravelLine && prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.hide();
			}
			hoveredDestinationPlanetId = null;
		}
	}

	// Update or create the prospective travel line from source to destination
	function updateProspectiveTravelLine(destinationPlanet: any) {
		const fleetState = $fleetCommandStore;
		if (!fleetState.sourcePlanetId || !destinationPlanet) return;

		// Find the source planet
		const sourcePlanet = $clientGameModel?.mainPlayerOwnedPlanets
			? $clientGameModel.mainPlayerOwnedPlanets[fleetState.sourcePlanetId]
			: null;

		if (!sourcePlanet) return;

		// Get planet positions from their hex coordinates
		const sourceX = sourcePlanet.boundingHexMidPoint.x;
		const sourceY = sourcePlanet.boundingHexMidPoint.y;
		const destX = destinationPlanet.boundingHexMidPoint.x;
		const destY = destinationPlanet.boundingHexMidPoint.y;

		// Create prospective travel line if it doesn't exist
		if (!prospectiveTravelLine) {
			prospectiveTravelLine = new DrawnTravelLine({
				type: TravelLineType.PROSPECTIVE,
				fromX: sourceX,
				fromY: sourceY,
				toX: destX,
				toY: destY,
				zIndex: 1000 // Ensure it renders on top
			});
			uiLayer.add(prospectiveTravelLine.group);

			// Animate the line drawing in smoothly
			prospectiveTravelLine.animateIn(0.3);
		} else {
			// Update existing line endpoints
			prospectiveTravelLine.updateEndpoints(sourceX, sourceY, destX, destY);

			// Show the line if it was hidden
			if (!prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.animateIn(0.2);
			}
		}

		// Redraw the layer to show the line
		uiLayer.batchDraw();
	}

	// Show prospective travel line for confirmed destination selection
	function showConfirmedDestinationLine() {
		const fleetState = $fleetCommandStore;
		if (!fleetState.sourcePlanetId || !fleetState.destinationPlanetId) return;

		// Find the source planet
		const sourcePlanet = $clientGameModel?.mainPlayerOwnedPlanets
			? $clientGameModel.mainPlayerOwnedPlanets[fleetState.sourcePlanetId]
			: null;

		if (!sourcePlanet) return;

		// Find the destination planet - check both owned planets and all client planets
		let destinationPlanet = null;

		// First check if it's one of the player's own planets
		if ($clientGameModel?.mainPlayerOwnedPlanets) {
			destinationPlanet = $clientGameModel.mainPlayerOwnedPlanets[fleetState.destinationPlanetId];
		}

		// If not found in owned planets, check all client planets
		if (!destinationPlanet && $clientGameModel?.clientPlanets) {
			destinationPlanet = $clientGameModel.clientPlanets.find(
				(planet) => planet.id === fleetState.destinationPlanetId
			);
		}

		if (!destinationPlanet) return;

		// Get planet positions from their hex coordinates
		const sourceX = sourcePlanet.boundingHexMidPoint.x;
		const sourceY = sourcePlanet.boundingHexMidPoint.y;
		const destX = destinationPlanet.boundingHexMidPoint.x;
		const destY = destinationPlanet.boundingHexMidPoint.y;

		// Create prospective travel line if it doesn't exist
		if (!prospectiveTravelLine) {
			prospectiveTravelLine = new DrawnTravelLine({
				type: TravelLineType.PROSPECTIVE,
				fromX: sourceX,
				fromY: sourceY,
				toX: destX,
				toY: destY,
				zIndex: 1000 // Ensure it renders on top
			});
			uiLayer.add(prospectiveTravelLine.group);

			// Animate the line drawing in smoothly
			prospectiveTravelLine.animateIn(0.3);
		} else {
			// Update existing line endpoints
			prospectiveTravelLine.updateEndpoints(sourceX, sourceY, destX, destY);

			// Show the line if it was hidden
			if (!prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.animateIn(0.2);
			}
		}

		// Reset hover state since this is showing confirmed destination
		hoveredDestinationPlanetId = null;

		// Redraw the layer to show the line
		uiLayer.batchDraw();
	}

	// Handle galaxy interaction with hex-based planet selection
	function handleStageClick(e: any) {
		const stagePos = stage.getPointerPosition();
		if (!stagePos || !currentGrid) return;

		// Convert stage coordinates to galaxy layer coordinates
		// This accounts for pan/zoom transformations
		const layerPos = galaxyLayer.getRelativePointerPosition();
		if (!layerPos) return;

		// Find the hex that contains this click position (using layer coordinates)
		const clickedHex = currentGrid.getHexAt(layerPos);
		if (!clickedHex) {
			return;
		}

		// Fast lookup using spatial index
		const hexKey = `${clickedHex.midPoint.x},${clickedHex.midPoint.y}`;
		const planetAtHex = planetByHexCoords.get(hexKey);

		if (planetAtHex) {
			handlePlanetSelection(planetAtHex);
		}
	}

	// Handle planet selection for fleet command destination selection and normal planet selection
	function handlePlanetSelection(planetData: any) {
		// Check if we're in destination selection mode
		const fleetState = $fleetCommandStore;
		if (fleetState.isSelectingDestination) {
			// Prevent selecting source planet as destination
			if (planetData.id === fleetState.sourcePlanetId) {
				return;
			}

			// Set the destination planet
			fleetCommandStore.setDestinationPlanet(planetData.id);
		} else {
			// Normal planet selection - always select the planet to show info
			lastSelectionWasFromClick = true; // Mark as click-initiated selection
			gameActions.selectPlanet(planetData.id);
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
	function updatePlanetSelection(selectedId: number, shouldZoomTo: boolean = false) {
		// Clear all previous selections
		drawnPlanets.forEach((drawnPlanet) => {
			drawnPlanet.setSelected(false);
		});

		// Set the newly selected planet
		const selectedPlanet = drawnPlanets.get(selectedId);
		if (selectedPlanet) {
			selectedPlanet.setSelected(true);
			console.log('Updated planet selection for planet:', selectedId);

			// Auto-pan to planet if requested (for programmatic selections)
			if (shouldZoomTo) {
				zoomToPlanet(selectedPlanet);
			}
		} else {
			console.log(
				'Planet not yet drawn for selection:',
				selectedId,
				'Available planets:',
				Array.from(drawnPlanets.keys())
			);
			// Planet might not be drawn yet - it will be handled in updatePlanets when created
		}
	}

	function clearPlanetSelection() {
		// Clear all planet selections
		drawnPlanets.forEach((drawnPlanet) => {
			drawnPlanet.setSelected(false);
		});
	}

	function zoomToPlanet(drawnPlanet: DrawnPlanet) {
		if (!stage) return;

		const planetData = drawnPlanet.getPlanetData();
		const planetWorldPos = {
			x: planetData.boundingHexMidPoint.x,
			y: planetData.boundingHexMidPoint.y
		};

		// Calculate the desired position to place the planet in the top half of the screen
		const stageWidth = stage.width();
		const stageHeight = stage.height();
		const currentScale = stage.scaleX();

		// Target position: center horizontally, 1/3 from top vertically
		const targetScreenX = stageWidth / 2;
		const targetScreenY = stageHeight / 3;

		// Calculate what the stage position should be to place the planet at the target screen position
		const targetStageX = targetScreenX - planetWorldPos.x * currentScale;
		const targetStageY = targetScreenY - planetWorldPos.y * currentScale;

		// Animate to the new position
		const currentPos = stage.position();
		const deltaX = targetStageX - currentPos.x;
		const deltaY = targetStageY - currentPos.y;

		// Only animate if the movement is significant (more than 50 pixels)
		if (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50) {
			console.log('Zooming to planet:', planetData.name, 'at position:', planetWorldPos);

			// Use Konva's built-in animation
			stage.to({
				x: targetStageX,
				y: targetStageY,
				duration: 0.8, // 800ms animation
				easing: Konva.Easings.EaseOut
			});

			// Update our internal pan tracking
			setTimeout(() => {
				updatePanPosition();
			}, 800);
		}
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
