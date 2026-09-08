/**
 * Screenshot quality presets and the pure resize math used by the capture
 * pipeline. Goal: keep on-screen text readable for the vision model while
 * avoiding wastefully large images that slow inference.
 */

export type ScreenshotQuality = 'fast' | 'balanced' | 'high';

export interface ScreenshotPreset {
  id: ScreenshotQuality;
  label: string;
  description: string;
  /** Longest edge (in pixels) the captured image is scaled down to fit. */
  maxLongEdge: number;
  /** JPEG quality (0..1) used when encoding the optimized capture. */
  jpegQuality: number;
}

export const SCREENSHOT_PRESETS: Record<ScreenshotQuality, ScreenshotPreset> = {
  fast: {
    id: 'fast',
    label: 'Fast',
    description: 'Smaller image, quickest to analyze.',
    maxLongEdge: 1280,
    jpegQuality: 0.62,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    description: 'Readable text with good speed. Recommended.',
    maxLongEdge: 1680,
    jpegQuality: 0.78,
  },
  high: {
    id: 'high',
    label: 'High detail',
    description: 'Sharpest text for dense screens. Slower.',
    maxLongEdge: 2440,
    jpegQuality: 0.92,
  },
};

export const DEFAULT_SCREENSHOT_QUALITY: ScreenshotQuality = 'balanced';

export interface ResizeTarget {
  width: number;
  height: number;
  scale: number;
  resized: boolean;
}

/**
 * Compute the output dimensions for a source image under a preset. Only ever
 * scales down (never upscales), preserving aspect ratio. Returns integer
 * dimensions of at least 1px.
 */
export function computeResizeTarget(
  srcWidth: number,
  srcHeight: number,
  preset: ScreenshotPreset,
): ResizeTarget {
  const w = Math.max(1, Math.round(srcWidth));
  const h = Math.max(1, Math.round(srcHeight));
  const longEdge = Math.max(w, h);

  if (longEdge <= preset.maxLongEdge) {
    return { width: w, height: h, scale: 1, resized: false };
  }

  const scale = preset.maxLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
    scale,
    resized: true,
  };
}

export function presetFor(quality: ScreenshotQuality): ScreenshotPreset {
  return SCREENSHOT_PRESETS[quality] ?? SCREENSHOT_PRESETS[DEFAULT_SCREENSHOT_QUALITY];
}

/**
 * Preset for interactive region snips (Shift+Enter). Regions are small, so
 * they usually pass through at native resolution — bounded only if the user
 * drags a huge area — and encode at high JPEG quality for sharp glyphs.
 */
export const SNIP_PRESET: ScreenshotPreset = {
  id: 'balanced',
  label: 'Snip',
  description: 'Native-resolution region capture.',
  maxLongEdge: 1680,
  jpegQuality: 0.92,
};
