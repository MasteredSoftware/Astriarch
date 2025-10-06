<script lang="ts">
	import type { Size } from '../types.js';
	import CardSvg from './CardSvg.svelte';

	interface Props {
		children?: any;
		label?: string;
		size?: Size;
		enabled?: boolean;
		onclick?: () => void;
		class?: string;
	}

	let {
		children,
		label = '',
		size = 'lg',
		enabled = true,
		onclick,
		class: className,
		...restProps
	}: Props = $props();

	const cardWidth = $derived(size === 'lg' ? '109px' : '115px');
	const cardHeight = $derived(size === 'lg' ? '136px' : '76px');

	const cardStyle = $derived(`
    width: ${cardWidth};
    height: ${cardHeight};
    background-color: transparent;
  `);

	const textStyle = $derived(`
    color: #FFF;
    font-size: 14px;
    font-weight: 400;
    line-height: 28px;
    letter-spacing: 0.14px;
    z-index: 100;
    position: relative;
    padding-top: 20px;
    padding-left: 16px;
  `);

	function handleClick() {
		onclick?.();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	style={cardStyle}
	class="relative {className || ''}"
	onclick={handleClick}
	onkeydown={(e) => {
		if (onclick && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			handleClick();
		}
	}}
	role={onclick ? 'button' : undefined}
	tabindex={onclick ? 0 : undefined}
	{...restProps}
>
	<!-- SVG Background (behind content) -->
	<CardSvg {size} {enabled} />

	<!-- Content layer (above SVG) -->
	<div class="relative z-10">
		{#if label}
			<div style={textStyle}>
				{label}
			</div>
		{/if}
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>
