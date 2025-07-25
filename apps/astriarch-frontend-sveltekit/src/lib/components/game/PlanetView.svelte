<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { gameStore, currentPlanet, type Planet } from '../../stores/gameStore.new';
  import { webSocketService } from '../../services/websocket';
  import { Button } from '../astriarch';
  import { Card } from '../astriarch';
  
  const dispatch = createEventDispatcher();
  
  let planet: Planet | null = null;
  let isOwned = false;
  let canBuild = false;
  
  // Building types and costs
  const BUILDINGS = {
    farm: { name: 'Farm', cost: { ore: 10, iridium: 0 }, description: 'Produces food for population growth' },
    mine: { name: 'Mine', cost: { ore: 15, iridium: 5 }, description: 'Extracts ore and iridium from planet' },
    factory: { name: 'Factory', cost: { ore: 20, iridium: 10 }, description: 'Builds ships and advanced structures' },
    spacePlatform: { name: 'Space Platform', cost: { ore: 50, iridium: 25 }, description: 'Defensive platform and fleet base' }
  };
  
  // Ship types and costs
  const SHIPS = {
    scout: { name: 'Scout', cost: { ore: 5, iridium: 2 }, description: 'Fast exploration and reconnaissance ship' },
    destroyer: { name: 'Destroyer', cost: { ore: 15, iridium: 8 }, description: 'Basic combat vessel' },
    cruiser: { name: 'Cruiser', cost: { ore: 25, iridium: 15 }, description: 'Heavy combat ship' },
    battleship: { name: 'Battleship', cost: { ore: 40, iridium: 25 }, description: 'Powerful capital ship' }
  };
  
  // Subscribe to current planet
  currentPlanet.subscribe(p => {
    planet = p;
    isOwned = planet?.playerId === $gameStore.currentPlayer;
    canBuild = isOwned && planet !== null;
  });
  
  function buildStructure(buildingType: string, quantity: number = 1) {
    if (!planet || !canBuild) return;
    
    const building = BUILDINGS[buildingType as keyof typeof BUILDINGS];
    if (!building) return;
    
    // Check if player has enough resources
    const totalCost = {
      ore: building.cost.ore * quantity,
      iridium: building.cost.iridium * quantity
    };
    
    if (planet.resources.ore < totalCost.ore || planet.resources.iridium < totalCost.iridium) {
      gameStore.addNotification({
        type: 'error',
        message: 'Insufficient resources',
        timestamp: Date.now()
      });
      return;
    }
    
    webSocketService.buildStructure(planet.id, buildingType, quantity);
  }
  
  function demolishBuilding(buildingType: string) {
    if (!planet || !canBuild) return;
    
    webSocketService.managePlanet(planet.id, 'demolish_building', { buildingType });
  }
  
  function adjustPopulation(workerType: string, change: number) {
    if (!planet || !canBuild) return;
    
    // This would adjust population allocation between farmers, miners, workers
    webSocketService.managePlanet(planet.id, 'adjust_population', {
      workerType,
      change
    });
  }
  
  function sendFleet() {
    // Open fleet sending dialog
    dispatch('sendFleet', { fromPlanetId: planet?.id });
  }
  
  function closePlanetView() {
    gameStore.selectPlanet(null);
  }
  
  // Calculate production rates
  function getProductionRates(planet: Planet) {
    return {
      food: planet.buildings.farms * 2,
      ore: planet.buildings.mines * 3,
      iridium: planet.buildings.mines * 1,
      production: planet.buildings.factories * 5
    };
  }
  
  // Calculate population capacity
  function getPopulationCapacity(planet: Planet) {
    return planet.buildings.farms * 100 + 50; // Base capacity + farm bonus
  }
</script>

