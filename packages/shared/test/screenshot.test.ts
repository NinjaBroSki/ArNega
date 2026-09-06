import { describe, expect, it } from 'vitest';
import {
  computeResizeTarget,
  DEFAULT_SCREENSHOT_QUALITY,
  presetFor,
  SCREENSHOT_PRESETS,
} from '../src/screenshot.js';

describe('screenshot presets', () => {
  it('defaults to balanced', () => {
    expect(DEFAULT_SCREENSHOT_QUALITY).toBe('balanced');
  });

  it('orders presets by size', () => {
    expect(SCREENSHOT_PRESETS.fast.maxLongEdge).toBeLessThan(
      SCREENSHOT_PRESETS.balanced.maxLongEdge,
    );
    expect(SCREENSHOT_PRESETS.balanced.maxLongEdge).toBeLessThan(
      SCREENSHOT_PRESETS.high.maxLongEdge,
    );
  });

  it('presetFor falls back to balanced for bad input', () => {
    expect(presetFor('nonsense' as never).id).toBe('balanced');
  });
});

describe('computeResizeTarget', () => {
  const balanced = SCREENSHOT_PRESETS.balanced;

  it('downscales a Retina capture preserving aspect ratio', () => {
    // MacBook Air 13" physical pixels
    const t = computeResizeTarget(2560, 1664, balanced);
    expect(t.resized).toBe(true);
    expect(t.width).toBe(balanced.maxLongEdge);
    expect(t.height).toBe(Math.round(1664 * (balanced.maxLongEdge / 2560)));
    expect(t.width / t.height).toBeCloseTo(2560 / 1664, 2);
  });

  it('never upscales small sources', () => {
    const t = computeResizeTarget(1200, 800, balanced);
    expect(t).toMatchObject({ width: 1200, height: 800, resized: false, scale: 1 });
  });

  it('handles portrait orientation via the long edge', () => {
    const t = computeResizeTarget(1000, 4000, balanced);
    expect(t.height).toBe(balanced.maxLongEdge);
    expect(t.width).toBe(Math.round(1000 * (balanced.maxLongEdge / 4000)));
  });

  it('guards degenerate dimensions', () => {
    const t = computeResizeTarget(0, 0, balanced);
    expect(t.width).toBeGreaterThanOrEqual(1);
    expect(t.height).toBeGreaterThanOrEqual(1);
  });
});
