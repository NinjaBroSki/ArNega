/**
 * Pure helpers for recording and displaying global shortcuts.
 * Converts keyboard events into Electron accelerator strings.
 */

export interface KeyEventLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Backslash: '\\',
  Comma: ',',
  Period: '.',
  Slash: '/',
};

function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return CODE_TO_KEY[code] ?? null;
}

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);

/**
 * Build an Electron accelerator from a keydown event, or null when the
 * combination isn't valid as a global shortcut (needs a real key plus at
 * least one non-shift modifier).
 */
export function acceleratorFromEvent(e: KeyEventLike): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const key = keyFromCode(e.code);
  if (!key) return null;

  const mods: string[] = [];
  if (e.metaKey) mods.push('Command');
  if (e.ctrlKey) mods.push('Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  const hasPrimaryModifier = e.metaKey || e.ctrlKey || e.altKey;
  const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
  if (!hasPrimaryModifier && !isFunctionKey) return null;

  return [...mods, key].join('+');
}

const MAC_SYMBOLS: Record<string, string> = {
  CommandOrControl: '⌘',
  CmdOrCtrl: '⌘',
  Command: '⌘',
  Cmd: '⌘',
  Control: '⌃',
  Ctrl: '⌃',
  Alt: '⌥',
  Option: '⌥',
  Shift: '⇧',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Enter: '↵',
};

/** Human-friendly rendering, e.g. "⌘⇧Space" on macOS. */
export function displayAccelerator(accelerator: string, platform: string = 'darwin'): string {
  const parts = accelerator.split('+');
  if (platform === 'darwin') {
    return parts.map((p) => MAC_SYMBOLS[p] ?? p).join('');
  }
  return parts.join('+');
}
