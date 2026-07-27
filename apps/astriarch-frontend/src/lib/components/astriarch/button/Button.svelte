<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { keyboardShortcutService } from '$lib/services/keyboardShortcuts';
	import { getLabelParts } from '$lib/utils/hotkeyLabel';
	import type { Size } from '../types.js';
	import ButtonSvg from './ButtonSvg.svelte';

	interface Props {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		children?: any;
		label?: string;
		size?: Size;
		variant?: 'primary' | 'outline' | 'secondary' | 'warning' | 'danger';
		onclick?: () => void;
		disabled?: boolean;
		class?: string;
		hotkey?: string; // Single character hotkey (e.g., 'a', 's', 'o')
		hotkeyContext?: string; // Optional context for the hotkey
	}

	let {
		children,
		label = '',
		size = 'lg',
		variant = 'primary',
		onclick,
		disabled = false,
		class: className,
		hotkey,
		hotkeyContext,
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
    overflow: visible;
  `);

	const textColor = $derived(() => {
		switch (variant) {
			case 'outline':
				return '#0FF'; // Cyan
			case 'secondary':
				return '#FFFFFF'; // White
			case 'warning':
				return '#FFFFFF'; // White
			case 'danger':
				return '#FFFFFF'; // White
			case 'primary':
			default:
				return '#1B1F25'; // Dark (for cyan background)
		}
	});

	const textStyle = $derived(`
    color: ${textColor()};
    font-size: 14px;
    font-weight: 800;
    line-height: 20px;
    letter-spacing: 2px;
    z-index: 20;
    text-transform: uppercase;
    text-align: center;
    position: relative;
    pointer-events: none;
  `);

	const labelParts = $derived(getLabelParts(label, hotkey));

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

	// Register hotkey on mount
	onMount(() => {
		if (hotkey && onclick) {
			keyboardShortcutService.registerShortcut(
				hotkey.toLowerCase(),
				(event: KeyboardEvent) => {
					event.preventDefault(); // Always prevent default browser behavior
					if (!disabled) {
						onclick();
					}
				},
				hotkeyContext
			);
		}
	});

	// Unregister hotkey on destroy
	onDestroy(() => {
		if (hotkey) {
			keyboardShortcutService.unregisterShortcut(hotkey.toLowerCase(), hotkeyContext);
		}
	});
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
		{:else if hotkey && label}
			{#if labelParts.match}
				{labelParts.before}<u class="hotkeyChar">{labelParts.match}</u>{labelParts.after}
			{:else}
				{label}
			{/if}
		{:else}
			{label}
		{/if}
	</span>
	<ButtonSvg {size} {variant} />
</button>
