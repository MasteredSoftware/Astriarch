<script lang="ts">
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';
	import { Fleet } from 'astriarch-engine/src/engine/fleet';
	import IconImage from '$lib/components/astriarch/icon-image/IconImage.svelte';
	import type { IconImageType } from '$lib/components/astriarch/types.js';

	export let ships: StarshipData[];
	export let shipType: StarShipType;

	// Map StarShipType to IconImageType
	function getShipIconType(shipType: StarShipType, isCustom: boolean = false): IconImageType {
		const suffix = isCustom ? '_custom' : '';

		switch (shipType) {
			case StarShipType.SystemDefense:
				return `defender${suffix}` as IconImageType;
			case StarShipType.Scout:
				return `scout${suffix}` as IconImageType;
			case StarShipType.Destroyer:
				return `destroyer${suffix}` as IconImageType;
			case StarShipType.Cruiser:
				return `cruiser${suffix}` as IconImageType;
			case StarShipType.Battleship:
				return `battleship${suffix}` as IconImageType;
			case StarShipType.SpacePlatform:
				return `space_platform${suffix}` as IconImageType;
			default:
				return `scout${suffix}` as IconImageType;
		}
	}

	// Calculate average health percentage across all ships
	function getAverageHealthPercentage(ships: StarshipData[]): number {
		if (ships.length === 0) return 0;

		const totalHealthPercentage = ships.reduce((sum, ship) => {
			const maxHealth = Fleet.maxStrength(ship);
			const currentHealth = ship.health;
			return sum + (currentHealth / maxHealth) * 100;
		}, 0);

		return Math.round(totalHealthPercentage / ships.length);
	}

	function getHealthColor(percentage: number): string {
		if (percentage >= 75) return '#00FF38'; // Status/Good - Green
		if (percentage >= 50) return '#FFF500'; // Status/Medium - Yellow
		if (percentage >= 25) return '#FFA500'; // Orange
		return '#FF0000'; // Status/bad - Red
	}

	$: shipCount = ships.length;
	$: averageHealth = getAverageHealthPercentage(ships);
	$: hasCustomShip = ships.some((ship) => !!ship.customShipData);
</script>

<div class="relative h-[36px] w-[50px]" title="{shipCount} ships - Avg Health: {averageHealth}%">
	<!-- Frame with gradient border using clip-path technique -->
	<div class="absolute inset-0">
		<!-- Gradient border background -->
		<div
			class="absolute inset-0 rounded-[0.125rem]"
			style="background: linear-gradient(349deg, #313E46 -1.31%, rgba(160, 176, 186, 0.54) 29.03%, #FFF 48.61%, rgba(105, 116, 123, 0.83) 95.74%);"
		></div>
		<!-- Inner content area that covers the gradient, leaving only the border visible -->
		<div class="absolute inset-[2px] rounded-[1px] bg-[rgba(0,0,0,0.85)]"></div>
	</div>

	<!-- Ship Count - Centered at top -->
	<div class="absolute top-[0px] left-[35px] z-10 -translate-x-1/2">
		<span
			class="text-[12px] leading-[16px] font-black tracking-[0.5px] whitespace-nowrap text-white"
			style="font-family: 'Orbitron', sans-serif;"
		>
			{shipCount}
		</span>
	</div>

	<!-- Ship Icon - Left side with shadow -->
	<div
		class="absolute top-[4px] left-[4px] h-[24px] w-[24px] shadow-[0px_0px_18px_0px_rgba(125,251,255,0.25)]"
	>
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="h-[34px] w-[34px] scale-y-[-1] rotate-180">
				<IconImage
					type={getShipIconType(shipType, hasCustomShip)}
					size={34}
					altText={`${shipType} ship`}
					class="h-full w-full"
				/>
			</div>
		</div>
	</div>

	<!-- Health Bar - Middle -->
	<div
		class="absolute top-[75%] right-[4%] bottom-[20%] left-[4%] flex items-center justify-center"
	>
		<div class="h-[8px] w-[46px] scale-y-[-1]">
			<div class="relative h-full w-full">
				<div class="absolute inset-0 bg-[rgba(27,31,37,0.65)]"></div>
				<!-- Health bars (4 segments) -->
				{#each Array(4) as _, i}
					<div
						class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] shadow-[0px_0px_14px_0px_rgba(255,255,255,0.24)]"
						style="left: {2.63 + i * 24.35}%; background-color: {getHealthColor(
							averageHealth
						)}; opacity: {averageHealth > (i + 1) * 25
							? 1
							: averageHealth > i * 25
								? Math.min(1, (averageHealth - i * 25) / 25)
								: 0.1}"
					></div>
				{/each}
			</div>
		</div>
	</div>
</div>
