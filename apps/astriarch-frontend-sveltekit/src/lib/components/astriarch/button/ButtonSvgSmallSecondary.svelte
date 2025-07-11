<script lang="ts">
  const uid = Math.random().toString(36).substr(2, 9);
  const filterId = `filter0_d_4_17223_${uid}`;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="91" height="52" viewBox="0 0 91 52" fill="none">
  <g filter="url(#{filterId})" transform="translate(-18,-16)">
    <path
      d="M98.3883 57.6607L98.3974 57.6503L98.4063 57.6397L107.537 46.6677C107.836 46.3084 108 45.8557 108 45.3883V19C108 17.8954 107.105 17 106 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H89.2636C89.8383 67 90.3852 66.7528 90.7649 66.3214L98.3883 57.6607Z"
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
      width="155"
      height="116"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB"
    >
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feOffset dy="16" />
      <feGaussianBlur stdDeviation="16" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4_17223" />
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4_17223" result="shape" />
    </filter>
  </defs>
</svg>
