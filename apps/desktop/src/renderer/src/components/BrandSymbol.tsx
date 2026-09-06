/** Inline ArNega symbol (return-arrow keycap) for use in the UI chrome. */

export function BrandSymbol({ size = 15 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="bs-aurora" x1="87" y1="85" x2="172" y2="170" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6CA8FF" />
          <stop offset="1" stopColor="#7CE3CE" />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="224" height="224" rx="56" fill="rgba(255,255,255,0.06)" />
      <rect
        x="18"
        y="18"
        width="220"
        height="220"
        rx="54"
        stroke="rgba(255,255,255,0.14)"
        strokeWidth="6"
        fill="none"
      />
      <g
        stroke="url(#bs-aurora)"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M169 85 V123 Q169 140 152 140 H92" />
        <path d="M116 114 L87 140 L116 167" />
      </g>
    </svg>
  );
}
