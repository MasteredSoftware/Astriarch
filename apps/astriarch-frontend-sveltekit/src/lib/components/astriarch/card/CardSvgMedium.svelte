<script lang="ts">
  export let enabled = true;
  
  const uid = Math.random().toString(36).substr(2, 9);
  const disabledGradientId = `paint0_linear_278_58_${uid}`;
  const enabledFilterId = `filter0_d_116_7246_${uid}`;
</script>

{#if !enabled}
  <svg xmlns="http://www.w3.org/2000/svg" width="115" height="76" viewBox="0 0 115 76" fill="none">
    <path
      d="M106.707 65.2071L106.719 65.1949L106.731 65.1823L113.462 57.9705C113.808 57.6001 114 57.1124 114 56.6058V3C114 1.89543 113.105 1 112 1H3C1.89543 1 1 1.89543 1 3V73C1 74.1046 1.89543 75 3 75H96.0858C96.6162 75 97.1249 74.7893 97.5 74.4142L106.707 65.2071Z"
      fill="white"
      fill-opacity="0.1"
      stroke="url(#{disabledGradientId})"
      stroke-width="2"
    />
    <defs>
      <linearGradient id={disabledGradientId} x1="2" y1="38" x2="113" y2="38" gradientUnits="userSpaceOnUse">
        <stop stop-color="#15181F" />
        <stop offset="1" stop-color="#313E46" />
      </linearGradient>
    </defs>
  </svg>
{:else}
  <svg xmlns="http://www.w3.org/2000/svg" width="115" height="76" viewBox="0 0 115 76" fill="none">
    <g filter="url(#{enabledFilterId})" transform="translate(-40,-18)">
      <path
        d="M42 21C42 20.4477 42.4477 20 43 20H152C152.552 20 153 20.4477 153 21V74.6058C153 74.8591 152.904 75.103 152.731 75.2882L146 82.5L136.793 91.7071C136.605 91.8946 136.351 92 136.086 92H43C42.4477 92 42 91.5523 42 91V21Z"
        fill="#1B1F25"
        fill-opacity="0.5"
        shape-rendering="crispEdges"
      />
      <path
        d="M146.707 83.2071L146.719 83.1949L146.731 83.1823L153.462 75.9705C153.808 75.6001 154 75.1124 154 74.6058V21C154 19.8954 153.105 19 152 19H43C41.8954 19 41 19.8954 41 21V91C41 92.1046 41.8954 93 43 93H136.086C136.616 93 137.125 92.7893 137.5 92.4142L146.707 83.2071Z"
        stroke="#00FFFF"
        stroke-width="2"
        shape-rendering="crispEdges"
      />
    </g>
    <defs>
      <filter
        id={enabledFilterId}
        x="0"
        y="-6"
        width="195"
        height="156"
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
        <feOffset dy="16" />
        <feGaussianBlur stdDeviation="20" />
        <feComposite in2="hardAlpha" operator="out" />
        <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0" />
        <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_116_7246" />
        <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_116_7246" result="shape" />
      </filter>
    </defs>
  </svg>
{/if}
