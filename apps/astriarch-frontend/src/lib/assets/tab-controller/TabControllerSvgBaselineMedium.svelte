<script lang="ts">
	let { id }: { id: string } = $props();
	const filterId = `filter0_b_4_23086_${id}`;
	const paintId = `paint0_linear_4_23086_${id}`;
</script>

<svg width="952" height="2" viewBox="0 0 952 2" fill="none" xmlns="http://www.w3.org/2000/svg">
	<g filter="url(#{filterId})">
		<path
			d="M1 1H951"
			stroke="url(#{paintId})"
			stroke-opacity="0.65"
			stroke-width="2"
			stroke-linecap="round"
		/>
	</g>
	<defs>
		<filter
			id={filterId}
			x="-16"
			y="-16"
			width="984"
			height="34"
			filterUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feFlood flood-opacity="0" result="BackgroundImageFix" />
			<feGaussianBlur in="BackgroundImageFix" stdDeviation="8" />
			<feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_4_23086" />
			<feBlend
				mode="normal"
				in="SourceGraphic"
				in2="effect1_backgroundBlur_4_23086"
				result="shape"
			/>
		</filter>
		<linearGradient
			id={paintId}
			x1="891"
			y1="44.5"
			x2="-55.214"
			y2="22.2944"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="white" stop-opacity="0" />
			<stop offset="0.681822" stop-color="#13F3FB" />
			<stop offset="1" stop-color="white" />
		</linearGradient>
	</defs>
</svg>
