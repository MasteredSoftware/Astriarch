<script lang="ts">
  let { id }: { id: string } = $props();
  const filterId = `filter0_b_116_18187_${id}`;
  const paint0Id = `paint0_linear_116_18187_${id}`;
  const paint1Id = `paint1_linear_116_18187_${id}`;
</script>

<svg xmlns="http://www.w3.org/2000/svg" width="277" height="64" viewBox="0 0 277 64" fill="none">
  <g filter="url(#{filterId})">
    <path
      d="M236.728 0H2C0.895431 0 0 0.895431 0 2V50.5704C0 51.1025 0.212012 51.6126 0.589129 51.9879L6.58218 57.9528L12.0298 63.4126C12.405 63.7887 12.9144 64 13.4456 64H275C276.105 64 277 63.1046 277 62V37.1619C277 36.6021 276.765 36.0679 276.353 35.6891L238.081 0.527206C237.712 0.188149 237.229 0 236.728 0Z"
      fill="url(#{paint0Id})"
      fill-opacity="0.8"
    />
    <path
      d="M7.29008 57.2464L7.28761 57.244L1.29457 51.2792C1.106 51.0915 1 50.8364 1 50.5704V2C1 1.44772 1.44772 1 2 1H236.728C236.978 1 237.22 1.09407 237.404 1.2636L275.677 36.4255C275.883 36.6149 276 36.882 276 37.1619V62C276 62.5523 275.552 63 275 63H13.4456C13.18 63 12.9253 62.8943 12.7377 62.7063L7.29008 57.2464Z"
      stroke="url(#{paint1Id})"
      stroke-width="2"
    />
  </g>
  <defs>
    <filter
      id={filterId}
      x="-16"
      y="-16"
      width="309"
      height="96"
      filterUnits="userSpaceOnUse"
      color-interpolation-filters="sRGB"
    >
      <feFlood flood-opacity="0" result="BackgroundImageFix" />
      <feGaussianBlur in="BackgroundImageFix" stdDeviation="8" />
      <feComposite in2="SourceAlpha" operator="in" result="effect1_backgroundBlur_116_18187" />
      <feBlend mode="normal" in="SourceGraphic" in2="effect1_backgroundBlur_116_18187" result="shape" />
    </filter>
    <linearGradient
      id={paint0Id}
      x1="275.803"
      y1="64.159"
      x2="200.142"
      y2="-95.0897"
      gradientUnits="userSpaceOnUse"
    >
      <stop stop-color="#1B1F25" />
      <stop offset="1" stop-color="#313E46" />
    </linearGradient>
    <linearGradient
      id={paint1Id}
      x1="269.065"
      y1="53.5385"
      x2="212.253"
      y2="-86.2579"
      gradientUnits="userSpaceOnUse"
    >
      <stop stop-opacity="0.5" />
      <stop offset="0.807161" stop-color="#00FFFF" />
      <stop offset="1" stop-color="white" />
    </linearGradient>
  </defs>
</svg>
