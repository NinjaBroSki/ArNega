/** Minimal inline icons — 1.5px strokes, currentColor. */

interface IconProps {
  size?: number;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function GearIcon({ size = 14 }: IconProps): React.JSX.Element {
  // Three sliders — the macOS "settings" idiom.
  return (
    <svg {...base(size)}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
      <circle cx="6" cy="4.5" r="1.6" fill="var(--an-ink-1, #0c0e13)" />
      <circle cx="10.5" cy="8" r="1.6" fill="var(--an-ink-1, #0c0e13)" />
      <circle cx="5" cy="11.5" r="1.6" fill="var(--an-ink-1, #0c0e13)" />
    </svg>
  );
}

export function CloseIcon({ size = 14 }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function CopyIcon({ size = 13 }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5" />
    </svg>
  );
}

export function CheckIcon({ size = 13 }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)}>
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}

export function StopIcon({ size = 13 }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)}>
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RetryIcon({ size = 13 }: IconProps): React.JSX.Element {
  return (
    <svg {...base(size)}>
      <path d="M13 8a5 5 0 1 1-1.5-3.6" />
      <path d="M13 2.5V5h-2.5" />
    </svg>
  );
}
