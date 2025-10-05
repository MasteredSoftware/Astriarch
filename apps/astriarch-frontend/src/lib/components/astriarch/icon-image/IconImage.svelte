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
	import volumeMutedIcon from '$lib/assets/icons/volume_muted.svg';
	import shipAttackIcon from '$lib/assets/icons/ship_attack.svg';
	import shipDefenseIcon from '$lib/assets/icons/ship_defense.svg';
	import shipSpeedIcon from '$lib/assets/icons/ship_speed.svg';
	import farmIcon from '$lib/assets/icons/farm.svg';
	import mineIcon from '$lib/assets/icons/mine.svg';
	import colonyIcon from '$lib/assets/icons/colony.svg';
	import factoryIcon from '$lib/assets/icons/factory.svg';
	import spacePlatformIcon from '$lib/assets/icons/space_platform.svg';
	import defenderIcon from '$lib/assets/icons/defender.svg';
	import defenderCustomIcon from '$lib/assets/icons/defender_custom.svg';
	import scoutIcon from '$lib/assets/icons/scout.svg';
	import scoutCustomIcon from '$lib/assets/icons/scout_custom.svg';
	import destroyerIcon from '$lib/assets/icons/destroyer.svg';
	import destroyerCustomIcon from '$lib/assets/icons/destroyer_custom.svg';
	import cruiserIcon from '$lib/assets/icons/cruiser.svg';
	import cruiserCustomIcon from '$lib/assets/icons/cruiser_custom.svg';
	import battleshipIcon from '$lib/assets/icons/battleship.svg';
	import battleshipCustomIcon from '$lib/assets/icons/battleship_custom.svg';

	const iconMap = {
		energy: energyIcon,
		exit: exitIcon,
		food: foodIcon,
		iridium: iridiumIcon,
		ore: oreIcon,
		population: populationIcon,
		research: researchIcon,
		volume: volumeIcon,
		volume_muted: volumeMutedIcon,
		ship_attack: shipAttackIcon,
		ship_defense: shipDefenseIcon,
		ship_speed: shipSpeedIcon,
		farm: farmIcon,
		mine: mineIcon,
		colony: colonyIcon,
		factory: factoryIcon,
		space_platform: spacePlatformIcon,
		defender: defenderIcon,
		defender_custom: defenderCustomIcon,
		scout: scoutIcon,
		scout_custom: scoutCustomIcon,
		destroyer: destroyerIcon,
		destroyer_custom: destroyerCustomIcon,
		cruiser: cruiserIcon,
		cruiser_custom: cruiserCustomIcon,
		battleship: battleshipIcon,
		battleship_custom: battleshipCustomIcon
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
