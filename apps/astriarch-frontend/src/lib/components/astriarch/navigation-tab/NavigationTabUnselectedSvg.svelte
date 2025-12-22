<script lang="ts">
	interface Props {
		onclick?: () => void;
		scale?: number;
	}

	let { onclick, scale = 1 }: Props = $props();
	const width = 239 * scale;
	const height = 48 * scale;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={width}
	height={height}
	viewBox="0 0 239 48"
	fill="none"
	style="pointer-events: none;"
>
	<path
		style="pointer-events: all; cursor: pointer;"
		{onclick}
		onkeydown={(e) => e.key === 'Enter' && onclick?.()}
		role="button"
		tabindex="0"
		opacity="0.9"
		d="M61.0641 44.7726L4.92509 2H174.3C175.613 2 176.891 2.43121 177.936 3.22741L234.075 46H64.7004C63.3866 46 62.1091 45.5688 61.0641 44.7726ZM236.431 47.7954C236.43 47.7947 236.429 47.7939 236.428 47.7932L236.431 47.7954Z"
		fill="#1B1F25"
		stroke="url(#paint0_linear_143_69328)"
		stroke-width="4"
	/>
	<defs>
		<linearGradient
			id="paint0_linear_143_69328"
			x1="260"
			y1="48"
			x2="257.948"
			y2="-7.20193"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="#313E46" />
			<stop offset="0.312574" stop-color="#A0B0BA" stop-opacity="0.536702" />
			<stop offset="0.514382" stop-color="white" />
			<stop offset="1" stop-color="#69747B" stop-opacity="0.83338" />
		</linearGradient>
	</defs>
</svg>
