export const NavigationTabSvgUnselected = (props: { onClick?: () => void;}) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="239" height="48" viewBox="0 0 239 48" fill="none" pointerEvents={'none'}>
      {/* <polygon points="0,0 170,0 239,48 70,48" onClick={() => {alert('blaw');props.onClick?.();}} fill="#00FF00" pointerEvents={'all'} /> */}
      <path
        pointerEvents={'all'}
        onClick={() => {props.onClick?.();}}
        cursor={'pointer'}
        opacity="0.9"
        d="M61.0641 44.7726L4.92509 2H174.3C175.613 2 176.891 2.43121 177.936 3.22741L234.075 46H64.7004C63.3866 46 62.1091 45.5688 61.0641 44.7726ZM236.431 47.7954C236.43 47.7947 236.429 47.7939 236.428 47.7932L236.431 47.7954Z"
        fill="#1B1F25"
        stroke="url(#paint0_linear_143_69328)"
        strokeWidth="4"
      />
      <defs>
        <linearGradient
          id="paint0_linear_143_69328"
          x1="260"
          y1="48"
          x2="257.948"
          y2="-7.20193"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#313E46" />
          <stop offset="0.312574" stopColor="#A0B0BA" stopOpacity="0.536702" />
          <stop offset="0.514382" stopColor="white" />
          <stop offset="1" stopColor="#69747B" stopOpacity="0.83338" />
        </linearGradient>
      </defs>
    </svg>
  );
};
