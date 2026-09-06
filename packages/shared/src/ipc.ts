/**
 * The typed IPC contract between the Electron main process, preload, and
 * renderer. The renderer can only reach the narrow surface described here —
 * it never gets Node access, arbitrary URL opening, or raw file paths.
 */

import type { ArNegaSettings } from './settings.js';
import type { GenerationPhase, SetupStatus } from './state.js';
import type { ChatDelta } from './ollama-parser.js';

export const IPC = {
  // renderer -> main (invoke)
  solve: 'arnega:solve',
  cancel: 'arnega:cancel',
  getStatus: 'arnega:get-status',
  refreshStatus: 'arnega:refresh-status',
  updateSettings: 'arnega:update-settings',
  pullDefaultModel: 'arnega:pull-default-model',
  cancelPull: 'arnega:cancel-pull',
  openExternal: 'arnega:open-external',
  openScreenRecordingSettings: 'arnega:open-screen-permission',
  hideWindow: 'arnega:hide-window',
  openSettingsWindow: 'arnega:open-settings-window',
  closeSettingsWindow: 'arnega:close-settings-window',
  resizeOverlay: 'arnega:resize-overlay',
  resetWindowPosition: 'arnega:reset-window-position',
  clearLocalState: 'arnega:clear-local-state',
  copyText: 'arnega:copy-text',
  // main -> renderer (events)
  genEvent: 'arnega:gen-event',
  setupStatus: 'arnega:setup-status',
  settingsChanged: 'arnega:settings-changed',
  windowShown: 'arnega:window-shown',
} as const;

/** Only these symbolic targets can be opened externally from the renderer. */
export type ExternalLinkTarget = 'ollama-download' | 'model-info' | 'repo' | 'releases';

export type ScreenPermissionState =
  | 'granted'
  | 'denied'
  | 'not-determined'
  | 'restricted'
  | 'unknown';

export interface ModelInfo {
  name: string;
  sizeGb?: string;
  vision: boolean;
  isDefault: boolean;
}

export interface AppStatus {
  setup: SetupStatus;
  settings: ArNegaSettings;
  screenPermission: ScreenPermissionState;
  models: ModelInfo[];
  appVersion: string;
}

export interface SolveResult {
  ok: boolean;
  requestId?: number;
  error?: string;
}

export interface UpdateSettingsResult {
  settings: ArNegaSettings;
  /** Non-fatal problem applying part of the update (e.g. shortcut in use). */
  warning?: string;
}

export interface GenTimings {
  /** ms from Enter to screenshot captured & optimized. */
  captureMs?: number;
  /** ms from Enter to the HTTP request hitting local Ollama. */
  requestSentMs?: number;
  /** ms from Enter to the first visible answer token. */
  firstTokenMs?: number;
  /** ms from Enter to completion. */
  totalMs?: number;
}

export type GenEvent =
  | { requestId: number; type: 'phase'; phase: GenerationPhase }
  | { requestId: number; type: 'delta'; text: string }
  | { requestId: number; type: 'done'; stats?: ChatDelta['stats']; timings: GenTimings }
  | { requestId: number; type: 'error'; message: string };

/**
 * The API surface the preload script exposes to the renderer as
 * `window.arnega`. Event subscribers return an unsubscribe function.
 */
export interface ArnegaApi {
  solve(): Promise<SolveResult>;
  cancel(): Promise<void>;
  getStatus(): Promise<AppStatus>;
  refreshStatus(): Promise<AppStatus>;
  updateSettings(update: Partial<ArNegaSettings>): Promise<UpdateSettingsResult>;
  pullDefaultModel(): Promise<void>;
  cancelPull(): Promise<void>;
  openExternal(target: ExternalLinkTarget): Promise<void>;
  openScreenRecordingSettings(): Promise<void>;
  hideWindow(): Promise<void>;
  openSettingsWindow(): Promise<void>;
  closeSettingsWindow(): Promise<void>;
  resizeOverlay(contentHeight: number): Promise<void>;
  resetWindowPosition(): Promise<void>;
  clearLocalState(): Promise<void>;
  copyText(text: string): Promise<void>;
  onGenEvent(cb: (event: GenEvent) => void): () => void;
  onSetupStatus(cb: (status: SetupStatus) => void): () => void;
  onSettingsChanged(cb: (settings: ArNegaSettings) => void): () => void;
  onWindowShown(cb: () => void): () => void;
  readonly appVersion: string;
  /** `process.platform` value, e.g. "darwin". */
  readonly platform: string;
}
