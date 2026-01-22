<script lang="ts">
	export let size: number = 32;
	let className: string = '';
	export { className as class };
	
	// Generate unique IDs for filters to avoid conflicts
	const uid = Math.random().toString(36).substring(2, 9);
	const filter0Id = `filter0_d_defender_custom_${uid}`;
	const filter1Id = `filter1_d_defender_custom_${uid}`;
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 61 58"
	fill="none"
	class={className}
>
	<g filter="url(#{filter0Id})">
		<g filter="url(#{filter1Id})">
			<path
				d="M42.4096 39.4659L30.2048 18.2059V32.9698L36.1104 39.4659H42.4096Z"
				fill="#13F3FB"
			/>
			<path d="M18 39.4659L30.2048 18.2059V32.9698L24.2993 39.4659H18Z" fill="#13F3FB" />
		</g>
	</g>
	<defs>
		<filter
			id={filter0Id}
			x="0"
			y="-2"
			width="61"
			height="61"
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
			y="8.00589"
			width="44.8097"
			height="41.66"
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
