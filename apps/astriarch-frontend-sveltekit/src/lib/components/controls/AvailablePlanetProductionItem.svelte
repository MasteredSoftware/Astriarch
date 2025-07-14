<script lang="ts">
  import { Card } from '$lib/components/astriarch';
  import * as Tooltip from '$lib/components/ui/tooltip';
  
  export let name: string;
  export let description: string = '';
  export let cost: Record<string, number> = {};
  export let enabled: boolean = true;
  export let onClick: (() => void) | undefined = undefined;

  // Resource color mapping based on our design system (removed food)
  const resourceColors: Record<string, string> = {
    energy: 'var(--astriarch-energy)',   // Yellow
    ore: 'var(--astriarch-ore)',         // Orange
    iridium: 'var(--astriarch-iridium)'  // Purple
  };

  // Filter out zero costs and sort for consistent display order
  $: displayCosts = Object.entries(cost)
    .filter(([_, amount]) => amount > 0)
    .sort(([a], [b]) => {
      const order = ['energy', 'ore', 'iridium'];
      return order.indexOf(a) - order.indexOf(b);
    });

  function handleClick() {
    if (enabled && onClick) {
      onClick();
    }
  }
</script>

<!-- Card content that's shared between tooltip and non-tooltip versions -->
{#snippet cardContent()}
  <Card
    class="w-full text-left relative group transition-all duration-200 cursor-pointer
           {enabled ? 'hover:bg-astriarch-ui-dark-blue/20' : 'cursor-not-allowed'}"
    size="md"
    {enabled}
    onclick={handleClick}
  >
    <div class="p-3">
      <!-- Item name -->
      <div class="text-astriarch-body-14-semibold text-astriarch-ui-white mb-1
                  {enabled ? '' : 'text-astriarch-ui-medium-grey'}">
        {name}
      </div>

      <!-- Resource costs -->
      {#if displayCosts.length > 0}
        <div class="flex items-center gap-2">
          {#each displayCosts as [resource, amount]}
            <div class="flex items-center gap-1">
              <!-- Colored resource circle -->
              <div 
                class="w-2.5 h-2.5 rounded-full flex-shrink-0
                       {enabled ? '' : 'opacity-50'}"
                style="background-color: {resourceColors[resource] || 'var(--astriarch-ui-medium-grey)'}"
              ></div>
              <!-- Resource amount -->
              <span class="text-astriarch-caption-12-semibold
                           {enabled ? 'text-astriarch-ui-white' : 'text-astriarch-ui-medium-grey'}">
                {amount}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </Card>
{/snippet}

{#if description}
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger class="w-full">
        {@render cardContent()}
      </Tooltip.Trigger>
      <Tooltip.Content>
        <div class="bg-astriarch-ui-dark-blue/95 border border-astriarch-primary/60 text-astriarch-ui-white text-astriarch-caption-12-medium max-w-xs rounded-md backdrop-blur-sm px-3 py-2" style="box-shadow: 0 10px 15px -3px rgba(0, 255, 255, 0.2), 0 4px 6px -2px rgba(0, 255, 255, 0.1);">
          {description}
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  </Tooltip.Provider>
{:else}
  {@render cardContent()}
{/if}
