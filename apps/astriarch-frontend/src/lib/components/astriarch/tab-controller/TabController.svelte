<script lang="ts">
	import TabControllerSvgBaselineSmall from '$lib/assets/tab-controller/TabControllerSvgBaselineSmall.svelte';
	import TabControllerSvgBaselineMedium from '$lib/assets/tab-controller/TabControllerSvgBaselineMedium.svelte';
	import TabControllerSvgBaselineLarge from '$lib/assets/tab-controller/TabControllerSvgBaselineLarge.svelte';
	import Tab from '../tab/Tab.svelte';
	import type { TabControllerTab, Size } from '../types.js';

	interface Props {
		tabs: TabControllerTab[];
		size?: Size;
		onclick?: () => void;
		children?: any;
	}

	let { tabs, size = 'sm', onclick, children, ...restProps }: Props = $props();

	let tabIndex = $state(0);

	// Generate unique ID for SVG
	const uniqueId = Math.random().toString(36).substring(2, 15);

	function handleTabChange(index: number) {
		tabIndex = index;
		// Call the tab's onclick handler if it exists
		tabs[index]?.onclick?.();
	}
</script>

<div class="relative" {...restProps}>
	<!-- Tab headers -->
	<div class="flex border-none">
		{#each tabs as tab, i}
			<Tab
				label={tab.label}
				selected={i === tabIndex}
				onclick={() => handleTabChange(i)}
				style="z-index: {i === tabIndex ? tabs.length : tabs.length - i};"
			/>
		{/each}
	</div>

	<!-- Tab baseline SVG -->
	<div class="relative top-0 left-2">
		{#if size === 'xs' || size === 'sm'}
			<TabControllerSvgBaselineSmall id={uniqueId} />
		{:else if size === 'md'}
			<TabControllerSvgBaselineMedium id={uniqueId} />
		{:else}
			<TabControllerSvgBaselineLarge id={uniqueId} />
		{/if}
	</div>

	<!-- Tab panels -->
	<div>
		{#if tabs[tabIndex]?.children}
			{@render tabs[tabIndex].children?.()}
		{/if}
	</div>

	{#if children}
		{@render children()}
	{/if}
</div>
