/**
 * Global show/hide shortcut. Only ever one accelerator registered; Enter is
 * deliberately NOT a global shortcut — it is handled inside the focused
 * overlay window only, so ArNega never hijacks Enter from other apps.
 */
import { globalShortcut } from 'electron';
import { toggleOverlay } from './windows.js';

let registered: string | null = null;

export interface ShortcutResult {
  ok: boolean;
  error?: string;
}

export function applyGlobalShortcut(accelerator: string): ShortcutResult {
  if (registered) {
    try {
      globalShortcut.unregister(registered);
    } catch {
      // ignore
    }
    registered = null;
  }
  try {
    const ok = globalShortcut.register(accelerator, () => {
      toggleOverlay();
    });
    if (!ok) {
      return { ok: false, error: 'That shortcut is already taken by another app.' };
    }
    registered = accelerator;
    return { ok: true };
  } catch {
    return { ok: false, error: 'That is not a usable shortcut.' };
  }
}

export function currentShortcut(): string | null {
  return registered;
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
  registered = null;
}
