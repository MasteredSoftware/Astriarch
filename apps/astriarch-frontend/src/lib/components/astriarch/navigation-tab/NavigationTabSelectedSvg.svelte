<script lang="ts">
	interface Props {
		onclick?: () => void;
		scale?: number;
	}

	let { onclick, scale = 1 }: Props = $props();
	const width = 241 * scale;
	const height = 48 * scale;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={width}
	height={height}
	viewBox="13 14 241 48"
	fill="none"
	style="pointer-events: none;"
>
	<g opacity="0.9" filter="url(#filter0_d_143_69439)">
		<path
			style="pointer-events: all; cursor: pointer;"
			{onclick}
			onkeydown={(e) => e.key === 'Enter' && onclick?.()}
			role="button"
			tabindex="0"
			d="M188.3 14H15.9625C15.0054 14 14.5951 15.2153 15.3565 15.7954L73.852 60.3635C75.2454 61.4251 76.9487 62 78.7004 62H251.037C251.995 62 252.405 60.7847 251.643 60.2046L193.148 15.6365C191.755 14.5749 190.051 14 188.3 14Z"
			fill="#00FFFF"
		/>
		<path
			style="pointer-events: none;"
			d="M75.0641 58.7726L18.9251 16H188.3C189.613 16 190.891 16.4312 191.936 17.2274L248.075 60H78.7004C77.3866 60 76.1091 59.5688 75.0641 58.7726ZM250.431 61.7954C250.43 61.7947 250.429 61.7939 250.428 61.7932L250.431 61.7954Z"
			stroke="url(#paint0_linear_143_69439)"
			stroke-width="4"
		/>
	</g>
	<defs>
		<filter
			id="filter0_d_143_69439"
			x="0.960571"
			y="0"
			width="265.079"
			height="76"
			filterUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feFlood flood-opacity="0" result="BackgroundImageFix" />
			<feColorMatrix
				in="SourceAlpha"
				type="matrix"
				values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
				result="hardAlpha"
			/>
			<feOffset />
			<feGaussianBlur stdDeviation="7" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.24 0" />
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_143_69439" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_143_69439" result="shape" />
		</filter>
		<linearGradient
			id="paint0_linear_143_69439"
			x1="274"
			y1="62"
			x2="271.948"
			y2="6.79807"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="#313E46" />
			<stop offset="0.312574" stop-color="#A0B0BA" stop-opacity="0.536702" />
			<stop offset="0.514382" stop-color="white" />
			<stop offset="1" stop-color="#69747B" stop-opacity="0.83338" />
		</linearGradient>
	</defs>
</svg>
