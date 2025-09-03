<script lang="ts">
	import NotificationSvgSmall from '$lib/assets/notification/NotificationSvgSmall.svelte';
	import NotificationSvgMedium from '$lib/assets/notification/NotificationSvgMedium.svelte';
	import NotificationSvgLarge from '$lib/assets/notification/NotificationSvgLarge.svelte';
	import type { Size } from '../types.js';

	interface Props {
		label?: string; // Make label optional since we can use children
		size?: Size;
		onclick?: () => void;
		children?: any;
	}

	let { label, size = 'sm', onclick, children, ...restProps }: Props = $props();

	// Generate unique ID for SVG
	const uniqueId = Math.random().toString(36).substring(2, 15);

	// Get dimensions based on size
	const dimensions = {
		xs: { width: '277px', height: '64px' },
		sm: { width: '277px', height: '64px' },
		md: { width: '277px', height: '84px' },
		lg: { width: '277px', height: '104px' }
	};

	const currentDimensions = dimensions[size];
</script>

<div
	class="relative cursor-pointer bg-transparent"
	style="width: {currentDimensions.width}; height: {currentDimensions.height};"
	role="button"
	tabindex="0"
	{onclick}
	{...restProps}
>
	<!-- Content area where children will be rendered, or fallback to label -->
	<div class="absolute top-5 left-4 z-10 text-sm leading-7 font-normal tracking-[0.14px]">
		{#if children}
			{@render children()}
		{:else if label}
			<span class="text-white">{label}</span>
		{/if}
	</div>

	<!-- SVG Background -->
	<div class="absolute top-0 left-0">
		{#if size === 'xs' || size === 'sm'}
			<NotificationSvgSmall id={uniqueId} />
		{:else if size === 'md'}
			<NotificationSvgMedium id={uniqueId} />
		{:else}
			<NotificationSvgLarge id={uniqueId} />
		{/if}
	</div>
</div>
