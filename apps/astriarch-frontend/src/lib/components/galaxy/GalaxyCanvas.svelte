<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		clientGameModel,
		gameGrid,
		gameActions,
		selectedPlanetId
	} from '#lib/stores/gameStore.ts';
	import { fleetCommandStore } from '#lib/stores/fleetCommandStore.ts';
	import { layoutMode, layoutDimensions } from '#lib/stores/layoutStore.ts';
	import { type ClientModelData, type Grid, GALAXY_WIDTH, GALAXY_HEIGHT } from 'astriarch-engine';
	import Konva from 'konva';
	import { DrawnPlanet } from './DrawnPlanet';
	import { DrawnFleet } from './DrawnFleet';
	import { keyFleets } from './fleetKeys';
	import { DrawnTravelLine, TravelLineType } from './DrawnTravelLine';
	import { perfCount, perfStart, perfEnd, perfRegisterKonvaStage } from '#lib/perf/perfMonitor.ts';

	let canvasContainer: HTMLDivElement;
	let stage: Konva.Stage;
	let galaxyLayer: Konva.Layer;
	let fleetLayer: Konva.Layer;
	let uiLayer: Konva.Layer;

	let drawnPlanets: Map<number, DrawnPlanet> = new Map();
	// Keyed by keyFleets(): the fleet id, or `${id}#${n}` for a repeated id.
	let drawnFleets: Map<string, DrawnFleet> = new Map();
	// Duplicate fleet ids already reported, so the warning isn't logged every tick.
	const warnedDuplicateFleetIds = new Set<number>();
	let currentGrid: Grid | null = null;
	// Stars, hex grid and hex labels; rebuilt only when the grid changes.
	let backgroundGroup: Konva.Group | null = null;

	// Spatial index for fast planet lookups by hex coordinates.
	// Rebuilt only when the set of planets changes (see planetSetKey).
	type PlanetLocation = { id: number; boundingHexMidPoint: { x: number; y: number } };
	let planetByHexCoords: Map<string, PlanetLocation> = new Map();
	let planetSetKey = '';

	// Event-driven canvas updates: store changes mark the canvas dirty and a
	// single update is coalesced into a microtask. Nothing polls.
	let updateScheduled = false;
	// Runs only while fleets are in transit; see updateFleetAnimation().
	let fleetAnimation: Konva.Animation | null = null;
	// Smallest on-screen movement (px) worth redrawing a fleet for.
	const FLEET_MIN_MOVE_SCREEN_PX = 0.5;
	let unsubscribers: Array<() => void> = [];
	let isInitialized = false;

	// Track pending selection to retry if planet not ready
	let pendingSelectionId: number | null = null;

	// Track the source of planet selection to determine if we should auto-pan
	let lastSelectionWasFromClick = false;

	// Pan and zoom state
	let zoomLevel = 1;
	const MIN_ZOOM = 0.3;
	const MAX_ZOOM = 3.0;
	const ZOOM_SPEED = 1.1;

	// Reactive canvas dimensions based on layout mode
	$: canvasWidth = $layoutDimensions.canvasWidth;
	$: canvasHeight = $layoutDimensions.canvasHeight;

	// React to layout changes
	$: if (stage && ($layoutMode || canvasWidth || canvasHeight)) {
		handleResize();
	}

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
		unsubscribers = [
			clientGameModel.subscribe(scheduleCanvasUpdate),
			gameGrid.subscribe(scheduleCanvasUpdate)
		];
		isInitialized = true;

		// Handle any pending selection that came in before initialization
		if (pendingSelectionId !== null) {
			updatePlanetSelection(pendingSelectionId, true); // Auto-pan for pending selections
			pendingSelectionId = null;
		}
	});

	onDestroy(() => {
		unsubscribers.forEach((unsubscribe) => unsubscribe());
		unsubscribers = [];
		fleetAnimation?.stop();
		fleetAnimation = null;
		cancelPendingPan();
		stopPan();
		window.removeEventListener('resize', handleResize);
		// Clean up prospective travel line
		if (prospectiveTravelLine) {
			prospectiveTravelLine.destroy();
			prospectiveTravelLine = null;
		}
		stage?.destroy();
	});

	function initializeCanvas() {
		console.log('Initializing GalaxyCanvas...');

		// Set Konva performance optimizations globally
		Konva.pixelRatio = 1;

		// Get galaxy dimensions from the grid when available
		const grid = $gameGrid;
		const galaxyWidth = grid ? GALAXY_WIDTH : 800; // Default fallback
		const galaxyHeight = grid ? GALAXY_HEIGHT : 600; // Default fallback

		console.log('Galaxy dimensions:', { galaxyWidth, galaxyHeight, hasGrid: !!grid });

		if (grid) {
			currentGrid = grid;
			console.log('Grid loaded w`ith', grid.hexes.length, 'hexes');
		}

		// Create Konva stage with proper galaxy dimensions
		stage = new Konva.Stage({
			container: canvasContainer,
			width: canvasWidth,
			height: canvasHeight,
			draggable: true, // Enable panning the galaxy view
			perfectDrawEnabled: false,
			listening: false // Disable events
		});

		// Create layers (back to front rendering order)
		galaxyLayer = new Konva.Layer({ name: 'galaxy' });
		fleetLayer = new Konva.Layer({ name: 'fleet' });
		uiLayer = new Konva.Layer({ name: 'ui' });

		// Performance optimization: disable listening for layers that don't need events
		galaxyLayer.listening(false);
		fleetLayer.listening(false);
		uiLayer.listening(false);

		stage.add(galaxyLayer);
		stage.add(fleetLayer);
		stage.add(uiLayer);

		// No-op unless perf instrumentation is enabled (?perf=1).
		perfRegisterKonvaStage(Konva, stage);

		// Add space background with proper galaxy bounds
		createSpaceBackground(galaxyWidth, galaxyHeight);

		// Center the view on the galaxy
		const scale = Math.min(canvasWidth / galaxyWidth, canvasHeight / galaxyHeight) * 0.8; // Leave some padding

		stage.scale({ x: scale, y: scale });
		stage.position({
			x: (canvasWidth - galaxyWidth * scale) / 2,
			y: (canvasHeight - galaxyHeight * scale) / 2
		});

		// Initialize zoom state
		zoomLevel = scale;

		// Handle window resize
		window.addEventListener('resize', handleResize);

		// Add zoom and pan event listeners
		stage.on('wheel', handleZoom);
		// A drag or zoom takes over from an in-progress auto-pan
		stage.on('dragstart wheel', () => {
			cancelPendingPan();
			stopPan();
		});
		stage.on('mousemove', handleMouseMove);
		stage.on('mouseout', handleMouseOut);

		console.log('GalaxyCanvas initialization complete');
	}

	function createSpaceBackground(galaxyWidth = 1000, galaxyHeight = 800) {
		backgroundGroup?.destroy();
		backgroundGroup = new Konva.Group({ name: 'background', listening: false });
		galaxyLayer.add(backgroundGroup);
		backgroundGroup.moveToBottom();

		// Create background that covers the entire galaxy area
		const background = new Konva.Rect({
			x: 0,
			y: 0,
			width: galaxyWidth,
			height: galaxyHeight,
			fill: '#000011',
			perfectDrawEnabled: false,
			listening: false // Disable events
		});
		backgroundGroup.add(background);

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
				shadowBlur: Math.random() * 2,
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			backgroundGroup.add(star);
		}
	}

	function createHexGrid() {
		if (!currentGrid || !backgroundGroup) return;

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
				perfectDrawEnabled: false,
				shadowForStrokeEnabled: false,
				listening: false // Disable events
			});
			backgroundGroup.add(hexShape);

			// Add hex labels for debugging (smaller and more subtle)
			const label = new Konva.Text({
				x: hex.midPoint.x - 8,
				y: hex.midPoint.y - 4,
				text: hex.data.id.toString(),
				fontSize: 7,
				fill: 'rgba(0, 255, 255, 0.2)',
				align: 'center',
				fontFamily: 'monospace',
				perfectDrawEnabled: false,
				listening: false // Disable events
			});
			backgroundGroup.add(label);
		}
	}

	function handleResize() {
		if (stage) {
			const oldWidth = stage.width();
			const oldHeight = stage.height();
			const newWidth = canvasWidth;
			const newHeight = canvasHeight;

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
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
	}

	/**
	 * Marks the canvas dirty. Called by store subscriptions; several changes in
	 * the same task are coalesced into one update.
	 */
	function scheduleCanvasUpdate() {
		if (updateScheduled || !stage) return;
		updateScheduled = true;
		queueMicrotask(() => {
			updateScheduled = false;
			if (!stage) return;
			perfCount('canvas.update');
			const t = perfStart();
			updateGameObjects();
			perfEnd('canvas.updateGameObjects', t);
		});
	}

	function updateGameObjects() {
		// Rebuild the background only when the grid changes. It lives in its own
		// group, so planets on the galaxy layer are kept.
		const grid = $gameGrid;
		if (grid && currentGrid !== grid) {
			currentGrid = grid;
			createSpaceBackground(GALAXY_WIDTH, GALAXY_HEIGHT);
		}

		if (!$clientGameModel) {
			return;
		}

		// Konva redraws a layer automatically when a node attribute changes, and
		// the Drawn* classes only touch attributes whose values changed, so no
		// explicit batchDraw() is needed (or wanted) here.
		updatePlanets($clientGameModel);
		updateFleets($clientGameModel);
	}

	function updatePlanets(gameModel: ClientModelData) {
		const allPlanetsToRender = new Set<number>();
		const planetLocations: PlanetLocation[] = [];

		// Track if any new planets were created
		let newPlanetsCreated = false;

		// First, render all owned planets (these have full PlanetData)
		for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
			allPlanetsToRender.add(planet.id);
			planetLocations.push(planet);

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
			planetLocations.push(clientPlanet);

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
						id: 0,
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
					waypointBoundingHexMidPoint: null,
					nextShipId: 1
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
				drawnPlanet.destroy();
				drawnPlanets.delete(planetId);
			}
		}

		// Rebuild the spatial index only when the set of planets changes
		const setKey = planetLocations.map((p) => p.id).join(',');
		if (setKey !== planetSetKey) {
			planetSetKey = setKey;
			planetByHexCoords = new Map(
				planetLocations.map((p) => [
					`${p.boundingHexMidPoint.x},${p.boundingHexMidPoint.y}`,
					{ id: p.id, boundingHexMidPoint: { ...p.boundingHexMidPoint } }
				])
			);
		}

		// If new planets were created and we have a selected planet, make sure it's visually selected
		if (newPlanetsCreated && $selectedPlanetId !== null) {
			updatePlanetSelection($selectedPlanetId, !lastSelectionWasFromClick);
		}
	}

	function updateFleets(gameModel: ClientModelData) {
		// Keep one DrawnFleet per fleet and update it in place. Fleet ids are
		// player-scoped, and only the main player's fleets are drawn. Ids can
		// collide (the client and server fleet id counters can diverge), so a
		// repeated id gets a derived key instead of hiding a fleet.
		const { keyed, duplicateIds } = keyFleets(gameModel.mainPlayer.fleetsInTransit);
		for (const id of duplicateIds) {
			if (warnedDuplicateFleetIds.has(id)) continue;
			warnedDuplicateFleetIds.add(id);
			console.warn(`GalaxyCanvas: duplicate fleet id ${id}; drawing each fleet with its own key`);
		}

		const seen = new Set<string>();
		for (const [key, fleet] of keyed) {
			seen.add(key);
			const drawnFleet = drawnFleets.get(key);
			if (drawnFleet) {
				drawnFleet.update(gameModel, fleet);
			} else {
				const created = new DrawnFleet(fleet, gameModel);
				drawnFleets.set(key, created);
				fleetLayer.add(created.group);
			}
		}

		for (const [key, drawnFleet] of drawnFleets) {
			if (!seen.has(key)) {
				drawnFleet.destroyFleet();
				drawnFleets.delete(key);
			}
		}

		updateFleetAnimation();
	}

	/**
	 * The model advances every MS_PER_TICK. While fleets are in transit, a
	 * Konva.Animation moves them smoothly between ticks; it starts with the first
	 * fleet and stops when the last one arrives. Each frame it only computes
	 * positions; a fleet's nodes change (and the fleet layer redraws) only when
	 * it moved at least FLEET_MIN_MOVE_SCREEN_PX on screen.
	 */
	function updateFleetAnimation() {
		if (drawnFleets.size === 0) {
			fleetAnimation?.stop();
			return;
		}
		fleetAnimation ??= new Konva.Animation(() => {
			perfCount('fleetAnimation.frame');
			const now = performance.now();
			const minLayerPx = FLEET_MIN_MOVE_SCREEN_PX / stage.scaleX();
			for (const drawnFleet of drawnFleets.values()) {
				drawnFleet.animate(now, minLayerPx);
			}
			// Moved fleets already requested a redraw via Konva's auto-draw
			return false;
		});
		if (!fleetAnimation.isRunning()) fleetAnimation.start();
	}

	// Handle mouse movement for prospective travel line preview during destination selection
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
	function handleMouseMove(_e: any) {
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

		// Find the closest planet to the mouse position
		let closestPlanet: PlanetLocation | null = null;
		let closestDistance = Infinity;

		// Check all planets in the spatial index
		for (const planet of planetByHexCoords.values()) {
			const dx = planet.boundingHexMidPoint.x - layerPos.x;
			const dy = planet.boundingHexMidPoint.y - layerPos.y;
			const distance = Math.sqrt(dx * dx + dy * dy);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestPlanet = planet;
			}
		}

		if (closestPlanet && closestPlanet.id !== $fleetCommandStore.sourcePlanetId) {
			// Found a valid destination planet (not the source planet)
			if (hoveredDestinationPlanetId !== closestPlanet.id) {
				hoveredDestinationPlanetId = closestPlanet.id;
				updateProspectiveTravelLine(closestPlanet);
			}
		} else {
			// No planet nearby or it's the source planet - hide prospective line
			if (prospectiveTravelLine && prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.animateOut(0.2);
			}
			hoveredDestinationPlanetId = null;
		}
	}

	// Handle mouse leaving the canvas - clear hover state
	function handleMouseOut() {
		// Clear hover state and hide prospective travel line
		if (hoveredDestinationPlanetId !== null) {
			hoveredDestinationPlanetId = null;
			if (prospectiveTravelLine && prospectiveTravelLine.isVisible()) {
				prospectiveTravelLine.animateOut(0.2);
			}
		}
	}

	// Update or create the prospective travel line from source to destination
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
	}

	// Handle galaxy interaction with hex-based planet selection
	// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
	function handleStageClick(_e: any) {
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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function handlePlanetSelection(planetData: any) {
		// Check if we're in destination selection mode
		const fleetState = $fleetCommandStore;
		if (fleetState.isSelectingDestination) {
			// Prevent selecting source planet as destination
			if (planetData.id === fleetState.sourcePlanetId) {
				return;
			}

			// Clear hover state immediately to allow confirmed destination line to show
			hoveredDestinationPlanetId = null;

			// Set the destination planet
			fleetCommandStore.setDestinationPlanet(planetData.id);
		} else {
			// Normal planet selection - always select the planet to show info
			lastSelectionWasFromClick = true; // Mark as click-initiated selection
			gameActions.selectPlanet(planetData.id);
			fleetCommandStore.clearDestination();
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

	/** rAF id of a pan waiting for the selection's re-render to paint. */
	let pendingPanFrame: number | null = null;

	function cancelPendingPan() {
		if (pendingPanFrame !== null) {
			cancelAnimationFrame(pendingPanFrame);
			pendingPanFrame = null;
		}
	}

	/**
	 * Pan to a planet once the selection's re-render has painted.
	 *
	 * Selecting a planet re-renders the side views (Fleet Command redraws every
	 * ShipCard), which can block the main thread for a few hundred ms. The pan is
	 * a time-based tween, so starting it in the same frame made it freeze and then
	 * jump ahead mid-motion. Waiting two frames lets that work land before the
	 * galaxy starts moving. A newer selection replaces a pan still waiting.
	 */
	function zoomToPlanet(drawnPlanet: DrawnPlanet) {
		cancelPendingPan();
		pendingPanFrame = requestAnimationFrame(() => {
			pendingPanFrame = requestAnimationFrame(() => {
				pendingPanFrame = null;
				startPanToPlanet(drawnPlanet);
			});
		});
	}

	function startPanToPlanet(drawnPlanet: DrawnPlanet) {
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

			animatePan(currentPos, { x: targetStageX, y: targetStageY });
		}
	}

	const PAN_DURATION_MS = 800;
	/** Most a single frame may advance the pan; a longer stall pauses it instead. */
	const PAN_MAX_STEP_MS = 1000 / 30;
	let panAnimation: Konva.Animation | null = null;

	function stopPan() {
		panAnimation?.stop();
		panAnimation = null;
	}

	/**
	 * Ease the stage from `from` to `to`, advancing by frame rather than by
	 * wall-clock time. Konva's tween (stage.to) is time-based, so a busy main
	 * thread made the galaxy freeze and then jump partway across the screen.
	 */
	function animatePan(from: { x: number; y: number }, to: { x: number; y: number }) {
		stopPan();
		let elapsed = 0;
		const anim = new Konva.Animation((frame) => {
			elapsed = Math.min(
				PAN_DURATION_MS,
				elapsed + Math.min(frame?.timeDiff ?? 0, PAN_MAX_STEP_MS)
			);
			const t = elapsed / PAN_DURATION_MS;
			const eased = 1 - (1 - t) * (1 - t); // ease-out
			stage.position({
				x: from.x + (to.x - from.x) * eased,
				y: from.y + (to.y - from.y) * eased
			});
			if (t >= 1) {
				anim.stop();
				if (panAnimation === anim) panAnimation = null;
			}
		}, stage.getLayers());
		panAnimation = anim;
		anim.start();
	}
</script>

<!-- Wrapper container for both canvas and UI overlays -->
<div class="galaxy-container relative h-full w-full">
	<!-- Konva canvas container -->
	<div
		bind:this={canvasContainer}
		class="galaxy-canvas absolute inset-0 rounded-lg border border-cyan-500/20 bg-black"
		on:click={handleStageClick}
		aria-label="Galaxy map - Click to interact with planets and fleets"
	></div>
	<!-- Zoom level indicator -->
	<div
		class="pointer-events-none absolute top-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400"
		style="right: 13rem"
	>
		Zoom: {Math.round(zoomLevel * 100)}%
	</div>

	<!-- Controls hint -->
	<div
		class="pointer-events-none absolute top-4 z-10 rounded border border-cyan-500/30 bg-black/70 px-2 py-1 text-xs text-cyan-400/70"
		style="left: 18rem"
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
