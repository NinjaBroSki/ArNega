import { describe, expect, it } from 'vitest';
import {
  applySettingsUpdate,
  DEFAULT_SETTINGS,
  normalizeSettings,
} from '../src/settings.js';
import { DEFAULT_MODEL } from '../src/config.js';

describe('normalizeSettings', () => {
  it('returns full defaults for garbage input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(42)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid values from a stored file', () => {
    const s = normalizeSettings({
      model: 'llava:13b',
      answerStyle: 'detailed',
      screenshotQuality: 'high',
      globalShortcut: 'Alt+Space',
      launchAtLogin: true,
      numCtx: 12288,
    });
    expect(s.model).toBe('llava:13b');
    expect(s.answerStyle).toBe('detailed');
    expect(s.screenshotQuality).toBe('high');
    expect(s.globalShortcut).toBe('Alt+Space');
    expect(s.launchAtLogin).toBe(true);
    expect(s.numCtx).toBe(12288);
  });

  it('repairs invalid enum values to defaults', () => {
    const s = normalizeSettings({ answerStyle: 'chaotic', screenshotQuality: 'ultra' });
    expect(s.answerStyle).toBe('normal');
    expect(s.screenshotQuality).toBe('balanced');
  });

  it('clamps numCtx into a safe range', () => {
    expect(normalizeSettings({ numCtx: 100 }).numCtx).toBe(2048);
    expect(normalizeSettings({ numCtx: 1_000_000 }).numCtx).toBe(32768);
    expect(normalizeSettings({ numCtx: 'many' }).numCtx).toBe(DEFAULT_SETTINGS.numCtx);
  });

  it('defaults model to the bundled default when empty', () => {
    expect(normalizeSettings({ model: '  ' }).model).toBe(DEFAULT_MODEL);
  });

  it('normalizes overlay bounds and drops invalid ones', () => {
    const s = normalizeSettings({ overlayBounds: { x: 10.6, y: 20.2, width: 600, height: 400 } });
    expect(s.overlayBounds).toEqual({ x: 11, y: 20, width: 600, height: 400 });
    expect(normalizeSettings({ overlayBounds: 'weird' }).overlayBounds).toBeUndefined();
  });

  it('clamps absurd overlay sizes', () => {
    const s = normalizeSettings({ overlayBounds: { width: 20, height: 9999 } });
    expect(s.overlayBounds?.width).toBeGreaterThanOrEqual(320);
    expect(s.overlayBounds?.height).toBeLessThanOrEqual(4000);
  });
});

describe('applySettingsUpdate', () => {
  it('applies partial updates on top of current settings', () => {
    const current = normalizeSettings({ answerStyle: 'direct' });
    const next = applySettingsUpdate(current, { screenshotQuality: 'fast' });
    expect(next.answerStyle).toBe('direct');
    expect(next.screenshotQuality).toBe('fast');
  });

  it('re-validates values in the update', () => {
    const next = applySettingsUpdate(DEFAULT_SETTINGS, { numCtx: -5 } as never);
    expect(next.numCtx).toBe(2048);
  });
});
