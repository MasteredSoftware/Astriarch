<script lang="ts">
	export let size: number = 32;
	let className: string = '';
	export { className as class };

	const uid = Math.random().toString(36).substring(2, 9);
	const filter0Id = `filter0_d_destroyer_custom_${uid}`;
	const filter1Id = `filter1_d_destroyer_custom_${uid}`;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 65 67"
	fill="none"
	class={className}
>
	<g filter="url(#{filter0Id})">
		<g filter="url(#{filter1Id})">
			<path
				d="M40.5075 29.702L32.5 18L32.5 35.4503L40.5075 40.9934L40.5075 49L47 43.8676L44.8358 39.1457L44.8358 27.649L42.0224 24.5695L40.5075 29.702Z"
				fill="#13F3FB"
			/>
			<path
				d="M24.4925 29.702L32.5 18L32.5 35.4503L24.4925 40.9934L24.4925 49L18 43.8676L20.1642 39.1457L20.1642 27.649L22.9776 24.5695L24.4925 29.702Z"
				fill="#13F3FB"
			/>
		</g>
	</g>
	<defs>
		<filter
			id={filter0Id}
			x="-3"
			y="-1"
			width="70"
			height="70"
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
			<feGaussianBlur stdDeviation="9" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 0.489808 0 0 0 0 0.982407 0 0 0 0 1 0 0 0 0.25 0"
			/>
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
		</filter>
		<filter
			id={filter1Id}
			x="7.8"
			y="7.8"
			width="49.4"
			height="51.4"
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
			<feGaussianBlur stdDeviation="5.1" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix
				type="matrix"
				values="0 0 0 0 1 0 0 0 0 0.641369 0 0 0 0 0.373149 0 0 0 0.4 0"
			/>
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow" result="shape" />
		</filter>
	</defs>
</svg>
