/**
 * IPC surface — every channel the renderer can reach. Handlers validate the
 * sender and their payloads; anything unexpected is rejected.
 */
import { clipboard, ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  APP_VERSION,
  DEFAULT_SHORTCUT,
  IPC,
  type AppStatus,
  type ArNegaSettings,
  type SolveResult,
  type UpdateSettingsResult,
} from '@arnega/shared';
import { app } from 'electron';
import { openExternalTarget } from './external.js';
import { openScreenRecordingSettings, screenPermissionState } from './permissions.js';
import { clearLocalState, loadSettings, updateSettings } from './settings-store.js';
import { applyGlobalShortcut } from './shortcuts.js';
import { cancelGeneration, runSolve } from './solve.js';
import {
  cancelPull,
  currentModels,
  currentStatus,
  refreshSetup,
  startPullDefaultModel,
  warmUp,
} from './status.js';
import {
  broadcast,
  closeSettingsWindow,
  hideOverlay,
  openSettingsWindow,
  resetOverlayPosition,
  resizeOverlayHeight,
} from './windows.js';

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl && url.startsWith(devUrl)) return true;
  return url.startsWith('file://');
}

function handle<T>(
  channel: string,
  fn: (event: IpcMainInvokeEvent, payload: unknown) => T | Promise<T>,
): void {
  ipcMain.handle(channel, (event, payload) => {
    if (!isTrustedSender(event)) {
      console.warn('[ipc] rejected message from untrusted sender on', channel);
      throw new Error('Untrusted sender');
    }
    return fn(event, payload);
  });
}

function assembleStatus(): AppStatus {
  return {
    setup: currentStatus(),
    settings: loadSettings(),
    screenPermission: screenPermissionState(),
    models: currentModels(),
    appVersion: APP_VERSION,
  };
}

const ALLOWED_SETTINGS_KEYS: (keyof ArNegaSettings)[] = [
  'model',
  'answerStyle',
  'screenshotQuality',
  'globalShortcut',
  'launchAtLogin',
  'numCtx',
  'keepAlive',
  'captureCursor',
];

function sanitizeSettingsUpdate(payload: unknown): Partial<ArNegaSettings> {
  const update: Record<string, unknown> = {};
  if (payload && typeof payload === 'object') {
    for (const key of ALLOWED_SETTINGS_KEYS) {
      if (key in (payload as Record<string, unknown>)) {
        update[key] = (payload as Record<string, unknown>)[key];
      }
    }
  }
  return update as Partial<ArNegaSettings>;
}

export function registerIpcHandlers(): void {
  // Validate the capture mode at the boundary: anything but the literal
  // 'region' falls back to a full-display capture.
  handle<SolveResult>(IPC.solve, (_event, payload) =>
    runSolve(payload === 'region' ? 'region' : 'full'),
  );

  handle(IPC.cancel, () => {
    cancelGeneration();
  });

  handle<AppStatus>(IPC.getStatus, () => assembleStatus());

  handle<AppStatus>(IPC.refreshStatus, async () => {
    await refreshSetup();
    return assembleStatus();
  });

  handle<UpdateSettingsResult>(IPC.updateSettings, (_event, payload) => {
    const update = sanitizeSettingsUpdate(payload);
    const before = loadSettings();
    let warning: string | undefined;

    let settings = updateSettings(update);

    if (update.globalShortcut && update.globalShortcut !== before.globalShortcut) {
      const result = applyGlobalShortcut(settings.globalShortcut);
      if (!result.ok) {
        warning = result.error;
        settings = updateSettings({ globalShortcut: before.globalShortcut });
        applyGlobalShortcut(settings.globalShortcut);
      }
    }

    if (typeof update.launchAtLogin === 'boolean') {
      try {
        app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin });
      } catch (err) {
        console.warn('[ipc] failed to update login item:', err);
        warning = 'Could not update the launch-at-login setting.';
      }
    }

    if (update.model && update.model !== before.model) {
      void refreshSetup().then(() => {
        if (currentStatus().state === 'ready') void warmUp();
      });
    }

    broadcast(IPC.settingsChanged, settings);
    return { settings, warning };
  });

  handle(IPC.pullDefaultModel, () => {
    void startPullDefaultModel();
  });

  handle(IPC.cancelPull, () => {
    cancelPull();
  });

  handle(IPC.openExternal, async (_event, payload) => {
    await openExternalTarget(payload);
  });

  handle(IPC.openScreenRecordingSettings, async () => {
    await openScreenRecordingSettings();
  });

  handle(IPC.hideWindow, () => {
    hideOverlay();
  });

  handle(IPC.openSettingsWindow, () => {
    openSettingsWindow();
  });

  handle(IPC.closeSettingsWindow, () => {
    closeSettingsWindow();
  });

  handle(IPC.resizeOverlay, (_event, payload) => {
    if (typeof payload === 'number' && Number.isFinite(payload)) {
      resizeOverlayHeight(payload);
    }
  });

  handle(IPC.resetWindowPosition, () => {
    resetOverlayPosition();
  });

  handle(IPC.clearLocalState, () => {
    const settings = clearLocalState();
    applyGlobalShortcut(settings.globalShortcut ?? DEFAULT_SHORTCUT);
    try {
      app.setLoginItemSettings({ openAtLogin: false });
    } catch {
      // best effort
    }
    broadcast(IPC.settingsChanged, settings);
  });

  handle(IPC.copyText, (_event, payload) => {
    if (typeof payload === 'string' && payload.length <= 2_000_000) {
      clipboard.writeText(payload);
    }
  });
}
