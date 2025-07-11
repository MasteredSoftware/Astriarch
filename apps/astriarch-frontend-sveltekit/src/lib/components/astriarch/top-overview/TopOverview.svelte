<script lang="ts">
  import TopOverviewItem from '../top-overview-item/TopOverviewItem.svelte';
  import type { ResourceData } from '../types.js';

  export let resourceData: ResourceData;
  export let population: number;

  type $$Props = {
    resourceData: ResourceData;
    population: number;
    class?: string;
    [key: string]: any;
  };
</script>

<div class="relative inline-flex gap-[26px] {$$props.class || ''}" {...$$restProps}>
  <TopOverviewItem type="population" amount={population} />
  <TopOverviewItem
    type="research"
    amount={resourceData.total.research}
    amountPerTurn={resourceData.perTurn.research}
  />
  <TopOverviewItem 
    type="energy" 
    amount={resourceData.total.energy} 
    amountPerTurn={resourceData.perTurn.energy} 
  />
  <TopOverviewItem 
    type="food" 
    amount={resourceData.total.food} 
    amountPerTurn={resourceData.perTurn.food} 
  />
  <TopOverviewItem 
    type="ore" 
    amount={resourceData.total.ore} 
    amountPerTurn={resourceData.perTurn.ore} 
  />
  <TopOverviewItem
    type="iridium"
    amount={resourceData.total.iridium}
    amountPerTurn={resourceData.perTurn.iridium}
  />
  <slot />
</div>
