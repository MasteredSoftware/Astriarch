<script lang="ts">
	export let size: number = 32;
	let className: string = '';
	export { className as class };

	const uid = Math.random().toString(36).substring(2, 9);
	const filter0Id = `filter0_d_cruiser_custom_${uid}`;
	const filter1Id = `filter1_d_cruiser_custom_${uid}`;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 70 70"
	fill="none"
	class={className}
>
	<g filter="url(#{filter0Id})">
		<g filter="url(#{filter1Id})">
			<path
				d="M52 43.2571L37.04 18L37.04 28.2971L35.0971 28.2971L35.0971 45.9771L38.0114 45.9771L38.0114 52L47.1429 45.0057L48.5029 45.0057L52 43.2571Z"
				fill="#13F3FB"
			/>
			<path
				d="M18.1943 43.2571L33.1543 18L33.1543 28.2971L35.0971 28.2971L35.0971 45.9771L32.1829 45.9771L32.1829 52L23.0514 45.0057L21.6914 45.0057L18.1943 43.2571Z"
				fill="#13F3FB"
			/>
		</g>
	</g>
	<defs>
		<filter
			id={filter0Id}
			x="0"
			y="0"
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
			x="7.99434"
			y="7.8"
			width="54.2057"
			height="54.4"
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
