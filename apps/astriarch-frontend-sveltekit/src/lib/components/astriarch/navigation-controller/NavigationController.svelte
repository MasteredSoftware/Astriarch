<script lang="ts">
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
      <div 
        class="relative w-[172px] mx-1 cursor-pointer"
        role="button"
        tabindex="0"
        onclick={() => handleTabClick(i)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleTabClick(i);
          }
        }}
      >
        <!-- Tab background -->
        <div 
          class="absolute top-0 left-0 right-0 bottom-0 rounded-t border border-solid transition-all duration-200 z-0"
          class:bg-cyan-400={i === selectedIndex}
          class:bg-transparent={i !== selectedIndex}
          class:border-cyan-400={i === selectedIndex}
          class:border-cyan-300={i !== selectedIndex}
          class:opacity-100={i === selectedIndex}
          class:opacity-70={i !== selectedIndex}
        ></div>
        
        <!-- Tab text -->
        <div 
          class="relative text-sm font-extrabold leading-[48px] tracking-[2px] uppercase text-center z-10"
          class:text-[#1B1F25]={i === selectedIndex}
          class:text-white={i !== selectedIndex}
        >
          {item.label}
        </div>
      </div>
    {/each}
  </div>
  
  <!-- Content area -->
  <div>
    {#if items[selectedIndex]?.content}
      {@render items[selectedIndex].content()}
    {/if}
  </div>
</div>
