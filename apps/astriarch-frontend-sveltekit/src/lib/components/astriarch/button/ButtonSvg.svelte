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
		variant?: 'primary' | 'outline';
	}

	let { size = 'lg', variant = 'primary' }: Props = $props();

	const componentBySizePrimary = {
		lg: ButtonSvgLargePrimary,
		md: ButtonSvgMediumPrimary,
		sm: ButtonSvgSmallPrimary,
		xs: ButtonSvgSmallPrimary
	};

	const componentBySizeSecondary = {
		lg: ButtonSvgLargeSecondary,
		md: ButtonSvgMediumSecondary,
		sm: ButtonSvgSmallSecondary,
		xs: ButtonSvgSmallSecondary
	};

	const Component = $derived(
		variant === 'primary' ? componentBySizePrimary[size] : componentBySizeSecondary[size]
	);
</script>

<div
	class="pointer-events-none absolute top-0 left-0 flex h-full w-full items-center justify-center"
>
	<div style="position: relative;">
		<Component />
	</div>
</div>
