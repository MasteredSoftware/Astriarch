<script lang="ts">
	const uid = Math.random().toString(36).substr(2, 9);
	const filterId = `filter0_d_4_17214_${uid}`;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="211" height="52" viewBox="0 0 211 52" fill="none">
	<g filter="url(#{filterId})" transform="translate(-18,-16)">
		<path
			d="M218.388 57.6607L218.397 57.6503L218.406 57.6397L227.537 46.6677C227.836 46.3084 228 45.8558 228 45.3883V19C228 17.8954 227.105 17 226 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H209.264C209.838 67 210.385 66.7528 210.765 66.3215L218.388 57.6607Z"
			stroke="#00FFFF"
			stroke-width="2"
			shape-rendering="crispEdges"
		/>
	</g>
	<defs>
		<filter
			id={filterId}
			x="-14"
			y="0"
			width="275"
			height="116"
			filterUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feFlood flood-opacity="0" result="BackgroundImageFix" />
			<feOffset dy="16" />
			<feGaussianBlur stdDeviation="16" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4_17214" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4_17214" result="shape" />
		</filter>
	</defs>
</svg>
