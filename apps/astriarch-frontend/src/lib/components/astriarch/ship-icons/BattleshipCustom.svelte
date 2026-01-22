<script lang="ts">
	export let size: number = 32;
	let className: string = '';
	export { className as class };
	
	const uid = Math.random().toString(36).substring(2, 9);
	const filter0Id = `filter0_d_battleship_custom_${uid}`;
	const filter1Id = `filter1_d_battleship_custom_${uid}`;
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
				d="M30.5772 23.9008L35 18L35 47.6446L31.9594 52L18 46.9421L18 42.7273L28.0894 24.7438L28.0894 35.9835L30.5772 35.9835L30.5772 23.9008Z"
				fill="#13F3FB"
			/>
			<path
				d="M39.4228 23.9008L35 18L35 47.6446L38.0407 52L52 46.9421L52 42.7273L41.9106 24.7438L41.9106 35.9835L39.4228 35.9835L39.4228 23.9008Z"
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
			x="7.8"
			y="7.8"
			width="54.4"
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
