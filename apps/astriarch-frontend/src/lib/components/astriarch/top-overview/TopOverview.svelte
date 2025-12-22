<script lang="ts">
	import TopOverviewItem from '../top-overview-item/TopOverviewItem.svelte';
	import TopOverviewFrameSvg from './TopOverviewFrameSvg.svelte';
	import TopOverviewButton from '../top-overview-button/TopOverviewButton.svelte';
	import TopOverviewButtonBackgroundSvg from '../top-overview-button/TopOverviewButtonBackgroundSvg.svelte';
	import VolumeButton from '../top-overview-button/VolumeButton.svelte';
	import GameSpeedButton from '../top-overview-button/GameSpeedButton.svelte';
	import IconImage from '../icon-image/IconImage.svelte';
	import type { ResourceData } from '../types.js';

	export let resourceData: ResourceData = {
		total: { research: 0, energy: 0, food: 0, ore: 0, iridium: 0, production: 0 },
		perTurn: { research: 0, energy: 0, food: 0, ore: 0, iridium: 0, production: 0 }
	};
	export let population: number = 0;
	export let onExitGame: (() => void) | undefined = undefined;

	type $$Props = {
		resourceData: ResourceData;
		population: number;
		onExitGame?: () => void;
		class?: string;
		[key: string]: any;
	};

	function handleExitClick() {
		if (onExitGame) {
			onExitGame();
		}
	}
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
		color={resourceData.colors?.food}
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

	<!-- Volume Control Button -->
	<VolumeButton />

	<!-- Game Speed Control Button -->
	<GameSpeedButton />

	<!-- Exit Game Button -->
	{#if onExitGame}
		<TopOverviewButton onclick={handleExitClick} title="Exit Game">
			<IconImage type="exit" size={24} altText="Exit Game" />
		</TopOverviewButton>
	{/if}

	<!-- SVG Background Frame -->
	<div class="pointer-events-none absolute top-0 left-0" style="z-index: 2;">
		<TopOverviewFrameSvg />

		<!-- Volume Button Background positioned to align with volume button -->
		<div class="absolute top-0" style="left: 805px;">
			<TopOverviewButtonBackgroundSvg />
		</div>

		<!-- Game Speed Button Background positioned to align with speed button -->
		<div class="absolute top-0" style="left: 874px;">
			<TopOverviewButtonBackgroundSvg />
		</div>

		<!-- Exit Button Background positioned to align with exit button -->
		<div class="absolute top-0" style="left: 943px;">
			<TopOverviewButtonBackgroundSvg />
		</div>
	</div>

	<slot />
</div>
