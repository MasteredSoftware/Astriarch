<script lang="ts">
  const uid = Math.random().toString(36).substr(2, 9);
  const filterId = `filter0_d_111_90_${uid}`;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="161" height="52" viewBox="0 0 161 52" fill="none">
  <g filter="url(#{filterId})" transform="translate(-16,-1)">
    <path
      d="M166.388 42.6607L166.397 42.6503L166.406 42.6397L175.537 31.6677C175.836 31.3084 176 30.8558 176 30.3883V4C176 2.89544 175.105 2 174 2H19C17.8954 2 17 2.89543 17 4V50C17 51.1046 17.8954 52 19 52H157.264C157.838 52 158.385 51.7528 158.765 51.3214L166.388 42.6607Z"
      stroke="#00FFFF"
      stroke-width="2"
      shape-rendering="crispEdges"
    />
  </g>
  <defs>
    <filter
      id={filterId}
      x="0"
      y="0"
      width="193"
      height="84"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB"
    >
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feOffset dy="15" />
      <feGaussianBlur stdDeviation="8" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 0.0823529 0 0 0 0 0.0941176 0 0 0 0 0.121569 0 0 0 0.2 0" />
      <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_111_90" />
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_111_90" result="shape" />
    </filter>
  </defs>
</svg>
