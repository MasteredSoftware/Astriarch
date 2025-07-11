<script lang="ts">
  import SvgContainer from '../SvgContainer.svelte';
  
  export let size: 'lg' | 'md' | 'sm' | 'xs' = 'lg';
  export let variant: 'primary' | 'outline' = 'primary';
</script>

<SvgContainer>
  {#if variant === 'primary'}
    {#if size === 'lg'}
      <!-- Original SVG with overflow contained -->
      <svg xmlns="http://www.w3.org/2000/svg" width="211" height="52" viewBox="0 0 211 52" fill="none">
        <g filter="url(#filter0_d_206_13299)" transform="translate(-18,-16)">
          <path
            d="M20 19C20 18.4477 20.4477 18 21 18H226C226.552 18 227 18.4477 227 19V45.3883C227 45.622 226.918 45.8484 226.769 46.028L217.638 57L210.014 65.6607C209.824 65.8764 209.551 66 209.264 66H21C20.4477 66 20 65.5523 20 65V19Z"
            fill="#00FFFF"
            shapeRendering="crispEdges"
          />
          <path
            d="M218.388 57.6607L218.397 57.6503L218.406 57.6397L227.537 46.6677C227.836 46.3084 228 45.8558 228 45.3883V19C228 17.8954 227.105 17 226 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H209.264C209.838 67 210.385 66.7528 210.765 66.3215L218.388 57.6607Z"
            stroke="url(#paint0_linear_206_13299)"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter
            id="filter0_d_206_13299"
            x="-14"
            y="0"
            width="275"
            height="116"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_206_13299" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_206_13299" result="shape" />
          </filter>
          <linearGradient
            id="paint0_linear_206_13299"
            x1="20"
            y1="42"
            x2="180.264"
            y2="128.546"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    {/if}
  {/if}
</SvgContainer>
