import { Box } from "@chakra-ui/react";

export const ButtonSvg = () => {
  return (
    <Box css={{ position: "absolute" }}>
      <svg
        width="211"
        height="52"
        viewBox="0 0 211 52"
        fill="none"
        version="1.1"
        id="svg8"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect id="rect1" width="235.77846" height="81.998787" x="-9.196126" y="-7.9188862" />
        <g filter="url(#filter0_d_206_13299)" id="g2" transform="translate(-18,-16)">
          <path
            id="rect8"
            style={{ display: "inline", fill: "#00ffff", strokeWidth: 0.798868 }}
            d="m 2,2 h 207 l 0.032,27.727969 -9.41703,11.350568 -7.92405,8.918029 L 2,50 Z"
            transform="translate(18,16)"
          />
          <path
            d="m 218.388,57.6607 0.009,-0.0104 0.009,-0.0106 9.131,-10.972 C 227.836,46.3084 228,45.8558 228,45.3883 V 19 c 0,-1.1046 -0.895,-2 -2,-2 H 21 c -1.1046,0 -2,0.8954 -2,2 v 46 c 0,1.1046 0.8954,2 2,2 h 188.264 c 0.574,0 1.121,-0.2472 1.501,-0.6785 z"
            stroke="url(#paint0_linear_206_13299)"
            stroke-opacity="0.75"
            stroke-width="2"
            shape-rendering="crispEdges"
            style={{ display: "inline", fill: "none", stroke: "url(#paint0_linear_206_13299)" }}
            id="path2"
          />
        </g>
        <defs id="defs8">
          <filter
            id="filter0_d_206_13299"
            x="-14"
            y="0"
            width="275"
            height="116"
            filterUnits="userSpaceOnUse"
            color-interpolation-filters="sRGB"
          >
            <feFlood flood-opacity="0" result="BackgroundImageFix" id="feFlood2" />
            {/* <feColorMatrix
         in="SourceAlpha"
         type="matrix"
         values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
         result="hardAlpha"
         id="feColorMatrix2" /> */}
            <feOffset dy="16" id="feOffset2" />
            <feGaussianBlur stdDeviation="16" id="feGaussianBlur2" />
            <feComposite in2="hardAlpha" operator="out" id="feComposite2" />
            <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" id="feColorMatrix3" />
            <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_206_13299" id="feBlend3" />
            <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_206_13299" result="shape" id="feBlend4" />
          </filter>
          <linearGradient
            id="paint0_linear_206_13299"
            x1="20"
            y1="42"
            x2="180.26401"
            y2="128.54601"
            gradientUnits="userSpaceOnUse"
          >
            <stop stop-color="white" id="stop4" />
            <stop offset="0.244808" stop-opacity="0.25" id="stop5" />
            <stop offset="0.761963" stop-opacity="0.25" id="stop7" />
            <stop offset="1" stop-color="white" id="stop8" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
};
