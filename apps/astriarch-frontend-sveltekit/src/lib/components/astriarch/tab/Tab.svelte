<script lang="ts">
	import TabSvgSelected from './TabSvgSelected.svelte';
	import TabSvgUnselected from '$lib/assets/tab/TabSvgUnselected.svelte';

	interface Props {
		label: string;
		selected: boolean;
		onclick?: () => void;
		style?: string;
	}

	let { label, selected, onclick, style, ...restProps }: Props = $props();

	// Generate unique ID for SVG
	const uniqueId = Math.random().toString(36).substring(2, 15);
</script>

<div
	class="relative w-[180px] cursor-pointer"
	{style}
	role="button"
	tabindex="0"
	{onclick}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			onclick?.();
		}
	}}
	{...restProps}
>
	<div
		class="relative z-[100] text-center text-sm leading-5 font-extrabold tracking-[2px] text-white uppercase"
		class:text-shadow-[0px_4px_4px_rgba(0,0,0,0.25)]={!selected}
		style={!selected ? '-webkit-text-stroke: 1px #000;' : ''}
	>
		{label}
	</div>

	<div class="absolute top-0 left-0">
		{#if selected}
			<TabSvgSelected />
		{:else}
			<TabSvgUnselected id={uniqueId} />
		{/if}
	</div>
</div>
