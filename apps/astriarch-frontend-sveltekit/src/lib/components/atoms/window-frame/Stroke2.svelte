<script lang="ts">
	export let className: string = '';
	export let strokeColor: string = 'var(--astriarch-primary)';
	export let strokeOpacity: number = 0.75;
</script>

<!-- Responsive SVG - middle stroke layer -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	viewBox="0 0 1668 1028"
	fill="none"
	class="h-full w-full {className}"
	preserveAspectRatio="none"
>
	<g filter="url(#stroke2-filter)">
		<path
			d="M260.063 8C263.24 8 266.344 8.94548 268.981 10.7158L336.437 56H1589.6C1593.94 56 1598.1 57.7665 1601.12 60.8936L1625.66 86.3418L1651.11 110.882C1654.23 113.897 1656 118.055 1656 122.399V915.078C1656 918.852 1654.67 922.505 1652.23 925.391L1584.01 1006.31C1580.97 1009.92 1576.5 1012 1571.78 1012H233.691C230.418 1012 227.228 1011 224.55 1009.13L224.021 1008.75L170.309 968H28C19.1634 968 12 960.837 12 952V24C12 15.1635 19.1634 8 28 8H260.063Z"
			stroke="var(--astriarch-ui-dark-grey)"
			stroke-opacity="0.5"
			stroke-width="16"
			shape-rendering="crispEdges"
		/>
		<path
			d="M260.063 8C263.24 8 266.344 8.94548 268.981 10.7158L336.437 56H1589.6C1593.94 56 1598.1 57.7665 1601.12 60.8936L1625.66 86.3418L1651.11 110.882C1654.23 113.897 1656 118.055 1656 122.399V915.078C1656 918.852 1654.67 922.505 1652.23 925.391L1584.01 1006.31C1580.97 1009.92 1576.5 1012 1571.78 1012H233.691C230.418 1012 227.228 1011 224.55 1009.13L224.021 1008.75L170.309 968H28C19.1634 968 12 960.837 12 952V24C12 15.1635 19.1634 8 28 8H260.063Z"
			stroke="url(#stroke2-gradient)"
			stroke-opacity={strokeOpacity}
			stroke-width="16"
			shape-rendering="crispEdges"
		/>
	</g>
	<defs>
		<filter
			id="stroke2-filter"
			x="0"
			y="0"
			width="1668"
			height="1028"
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
			<feGaussianBlur stdDeviation="2" />
			<feComposite in2="hardAlpha" operator="out" />
			<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0" />
			<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_111_101" />
			<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_111_101" result="shape" />
		</filter>
		<linearGradient
			id="stroke2-gradient"
			x1="1657.65"
			y1="1028.15"
			x2="72.1367"
			y2="-64.8751"
			gradientUnits="userSpaceOnUse"
		>
			<stop stop-color={strokeColor} />
			<stop offset="1" stop-color="var(--astriarch-ui-white)" />
		</linearGradient>
	</defs>
</svg>
