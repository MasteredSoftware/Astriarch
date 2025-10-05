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
