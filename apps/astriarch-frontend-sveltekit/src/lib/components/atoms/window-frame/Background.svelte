<script lang="ts">
	export let className: string = '';
</script>

<!-- Responsive SVG background -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 1728 1118"
	fill="none"
	class="h-full w-full {className}"
	preserveAspectRatio="none"
>
	<defs>
		<linearGradient
			id="bg-gradient"
			x1="100%"
			y1="100%"
			x2="5%"
			y2="-10%"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="var(--astriarch-ui-dark-blue)" />
			<stop offset="1" stop-color="var(--astriarch-ui-dark-grey)" />
		</linearGradient>
	</defs>

	<!-- Main background shape -->
	<path
		d="M52 67.5L293.499 67.5L344.001 118.001L1677 118.001L1677 156L1677 963L1625.5 1014.5L293.499 1014.5L207.001 1051L52 1051L52 67.5Z"
		fill="url(#bg-gradient)"
		fill-opacity="0.8"
	/>
</svg>
