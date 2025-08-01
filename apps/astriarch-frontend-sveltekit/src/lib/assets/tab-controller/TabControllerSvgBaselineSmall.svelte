<script lang="ts">
	let { id }: { id: string } = $props();
	const filterId = `filter0_b_4_28286_${id}`;
	const paintId = `paint0_linear_4_28286_${id}`;
</script>

<svg width="902" height="2" viewBox="0 0 902 2" fill="none" xmlns="http://www.w3.org/2000/svg">
	<g filter="url(#{filterId})">
		<path
			d="M1 1H901"
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
			width="934"
			height="34"
			filterUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feFlood flood-opacity="0" result="BackgroundImageFix" />
			<feGaussianBlur in="BackgroundImageFix" stdDeviation="8" />
			<feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_4_28286" />
			<feBlend
				mode="normal"
				in="SourceGraphic"
				in2="effect1_backgroundBlur_4_28286"
				result="shape"
			/>
		</filter>
		<linearGradient
			id={paintId}
			x1="844.158"
			y1="44.5"
			x2="-52.306"
			y2="24.5692"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="white" stop-opacity="0" />
			<stop offset="0.681822" stop-color="#13F3FB" />
			<stop offset="1" stop-color="white" />
		</linearGradient>
	</defs>
</svg>
