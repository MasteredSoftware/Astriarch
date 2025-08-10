<script lang="ts">
	// Import the SVG logo directly
	import logoSvg from '$lib/assets/logo/logo.svg';
	
	export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
	export let variant: 'default' | 'white' | 'primary' = 'default';
	export let type: 'text' | 'image' = 'image'; // Default to image since we have the SVG
	export let className: string = '';

	// Size configurations for container height
	const sizeClasses = {
		sm: 'h-6', // ~24px height
		md: 'h-8', // ~32px height
		lg: 'h-12', // ~48px height
		xl: 'h-16' // ~64px height
	};

	// Typography sizes for text logo
	const typographySizes = {
		sm: 'text-astriarch-headline-24',
		md: 'text-astriarch-headline-32',
		lg: 'text-astriarch-headline-42',
		xl: 'text-astriarch-headline-56'
	};

	// Variant color classes using our design system
	const variantClasses = {
		default: 'text-astriarch-ui-light-grey',
		white: 'text-astriarch-ui-white',
		primary: 'text-astriarch-primary'
	};

	const logoText = 'ASTRIARCH';
</script>

<div
	class="inline-flex items-center {sizeClasses[size]} {className}"
	role="img"
	aria-label="Astriarch Logo"
>
	{#if type === 'text'}
		<!-- Text-based logo using our typography system -->
		<span
			class="{typographySizes[size]} {variantClasses[
				variant
			]} leading-none font-bold tracking-wider"
		>
			{logoText}
		</span>
	{:else}
		<!-- SVG-based logo using the Figma asset -->
		<img
			src={logoSvg}
			alt="Astriarch"
			class="h-full w-auto object-contain"
			style="filter: {variant === 'primary'
				? 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.5))'
				: variant === 'white'
					? 'brightness(0) invert(1)'
					: 'drop-shadow(0 0 5px rgba(0, 255, 255, 0.3))'}"
		/>
	{/if}
</div>
