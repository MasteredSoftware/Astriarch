export const CardSvgLarge = ({ enabled }: { enabled: boolean }) => {
  if (!enabled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="109" height="136" viewBox="0 0 109 136" fill="none">
        <g filter="url(#filter0_d_4_23115)" transform="translate(-40,-20)">
          <path
            d="M40 21C40 20.4477 40.4477 20 41 20H148C148.552 20 149 20.4477 149 21V138.606C149 138.859 148.904 139.103 148.731 139.288L142 146.5L132.793 155.707C132.605 155.895 132.351 156 132.086 156H41C40.4477 156 40 155.552 40 155V21Z"
            fill="#1B1F25"
            fillOpacity="0.5"
            shapeRendering="crispEdges"
          />
        </g>
        <defs>
          <filter
            id="filter0_d_4_23115"
            x="0"
            y="-4"
            width="189"
            height="216"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
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
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4_23115" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4_23115" result="shape" />
          </filter>
        </defs>
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="109" height="136" viewBox="0 0 109 136" fill="none">
      <g filter="url(#filter0_d_122_20636)" transform="translate(-19,-20)">
        <path
          d="M19 21C19 20.4477 19.4477 20 20 20H127C127.552 20 128 20.4477 128 21V138.606C128 138.859 127.904 139.103 127.731 139.288L121 146.5L111.793 155.707C111.605 155.895 111.351 156 111.086 156H20C19.4477 156 19 155.552 19 155V21Z"
          fill="#1B1F25"
          fillOpacity="0.5"
          shapeRendering="crispEdges"
        />
        <path
          d="M20 21L20 21H127V138.606L120.281 145.805L111.086 155H20L20 21Z"
          stroke="#00FFFF"
          strokeWidth="2"
          shapeRendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_122_20636"
          x="-21"
          y="-4"
          width="189"
          height="216"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
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
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_122_20636" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_122_20636" result="shape" />
        </filter>
      </defs>
    </svg>
  );
};
