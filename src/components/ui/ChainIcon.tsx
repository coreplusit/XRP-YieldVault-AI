export interface ChainIconProps {
  className?: string;
}

/** Custom interlocking chain-link SVG mark for the XRP YieldVault brand. */
export function ChainIcon({ className }: ChainIconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chain-gradient" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="100%" stopColor="#23D5AB" />
        </linearGradient>
      </defs>
      <path
        d="M10 14C10 11.7909 11.7909 10 14 10H18C20.2091 10 22 11.7909 22 14V18C22 20.2091 20.2091 22 18 22H14C11.7909 22 10 20.2091 10 18V14Z"
        stroke="url(#chain-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 8C6 5.79086 7.79086 4 10 4H14"
        stroke="url(#chain-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M26 24C26 26.2091 24.2091 28 22 28H18"
        stroke="url(#chain-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="6" cy="8" r="2" fill="#00F2FE" />
      <circle cx="26" cy="24" r="2" fill="#23D5AB" />
      <path
        d="M14 16H18"
        stroke="url(#chain-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
