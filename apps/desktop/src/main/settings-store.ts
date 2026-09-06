/**
 * Persistent settings — a single JSON file in the app's userData directory.
 * All validation lives in @arnega/shared (`normalizeSettings`), so a corrupt
 * or hand-edited file can never produce an invalid in-memory state.
 *
 * Local files ArNega creates (documented in docs/PRIVACY.md):
 *   ~/Library/Application Support/ArNega/settings.json
 */
import { app } from 'electron';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  applySettingsUpdate,
  normalizeSettings,
  type ArNegaSettings,
} from '@arnega/shared';

type Listener = (settings: ArNegaSettings) => void;

let cached: ArNegaSettings | null = null;
const listeners = new Set<Listener>();

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): ArNegaSettings {
  if (cached) return cached;
  try {
    const raw = readFileSync(settingsPath(), 'utf8');
    cached = normalizeSettings(JSON.parse(raw));
  } catch {
    cached = normalizeSettings({});
  }
  return cached;
}

function persist(settings: ArNegaSettings): void {
  const target = settingsPath();
  const tmp = `${target}.tmp`;
  try {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(tmp, JSON.stringify(settings, null, 2), 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    console.error('[settings] failed to persist settings:', err);
  }
}

export function updateSettings(update: Partial<ArNegaSettings>): ArNegaSettings {
  const next = applySettingsUpdate(loadSettings(), update);
  cached = next;
  persist(next);
  for (const cb of listeners) cb(next);
  return next;
}

/** Remove all locally stored state and reset to defaults. */
export function clearLocalState(): ArNegaSettings {
  try {
    rmSync(settingsPath(), { force: true });
  } catch (err) {
    console.error('[settings] failed to remove settings file:', err);
  }
  cached = normalizeSettings({});
  for (const cb of listeners) cb(cached);
  return cached;
}

export function onSettingsChanged(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
