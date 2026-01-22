<script lang="ts">
	import { StarShipType, type StarshipData } from 'astriarch-engine/src/model/fleet';
	import { Fleet } from 'astriarch-engine/src/engine/fleet';
	import { GameTools } from 'astriarch-engine/src/utils/gameTools';
	import IconImage from '$lib/components/astriarch/icon-image/IconImage.svelte';
	import type { IconImageType } from '$lib/components/astriarch/types.js';

	export let ship: StarshipData;
	export let isSelected: boolean = false;
	export let onToggleSelection: () => void;

	// Map StarShipType to IconImageType, considering if it's a custom ship
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
				return `scout${suffix}` as IconImageType; // fallback
		}
	}

	// Get ship type display name
	function getShipTypeName(shipType: StarShipType): string {
		switch (shipType) {
			case StarShipType.SystemDefense:
				return 'Defender';
			case StarShipType.Scout:
				return 'Scout';
			case StarShipType.Destroyer:
				return 'Destroyer';
			case StarShipType.Cruiser:
				return 'Cruiser';
			case StarShipType.Battleship:
				return 'Battleship';
			case StarShipType.SpacePlatform:
				return 'Space Platform';
			default:
				return 'Unknown';
		}
	}

	function getHealthPercentage(ship: StarshipData): number {
		// Calculate actual health percentage based on current health vs max strength
		const maxHealth = Fleet.maxStrength(ship);
		const currentHealth = ship.health;
		return Math.round((currentHealth / maxHealth) * 100);
	}

	function getExperiencePercentage(ship: StarshipData): number {
		// Calculate experience percentage towards next level
		const baseStrength = Fleet.getStarshipTypeBaseStrength(ship.type);
		const levelInfo = Fleet.starShipLevel(ship, baseStrength);

		// If at max level, show 100%
		if (levelInfo.level >= 10) {
			return 100;
		}

		// Calculate experience needed for current level and next level
		const currentExp = ship.experienceAmount;
		const nextLevelExpRequired = levelInfo.nextLevelExpRequirement;

		// Calculate experience required for current level (simplified approximation)
		let currentLevelExpRequired = 0;
		let tempExp = baseStrength / 2; // First level requirement

		for (let i = 0; i < levelInfo.level; i++) {
			currentLevelExpRequired += tempExp;
			tempExp += Math.round(tempExp / 2);
		}

		// Calculate progress towards next level
		const expForThisLevel = nextLevelExpRequired - currentLevelExpRequired;
		const expProgress = Math.max(0, currentExp - currentLevelExpRequired);

		return Math.round((expProgress / expForThisLevel) * 100);
	}

	function getHealthColor(percentage: number): string {
		if (percentage >= 75) return '#00FF38'; // Status/Good - Green
		if (percentage >= 50) return '#FFF500'; // Status/Medium - Yellow
		if (percentage >= 25) return '#FFA500'; // Orange
		return '#FF0000'; // Status/bad - Red
	}
</script>

<button
	type="button"
	class="relative h-[72px] w-[90px] cursor-pointer transition-all hover:scale-105 focus:ring-2 focus:ring-cyan-400 focus:outline-none"
	onclick={onToggleSelection}
	aria-label="Toggle selection of {GameTools.starShipTypeToFriendlyName(
		ship.type,
		!!ship.customShipData
	)} (ID: {ship.id}, Health: {ship.health})"
	aria-pressed={isSelected}
	title="{GameTools.starShipTypeToFriendlyName(ship.type, !!ship.customShipData)} - Health: {ship.health}/{Fleet.maxStrength(
		ship
	)}, Level: {Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type))
		.level}, Experience: {ship.experienceAmount}"
>
	<!-- Frame with selection border -->
	<div
		class="absolute inset-0 rounded-[4px] border-[3.6px] bg-black/15 {isSelected
			? 'border-[#00FFFF]'
			: 'border-[#313E46]'}"
	></div>

	<!-- Ship Icon - Much larger, takes up most of the card -->
	<div
		class="absolute top-[-7.2px] left-[14.4px] h-[61.2px] w-[61.2px]"
	>
		<div class="absolute inset-0 flex items-center justify-center">
			<div class="h-[61.2px] w-[61.2px]">
				<div
					class="relative h-full w-full transition-all duration-200"
					style="filter: {isSelected
						? 'brightness(0) saturate(100%) invert(85%) sepia(78%) saturate(2476%) hue-rotate(159deg) brightness(103%) contrast(101%)'
						: 'none'}"
				>
					<IconImage
						type={getShipIconType(ship.type, !!ship.customShipData)}
						size={61}
						altText={GameTools.starShipTypeToFriendlyName(ship.type, !!ship.customShipData)}
						class="h-full w-full"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Experience Bars - Overlaid on ship icon at bottom -->
	<div class="absolute top-[75%] right-[4%] bottom-[5%] left-[4%]">
		<div
			class="absolute inset-0 rounded-br-[3.6px] rounded-bl-[3.6px] bg-[rgba(27,31,37,0.65)]"
		></div>
		<!-- Experience bar fill - continuous left to right -->
		{#each Array(4) as _, i}
			<div
				class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] bg-[#23BDFF] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
				style="left: {2.63 + i * 24.35}%; opacity: {getExperiencePercentage(ship) > (i + 1) * 25
					? 1
					: getExperiencePercentage(ship) > i * 25
						? Math.min(1, (getExperiencePercentage(ship) - i * 25) / 25)
						: 0.1}"
			></div>
		{/each}
	</div>

	<!-- Health Bar - Overlaid on ship icon in middle -->
	<div
		class="absolute top-[60%] right-[4%] bottom-[20%] left-[4%] flex items-center justify-center"
	>
		<div class="h-[14.4px] w-[82.8px]">
			<div class="relative h-full w-full">
				<div class="absolute inset-0 bg-[rgba(27,31,37,0.65)]"></div>
				<!-- Health bars (4 segments) -->
				{#each Array(4) as _, i}
					<div
						class="absolute top-[25%] bottom-[25%] w-[20%] rounded-[1px] shadow-[0px_0px_25.2px_0px_rgba(255,255,255,0.24)]"
						style="left: {2.63 + i * 24.35}%; background-color: {getHealthColor(
							getHealthPercentage(ship)
						)}; opacity: {getHealthPercentage(ship) > (i + 1) * 25
							? 1
							: getHealthPercentage(ship) > i * 25
								? Math.min(1, (getHealthPercentage(ship) - i * 25) / 25)
								: 0.1}"
					></div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Level Indicator - Top left corner -->
	{#if Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type)).level > 0}
		<div class="absolute top-[5%] left-[8%]">
			<div class="min-w-[16px] rounded-sm bg-[rgba(27,31,37,0.8)] px-1 py-0.5 text-center">
				<span class="text-[8px] leading-none font-bold text-[#23BDFF]">
					{Fleet.starShipLevel(ship, Fleet.getStarshipTypeBaseStrength(ship.type)).level}
				</span>
			</div>
		</div>
	{/if}

	<!-- Ship Type Label -->
	<div class="absolute right-0 bottom-[-18px] left-0 text-center">
		<span class="text-[8px] font-bold tracking-wider text-white/60 uppercase">
			{getShipTypeName(ship.type)}
		</span>
	</div>
</button>
