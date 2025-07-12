<script lang="ts">
  import { Text, Card } from '$lib/components/astriarch';
  import { clientGameModel, currentResearch } from '$lib/stores/gameStore';

  $: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
  $: planetList = Object.values(planets);
</script>

<div class="p-6 space-y-6">
  <Text style="font-size: 24px; color: #00FFFF; margin-bottom: 16px;">
    Planet Overview
  </Text>
  
  <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
    {#each planetList as planet (planet.id)}
      <Card>
        <div class="p-4">
          <div class="flex justify-between items-center mb-3">
            <Text style="font-size: 18px; color: #00FFFF;">
              {planet.name}
            </Text>
            <Text style="font-size: 12px; color: #94A3B8;">
              Population: {planet.population?.length || 0}
            </Text>
          </div>
          
          <!-- Planet Resources -->
          <div class="grid grid-cols-2 gap-2 mb-3 text-sm">
            <div>
              <Text style="color: #94A3B8;">Food:</Text>
              <Text style="color: #FFFFFF;">{(planet.resources?.food || 0).toFixed(1)}</Text>
            </div>
            <div>
              <Text style="color: #94A3B8;">Energy:</Text>
              <Text style="color: #FFFFFF;">{(planet.resources?.energy || 0).toFixed(1)}</Text>
            </div>
            <div>
              <Text style="color: #94A3B8;">Ore:</Text>
              <Text style="color: #FFFFFF;">{(planet.resources?.ore || 0).toFixed(1)}</Text>
            </div>
            <div>
              <Text style="color: #94A3B8;">Iridium:</Text>
              <Text style="color: #FFFFFF;">{(planet.resources?.iridium || 0).toFixed(1)}</Text>
            </div>
          </div>
          
          <!-- Planet Buildings -->
          <div class="mb-3">
            <Text style="color: #94A3B8; font-size: 14px; margin-bottom: 4px;">Buildings:</Text>
            <div class="grid grid-cols-2 gap-1 text-xs">
              <Text style="color: #FFFFFF;">Farms: {planet.builtImprovements?.[3] || 0}</Text>
              <Text style="color: #FFFFFF;">Mines: {planet.builtImprovements?.[4] || 0}</Text>
              <Text style="color: #FFFFFF;">Factories: {planet.builtImprovements?.[1] || 0}</Text>
              <Text style="color: #FFFFFF;">Colonies: {planet.builtImprovements?.[2] || 0}</Text>
            </div>
          </div>
          
          <!-- Build Queue -->
          {#if planet.buildQueue && planet.buildQueue.length > 0}
            <div class="border-t border-cyan-500/20 pt-2">
              <Text style="color: #94A3B8; font-size: 12px;">Building:</Text>
              <Text style="color: #00FFFF; font-size: 12px;">
                {planet.buildQueue[0]?.itemType === 1 ? 'Improvement' : 
                 planet.buildQueue[0]?.itemType === 2 ? 'Starship' : 'Unknown'}
              </Text>
              <Text style="color: #94A3B8; font-size: 10px;">
                Progress: {Math.round(planet.buildQueue[0]?.productionCostComplete || 0)}/{Math.round(planet.buildQueue[0]?.baseProductionCost || 1)}
              </Text>
            </div>
          {:else}
            <div class="border-t border-cyan-500/20 pt-2">
              <Text style="color: #94A3B8; font-size: 12px;">Build queue empty</Text>
            </div>
          {/if}
        </div>
      </Card>
    {:else}
      <Card>
        <div class="p-4 text-center">
          <Text style="color: #94A3B8;">
            No planets under your control.
          </Text>
        </div>
      </Card>
    {/each}
  </div>
</div>
