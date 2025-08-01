<script lang="ts">
	import type { Size } from '../types.js';
	import ButtonSvg from './ButtonSvg.svelte';

	interface Props {
		children?: any;
		label?: string;
		size?: Size;
		variant?: 'primary' | 'outline';
		onclick?: () => void;
		disabled?: boolean;
		class?: string;
	}

	let {
		children,
		label = '',
		size = 'lg',
		variant = 'primary',
		onclick,
		disabled = false,
		class: className,
		...restProps
	}: Props = $props();

	const widthBySize = {
		lg: '211px', // Match SVG width
		md: '161px', // Match SVG width
		sm: '91px', // Match SVG width
		xs: '91px' // Match SVG width (same as sm)
	} as const;

	const heightBySize = {
		lg: '52px', // Match SVG height
		md: '52px', // Match SVG height
		sm: '52px', // Match SVG height
		xs: '52px'
	} as const;

	const buttonStyle = $derived(`
    width: ${widthBySize[size]};
    height: ${heightBySize[size]};
    background-color: transparent;
    border: none;
    border-radius: 0;
    padding: 0;
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    position: relative;
    opacity: ${disabled ? 0.5 : 1};
    display: flex;
    align-items: center;
    justify-content: center;
  `);

	const textColor = $derived(variant === 'outline' ? '#0FF' : '#1B1F25');

	const textStyle = $derived(`
    color: ${textColor};
    font-size: 14px;
    font-weight: 800;
    line-height: 20px;
    letter-spacing: 2px;
    z-index: 10;
    text-transform: uppercase;
    text-align: center;
    position: relative;
    pointer-events: none;
  `);

	function handleClick() {
		if (!disabled) {
			onclick?.();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
			event.preventDefault();
			onclick?.();
		}
	}
</script>

<button
	onclick={handleClick}
	onkeydown={handleKeydown}
	style={buttonStyle}
	class="transition-opacity hover:opacity-90 active:opacity-100 {className || ''}"
	{disabled}
	{...restProps}
>
	<span style={textStyle}>
		{#if children}
			{@render children()}
		{:else}
			{label}
		{/if}
	</span>
	<ButtonSvg {size} {variant} />
</button>
