<script lang="ts">
	import NavigationTab from '../navigation-tab/NavigationTab.svelte';

	interface NavigationItem {
		label: string;
		content?: any;
		onclick?: () => void;
	}

	interface Props {
		items: NavigationItem[];
		initialSelectedIndex?: number;
		onchange?: (index: number) => void;
		orientation?: 'horizontal' | 'vertical';
	}

	let {
		items,
		initialSelectedIndex = 0,
		onchange,
		orientation = 'horizontal',
		...restProps
	}: Props = $props();

	let selectedIndex = $state(initialSelectedIndex);

	function handleTabClick(index: number) {
		selectedIndex = index;
		if (onchange) {
			onchange(index);
		}
		if (items[index].onclick) {
			items[index].onclick!();
		}
	}
</script>

<div class="relative" {...restProps} style="z-index: 100;">
	{#if orientation === 'vertical'}
		<!-- Vertical Navigation (for landscape sidebar) - Horizontal tab layout -->
		<div
			class="relative flex h-[24px] w-full flex-row items-center justify-start border-b border-l border-cyan-300/30 bg-black/60 shadow-[4px_0px_16px_rgba(0,0,0,0.5)] backdrop-blur-[5px]"
		>
			{#each items as item, i}
				<NavigationTab
					label={item.label}
					selected={i === selectedIndex}
					zIndex={items.length - i}
					onclick={() => handleTabClick(i)}
					orientation="vertical"
				/>
			{/each}
		</div>
	{:else}
		<!-- Horizontal Navigation (default, for portrait bottom bar) -->
		<div
			class="relative flex h-12 w-full items-center justify-center border-t border-cyan-300/30 bg-black/60 shadow-[0px_-4px_16px_rgba(0,0,0,0.5)] backdrop-blur-[5px]"
		>
			{#each items as item, i}
				<NavigationTab
					label={item.label}
					selected={i === selectedIndex}
					zIndex={items.length - i}
					onclick={() => handleTabClick(i)}
				/>
			{/each}
		</div>
	{/if}

	<!-- Content area -->
	<div>
		{#if items[selectedIndex]?.content}
			{@render items[selectedIndex].content()}
		{/if}
	</div>
</div>
