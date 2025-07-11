<script lang="ts">
  import type { IconImageType } from '../types.js';
  
  export let type: IconImageType;
  export let size: number = 32;
  export let altText: string | undefined = undefined;
  
  // Import all the icons statically
  import energyIcon from '$lib/assets/icons/energy.svg';
  import exitIcon from '$lib/assets/icons/exit.svg';
  import foodIcon from '$lib/assets/icons/food.svg';
  import iridiumIcon from '$lib/assets/icons/iridium.svg';
  import oreIcon from '$lib/assets/icons/ore.svg';
  import populationIcon from '$lib/assets/icons/population.svg';
  import researchIcon from '$lib/assets/icons/research.svg';
  import volumeIcon from '$lib/assets/icons/volume.svg';

  const iconMap = {
    energy: energyIcon,
    exit: exitIcon,
    food: foodIcon,
    iridium: iridiumIcon,
    ore: oreIcon,
    population: populationIcon,
    research: researchIcon,
    volume: volumeIcon,
  };

  $: icon = iconMap[type];
  $: alt = altText ?? type.charAt(0).toUpperCase() + type.slice(1);
  
  $: containerStyle = `
    width: ${size}px;
    height: ${size}px;
    display: flex;
    justify-content: center;
    align-items: center;
  `;
</script>

<div style={containerStyle} {...$$restProps}>
  <img src={icon} {alt} />
</div>
