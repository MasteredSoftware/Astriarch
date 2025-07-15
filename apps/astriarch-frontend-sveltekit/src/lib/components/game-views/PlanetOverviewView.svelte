<script lang="ts">
  import { Text, Card, Button, AvailablePlanetProductionItem } from '$lib/components/astriarch';
  import { clientGameModel } from '$lib/stores/gameStore';
  import { GameTools } from 'astriarch-engine/src/utils/gameTools';
  import { PlanetProductionItem } from 'astriarch-engine/src/engine/planetProductionItem';
  import { Planet } from 'astriarch-engine/src/engine/planet';
  import { PlanetImprovementType } from 'astriarch-engine/src/model/planet';
  import { StarShipType } from 'astriarch-engine/src/model/fleet';

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

  function addBuildingToQueue(buildingType: PlanetImprovementType) {
    if (!selectedPlanet || !$clientGameModel) return;
    
    const item = PlanetProductionItem.constructPlanetImprovement(buildingType);
    
    try {
      // Planet.enqueueProductionItemAndSpendResources(
      //   $clientGameModel.grid,
      //   $clientGameModel.mainPlayer,
      //   $clientGameModel.planetById,
      //   selectedPlanet,
      //   item
      // );
      console.log('Added building to queue:', GameTools.planetImprovementTypeToFriendlyName(buildingType));
    } catch (error) {
      console.error('Failed to add building to queue:', error);
    }
  }

  function addShipToQueue(shipType: StarShipType) {
    if (!selectedPlanet || !$clientGameModel) return;
    
    const item = PlanetProductionItem.constructStarShipInProduction(shipType);
    
    try {
      // Planet.enqueueProductionItemAndSpendResources(
      //   $clientGameModel.grid,
      //   $clientGameModel.mainPlayer,
      //   $clientGameModel.planetById,
      //   selectedPlanet,
      //   item
      // );
      console.log('Added ship to queue:', GameTools.starShipTypeToFriendlyName(shipType));
    } catch (error) {
      console.error('Failed to add ship to queue:', error);
    }
  }

  // Available building types with descriptions
  const buildingTypes = [
    { type: PlanetImprovementType.Farm, description: 'Increases food production' },
    { type: PlanetImprovementType.Mine, description: 'Increases ore and iridium production' },
    { type: PlanetImprovementType.Factory, description: 'Increases production rate' },
    { type: PlanetImprovementType.Colony, description: 'Increases population capacity' }
  ];

  const shipTypes = [
    { type: StarShipType.SystemDefense, description: 'Basic planetary defense unit' },
    { type: StarShipType.Scout, description: 'Fast exploration vessel' },
    { type: StarShipType.Destroyer, description: 'Light combat vessel' },
    { type: StarShipType.Cruiser, description: 'Medium combat vessel' },
    { type: StarShipType.Battleship, description: 'Heavy combat vessel' },
    { type: StarShipType.SpacePlatform, description: 'Massive defensive structure' }
  ];

  // Generate available buildings with proper costs from engine
  $: availableBuildings = buildingTypes.map(({ type, description }) => {
    const productionItem = PlanetProductionItem.constructPlanetImprovement(type);
    return {
      type,
      name: GameTools.planetImprovementTypeToFriendlyName(type),
      description,
      cost: {
        energy: productionItem.energyCost,
        ore: productionItem.oreCost,
        iridium: productionItem.iridiumCost
      }
    };
  });

  // Generate available ships with proper costs from engine
  $: availableShips = shipTypes.map(({ type, description }) => {
    const productionItem = PlanetProductionItem.constructStarShipInProduction(type);
    return {
      type,
      name: GameTools.starShipTypeToFriendlyName(type),
      description,
      cost: {
        energy: productionItem.energyCost,
        ore: productionItem.oreCost,
        iridium: productionItem.iridiumCost
      }
    };
  });
</script>

