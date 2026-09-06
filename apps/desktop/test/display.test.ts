import { describe, expect, it } from 'vitest';
import {
  isRectVisibleOnAnyDisplay,
  pickTargetDisplay,
  type DisplayLike,
} from '../src/main/display.js';

const MAIN: DisplayLike = {
  id: 1,
  bounds: { x: 0, y: 0, width: 1470, height: 956 },
  scaleFactor: 2,
};
const EXTERNAL: DisplayLike = {
  id: 2,
  bounds: { x: 1470, y: 0, width: 2560, height: 1440 },
  scaleFactor: 1,
};

describe('pickTargetDisplay', () => {
  it('returns the only display on single-display machines', () => {
    expect(pickTargetDisplay([MAIN], null, null)).toBe(MAIN);
  });

  it('prefers the display containing the overlay', () => {
    const overlay = { x: 1600, y: 100, width: 560, height: 200 };
    expect(pickTargetDisplay([MAIN, EXTERNAL], overlay, { x: 10, y: 10 })).toBe(EXTERNAL);
  });

  it('uses the display with the larger overlay overlap when straddling', () => {
    const overlay = { x: 1470 - 100, y: 100, width: 560, height: 200 }; // 100px on main, 460 on ext
    expect(pickTargetDisplay([MAIN, EXTERNAL], overlay, null)).toBe(EXTERNAL);
  });

  it('falls back to the cursor display when the overlay is hidden', () => {
    expect(pickTargetDisplay([MAIN, EXTERNAL], null, { x: 2000, y: 500 })).toBe(EXTERNAL);
    expect(pickTargetDisplay([MAIN, EXTERNAL], null, { x: 100, y: 500 })).toBe(MAIN);
  });

  it('falls back to the primary display with no signals', () => {
    expect(pickTargetDisplay([MAIN, EXTERNAL], null, null)).toBe(MAIN);
  });

  it('throws with no displays', () => {
    expect(() => pickTargetDisplay([], null, null)).toThrow();
  });
});

describe('isRectVisibleOnAnyDisplay', () => {
  it('accepts a rect fully on a display', () => {
    expect(
      isRectVisibleOnAnyDisplay({ x: 100, y: 100, width: 560, height: 200 }, [MAIN]),
    ).toBe(true);
  });

  it('rejects a rect far off every display', () => {
    expect(
      isRectVisibleOnAnyDisplay({ x: -5000, y: -5000, width: 560, height: 200 }, [MAIN, EXTERNAL]),
    ).toBe(false);
  });
});
