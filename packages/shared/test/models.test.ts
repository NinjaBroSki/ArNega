import { describe, expect, it } from 'vitest';
import {
  bytesToGb,
  displayModelName,
  hasDefaultModel,
  isLikelyVisionModelName,
  isVisionCapable,
} from '../src/models.js';
import { DEFAULT_MODEL } from '../src/config.js';

describe('vision detection', () => {
  it('recognizes well-known vision model names', () => {
    for (const name of [
      'qwen3-vl:8b-thinking-q4_K_M',
      'llava:13b',
      'llama3.2-vision:11b',
      'minicpm-v:8b',
      'moondream:latest',
    ]) {
      expect(isLikelyVisionModelName(name)).toBe(true);
    }
  });

  it('rejects text-only model names', () => {
    for (const name of ['llama3.1:8b', 'qwen2.5-coder:7b', 'mistral:7b', 'phi4:latest']) {
      expect(isLikelyVisionModelName(name)).toBe(false);
    }
  });

  it('prefers explicit capabilities over heuristics', () => {
    expect(isVisionCapable({ name: 'mystery-model' }, ['completion', 'vision'])).toBe(true);
    expect(isVisionCapable({ name: 'qwen3-vl:8b' }, ['completion'])).toBe(false);
  });

  it('uses family markers from /api/tags details', () => {
    expect(
      isVisionCapable({ name: 'custom', details: { families: ['qwen3vl'] } }),
    ).toBe(true);
    expect(isVisionCapable({ name: 'custom', details: { families: ['llama'] } })).toBe(false);
  });
});

describe('hasDefaultModel', () => {
  it('finds the exact default tag', () => {
    expect(hasDefaultModel([{ name: DEFAULT_MODEL }])).toBe(true);
    expect(hasDefaultModel([{ name: 'qwen3-vl:8b' }])).toBe(false);
    expect(hasDefaultModel([])).toBe(false);
  });
});

describe('display helpers', () => {
  it('strips tags for display', () => {
    expect(displayModelName('qwen3-vl:8b-thinking-q4_K_M')).toBe('qwen3-vl');
  });
  it('formats sizes in GB', () => {
    expect(bytesToGb(6_000_000_000)).toBe('5.6 GB');
    expect(bytesToGb(undefined)).toBeUndefined();
  });
});
