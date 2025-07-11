<script lang="ts">
  export let size: 'lg' | 'md' | 'sm' | 'xs' = 'lg';
  export let variant: 'primary' | 'outline' = 'primary';
</script>

<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
  {#if variant === 'primary'}
    {#if size === 'lg'}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 215 70" fill="none">
        <g filter="url(#filter0_d_206_13299)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H208C208.552 2 209 2.4477 209 3V29.3883C209 29.622 208.918 29.8484 208.769 30.028L199.638 41L192.014 49.6607C191.824 49.8764 191.551 50 191.264 50H3C2.4477 50 2 49.5523 2 49V3Z"
            fill="#00FFFF"
            shapeRendering="crispEdges"
          />
          <path
            d="M200.388 41.6607L200.397 41.6503L200.406 41.6397L209.537 30.6677C209.836 30.3084 210 29.8558 210 29.3883V3C210 1.8954 209.105 1 208 1H3C1.8954 1 1 1.8954 1 3V49C1 50.1046 1.8954 51 3 51H191.264C191.838 51 192.385 50.7528 192.765 50.3215L200.388 41.6607Z"
            stroke="url(#paint0_linear_206_13299)"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter
            id="filter0_d_206_13299"
            x="0"
            y="0"
            width="215"
            height="70"
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
            x1="2"
            y1="26"
            x2="162.264"
            y2="112.546"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    {:else if size === 'md'}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 165 66" fill="none">
        <g filter="url(#filter0_d_medium)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H158C158.552 2 159 2.4477 159 3V29.3883C159 29.622 158.918 29.8484 158.769 30.028L149.638 41L142.014 45.6607C141.824 45.8764 141.551 46 141.264 46H3C2.4477 46 2 45.5523 2 45V3Z"
            fill="#00FFFF"
            shapeRendering="crispEdges"
          />
          <path
            d="M150.388 41.6607L150.397 41.6503L150.406 41.6397L159.537 30.6677C159.836 30.3084 160 29.8558 160 29.3883V3C160 1.8954 159.105 1 158 1H3C1.8954 1 1 1.8954 1 3V45C1 46.1046 1.8954 47 3 47H141.264C141.838 47 142.385 46.7528 142.765 46.3215L150.388 41.6607Z"
            stroke="url(#paint0_linear_medium)"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter id="filter0_d_medium" x="0" y="0" width="165" height="66" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_medium" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_medium" result="shape" />
          </filter>
          <linearGradient id="paint0_linear_medium" x1="2" y1="26" x2="142" y2="84" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 95 58" fill="none">
        <g filter="url(#filter0_d_small)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H88C88.552 2 89 2.4477 89 3V23.3883C89 23.622 88.918 23.8484 88.769 24.028L84.638 29L80.014 33.6607C79.824 33.8764 79.551 34 79.264 34H3C2.4477 34 2 33.5523 2 33V3Z"
            fill="#00FFFF"
            shapeRendering="crispEdges"
          />
          <path
            d="M85.388 29.6607L85.397 29.6503L85.406 29.6397L89.537 24.6677C89.836 24.3084 90 23.8558 90 23.3883V3C90 1.8954 89.105 1 88 1H3C1.8954 1 1 1.8954 1 3V33C1 34.1046 1.8954 35 3 35H79.264C79.838 35 80.385 34.7528 80.765 34.3215L85.388 29.6607Z"
            stroke="url(#paint0_linear_small)"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter id="filter0_d_small" x="0" y="0" width="95" height="58" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_small" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_small" result="shape" />
          </filter>
          <linearGradient id="paint0_linear_small" x1="2" y1="19" x2="72" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    {/if}
  {:else}
    {#if size === 'lg'}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 215 70" fill="none">
        <g filter="url(#filter0_d_secondary)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H208C208.552 2 209 2.4477 209 3V29.3883C209 29.622 208.918 29.8484 208.769 30.028L199.638 41L192.014 49.6607C191.824 49.8764 191.551 50 191.264 50H3C2.4477 50 2 49.5523 2 49V3Z"
            fill="transparent"
            shapeRendering="crispEdges"
          />
          <path
            d="M200.388 41.6607L200.397 41.6503L200.406 41.6397L209.537 30.6677C209.836 30.3084 210 29.8558 210 29.3883V3C210 1.8954 209.105 1 208 1H3C1.8954 1 1 1.8954 1 3V49C1 50.1046 1.8954 51 3 51H191.264C191.838 51 192.385 50.7528 192.765 50.3215L200.388 41.6607Z"
            stroke="#00FFFF"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter id="filter0_d_secondary" x="0" y="0" width="215" height="70" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_secondary" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_secondary" result="shape" />
          </filter>
        </defs>
      </svg>
    {:else if size === 'md'}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 165 66" fill="none">
        <g filter="url(#filter0_d_medium_secondary)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H158C158.552 2 159 2.4477 159 3V29.3883C159 29.622 158.918 29.8484 158.769 30.028L149.638 41L142.014 45.6607C141.824 45.8764 141.551 46 141.264 46H3C2.4477 46 2 45.5523 2 45V3Z"
            fill="transparent"
            shapeRendering="crispEdges"
          />
          <path
            d="M150.388 41.6607L150.397 41.6503L150.406 41.6397L159.537 30.6677C159.836 30.3084 160 29.8558 160 29.3883V3C160 1.8954 159.105 1 158 1H3C1.8954 1 1 1.8954 1 3V45C1 46.1046 1.8954 47 3 47H141.264C141.838 47 142.385 46.7528 142.765 46.3215L150.388 41.6607Z"
            stroke="#00FFFF"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter id="filter0_d_medium_secondary" x="0" y="0" width="165" height="66" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_medium_secondary" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_medium_secondary" result="shape" />
          </filter>
        </defs>
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 95 58" fill="none">
        <g filter="url(#filter0_d_small_secondary)">
          <path
            d="M2 3C2 2.4477 2.4477 2 3 2H88C88.552 2 89 2.4477 89 3V23.3883C89 23.622 88.918 23.8484 88.769 24.028L84.638 29L80.014 33.6607C79.824 33.8764 79.551 34 79.264 34H3C2.4477 34 2 33.5523 2 33V3Z"
            fill="transparent"
            shapeRendering="crispEdges"
          />
          <path
            d="M85.388 29.6607L85.397 29.6503L85.406 29.6397L89.537 24.6677C89.836 24.3084 90 23.8558 90 23.3883V3C90 1.8954 89.105 1 88 1H3C1.8954 1 1 1.8954 1 3V33C1 34.1046 1.8954 35 3 35H79.264C79.838 35 80.385 34.7528 80.765 34.3215L85.388 29.6607Z"
            stroke="#00FFFF"
            strokeOpacity="0.75"
            strokeWidth="2"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter id="filter0_d_small_secondary" x="0" y="0" width="95" height="58" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feOffset dy="16" />
            <feGaussianBlur stdDeviation="16" />
            <feComposite in2="hardAlpha" operator="out" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_small_secondary" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_small_secondary" result="shape" />
          </filter>
        </defs>
      </svg>
    {/if}
  {/if}
</div>
