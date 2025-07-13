<script lang="ts">
  import { Text, Card, Button } from '$lib/components/astriarch';
  import { clientGameModel } from '$lib/stores/gameStore';

  let selectedPlanet = null;

  $: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
  $: planetList = Object.values(planets);
  
  // Auto-select first planet if none selected
  $: if (!selectedPlanet && planetList.length > 0) {
    selectedPlanet = planetList[0];
  }

  function selectPlanet(planet) {
    selectedPlanet = planet;
  }

  function getBuildingTypeName(type) {
    switch(type) {
      case 1: return 'Factory';
      case 2: return 'Colony';
      case 3: return 'Farm';
      case 4: return 'Mine';
      default: return 'Unknown';
    }
  }

  function getStarshipTypeName(type) {
    switch(type) {
      case 1: return 'Defender';
      case 2: return 'Scout';
      case 3: return 'Destroyer';
      case 4: return 'Cruiser';
      case 5: return 'Battleship';
      case 6: return 'Space Platform';
      default: return 'Unknown Ship';
    }
  }

  function getPlanetTypeName(type) {
    switch(type) {
      case 1: return 'Arid';
      case 2: return 'Terran';
      case 3: return 'Ocean';
      case 4: return 'Gaia';
      default: return 'Unknown';
    }
  }

  // Sample data for available buildings and ships
  const availableBuildings = [
    { type: 3, name: 'Farm', cost: { energy: 1 }, description: 'Increases food production' },
    { type: 4, name: 'Mine', cost: { energy: 2, ore: 1 }, description: 'Increases ore and iridium production' },
    { type: 1, name: 'Factory', cost: { energy: 6, ore: 4, iridium: 2 }, description: 'Increases production capacity' },
    { type: 2, name: 'Colony', cost: { energy: 3, ore: 2, iridium: 1 }, description: 'Increases population capacity' }
  ];

  const availableShips = [
    { type: 2, name: 'Scout', cost: { energy: 3, ore: 2, iridium: 1 }, description: 'Fast exploration vessel' },
    { type: 3, name: 'Destroyer', cost: { energy: 6, ore: 4, iridium: 2 }, description: 'Light combat vessel' },
    { type: 4, name: 'Cruiser', cost: { energy: 12, ore: 8, iridium: 4 }, description: 'Medium combat vessel' },
    { type: 5, name: 'Battleship', cost: { energy: 24, ore: 16, iridium: 8 }, description: 'Heavy combat vessel' }
  ];
</script>