<div class="h-full bg-slate-900/95 backdrop-blur-sm flex flex-col">
  {#if selectedPlanet}
    <!-- Planet Header Summary -->
    <div class="p-4 border-b border-cyan-500/20 bg-slate-800/50 flex-shrink-0">
      <div class="flex justify-between items-center mb-2">
        <div class="flex items-center space-x-4">
          <h2 class="text-astriarch-headline-24 text-astriarch-primary">
            {selectedPlanet.name}
          </h2>
          <span class="text-astriarch-body-14 text-astriarch-ui-light-grey">
            {GameTools.planetTypeToFriendlyName(selectedPlanet.type)}
          </span>
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
          <div class="text-astriarch-food">{(selectedPlanet.resources?.food || 0).toFixed(1)}</div>
          <div class="text-astriarch-ui-light-grey">Food</div>
        </div>
        <div class="text-center">
          <div class="text-astriarch-energy">{(selectedPlanet.resources?.energy || 0).toFixed(1)}</div>
          <div class="text-astriarch-ui-light-grey">Energy</div>
        </div>
        <div class="text-center">
          <div class="text-astriarch-ore">{(selectedPlanet.resources?.ore || 0).toFixed(1)}</div>
          <div class="text-astriarch-ui-light-grey">Ore</div>
        </div>
        <div class="text-center">
          <div class="text-astriarch-iridium">{(selectedPlanet.resources?.iridium || 0).toFixed(1)}</div>
          <div class="text-astriarch-ui-light-grey">Iridium</div>
        </div>
      </div>
    </div>

    <!-- Three Column Layout -->
    <div class="flex flex-1 min-h-0">
      <!-- Column 1: Available Items to Build -->
      <div class="flex-1 border-r border-cyan-500/20 p-3 overflow-y-auto">
        <h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">
          Build Items
        </h3>
        
        <!-- Buildings Section -->
        <div class="mb-4">
          <h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
            Buildings
          </h4>
          <div class="grid grid-cols-4 gap-2">
            {#each availableBuildings as building, index}
              <AvailablePlanetProductionItem 
                name={building.name}
                description={building.description}
                cost={building.cost}
                enabled={index !== 0}
                onClick={() => addBuildingToQueue(building.type)}
              />
            {/each}
          </div>
        </div>

        <!-- Ships Section -->
        <div>
          <h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
            Starships
          </h4>
          <div class="grid grid-cols-4 gap-2">
            {#each availableShips as ship}
              <AvailablePlanetProductionItem 
                name={ship.name}
                description={ship.description}
                cost={ship.cost}
                onClick={() => addShipToQueue(ship.type)}
              />
            {/each}
          </div>
        </div>
      </div>

      <!-- Column 2: Resources per Turn & Worker Management -->
      <div class="flex-1 border-r border-cyan-500/20 p-3 overflow-y-auto">
        <h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">
          Production & Workers
        </h3>
        
        <!-- Resource Production -->
        <div class="mb-4">
          <h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
            Resource Production per Turn
          </h4>
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
          <h4 class="text-astriarch-caption-12-semibold text-astriarch-ui-light-grey mb-1">
            Worker Assignment
          </h4>
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
        <h3 class="text-astriarch-body-16-semibold text-astriarch-primary mb-2">
          Build Queue
        </h3>
        
        {#if selectedPlanet.buildQueue && selectedPlanet.buildQueue.length > 0}
          <div class="space-y-2">
            {#each selectedPlanet.buildQueue as item, index}
              <div class="p-2 bg-slate-800/50 rounded border border-slate-600/50">
                <div class="flex justify-between items-center text-xs mb-1">
                  <div class="text-cyan-400 font-medium">
                    {#if item.itemType === 1}
                      {GameTools.planetImprovementTypeToFriendlyName(item.improvementData?.type)}
                    {:else if item.itemType === 2}
                      {GameTools.starShipTypeToFriendlyName(item.starshipData?.type)}
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
