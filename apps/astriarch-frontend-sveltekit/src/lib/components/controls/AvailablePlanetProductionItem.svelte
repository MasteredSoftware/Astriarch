<script lang="ts">
  import { Card } from '$lib/components/astriarch';
  
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

<Card
  class="w-full text-left relative group transition-all duration-200 cursor-pointer
         {enabled ? 'hover:bg-astriarch-ui-dark-blue/20' : 'cursor-not-allowed'}"
  {enabled}
  onclick={handleClick}
>
  <div class="p-3">
    <!-- Item name -->
    <div class="text-astriarch-body-14-semibold text-astriarch-ui-white mb-1
                {enabled ? '' : 'text-astriarch-ui-medium-grey'}">
      {name}
    </div>

    <!-- Description (if provided) -->
    {#if description}
      <div class="text-astriarch-caption-10 text-astriarch-ui-light-grey mb-2
                  {enabled ? '' : 'text-astriarch-ui-dark-grey'}">
        {description}
      </div>
    {/if}

    <!-- Resource costs -->
    {#if displayCosts.length > 0}
      <div class="flex items-center gap-3">
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