<div class="h-full bg-slate-900/95 backdrop-blur-sm flex flex-col">
  {#if selectedPlanet}
    <!-- Planet Header Summary -->
    <div class="p-4 border-b border-cyan-500/20 bg-slate-800/50 flex-shrink-0">
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center space-x-4">
          <Text style="font-size: 18px; color: #00FFFF; font-weight: 600;">
            {selectedPlanet.name}
          </Text>
          <Text style="font-size: 12px; color: #94A3B8;">
            {getPlanetTypeName(selectedPlanet.type)} World
          </Text>
          {#if planetList.length > 1}
            <select 
              class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
              on:change={(e) => selectPlanet(planetList.find(p => p.id === parseInt(e.target.value)))}
              value={selectedPlanet.id}
            >
              {#each planetList as planet}
                <option value={planet.id}>{planet.name}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="text-right text-xs">
          <div class="text-white">Population: {selectedPlanet.population?.length || 0}</div>
          <div class="text-slate-400">Max: {selectedPlanet.maxImprovements + (selectedPlanet.builtImprovements?.[2] || 0)}</div>
        </div>
      </div>
      
      <!-- Resource Summary -->
      <div class="grid grid-cols-4 gap-4 text-xs">
        <div class="text-center">
          <div class="text-green-400">{(selectedPlanet.resources?.food || 0).toFixed(1)}</div>
          <div class="text-slate-400">Food</div>
        </div>
        <div class="text-center">
          <div class="text-yellow-400">{(selectedPlanet.resources?.energy || 0).toFixed(1)}</div>
          <div class="text-slate-400">Energy</div>
        </div>
        <div class="text-center">
          <div class="text-orange-400">{(selectedPlanet.resources?.ore || 0).toFixed(1)}</div>
          <div class="text-slate-400">Ore</div>
        </div>
        <div class="text-center">
          <div class="text-purple-400">{(selectedPlanet.resources?.iridium || 0).toFixed(1)}</div>
          <div class="text-slate-400">Iridium</div>
        </div>
      </div>
    </div>

    <!-- Three Column Layout -->
    <div class="flex flex-1 min-h-0">
      <!-- Column 1: Available Items to Build -->
      <div class="flex-1 border-r border-cyan-500/20 p-3 overflow-y-auto">
        <Text style="font-size: 14px; color: #00FFFF; margin-bottom: 8px; font-weight: 500;">
          Build Items
        </Text>
        
        <!-- Buildings Section -->
        <div class="mb-4">
          <Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">
            Buildings
          </Text>
          <div class="space-y-1">
            {#each availableBuildings as building}
              <button class="w-full text-left p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded text-xs border border-slate-600/30 hover:border-cyan-500/30 transition-colors">
                <div class="flex justify-between items-center">
                  <div>
                    <div class="text-white font-medium">{building.name}</div>
                    <div class="text-slate-400 text-xs">{building.description}</div>
                  </div>
                  <div class="text-right text-xs text-slate-400">
                    {Object.entries(building.cost).map(([resource, amount]) => `${amount} ${resource}`).join(', ')}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Ships Section -->
        <div>
          <Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">
            Starships
          </Text>
          <div class="space-y-1">
            {#each availableShips as ship}
              <button class="w-full text-left p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded text-xs border border-slate-600/30 hover:border-cyan-500/30 transition-colors">
                <div class="flex justify-between items-center">
                  <div>
                    <div class="text-white font-medium">{ship.name}</div>
                    <div class="text-slate-400 text-xs">{ship.description}</div>
                  </div>
                  <div class="text-right text-xs text-slate-400">
                    {Object.entries(ship.cost).map(([resource, amount]) => `${amount} ${resource}`).join(', ')}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      </div>

      <!-- Column 2: Resources per Turn & Worker Management -->
      <div class="flex-1 border-r border-cyan-500/20 p-3 overflow-y-auto">
        <Text style="font-size: 14px; color: #00FFFF; margin-bottom: 8px; font-weight: 500;">
          Production & Workers
        </Text>
        
        <!-- Resource Production -->
        <div class="mb-4">
          <Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">
            Resource Production per Turn
          </Text>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between p-2 bg-slate-800/30 rounded">
              <span class="text-green-400">Food:</span>
              <span class="text-white">+2.4 / turn</span>
            </div>
            <div class="flex justify-between p-2 bg-slate-800/30 rounded">
              <span class="text-yellow-400">Energy:</span>
              <span class="text-white">+3.6 / turn</span>
            </div>
            <div class="flex justify-between p-2 bg-slate-800/30 rounded">
              <span class="text-orange-400">Ore:</span>
              <span class="text-white">+1.8 / turn</span>
            </div>
            <div class="flex justify-between p-2 bg-slate-800/30 rounded">
              <span class="text-purple-400">Iridium:</span>
              <span class="text-white">+0.9 / turn</span>
            </div>
          </div>
        </div>

        <!-- Worker Assignment -->
        <div>
          <Text style="font-size: 12px; color: #94A3B8; margin-bottom: 4px;">
            Worker Assignment
          </Text>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between items-center p-2 bg-slate-800/30 rounded">
              <span class="text-green-400">Farmers:</span>
              <div class="flex items-center space-x-1">
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">-</button>
                <span class="text-white w-6 text-center">2</span>
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">+</button>
              </div>
            </div>
            <div class="flex justify-between items-center p-2 bg-slate-800/30 rounded">
              <span class="text-orange-400">Miners:</span>
              <div class="flex items-center space-x-1">
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">-</button>
                <span class="text-white w-6 text-center">3</span>
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">+</button>
              </div>
            </div>
            <div class="flex justify-between items-center p-2 bg-slate-800/30 rounded">
              <span class="text-blue-400">Workers:</span>
              <div class="flex items-center space-x-1">
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">-</button>
                <span class="text-white w-6 text-center">1</span>
                <button class="w-5 h-5 bg-slate-600 hover:bg-slate-500 rounded text-xs">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Column 3: Build Queue -->
      <div class="flex-1 p-3 overflow-y-auto">
        <Text style="font-size: 14px; color: #00FFFF; margin-bottom: 8px; font-weight: 500;">
          Build Queue
        </Text>
        
        {#if selectedPlanet.buildQueue && selectedPlanet.buildQueue.length > 0}
          <div class="space-y-2">
            {#each selectedPlanet.buildQueue as item, index}
              <div class="p-2 bg-slate-800/50 rounded border border-slate-600/50">
                <div class="flex justify-between items-center text-xs mb-1">
                  <div class="text-cyan-400 font-medium">
                    {#if item.itemType === 1}
                      {getBuildingTypeName(item.improvementData?.type)}
                    {:else if item.itemType === 2}
                      {getStarshipTypeName(item.starshipData?.type)}
                    {:else}
                      Unknown Item
                    {/if}
                  </div>
                  <button class="text-red-400 hover:text-red-300 text-xs">✕</button>
                </div>
                
                <div class="text-xs text-slate-400 mb-2">
                  {index === 0 ? 'Building...' : `Queue position ${index + 1}`}
                </div>
                
                {#if index === 0}
                  <!-- Progress bar for current item -->
                  <div class="mb-2">
                    <div class="w-full bg-slate-700 rounded-full h-1.5">
                      <div 
                        class="bg-cyan-500 h-1.5 rounded-full transition-all duration-300" 
                        style="width: {Math.min(100, ((item.productionCostComplete || 0) / (item.baseProductionCost || 1)) * 100)}%"
                      ></div>
                    </div>
                  </div>
                {/if}
                
                <div class="flex justify-between text-xs">
                  <span class="text-slate-400">
                    {Math.round(item.productionCostComplete || 0)}/{Math.round(item.baseProductionCost || 1)}
                  </span>
                  {#if index === 0}
                    <span class="text-slate-400">
                      {item.turnsToComplete || '?'} turns
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="text-center py-8">
            <Text style="color: #94A3B8; font-size: 12px;">
              Build queue is empty
            </Text>
            <Text style="color: #64748B; font-size: 10px; margin-top: 4px;">
              Select items from the left to build
            </Text>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- No Planet Selected -->
    <div class="flex items-center justify-center h-full">
      <div class="text-center">
        <Text style="color: #94A3B8; font-size: 14px;">
          No planets under your control
        </Text>
        <Text style="color: #64748B; font-size: 12px; margin-top: 4px;">
          Expand your empire to manage planets
        </Text>
      </div>
    </div>
  {/if}
</div>
