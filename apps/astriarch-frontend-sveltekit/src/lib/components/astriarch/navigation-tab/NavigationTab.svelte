<script lang="ts">
  import Text from '../text/Text.svelte';
  import NavigationTabSelectedSvg from './NavigationTabSelectedSvg.svelte';
  import NavigationTabUnselectedSvg from './NavigationTabUnselectedSvg.svelte';

  interface Props {
    label: string;
    selected: boolean;
    zIndex?: number;
    onclick?: () => void;
  }

  let { label, selected, zIndex = 1, onclick }: Props = $props();
</script>

<div class="relative w-[172px] pointer-events-none" style="z-index: {zIndex}">
  <Text
    class="absolute top-0 left-0 w-[240px] text-center uppercase font-extrabold text-sm tracking-[2px] leading-12 pointer-events-none"
    style="z-index: 100; color: {selected ? '#1B1F25' : '#FFF'};"
  >
    {label}
  </Text>
  
  {#if selected}
    <NavigationTabSelectedSvg {onclick} />
  {:else}
    <NavigationTabUnselectedSvg {onclick} />
  {/if}
</div>
