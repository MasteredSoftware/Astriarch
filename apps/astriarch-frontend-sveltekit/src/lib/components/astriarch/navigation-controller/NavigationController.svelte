<script lang="ts">
  import NavigationTab from '../navigation-tab/NavigationTab.svelte';
  
  interface NavigationItem {
    label: string;
    content?: any;
    onclick?: () => void;
  }
  
  interface Props {
    items: NavigationItem[];
    initialSelectedIndex?: number;
    onchange?: (index: number) => void;
  }
  
  let { 
    items,
    initialSelectedIndex = 0,
    onchange,
    ...restProps 
  }: Props = $props();
  
  let selectedIndex = $state(initialSelectedIndex);
  
  function handleTabClick(index: number) {
    selectedIndex = index;
    if (onchange) {
      onchange(index);
    }
    if (items[index].onclick) {
      items[index].onclick!();
    }
  }
</script>

<div class="relative" {...restProps}>
  <div 
    class="relative flex justify-center items-center h-12 w-full bg-black/60 border-t border-cyan-300/30 shadow-[0px_-4px_16px_rgba(0,0,0,0.5)] backdrop-blur-[5px]"
  >
    {#each items as item, i}
      <NavigationTab
        label={item.label}
        selected={i === selectedIndex}
        zIndex={items.length - i}
        onclick={() => handleTabClick(i)}
      />
    {/each}
  </div>
  
  <!-- Content area -->
  <div>
    {#if items[selectedIndex]?.content}
      {@render items[selectedIndex].content()}
    {/if}
  </div>
</div>
