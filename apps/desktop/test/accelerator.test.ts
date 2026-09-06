import { describe, expect, it } from 'vitest';
import {
  acceleratorFromEvent,
  displayAccelerator,
} from '../src/renderer/src/lib/accelerator.js';

function ev(partial: Partial<Parameters<typeof acceleratorFromEvent>[0]>) {
  return {
    key: '',
    code: '',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...partial,
  };
}

describe('acceleratorFromEvent', () => {
  it('builds the default-style shortcut', () => {
    expect(
      acceleratorFromEvent(ev({ key: ' ', code: 'Space', metaKey: true, shiftKey: true })),
    ).toBe('Command+Shift+Space');
  });

  it('uses physical key codes so Alt-modified characters still work', () => {
    expect(acceleratorFromEvent(ev({ key: 'å', code: 'KeyA', altKey: true }))).toBe('Alt+A');
  });

  it('rejects bare keys without a primary modifier', () => {
    expect(acceleratorFromEvent(ev({ key: 'a', code: 'KeyA' }))).toBeNull();
    expect(acceleratorFromEvent(ev({ key: 'A', code: 'KeyA', shiftKey: true }))).toBeNull();
  });

  it('allows bare function keys', () => {
    expect(acceleratorFromEvent(ev({ key: 'F6', code: 'F6' }))).toBe('F6');
  });

  it('returns null while only modifiers are held', () => {
    expect(acceleratorFromEvent(ev({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }))).toBeNull();
    expect(acceleratorFromEvent(ev({ key: 'Meta', code: 'MetaLeft', metaKey: true }))).toBeNull();
  });

  it('maps digits, arrows, and punctuation', () => {
    expect(acceleratorFromEvent(ev({ key: '1', code: 'Digit1', ctrlKey: true }))).toBe('Control+1');
    expect(acceleratorFromEvent(ev({ key: 'ArrowUp', code: 'ArrowUp', metaKey: true }))).toBe(
      'Command+Up',
    );
    expect(acceleratorFromEvent(ev({ key: '/', code: 'Slash', metaKey: true }))).toBe('Command+/');
  });
});

describe('displayAccelerator', () => {
  it('renders macOS symbols', () => {
    expect(displayAccelerator('Command+Shift+Space', 'darwin')).toBe('⌘⇧Space');
    expect(displayAccelerator('CommandOrControl+Shift+Space', 'darwin')).toBe('⌘⇧Space');
    expect(displayAccelerator('Alt+Up', 'darwin')).toBe('⌥↑');
  });

  it('keeps plus-joined text elsewhere', () => {
    expect(displayAccelerator('Control+Shift+Space', 'win32')).toBe('Control+Shift+Space');
  });
});
