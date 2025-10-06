<script lang="ts">
	interface Props {
		variant?: 'primary' | 'secondary';
		class?: string;
	}

	let { variant = 'secondary', class: className }: Props = $props();

	const { width, height } = { width: 241, height: 84 };

	// Colors based on variant
	const fillColor = variant === 'primary' ? '#00FFFF' : 'transparent';
	const strokeColor = '#00FFFF';
</script>

<svg
	{width}
	{height}
	viewBox="0 0 241 84"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class="pointer-events-none absolute inset-0 {className || ''}"
>
	<defs>
		{#if variant === 'primary'}
			<linearGradient
				id="paint0_linear"
				x1="20"
				y1="42"
				x2="171.051"
				y2="115.689"
				gradientUnits="userSpaceOnUse"
			>
				<stop stop-color="white" />
				<stop offset="0.244808" stop-opacity="0.25" />
				<stop offset="0.500575" stop-opacity="0.5" />
				<stop offset="0.761963" stop-opacity="0.25" />
				<stop offset="1" stop-color="white" />
			</linearGradient>
		{/if}
	</defs>

	<!-- Primary variant with fill -->
	{#if variant === 'primary'}
		<path
			d="M20 19C20 18.4477 20.4477 18 21 18H206C206.552 18 207 18.4477 207 19V45.3883C207 45.622 206.918 45.8484 206.769 46.028L197.638 57L190.014 65.6607C189.824 65.8764 189.551 66 189.264 66H21C20.4477 66 20 65.5523 20 65V19Z"
			fill={fillColor}
			shape-rendering="crispEdges"
		/>
	{/if}

	<!-- Border path for both variants -->
	<path
		d="M206 17C207.105 17 208 17.8954 208 19V45.3887C208 45.856 207.836 46.3088 207.537 46.668L198.406 57.6396L198.389 57.6611L190.765 66.3213C190.385 66.7526 189.838 67 189.264 67H21C19.8954 67 19 66.1046 19 65V19C19 17.8954 19.8954 17 21 17H206Z"
		stroke={variant === 'primary' ? `url(#paint0_linear)` : strokeColor}
		stroke-opacity={variant === 'primary' ? '0.75' : '1'}
		stroke-width="2"
		shape-rendering="crispEdges"
		fill="none"
	/>
</svg>
