<script lang="ts">
	import Text from '../text/Text.svelte';
	import NavigationTabSelectedSvg from './NavigationTabSelectedSvg.svelte';
	import NavigationTabUnselectedSvg from './NavigationTabUnselectedSvg.svelte';

	interface Props {
		label: string;
		shortcutKey?: string;
		selected: boolean;
		zIndex?: number;
		onclick?: () => void;
		orientation?: 'horizontal' | 'vertical';
	}

	interface LabelParts {
		before: string;
		match: string;
		after: string;
	}

	let {
		label,
		shortcutKey,
		selected,
		zIndex = 1,
		onclick,
		orientation = 'horizontal'
	}: Props = $props();

	function getLabelParts(text: string, key?: string): LabelParts {
		if (!key) {
			return { before: text, match: '', after: '' };
		}

		const matchIndex = text.toLowerCase().indexOf(key.toLowerCase());
		if (matchIndex === -1) {
			return { before: text, match: '', after: '' };
		}

		return {
			before: text.slice(0, matchIndex),
			match: text.slice(matchIndex, matchIndex + 1),
			after: text.slice(matchIndex + 1)
		};
	}

	const labelParts = $derived(getLabelParts(label, shortcutKey));
</script>

{#if orientation === 'vertical'}
	<!-- Vertical Mode Tab Layout (Horizontal arrangement with smaller SVGs) -->
	<div class="pointer-events-none relative" style="z-index: {zIndex}; width: 103px;">
		<Text
			class="pointer-events-none absolute top-0 left-0 text-center text-xs leading-[29px] font-extrabold tracking-[1px] uppercase"
			style="z-index: 100; color: {selected ? '#1B1F25' : '#FFF'}; width: 144px;"
		>
			{#if labelParts.match}
				{labelParts.before}<u class="underline decoration-2">{labelParts.match}</u
				>{labelParts.after}
			{:else}
				{label}
			{/if}
		</Text>

		{#if selected}
			<NavigationTabSelectedSvg {onclick} scale={0.6} ariaLabel={label} />
		{:else}
			<NavigationTabUnselectedSvg {onclick} scale={0.6} ariaLabel={label} />
		{/if}
	</div>
{:else}
	<!-- Horizontal Tab Layout (Original) -->
	<div class="pointer-events-none relative w-[172px]" style="z-index: {zIndex}">
		<Text
			class="pointer-events-none absolute top-0 left-0 w-[240px] text-center text-sm leading-12 font-extrabold tracking-[2px] uppercase"
			style="z-index: 100; color: {selected ? '#1B1F25' : '#FFF'};"
		>
			{#if labelParts.match}
				{labelParts.before}<u class="underline decoration-2">{labelParts.match}</u
				>{labelParts.after}
			{:else}
				{label}
			{/if}
		</Text>

		{#if selected}
			<NavigationTabSelectedSvg {onclick} ariaLabel={label} />
		{:else}
			<NavigationTabUnselectedSvg {onclick} ariaLabel={label} />
		{/if}
	</div>
{/if}
