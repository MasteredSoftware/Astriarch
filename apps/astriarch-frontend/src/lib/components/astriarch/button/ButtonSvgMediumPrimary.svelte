<script lang="ts">
	interface Props {
		color?: string;
	}

	let { color = '#00FFFF' }: Props = $props();

	const uid = Math.random().toString(36).substr(2, 9);
	const filterId = `filter0_d_206_13297_${uid}`;
	const gradientId = `paint0_linear_206_13297_${uid}`;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="161" height="52" viewBox="0 0 161 52" fill="none">
	<g filter="url(#{filterId})" transform="translate(-18,-16)">
		<path
			d="M20 19C20 18.4477 20.4477 18 21 18H176C176.552 18 177 18.4477 177 19V45.3883C177 45.622 176.918 45.8484 176.769 46.028L167.638 57L160.014 65.6607C159.824 65.8764 159.551 66 159.264 66H21C20.4477 66 20 65.5523 20 65V19Z"
			fill={color}
			shape-rendering="crispEdges"
		/>
		<path
			d="M168.388 57.6607L168.397 57.6503L168.406 57.6397L177.537 46.6677C177.836 46.3084 178 45.8558 178 45.3883V19C178 17.8954 177.105 17 176 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H159.264C159.838 67 160.385 66.7528 160.765 66.3214L168.388 57.6607Z"
			stroke="url(#{gradientId})"
			stroke-opacity="0.75"
			stroke-width="2"
			shape-rendering="crispEdges"
		/>
	</g>
	<defs>
		<filter
			id={filterId}
			x="-14"
			y="0"
			width="225"
			height="116"
			filterUnits="userSpaceOnUse"
			color-interpolation-filters="sRGB"
		>
			<feFlood flood-opacity="0" result="BackgroundImageFix" />
			<feOffset dy="16" />
			<feGaussianBlur stdDeviation="16" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_113_143" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_113_143" result="shape" />
		</filter>
		<linearGradient
			id={gradientId}
			x1="20"
			y1="42"
			x2="154.446"
			y2="97.0664"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color="white" />
			<stop offset="0.244808" stop-opacity="0.25" />
			<stop offset="0.500575" stop-opacity="0.5" />
			<stop offset="0.761963" stop-opacity="0.25" />
			<stop offset="1" stop-color="white" />
		</linearGradient>
	</defs>
</svg>
