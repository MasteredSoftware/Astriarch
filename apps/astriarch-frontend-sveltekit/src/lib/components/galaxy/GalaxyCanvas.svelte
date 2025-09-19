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

	// Performance optimization: simple dirty flags for event-driven rendering
	let galaxyLayerDirty = true; // Background, grid, planets
	let fleetLayerDirty = true;  // Fleets in transit
	let uiLayerDirty = true;     // Selection indicators, UI overlays
	
	// Data synchronization flags - only update game objects when needed
	let planetDataDirty = true;  // Planet data needs to be synchronized
	let fleetDataDirty = true;   // Fleet data needs to be synchronized
	
	// Simple state tracking for basic optimizations
	let lastGameModelUpdate = 0;
	let hasActiveFleets = false;
	
	// Performance monitoring with detailed frame timing
	let renderStats = {
		frameCount: 0,
		lastFpsCheck: Date.now(),
		currentFps: 0,
		frameTimings: [] as number[],
		avgFrameTime: 0,
		maxFrameTime: 0,
		minFrameTime: Infinity,
		layerRenderTimes: {
			galaxy: 0,
			fleet: 0,
			ui: 0
		},
		totalRenderTime: 0,
		skippedFrames: 0,
		activeFrames: 0
	};

	// Pan and zoom state
	let zoomLevel = 1;
	let panX = 0;
	let panY = 0;
	const MIN_ZOOM = 0.3;
	const MAX_ZOOM = 3.0;
	const ZOOM_SPEED = 1.1;

	onMount(() => {
		initializeCanvas();
		startRenderLoop();
		isInitialized = true;
	});

	// ============================================================================
	// PUBLIC API - Event-driven update methods for external components to call
	// ============================================================================
	
	// Call when planets change (ships built, improvements added, etc.)
	export function markPlanetsChanged() {
		galaxyLayerDirty = true;
		planetDataDirty = true;
		wakeUpRenderLoop();
	}
	
	// Call when fleets are added, removed, or move
	export function markFleetsChanged() {
		fleetLayerDirty = true;
		fleetDataDirty = true;
		wakeUpRenderLoop();
	}
	
	// Call when planet selection changes
	export function markSelectionChanged() {
		uiLayerDirty = true;
		wakeUpRenderLoop();
	}
	
	// Call when user zooms or pans
	export function markViewChanged() {
		galaxyLayerDirty = true;
		fleetLayerDirty = hasActiveFleets;
		uiLayerDirty = true;
		wakeUpRenderLoop();
	}
	
	// Call when game model updates (force refresh everything)
	export function markGameStateChanged() {
		galaxyLayerDirty = true;
		fleetLayerDirty = true;
		uiLayerDirty = true;
		planetDataDirty = true;
		fleetDataDirty = true;
		wakeUpRenderLoop();
	}

	// ============================================================================
	// INTERNAL RENDERING SYSTEM
	// ============================================================================

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

		// Add some stars for atmosphere (reduce count for better performance)
		for (let i = 0; i < 50; i++) { // Reduced from 100 to 50
			const star = new Konva.Circle({
				x: Math.random() * galaxyWidth,
				y: Math.random() * galaxyHeight,
				radius: Math.random() * 1.5 + 0.5,
				fill: `rgba(255, 255, 255, ${Math.random() * 0.6 + 0.4})`,
				shadowColor: 'white',
				shadowBlur: Math.random() * 2,
				listening: false // Disable event listening for performance
			});
			galaxyLayer.add(star);
		}

		// Don't cache the galaxy layer here since we'll be adding planets to it
		// galaxyLayer.cache();
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
				closed: true,
				listening: false // Disable event listening for performance
			});
			galaxyLayer.add(hexShape);

			// Only add hex labels at higher zoom levels for performance
			if (zoomLevel > 0.8) {
				const label = new Konva.Text({
					x: hex.midPoint.x - 8,
					y: hex.midPoint.y - 4,
					text: hex.data.id.toString(),
					fontSize: 7,
					fill: 'rgba(0, 255, 255, 0.2)',
					align: 'center',
					fontFamily: 'monospace',
					listening: false // Disable event listening for performance
				});
				galaxyLayer.add(label);
			}
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

		// Mark layers as needing updates due to zoom
		markViewChanged();
	}

	function updatePanPosition() {
		const pos = stage.position();
		panX = pos.x;
		panY = pos.y;

		// Mark layers as needing updates due to pan
		markViewChanged();
	}

	function startRenderLoop() {
		function render() {
			const frameStartTime = performance.now();
			let renderingOccurred = false;
			
			// Update performance stats
			renderStats.frameCount++;
			const now = Date.now();
			if (now - renderStats.lastFpsCheck > 1000) {
				renderStats.currentFps = renderStats.frameCount;
				renderStats.frameCount = 0;
				renderStats.lastFpsCheck = now;
				
				// Calculate frame timing averages over the last second
				if (renderStats.frameTimings.length > 0) {
					renderStats.avgFrameTime = renderStats.frameTimings.reduce((a, b) => a + b, 0) / renderStats.frameTimings.length;
					renderStats.maxFrameTime = Math.max(...renderStats.frameTimings);
					renderStats.minFrameTime = Math.min(...renderStats.frameTimings);
					renderStats.frameTimings = []; // Reset for next second
				}
			}

			// Update game objects if needed (basic model sync)
			updateGameObjects();
			
			// Only redraw layers that are dirty
			let layerRenderStartTime = performance.now();
			if (galaxyLayerDirty) {
				galaxyLayer.batchDraw();
				renderStats.layerRenderTimes.galaxy = performance.now() - layerRenderStartTime;
				galaxyLayerDirty = false;
				renderingOccurred = true;
			}
			
			layerRenderStartTime = performance.now();
			if (fleetLayerDirty) {
				fleetLayer.batchDraw();
				renderStats.layerRenderTimes.fleet = performance.now() - layerRenderStartTime;
				fleetLayerDirty = false;
				renderingOccurred = true;
			}
			
			layerRenderStartTime = performance.now();
			if (uiLayerDirty) {
				uiLayer.batchDraw();
				renderStats.layerRenderTimes.ui = performance.now() - layerRenderStartTime;
				uiLayerDirty = false;
				renderingOccurred = true;
			}
			
			// Calculate total frame time
			const frameEndTime = performance.now();
			const totalFrameTime = frameEndTime - frameStartTime;
			renderStats.frameTimings.push(totalFrameTime);
			renderStats.totalRenderTime = totalFrameTime;
			
			// Track frame activity
			if (renderingOccurred) {
				renderStats.activeFrames++;
			} else {
				renderStats.skippedFrames++;
			}
			
			// Continue immediately if layers are dirty or we have active fleets (for animation)
			const shouldContinue = galaxyLayerDirty || fleetLayerDirty || uiLayerDirty || hasActiveFleets;
			
			if (shouldContinue) {
				// Immediate next frame for active rendering or fleet animations
				animationFrameId = requestAnimationFrame(render);
			} else {
				// Nothing is happening - check much less frequently to save CPU
				setTimeout(() => {
					animationFrameId = requestAnimationFrame(render);
				}, 500); // Check every 500ms instead of every frame
			}
		}
		render();
	}

	function updateGameObjects(): void {
		if (!$clientGameModel) {
			return;
		}

		// Check if game model has been updated
		const currentModelTimestamp = $clientGameModel.lastSnapshotTime || Date.now();
		if (currentModelTimestamp !== lastGameModelUpdate) {
			lastGameModelUpdate = currentModelTimestamp;
			
			// Game model changed - mark data as needing update
			planetDataDirty = true;
			fleetDataDirty = true;
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
			markGameStateChanged(); // Force full refresh
		}

		// Only update planet/fleet data when it's actually dirty
		if (planetDataDirty) {
			updatePlanets($clientGameModel);
			planetDataDirty = false;
		}
		
		if (fleetDataDirty) {
			updateFleets($clientGameModel);
			fleetDataDirty = false;
		}
	}

	function updatePlanets(gameModel: ClientModelData): void {
		const allPlanetsToRender = new Set<number>();

		// Clear and rebuild the spatial index
		planetByHexCoords.clear();

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
			}

			// Update planet - since update() returns void, we assume visual changes occurred
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
			}

			// Update planet - since update() returns void, we assume visual changes occurred
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

	function updateFleets(gameModel: ClientModelData): void {
		// Clear all existing fleets and rebuild from current game state
		for (const drawnFleet of drawnFleets.values()) {
			drawnFleet.group.remove();
			drawnFleet.destroyFleet();
		}
		drawnFleets.clear();

		// Create drawn fleets for all fleets in transit
		gameModel.mainPlayer.fleetsInTransit.forEach((fleet, index) => {
			const fleetId = index.toString();
			const drawnFleet = new DrawnFleet(fleet, gameModel);
			drawnFleets.set(fleetId, drawnFleet);
			fleetLayer.add(drawnFleet.group);
		});

		// Update fleet status for render loop optimization
		hasActiveFleets = gameModel.mainPlayer.fleetsInTransit.length > 0;

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

	// Wake up the render loop from idle state
	function wakeUpRenderLoop() {
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}
		animationFrameId = requestAnimationFrame(() => {
			// Restart the render loop
			startRenderLoop();
		});
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

	// Reactive updates for planet selection
	$: if ($selectedPlanetId !== null) {
		updatePlanetSelection($selectedPlanetId);
		markSelectionChanged();
	} else {
		clearPlanetSelection();
		markSelectionChanged();
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

	// Performance logging for analysis
	function logPerformanceStats() {
		const stats = {
			averageFrameTime: renderStats.avgFrameTime,
			minFrameTime: renderStats.minFrameTime === Infinity ? 0 : renderStats.minFrameTime,
			maxFrameTime: renderStats.maxFrameTime,
			currentFPS: renderStats.currentFps,
			activeFrames: renderStats.activeFrames,
			skippedFrames: renderStats.skippedFrames,
			frameSkipRatio: renderStats.skippedFrames / (renderStats.activeFrames + renderStats.skippedFrames),
			layerRenderTimes: renderStats.layerRenderTimes,
			planetsRendered: drawnPlanets.size,
			fleetsRendered: drawnFleets.size,
			hasActiveFleets: hasActiveFleets,
			eventDrivenOptimization: {
				idleOptimization: renderStats.skippedFrames > renderStats.activeFrames ? 'ACTIVE' : 'INACTIVE',
				renderMode: 'EVENT_DRIVEN'
			}
		};
		
		console.table(stats);
		console.log('Event-Driven Performance:', {
			'Has Active Fleets': hasActiveFleets,
			'Frame Skip Efficiency': `${(stats.frameSkipRatio * 100).toFixed(1)}%`,
			'Render Mode': 'Event-Driven'
		});
		return stats;
	}

	// Make performance logging available globally for testing
	if (typeof window !== 'undefined') {
		(window as any).galaxyPerformanceStats = logPerformanceStats;
	}
</script>

<!-- Wrapper container for both canvas and UI overlays -->
<div class="galaxy-container relative h-full w-full">
	<!-- Konva canvas container (no UI elements inside) -->
	<div
		bind:this={canvasContainer}
		class="galaxy-canvas absolute inset-0 rounded-lg border border-cyan-500/20 bg-black"
		on:click={handleStageClick}
		on:keydown
		role="button"
		tabindex="0"
		aria-label="Galaxy map - Click to interact with planets and fleets"
	>
	</div>

	<!-- UI overlays rendered outside of Konva container -->
	<!-- Zoom level indicator -->
	<div
		class="absolute top-4 left-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400 pointer-events-none"
	>
		Zoom: {Math.round(zoomLevel * 100)}%
	</div>

	<!-- Performance monitor with detailed metrics -->
	{#if renderStats.currentFps > 0}
		<div
			class="absolute top-4 right-4 z-10 rounded border border-cyan-500/30 bg-black/90 px-3 py-2 text-xs text-cyan-400 font-mono pointer-events-none"
			style="min-width: 280px;"
		>
			<div class="grid grid-cols-2 gap-x-4 gap-y-1">
				<div>FPS: {renderStats.currentFps}</div>
				<div>Frame: {renderStats.avgFrameTime.toFixed(2)}ms</div>
				<div>Min: {renderStats.minFrameTime === Infinity ? '0' : renderStats.minFrameTime.toFixed(2)}ms</div>
				<div>Max: {renderStats.maxFrameTime.toFixed(2)}ms</div>
				<div>Active: {renderStats.activeFrames}</div>
				<div>Skipped: {renderStats.skippedFrames}</div>
			</div>
			<div class="mt-2 pt-2 border-t border-cyan-500/20">
				<div class="text-xs text-cyan-400/70">Layer Render Times:</div>
				<div class="grid grid-cols-3 gap-x-2 text-xs">
					<div>G: {renderStats.layerRenderTimes.galaxy.toFixed(2)}ms</div>
					<div>F: {renderStats.layerRenderTimes.fleet.toFixed(2)}ms</div>
					<div>U: {renderStats.layerRenderTimes.ui.toFixed(2)}ms</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Controls hint -->
	<div
		class="absolute bottom-4 left-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400/70 pointer-events-none"
	>
		Mouse wheel: zoom • Drag: pan
	</div>
</div>

<style>
	.galaxy-container {
		/* Container for both canvas and UI overlays */
	}

	.galaxy-canvas {
		cursor: grab;
		user-select: none; /* Prevent text selection during dragging */
	}

	.galaxy-canvas:active {
		cursor: grabbing;
	}
</style>
