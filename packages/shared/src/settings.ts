/**
 * Settings schema, defaults, and pure normalization/migration.
 *
 * The desktop main process persists these as JSON in the app's userData
 * directory. All validation lives here as pure functions so it can be tested
 * and reused, and so a corrupt or partial file always resolves to safe values.
 */

import type { AnswerStyle } from './prompts.js';
import type { ScreenshotQuality } from './screenshot.js';
import { DEFAULT_MODEL, DEFAULT_KEEP_ALIVE, DEFAULT_NUM_CTX } from './config.js';

export const SETTINGS_SCHEMA_VERSION = 1;

/** Default global show/hide shortcut (Electron accelerator syntax). */
export const DEFAULT_SHORTCUT = 'CommandOrControl+Shift+Space';

export interface OverlayBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface ArNegaSettings {
  schemaVersion: number;
  model: string;
  answerStyle: AnswerStyle;
  screenshotQuality: ScreenshotQuality;
  globalShortcut: string;
  launchAtLogin: boolean;
  numCtx: number;
  keepAlive: string;
  captureCursor: boolean;
  overlayBounds?: OverlayBounds;
}

export const DEFAULT_SETTINGS: ArNegaSettings = {
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  model: DEFAULT_MODEL,
  answerStyle: 'normal',
  screenshotQuality: 'balanced',
  globalShortcut: DEFAULT_SHORTCUT,
  launchAtLogin: false,
  numCtx: DEFAULT_NUM_CTX,
  keepAlive: DEFAULT_KEEP_ALIVE,
  captureCursor: false,
};

const ANSWER_STYLES: AnswerStyle[] = ['direct', 'normal', 'detailed'];
const SCREENSHOT_QUALITIES: ScreenshotQuality[] = ['fast', 'balanced', 'high'];

const NUM_CTX_MIN = 2048;
const NUM_CTX_MAX = 32768;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeBounds(value: unknown): OverlayBounds | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const b = value as Record<string, unknown>;
  const width = clampInt(b.width, 320, 4000, DEFAULT_OVERLAY_SIZE.width);
  const height = clampInt(b.height, 200, 4000, DEFAULT_OVERLAY_SIZE.height);
  const out: OverlayBounds = { width, height };
  if (typeof b.x === 'number' && Number.isFinite(b.x)) out.x = Math.round(b.x);
  if (typeof b.y === 'number' && Number.isFinite(b.y)) out.y = Math.round(b.y);
  return out;
}

/** Initial overlay size — compact, expands as answers arrive. */
export const DEFAULT_OVERLAY_SIZE = { width: 560, height: 132 } as const;
export const OVERLAY_MIN_SIZE = { width: 380, height: 120 } as const;
export const OVERLAY_MAX_HEIGHT = 720;

/**
 * Merge an arbitrary (possibly partial or corrupt) object onto the defaults,
 * validating every field. Always returns a complete, safe settings object.
 */
export function normalizeSettings(input: unknown): ArNegaSettings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    model: isNonEmptyString(raw.model) ? raw.model : DEFAULT_SETTINGS.model,
    answerStyle: pickEnum(raw.answerStyle, ANSWER_STYLES, DEFAULT_SETTINGS.answerStyle),
    screenshotQuality: pickEnum(
      raw.screenshotQuality,
      SCREENSHOT_QUALITIES,
      DEFAULT_SETTINGS.screenshotQuality,
    ),
    globalShortcut: isNonEmptyString(raw.globalShortcut)
      ? raw.globalShortcut
      : DEFAULT_SETTINGS.globalShortcut,
    launchAtLogin: typeof raw.launchAtLogin === 'boolean' ? raw.launchAtLogin : false,
    numCtx: clampInt(raw.numCtx, NUM_CTX_MIN, NUM_CTX_MAX, DEFAULT_SETTINGS.numCtx),
    keepAlive: isNonEmptyString(raw.keepAlive) ? raw.keepAlive : DEFAULT_SETTINGS.keepAlive,
    captureCursor: typeof raw.captureCursor === 'boolean' ? raw.captureCursor : false,
    overlayBounds: normalizeBounds(raw.overlayBounds),
  };
}

/** Apply a partial update on top of current settings, re-validated. */
export function applySettingsUpdate(
  current: ArNegaSettings,
  update: Partial<ArNegaSettings>,
): ArNegaSettings {
  return normalizeSettings({ ...current, ...update });
}
