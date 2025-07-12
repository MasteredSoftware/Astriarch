<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { clientGameModel, gameModel } from '$lib/stores/gameStore';
  import type { ClientModelData, PlanetHappinessType, PlanetImprovementType, Grid } from 'astriarch-engine';
  import type Konva from 'konva';

  // Only import Konva and canvas components on the client side
  let KonvaLib: typeof Konva;
  let DrawnPlanet: any;
  let DrawnFleet: any;

  let canvasContainer: HTMLDivElement;
  let stage: Konva.Stage;
  let galaxyLayer: Konva.Layer;
  let fleetLayer: Konva.Layer;
  let uiLayer: Konva.Layer;
  
  let drawnPlanets: Map<number, any> = new Map();
  let drawnFleets: Map<number, any> = new Map();
  let currentGrid: Grid | null = null;
  
  let animationFrameId: number;
  let isInitialized = false;

  onMount(async () => {
    // Dynamically import Konva and canvas components only on client side
    try {
      const konvaModule = await import('konva');
      const drawnPlanetModule = await import('./DrawnPlanet');
      const drawnFleetModule = await import('./DrawnFleet');
      
      KonvaLib = konvaModule.default;
      DrawnPlanet = drawnPlanetModule.DrawnPlanet;
      DrawnFleet = drawnFleetModule.DrawnFleet;
      
      initializeCanvas();
      startRenderLoop();
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize GalaxyCanvas:', error);
    }
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
    const gm = $gameModel;
    const galaxyWidth = gm?.grid ? 621 : 800; // Default fallback
    const galaxyHeight = gm?.grid ? 480 : 600; // Default fallback
    
    console.log('Galaxy dimensions:', { galaxyWidth, galaxyHeight, hasGrid: !!gm?.grid });
    
    if (gm?.grid) {
      currentGrid = gm.grid;
      console.log('Grid loaded with', gm.grid.hexes.length, 'hexes');
    }

    // Create Konva stage with proper galaxy dimensions
    stage = new KonvaLib.Stage({
      container: canvasContainer,
      width: window.innerWidth - 300, // Account for UI panels
      height: window.innerHeight - 200, // Account for top bar and navigation
      draggable: true // Allow panning the galaxy view
    });

    // Create layers (back to front rendering order)
    galaxyLayer = new KonvaLib.Layer();
    fleetLayer = new KonvaLib.Layer();
    uiLayer = new KonvaLib.Layer();

    stage.add(galaxyLayer);
    stage.add(fleetLayer);
    stage.add(uiLayer);

    // Add space background with proper galaxy bounds
    createSpaceBackground(galaxyWidth, galaxyHeight);
    
    // Center the view on the galaxy
    const scale = Math.min(
      (window.innerWidth - 300) / galaxyWidth,
      (window.innerHeight - 200) / galaxyHeight
    ) * 0.8; // Leave some padding
    
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
    const background = new KonvaLib.Rect({
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
      const star = new KonvaLib.Circle({
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

    // Draw hex grid as subtle overlay
    for (const hex of currentGrid.hexes) {
      const hexShape = new KonvaLib.RegularPolygon({
        x: hex.midPoint.x,
        y: hex.midPoint.y,
        sides: 6,
        radius: hex.data.height / 2,
        stroke: 'rgba(0, 255, 255, 0.1)',
        strokeWidth: 1,
        fill: 'transparent'
      });
      galaxyLayer.add(hexShape);

      // Add hex labels for debugging (optional)
      const label = new KonvaLib.Text({
        x: hex.midPoint.x - 10,
        y: hex.midPoint.y - 5,
        text: hex.data.id,
        fontSize: 8,
        fill: 'rgba(0, 255, 255, 0.3)',
        align: 'center'
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
      console.log('No client game model available');
      return;
    }

    console.log('Updating game objects...');

    // Update grid reference if changed
    const gm = $gameModel;
    if (gm?.grid && currentGrid !== gm.grid) {
      currentGrid = gm.grid;
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

    console.log('Updating planets:', { 
      ownedPlanets: Object.keys(gameModel.mainPlayerOwnedPlanets).length,
      clientPlanets: gameModel.clientPlanets.length 
    });

    // First, render all owned planets (these have full PlanetData)
    for (const planet of Object.values(gameModel.mainPlayerOwnedPlanets)) {
      allPlanetsToRender.add(planet.id);
      
      let drawnPlanet = drawnPlanets.get(planet.id);
      
      if (!drawnPlanet) {
        console.log('Creating new DrawnPlanet for owned planet:', planet.id, planet.name);
        drawnPlanet = new DrawnPlanet(KonvaLib, planet, gameModel);
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
        console.log('Creating new DrawnPlanet for client planet:', clientPlanet.id, clientPlanet.name);
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
            4: 0  // Mine
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
        
        drawnPlanet = new DrawnPlanet(KonvaLib, planetData, gameModel);
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
    // Clear existing fleets that are no longer active
    const activeFleetIds = new Set<number>();
    
    // Update fleets in transit for main player
    gameModel.mainPlayer.fleetsInTransit.forEach((fleet, index) => {
      const fleetId = index; // Use index as ID for now
      activeFleetIds.add(fleetId);
      
      let drawnFleet = drawnFleets.get(fleetId);
      
      if (!drawnFleet) {
        drawnFleet = new DrawnFleet(KonvaLib, fleet, gameModel);
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
</script>

<div 
  bind:this={canvasContainer} 
  class="galaxy-canvas w-full h-full bg-black rounded-lg border border-cyan-500/20"
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
