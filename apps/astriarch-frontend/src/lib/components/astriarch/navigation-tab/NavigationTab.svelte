<script lang="ts">
	import Text from '../text/Text.svelte';
	import NavigationTabSelectedSvg from './NavigationTabSelectedSvg.svelte';
	import NavigationTabUnselectedSvg from './NavigationTabUnselectedSvg.svelte';

	interface Props {
		label: string;
		selected: boolean;
		zIndex?: number;
		onclick?: () => void;
		orientation?: 'horizontal' | 'vertical';
	}

	let { label, selected, zIndex = 1, onclick, orientation = 'horizontal' }: Props = $props();
</script>

{#if orientation === 'vertical'}
	<!-- Vertical Mode Tab Layout (Horizontal arrangement with smaller SVGs) -->
	<div class="pointer-events-none relative w-[172px]" style="z-index: {zIndex}">
		<Text
			class="pointer-events-none absolute top-0 left-0 w-[240px] text-center text-sm leading-12 font-extrabold tracking-[2px] uppercase"
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
{:else}
	<!-- Horizontal Tab Layout (Original) -->
	<div class="pointer-events-none relative w-[172px]" style="z-index: {zIndex}">
		<Text
			class="pointer-events-none absolute top-0 left-0 w-[240px] text-center text-sm leading-12 font-extrabold tracking-[2px] uppercase"
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
{/if}
