import { Box, ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

export interface ButtonSvgProps {
  size: "lg" | "md" | "sm" | "xs"; //Pick<ChakraButtonProps, 'size'>;
}

const ButtonSvgLarge = () => {
  return (
    <svg
      width="211"
      height="52"
      viewBox="0 0 211 52`"
      fill="none"
      version="1.1"
      id="svg8"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* <rect id="rect1" width="235.77846" height="81.998787" x="-9.196126" y="-7.9188862" /> */}
      <g filter="url(#filter0_d_206_13299)" id="g2" transform="translate(-18,-16)">
        <path
          id="rect8"
          style={{ display: "inline", fill: "#00ffff", strokeWidth: 0.798868 }}
          d="m 2,2 h 207 l 0.032,27.727969 -9.41703,11.350568 -7.92405,8.918029 L 2,50 Z"
          transform="translate(18,16)"
          shape-rendering="crispEdges"
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
  );
};

const ButtonSvgMedium = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="161" height="52" viewBox="0 0 161 52" fill="none">
      <g filter="url(#filter0_d_113_143)" transform="translate(-18,-16)">
        <path
          d="M20 19C20 18.4477 20.4477 18 21 18H176C176.552 18 177 18.4477 177 19V45.3883C177 45.622 176.918 45.8484 176.769 46.028L167.638 57L160.014 65.6607C159.824 65.8764 159.551 66 159.264 66H21C20.4477 66 20 65.5523 20 65V19Z"
          fill="#00FFFF"
          shape-rendering="crispEdges"
        />
        <path
          d="M168.388 57.6607L168.397 57.6503L168.406 57.6397L177.537 46.6677C177.836 46.3084 178 45.8558 178 45.3883V19C178 17.8954 177.105 17 176 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H159.264C159.838 67 160.385 66.7528 160.765 66.3214L168.388 57.6607Z"
          stroke="url(#paint0_linear_113_143)"
          stroke-opacity="0.75"
          stroke-width="2"
          shape-rendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_113_143"
          x="-14"
          y="0"
          width="225"
          height="116"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          {/* <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          /> */}
          <feOffset dy="16" />
          <feGaussianBlur stdDeviation="16" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_113_143" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_113_143" result="shape" />
        </filter>
        <linearGradient
          id="paint0_linear_113_143"
          x1="20"
          y1="42"
          x2="154.446"
          y2="97.0664"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="white" />
          <stop offset="0.244808" stop-opacity="0.25" />
          <stop offset="0.500575" stop-opacity="0.5" />
          <stop offset="0.761963" stop-opacity="0.25" />
          <stop offset="1" stop-color="white" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const ButtonSvgSmall = () => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="91" height="52" viewBox="0 0 91 52" fill="none">
      <g filter="url(#filter0_d_4_17194)" transform="translate(-18,-16)">
        <path
          d="M20 19C20 18.4477 20.4477 18 21 18H106C106.552 18 107 18.4477 107 19V45.3883C107 45.622 106.918 45.8484 106.769 46.028L97.6376 57L90.0142 65.6607C89.8244 65.8764 89.5509 66 89.2636 66H21C20.4477 66 20 65.5523 20 65V19Z"
          fill="#00FFFF"
          shape-rendering="crispEdges"
        />
        <path
          d="M98.3883 57.6607L98.3974 57.6503L98.4063 57.6397L107.537 46.6677C107.836 46.3084 108 45.8557 108 45.3883V19C108 17.8954 107.105 17 106 17H21C19.8954 17 19 17.8954 19 19V65C19 66.1046 19.8954 67 21 67H89.2636C89.8383 67 90.3852 66.7528 90.7649 66.3214L98.3883 57.6607Z"
          stroke="url(#paint0_linear_4_17194)"
          stroke-opacity="0.75"
          stroke-width="2"
          shape-rendering="crispEdges"
        />
      </g>
      <defs>
        <filter
          id="filter0_d_4_17194"
          x="-14"
          y="0"
          width="155"
          height="116"
          filterUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feFlood flood-opacity="0" result="BackgroundImageFix" />
          {/* <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          /> */}
          <feOffset dy="16" />
          <feGaussianBlur stdDeviation="16" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0" />
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_4_17194" />
          <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_4_17194" result="shape" />
        </filter>
        <linearGradient
          id="paint0_linear_4_17194"
          x1="20"
          y1="42"
          x2="102.738"
          y2="60.7786"
          gradientUnits="userSpaceOnUse"
        >
          <stop stop-color="white" />
          <stop offset="0.244808" stop-opacity="0.25" />
          <stop offset="0.500575" stop-opacity="0.5" />
          <stop offset="0.761963" stop-opacity="0.25" />
          <stop offset="1" stop-color="white" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const componentBySize = {
  lg: ButtonSvgLarge,
  md: ButtonSvgMedium,
  sm: ButtonSvgSmall,
  xs: ButtonSvgSmall,
};

export const ButtonSvg = (props: ButtonSvgProps) => {
  const size = props.size;
  return <Box css={{ position: "absolute" }}>{componentBySize[size]()}</Box>;
};
