<script lang="ts">
  export let name: string;
  export let description: string = '';
  export let cost: Record<string, number> = {};
  export let isSelected: boolean = false;
  export let onClick: (() => void) | undefined = undefined;

  // Resource color mapping based on our design system
  const resourceColors: Record<string, string> = {
    energy: 'var(--astriarch-energy)', // Yellow
    ore: 'var(--astriarch-ore)',       // Orange
    iridium: 'var(--astriarch-iridium)', // Purple
    food: 'var(--astriarch-food)'      // Green (if needed)
  };

  // Filter out zero costs and sort for consistent display order
  $: displayCosts = Object.entries(cost)
    .filter(([_, amount]) => amount > 0)
    .sort(([a], [b]) => {
      const order = ['energy', 'ore', 'iridium', 'food'];
      return order.indexOf(a) - order.indexOf(b);
    });
</script>

<button 
  class="w-full text-left relative group transition-all duration-200
         {isSelected 
           ? 'bg-astriarch-ui-dark-blue/50 border-astriarch-primary' 
           : 'bg-astriarch-ui-dark-grey/30 border-astriarch-ui-medium-grey/20 hover:border-astriarch-primary/50'
         }
         border rounded-lg p-3 hover:bg-astriarch-ui-dark-blue/30"
  on:click={onClick}
>
  <!-- Background decorative shape matching Figma design -->
  <div class="absolute inset-0 opacity-10">
    <!-- Angled corner effect -->
    <div class="absolute top-0 right-0 w-4 h-4 bg-astriarch-primary transform rotate-45 translate-x-2 -translate-y-2"></div>
  </div>

  <div class="relative z-10">
    <!-- Item name -->
    <div class="text-astriarch-body-14-semibold text-astriarch-ui-white mb-1">
      {name}
    </div>

    <!-- Description (if provided) -->
    {#if description}
      <div class="text-astriarch-caption-10 text-astriarch-ui-light-grey mb-2">
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
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style="background-color: {resourceColors[resource] || 'var(--astriarch-ui-medium-grey)'}"
            ></div>
            <!-- Resource amount -->
            <span class="text-astriarch-caption-12-semibold text-astriarch-ui-white">
              {amount}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Hover effect overlay -->
  <div class="absolute inset-0 bg-astriarch-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none"></div>
</button>
