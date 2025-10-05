<script lang="ts">
	export let className: string = '';
	export let strokeColor: string = 'var(--astriarch-primary)';
	export let strokeOpacity: number = 0.25;
</script>

<!-- Responsive SVG - outermost stroke layer -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 1700 1060"
	fill="none"
	class="h-full w-full {className}"
	preserveAspectRatio="none"
>
	<g filter="url(#stroke3-filter)">
		<path
			d="M276.063 16C280.828 16 285.485 17.4186 289.44 20.0742L354.872 64H1605.6C1611.91 64 1617.96 66.4871 1622.45 70.9072L1622.88 71.3408L1647.32 96.6836L1672.66 121.123L1673.09 121.552C1677.51 126.036 1680 132.086 1680 138.399V931.078C1680 936.562 1678.12 941.876 1674.69 946.138L1674.35 946.547L1606.13 1027.47L1606.13 1027.47C1601.57 1032.88 1594.86 1036 1587.78 1036H249.691C244.453 1036 239.359 1034.29 235.186 1031.12V1031.12L183.618 992H44C30.7452 992 20 981.255 20 968V40C20 26.7452 30.7451 16 44 16H276.063Z"
			stroke="var(--astriarch-ui-dark-grey)"
			stroke-opacity="0.5"
			stroke-width="32"
			shape-rendering="crispEdges"
		/>
		<path
			d="M276.063 16C280.828 16 285.485 17.4186 289.44 20.0742L354.872 64H1605.6C1611.91 64 1617.96 66.4871 1622.45 70.9072L1622.88 71.3408L1647.32 96.6836L1672.66 121.123L1673.09 121.552C1677.51 126.036 1680 132.086 1680 138.399V931.078C1680 936.562 1678.12 941.876 1674.69 946.138L1674.35 946.547L1606.13 1027.47L1606.13 1027.47C1601.57 1032.88 1594.86 1036 1587.78 1036H249.691C244.453 1036 239.359 1034.29 235.186 1031.12V1031.12L183.618 992H44C30.7452 992 20 981.255 20 968V40C20 26.7452 30.7451 16 44 16H276.063Z"
			stroke="url(#stroke3-gradient)"
			stroke-opacity={strokeOpacity}
			stroke-width="32"
			shape-rendering="crispEdges"
		/>
	</g>
	<defs>
		<filter
			id="stroke3-filter"
			x="0"
			y="0"
			width="1700"
			height="1060"
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
			<feOffset dy="4" />
			<feGaussianBlur stdDeviation="8" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 0 0 0 0.15 0" />
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_113_7874" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_113_7874" result="shape" />
		</filter>
		<linearGradient
			id="stroke3-gradient"
			x1="1681.65"
			y1="1060.15"
			x2="88.1367"
			y2="-32.8751"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color={strokeColor} />
			<stop offset="1" stop-color="var(--astriarch-ui-white)" />
		</linearGradient>
	</defs>
</svg>
