<script lang="ts">
	import type { Size } from '../types.js';
	import ButtonSvgLargePrimary from './ButtonSvgLargePrimary.svelte';
	import ButtonSvgMediumPrimary from './ButtonSvgMediumPrimary.svelte';
	import ButtonSvgSmallPrimary from './ButtonSvgSmallPrimary.svelte';
	import ButtonSvgLargeSecondary from './ButtonSvgLargeSecondary.svelte';
	import ButtonSvgMediumSecondary from './ButtonSvgMediumSecondary.svelte';
	import ButtonSvgSmallSecondary from './ButtonSvgSmallSecondary.svelte';

	interface Props {
		size?: Size;
		variant?: 'primary' | 'outline' | 'secondary' | 'warning' | 'danger';
	}

	let { size = 'lg', variant = 'primary' }: Props = $props();

	// Map variants to colors
	const colorByVariant = {
		primary: '#00FFFF',
		outline: undefined, // Uses outline/stroke only
		secondary: '#888888',
		warning: '#FF6B35',
		danger: '#DC2626'
	};

	const fillColor = $derived(colorByVariant[variant]);
	const isOutline = $derived(variant === 'outline');

	const componentBySizeFilled = {
		lg: ButtonSvgLargePrimary,
		md: ButtonSvgMediumPrimary,
		sm: ButtonSvgSmallPrimary,
		xs: ButtonSvgSmallPrimary
	};

	const componentBySizeOutline = {
		lg: ButtonSvgLargeSecondary,
		md: ButtonSvgMediumSecondary,
		sm: ButtonSvgSmallSecondary,
		xs: ButtonSvgSmallSecondary
	};

	const Component = $derived(
		isOutline ? componentBySizeOutline[size] : componentBySizeFilled[size]
	);
</script>

<div
	class="pointer-events-none absolute top-0 left-0 flex h-full w-full items-center justify-center"
>
	<div style="position: relative;">
		<Component color={fillColor} />
	</div>
</div>
