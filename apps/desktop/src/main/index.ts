/**
 * ArNega — main process entry.
 *
 * A fully local screen question-answering assistant: capture → local Ollama →
 * streamed answer. No cloud AI endpoints, no telemetry, no accounts.
 */
import { app } from 'electron';
import { registerIpcHandlers } from './ipc.js';
import { installAppMenu } from './menu.js';
import { loadSettings } from './settings-store.js';
import { applyGlobalShortcut, unregisterAllShortcuts } from './shortcuts.js';
import { isGenerating } from './solve.js';
import { currentStatus, isDownloadingModel, refreshSetup, warmUp } from './status.js';
import { createOverlayWindow, setOverlayShownHook, showOverlay } from './windows.js';

const STATUS_POLL_MS = 20_000;

// Must run before `ready` so the userData directory is ~/Library/Application
// Support/ArNega (not the package name).
app.setName('ArNega');

// Single instance — a second launch focuses the existing overlay.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showOverlay();
  });

  app.whenReady().then(async () => {
    installAppMenu();
    registerIpcHandlers();
    createOverlayWindow();

    const settings = loadSettings();
    const shortcut = applyGlobalShortcut(settings.globalShortcut);
    if (!shortcut.ok) {
      console.warn('[main] global shortcut unavailable:', shortcut.error);
    }

    await refreshSetup();
    if (currentStatus().state === 'ready') {
      void warmUp();
    }

    // Re-warm whenever the overlay is summoned (throttled): keep_alive may
    // have expired since the last question, and reloading during "user is
    // reading the screen" time beats reloading after they press Enter.
    let lastWarmAt = 0;
    setOverlayShownHook(() => {
      const now = Date.now();
      if (now - lastWarmAt < 60_000) return;
      if (isGenerating() || isDownloadingModel()) return;
      lastWarmAt = now;
      if (currentStatus().state === 'ready') void warmUp();
    });

    setInterval(() => {
      if (isGenerating() || isDownloadingModel()) return;
      void refreshSetup();
    }, STATUS_POLL_MS);
  });

  app.on('activate', () => {
    showOverlay();
  });

  app.on('window-all-closed', () => {
    // Keep running (macOS convention) — the overlay can be summoned with the
    // global shortcut. Quit is available from the menu / Cmd+Q.
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    unregisterAllShortcuts();
  });

  // Defense in depth: harden any web contents that ever gets created.
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}
