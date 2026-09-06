/**
 * ArNega design tokens — the single palette and rhythm shared by the desktop
 * app and the website. The CSS mirror of these values lives in
 * `assets/tokens.css`; keep the two in sync when changing the brand.
 *
 * Identity: intelligent, fast, minimal, slightly futuristic, premium.
 * Dark-first. One accent family ("ion" blue with a mint glow partner used
 * only in gradients), near-black charcoal base, off-white typography.
 */

export const colors = {
  // Base surfaces (dark-first)
  ink0: '#07080B',
  ink1: '#0C0E13',
  ink2: '#12151C',
  ink3: '#1A1E27',
  ink4: '#232937',

  // Typography
  textBright: '#F5F7FA',
  textPrimary: '#E7EBF1',
  textSecondary: '#A8B1BE',
  textFaint: '#69707E',

  // Accent family
  ion: '#6CA8FF',
  ionBright: '#93C1FF',
  ionDeep: '#3D74D9',
  mint: '#7CE3CE',

  // Lines & fills
  borderSubtle: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  fillSubtle: 'rgba(255, 255, 255, 0.04)',
  fillHover: 'rgba(255, 255, 255, 0.07)',

  // Status
  ok: '#5BD6A2',
  warn: '#F0C674',
  danger: '#F07F7F',
} as const;

export const gradients = {
  /** The signature ArNega gradient — used sparingly (logo, hero, key moments). */
  aurora: `linear-gradient(135deg, ${colors.ion} 0%, ${colors.mint} 100%)`,
  auroraSoft: `linear-gradient(135deg, rgba(108,168,255,0.16) 0%, rgba(124,227,206,0.10) 100%)`,
} as const;

export const typography = {
  /** System stacks only — nothing to license, nothing to download. */
  display:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif",
  text: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', 'Roboto Mono', monospace",
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  /** The overlay window and product "keycap" corners. */
  overlay: 16,
  keycap: 9,
} as const;

export const spacing = {
  unit: 4,
  scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128] as const,
} as const;

export const shadows = {
  overlay: '0 18px 60px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.35)',
  popover: '0 12px 40px rgba(0, 0, 0, 0.45)',
  keycap: '0 1px 0 rgba(255,255,255,0.06) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 2px 6px rgba(0,0,0,0.35)',
  glow: '0 0 24px rgba(108, 168, 255, 0.35)',
} as const;

export const motion = {
  /** Micro-interactions: hovers, key presses. */
  fastMs: 120,
  /** Standard transitions: state changes, reveals. */
  baseMs: 220,
  /** Entrances: window/section appearance. */
  slowMs: 420,
  /** Signature easing — decisive start, calm settle. */
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const brand = {
  name: 'ArNega',
  tagline: 'See it. Press Enter. Get the answer.',
  eyebrow: 'Local screen intelligence',
} as const;
