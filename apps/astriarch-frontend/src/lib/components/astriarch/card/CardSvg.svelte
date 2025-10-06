<script lang="ts">
	import type { Size } from '../types.js';
	import CardSvgLarge from './CardSvgLarge.svelte';
	import CardSvgMedium from './CardSvgMedium.svelte';

	export let size: Size = 'lg';
	export let enabled = true;

	$: component = size === 'lg' ? CardSvgLarge : CardSvgMedium;
</script>

<div class="absolute top-0">
	<svelte:component this={component} {enabled} />
</div>
