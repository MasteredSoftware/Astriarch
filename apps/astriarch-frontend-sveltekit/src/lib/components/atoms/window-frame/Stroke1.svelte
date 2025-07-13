<script lang="ts">
  export let className: string = '';
  export let strokeColor: string = 'var(--astriarch-primary)';
  export let strokeOpacity: number = 0.9;
</script>

<!-- Responsive SVG - innermost stroke layer -->
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 1636 996" 
  fill="none"
  class="w-full h-full {className}"
  preserveAspectRatio="none"
>
  <g filter="url(#stroke1-filter)">
    <path 
      d="M12 2H244.063C245.255 2 246.419 2.35465 247.408 3.01855L314.862 48.3027C316.511 49.4092 318.451 50 320.437 50H1573.6C1575.23 50 1576.79 50.6623 1577.92 51.835L1602.56 77.3887L1602.61 77.4395L1628.17 102.08C1629.34 103.211 1630 104.77 1630 106.399V899.078C1630 900.493 1629.5 901.863 1628.59 902.945L1560.37 983.867C1559.23 985.219 1557.55 986 1555.78 986H217.691C216.382 986 215.108 985.572 214.064 984.78L160.353 944.033C158.614 942.714 156.491 942 154.309 942H12C8.68629 942 6 939.314 6 936V8C6.00001 4.68629 8.6863 2 12 2Z" 
      stroke="var(--astriarch-ui-light-grey)" 
      stroke-width="4" 
      shape-rendering="crispEdges"
    />
    <path 
      d="M12 2H244.063C245.255 2 246.419 2.35465 247.408 3.01855L314.862 48.3027C316.511 49.4092 318.451 50 320.437 50H1573.6C1575.23 50 1576.79 50.6623 1577.92 51.835L1602.56 77.3887L1602.61 77.4395L1628.17 102.08C1629.34 103.211 1630 104.77 1630 106.399V899.078C1630 900.493 1629.5 901.863 1628.59 902.945L1560.37 983.867C1559.23 985.219 1557.55 986 1555.78 986H217.691C216.382 986 215.108 985.572 214.064 984.78L160.353 944.033C158.614 942.714 156.491 942 154.309 942H12C8.68629 942 6 939.314 6 936V8C6.00001 4.68629 8.6863 2 12 2Z" 
      stroke="url(#stroke1-gradient)" 
      stroke-opacity={strokeOpacity}
      stroke-width="4" 
      shape-rendering="crispEdges"
    />
  </g>
  <defs>
    <filter id="stroke1-filter" x="0" y="0" width="1636" height="996" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="4"/>
      <feGaussianBlur stdDeviation="3"/>
      <feComposite in2="hardAlpha" operator="out"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 1 0 0 0 0 1 0 0 0 0.25 0"/>
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_113_7872"/>
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_113_7872" result="shape"/>
    </filter>
    <linearGradient id="stroke1-gradient" x1="1631.65" y1="996.154" x2="88.1367" y2="-32.8751" gradientUnits="userSpaceOnUse">
      <stop stop-color={strokeColor} />
      <stop offset="1" stop-color="var(--astriarch-ui-white)" />
    </linearGradient>
  </defs>
</svg>
