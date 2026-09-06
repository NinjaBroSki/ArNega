import { describe, expect, it } from 'vitest';
import { normalizeMathDelimiters } from '../src/renderer/src/lib/math.js';

describe('normalizeMathDelimiters', () => {
  it('converts inline \\( \\) to single dollars', () => {
    expect(normalizeMathDelimiters('Slope is \\( 2x \\ln x + x \\) here.')).toBe(
      'Slope is $2x \\ln x + x$ here.',
    );
  });

  it('converts display \\[ \\] to double dollars on their own lines', () => {
    expect(normalizeMathDelimiters('Result:\\[ \\frac{dy}{dx} = 2x \\]done')).toBe(
      'Result:\n$$\\frac{dy}{dx} = 2x$$\ndone',
    );
  });

  it('handles multiline display math', () => {
    const input = 'A\\[\n\\sum_{n=1}^{\\infty} \\frac{1}{n^2}\n\\]B';
    expect(normalizeMathDelimiters(input)).toBe('A\n$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$$\nB');
  });

  it('leaves dollar-delimited math and plain text untouched', () => {
    const s = 'Already $x^2$ and $$y = mx + b$$ and costs $5.';
    expect(normalizeMathDelimiters(s)).toBe(s);
  });

  it('handles several inline expressions in one answer', () => {
    expect(normalizeMathDelimiters('\\(a\\) plus \\(b\\)')).toBe('$a$ plus $b$');
  });
});
