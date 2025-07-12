<script lang="ts">
  import { Text, Card } from '$lib/components/astriarch';
  import { clientGameModel } from '$lib/stores/gameStore';

  $: fleets = $clientGameModel?.mainPlayer.fleetsInTransit || [];
  $: planets = $clientGameModel?.mainPlayerOwnedPlanets || {};
</script>

<div class="p-6 space-y-6">
  <Text style="font-size: 24px; color: #00FFFF; margin-bottom: 16px;">
    Fleet Command
  </Text>
  
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Active Fleets -->
    <div>
      <Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 12px;">
        Active Fleets ({fleets.length})
      </Text>
      
      <div class="space-y-3">
        {#each fleets as fleet, index (index)}
          <Card>
            <div class="p-4">
              <div class="flex justify-between items-center mb-2">
                <Text style="font-size: 16px; color: #00FFFF;">
                  Fleet {index + 1}
                </Text>
                <Text style="font-size: 12px; color: #94A3B8;">
                  {fleet.starships.length} ships
                </Text>
              </div>
              
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Text style="color: #94A3B8;">Location:</Text>
                  <Text style="color: #FFFFFF;">
                    {fleet.locationHexMidPoint ? 'In system' : 'Unknown'}
                  </Text>
                </div>
                <div>
                  <Text style="color: #94A3B8;">Status:</Text>
                  <Text style="color: #FFFFFF;">
                    {fleet.destinationHexMidPoint ? 'Moving' : 'Stationed'}
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        {:else}
          <Card>
            <div class="p-4 text-center">
              <Text style="color: #94A3B8;">
                No active fleets. Build ships at your planets to create fleets.
              </Text>
            </div>
          </Card>
        {/each}
      </div>
    </div>

    <!-- Shipyards & Construction -->
    <div>
      <Text style="font-size: 18px; color: #FFFFFF; margin-bottom: 12px;">
        Shipyards & Construction
      </Text>
      
      <div class="space-y-3">
        {#each Object.values(planets) as planet (planet.id)}
          <Card>
            <div class="p-4">
              <div class="flex justify-between items-center mb-2">
                <Text style="font-size: 16px; color: #00FFFF;">
                  {planet.name}
                </Text>
                <Text style="font-size: 12px; color: #94A3B8;">
                  {planet.buildQueue?.length || 0} in queue
                </Text>
              </div>
              
              <div class="text-sm">
                <Text style="color: #94A3B8;">
                  Production: {planet.builtImprovements[1] || 0} factories
                </Text>
                {#if planet.buildQueue && planet.buildQueue.length > 0}
                  <Text style="color: #FFFFFF; margin-top: 4px;">
                    Building: {planet.buildQueue[0]?.itemType === 1 ? 'Improvement' : planet.buildQueue[0]?.itemType === 2 ? 'Starship' : 'Unknown'}
                  </Text>
                {/if}
              </div>
            </div>
          </Card>
        {/each}
      </div>
    </div>
  </div>
</div>