{#if planet}
<div class="planet-view-overlay">
  <Card style="width: 90%; max-width: 800px; max-height: 90%; overflow-y: auto; background: var(--background); border: 2px solid var(--border);">
    <div class="planet-header">
      <h2>Planet {planet.id}</h2>
      <Button variant="secondary" size="small" on:click={closePlanetView}>Close</Button>
    </div>
    
    <div class="planet-content">
      <!-- Planet Info -->
      <div class="planet-info">
        <div class="info-section">
          <h3>Planet Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <span class="label">Owner:</span>
              <span class="value">{planet.playerId ? planet.playerName || planet.playerId : 'Neutral'}</span>
            </div>
            <div class="status-item">
              <span class="label">Population:</span>
              <span class="value">{planet.population} / {getPopulationCapacity(planet)}</span>
            </div>
            <div class="status-item">
              <span class="label">Position:</span>
              <span class="value">({planet.position.x}, {planet.position.y})</span>
            </div>
          </div>
        </div>
        
        <!-- Resources -->
        <div class="info-section">
          <h3>Resources</h3>
          <div class="resource-grid">
            <div class="resource-item">
              <span class="resource-icon">🌾</span>
              <span class="resource-name">Food</span>
              <span class="resource-amount">{planet.resources.food}</span>
              <span class="resource-production">+{getProductionRates(planet).food}/turn</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">⛏️</span>
              <span class="resource-name">Ore</span>
              <span class="resource-amount">{planet.resources.ore}</span>
              <span class="resource-production">+{getProductionRates(planet).ore}/turn</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">💎</span>
              <span class="resource-name">Iridium</span>
              <span class="resource-amount">{planet.resources.iridium}</span>
              <span class="resource-production">+{getProductionRates(planet).iridium}/turn</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Buildings -->
      <div class="buildings-section">
        <h3>Buildings</h3>
        <div class="buildings-grid">
          {#each Object.entries(BUILDINGS) as [buildingType, buildingInfo]}
            <div class="building-item">
              <div class="building-header">
                <h4>{buildingInfo.name}</h4>
                <span class="building-count">{planet.buildings[buildingType as keyof typeof planet.buildings]}</span>
              </div>
              <p class="building-description">{buildingInfo.description}</p>
              <div class="building-cost">
                Cost: {buildingInfo.cost.ore} ore
                {#if buildingInfo.cost.iridium > 0}, {buildingInfo.cost.iridium} iridium{/if}
              </div>
              {#if canBuild}
                <div class="building-actions">
                  <Button 
                    size="small" 
                    on:click={() => buildStructure(buildingType)}
                    disabled={planet.resources.ore < buildingInfo.cost.ore || planet.resources.iridium < buildingInfo.cost.iridium}
                  >
                    Build
                  </Button>
                  {#if planet.buildings[buildingType as keyof typeof planet.buildings] > 0}
                    <Button 
                      variant="secondary" 
                      size="small" 
                      on:click={() => demolishBuilding(buildingType)}
                    >
                      Demolish
                    </Button>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      
      <!-- Fleet Management -->
      {#if canBuild}
        <div class="fleet-section">
          <h3>Fleet Management</h3>
          <div class="fleet-actions">
            <Button on:click={sendFleet}>Send Fleet</Button>
            <Button variant="secondary">Build Ships</Button>
          </div>
        </div>
      {/if}
      
      <!-- Build Queue -->
      {#if planet.buildQueue && planet.buildQueue.length > 0}
        <div class="build-queue-section">
          <h3>Build Queue</h3>
          <div class="build-queue">
            {#each planet.buildQueue as item, index}
              <div class="queue-item">
                <span class="queue-type">{item.type}</span>
                <span class="queue-time">{item.turnsRemaining} turns</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </Card>
</div>
{/if}

<style>
  .planet-view-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  
  .planet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--muted);
  }
  
  .planet-header h2 {
    margin: 0;
    color: var(--foreground);
  }
  
  .planet-content {
    padding: 1rem;
  }
  
  .info-section {
    margin-bottom: 1.5rem;
  }
  
  .info-section h3 {
    margin: 0 0 0.75rem 0;
    color: var(--foreground);
    font-size: 1.1rem;
  }
  
  .status-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.5rem;
  }
  
  .status-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem;
    background: var(--muted);
    border-radius: 4px;
  }
  
  .label {
    font-weight: 600;
    color: var(--muted-foreground);
  }
  
  .value {
    color: var(--foreground);
  }
  
  .resource-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 0.75rem;
  }
  
  .resource-item {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.75rem;
    background: var(--muted);
    border-radius: 4px;
  }
  
  .resource-icon {
    font-size: 1.5rem;
  }
  
  .resource-name {
    font-weight: 600;
    color: var(--foreground);
  }
  
  .resource-amount {
    font-weight: 700;
    color: var(--primary);
    text-align: right;
  }
  
  .resource-production {
    color: var(--success);
    font-size: 0.9rem;
    text-align: right;
  }
  
  .buildings-section {
    margin-bottom: 1.5rem;
  }
  
  .buildings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
  
  .building-item {
    padding: 1rem;
    background: var(--muted);
    border-radius: 4px;
    border: 1px solid var(--border);
  }
  
  .building-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  
  .building-header h4 {
    margin: 0;
    color: var(--foreground);
  }
  
  .building-count {
    font-weight: 700;
    color: var(--primary);
    font-size: 1.2rem;
  }
  
  .building-description {
    margin: 0.5rem 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }
  
  .building-cost {
    margin: 0.5rem 0;
    color: var(--warning);
    font-size: 0.9rem;
    font-weight: 600;
  }
  
  .building-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }
  
  .fleet-section,
  .build-queue-section {
    margin-bottom: 1.5rem;
  }
  
  .fleet-actions {
    display: flex;
    gap: 0.75rem;
  }
  
  .build-queue {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .queue-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    background: var(--muted);
    border-radius: 4px;
  }
  
  .queue-type {
    font-weight: 600;
    color: var(--foreground);
  }
  
  .queue-time {
    color: var(--muted-foreground);
  }
</style>