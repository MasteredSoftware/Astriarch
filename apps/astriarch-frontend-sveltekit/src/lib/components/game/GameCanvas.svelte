<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { gameStore, type Planet, type Fleet } from '../../stores/gameStore';
  
  const dispatch = createEventDispatcher();
  
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let animationId: number;
  
  // Canvas dimensions
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const PLANET_RADIUS = 12;
  const FLEET_SIZE = 8;
  
  // Colors for different players
  const PLAYER_COLORS = ['#ffffff', '#ffff00', '#ffa500', '#0080ff', '#00ff00', '#ff0000', '#800080'];
  
  let gameState = $gameStore.gameState;
  let selectedPlanet = $gameStore.selectedPlanet;
  let hoveredPlanet: string | null = null;
  
  // Subscribe to store changes
  gameStore.subscribe(store => {
    gameState = store.gameState;
    selectedPlanet = store.selectedPlanet;
    if (ctx) {
      draw();
    }
  });
  
  onMount(() => {
    ctx = canvas.getContext('2d')!;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // Set up mouse event handlers
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    
    // Start animation loop
    animate();
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('mousemove', handleCanvasMouseMove);
      canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
    };
  });
  
  function animate() {
    draw();
    animationId = requestAnimationFrame(animate);
  }
  
  function draw() {
    if (!ctx || !gameState) return;
    
    // Clear canvas
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw stars background
    drawStars();
    
    // Draw planets
    Object.values(gameState.planets).forEach(planet => {
      drawPlanet(planet);
    });
    
    // Draw fleets
    Object.values(gameState.fleets).forEach(fleet => {
      drawFleet(fleet);
    });
    
    // Draw selection indicators and UI overlays
    drawUI();
  }
  
  function drawStars() {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * CANVAS_WIDTH;
      const y = Math.random() * CANVAS_HEIGHT;
      const brightness = Math.random();
      ctx.globalAlpha = brightness * 0.8;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  
  function drawPlanet(planet: Planet) {
    const { x, y } = planet.position;
    
    // Planet base
    ctx.beginPath();
    ctx.arc(x, y, PLANET_RADIUS, 0, Math.PI * 2);
    
    // Planet color based on type/owner
    if (planet.playerId) {
      const playerIndex = Object.keys(gameState!.players).indexOf(planet.playerId);
      ctx.fillStyle = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] || '#888888';
    } else {
      ctx.fillStyle = '#666666'; // Neutral planet
    }
    ctx.fill();
    
    // Planet border
    ctx.strokeStyle = planet.id === selectedPlanet ? '#00ff00' : 
                     planet.id === hoveredPlanet ? '#ffff00' : '#333333';
    ctx.lineWidth = planet.id === selectedPlanet ? 3 : 1;
    ctx.stroke();
    
    // Planet population indicator
    if (planet.population > 0) {
      const populationRadius = Math.min(PLANET_RADIUS * 0.6, Math.sqrt(planet.population) * 0.5);
      ctx.beginPath();
      ctx.arc(x, y, populationRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.fill();
    }
    
    // Buildings indicator
    const buildingCount = Object.values(planet.buildings).reduce((sum, count) => sum + count, 0);
    if (buildingCount > 0) {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(x - 2, y - PLANET_RADIUS - 4, Math.min(buildingCount * 0.5, 8), 2);
    }
  }
  
  function drawFleet(fleet: Fleet) {
    const { x, y } = fleet.position;
    
    // Fleet icon
    ctx.beginPath();
    ctx.moveTo(x, y - FLEET_SIZE);
    ctx.lineTo(x - FLEET_SIZE * 0.7, y + FLEET_SIZE * 0.5);
    ctx.lineTo(x, y);
    ctx.lineTo(x + FLEET_SIZE * 0.7, y + FLEET_SIZE * 0.5);
    ctx.closePath();
    
    // Fleet color based on owner
    const playerIndex = Object.keys(gameState!.players).indexOf(fleet.playerId);
    ctx.fillStyle = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length] || '#888888';
    ctx.fill();
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Fleet size indicator
    const totalShips = Object.values(fleet.ships).reduce((sum, count) => sum + count, 0);
    if (totalShips > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(totalShips.toString(), x, y + FLEET_SIZE + 12);
    }
    
    // Movement trail if in transit
    if (fleet.destination) {
      const destPlanet = gameState!.planets[fleet.destination.planetId];
      if (destPlanet) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(x, y);
        ctx.lineTo(destPlanet.position.x, destPlanet.position.y);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }
  
  function drawUI() {
    // Draw game time
    if (gameState) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`Game Time: ${Math.floor(gameState.gameTime / 1000)}s`, 10, 25);
    }
    
    // Draw player resources (if current player is set)
    const currentPlayer = gameState?.players[$gameStore.currentPlayer || ''];
    if (currentPlayer) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.fillText(`Credits: ${currentPlayer.resources.credits}`, 10, 45);
      ctx.fillText(`Attack: ${currentPlayer.research.attack}`, 10, 60);
      ctx.fillText(`Defense: ${currentPlayer.research.defense}`, 10, 75);
      ctx.fillText(`Propulsion: ${currentPlayer.research.propulsion}`, 10, 90);
    }
  }
  
  function handleCanvasClick(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Check for planet clicks
    if (gameState) {
      for (const planet of Object.values(gameState.planets)) {
        const distance = Math.sqrt(
          Math.pow(x - planet.position.x, 2) + Math.pow(y - planet.position.y, 2)
        );
        
        if (distance <= PLANET_RADIUS) {
          dispatch('planetClick', { planetId: planet.id, planet });
          gameStore.selectPlanet(planet.id);
          return;
        }
      }
      
      // Check for fleet clicks
      for (const fleet of Object.values(gameState.fleets)) {
        const distance = Math.sqrt(
          Math.pow(x - fleet.position.x, 2) + Math.pow(y - fleet.position.y, 2)
        );
        
        if (distance <= FLEET_SIZE) {
          dispatch('fleetClick', { fleetId: fleet.id, fleet });
          gameStore.selectFleet(fleet.id);
          return;
        }
      }
    }
    
    // Clear selection if clicking empty space
    gameStore.selectPlanet(null);
    gameStore.selectFleet(null);
  }
  
  function handleCanvasMouseMove(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    let newHoveredPlanet: string | null = null;
    
    // Check for planet hover
    if (gameState) {
      for (const planet of Object.values(gameState.planets)) {
        const distance = Math.sqrt(
          Math.pow(x - planet.position.x, 2) + Math.pow(y - planet.position.y, 2)
        );
        
        if (distance <= PLANET_RADIUS) {
          newHoveredPlanet = planet.id;
          canvas.style.cursor = 'pointer';
          break;
        }
      }
    }
    
    if (newHoveredPlanet !== hoveredPlanet) {
      hoveredPlanet = newHoveredPlanet;
      if (!newHoveredPlanet) {
        canvas.style.cursor = 'default';
      }
    }
  }
  
  function handleCanvasMouseLeave() {
    hoveredPlanet = null;
    canvas.style.cursor = 'default';
  }
</script>

<div class="game-canvas-container">
  <canvas
    bind:this={canvas}
    width={CANVAS_WIDTH}
    height={CANVAS_HEIGHT}
    class="game-canvas"
  ></canvas>
</div>

<style>
  .game-canvas-container {
    display: flex;
    justify-content: center;
    align-items: center;
    background: #000011;
    border: 2px solid #333;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .game-canvas {
    display: block;
    cursor: default;
  }
  
  .game-canvas:hover {
    /* Hover effects handled in JavaScript */
  }
</style>