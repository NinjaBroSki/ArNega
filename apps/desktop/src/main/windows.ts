/**
 * Window management: the floating overlay and the settings window.
 *
 * Security posture (see docs/SECURITY.md):
 *   - contextIsolation on, sandbox on, nodeIntegration off
 *   - navigation locked to the bundled renderer
 *   - window.open denied everywhere
 *   - content protection enabled (best-effort exclusion from ordinary capture)
 */
import { BrowserWindow, screen, shell } from 'electron';
import { join } from 'node:path';
import {
  DEFAULT_OVERLAY_SIZE,
  IPC,
  OVERLAY_MIN_SIZE,
  OVERLAY_MAX_HEIGHT,
  type OverlayBounds,
} from '@arnega/shared';
import { loadSettings, updateSettings } from './settings-store.js';
import { isRectVisibleOnAnyDisplay } from './display.js';

const isDev = !!process.env['ELECTRON_RENDERER_URL'];

let overlayWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

function preloadPath(): string {
  return join(__dirname, '../preload/index.js');
}

function loadRenderer(win: BrowserWindow, view: 'overlay' | 'settings'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void win.loadURL(`${devUrl}?view=${view}`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } });
  }
}

function hardenWebContents(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    // The renderer is a local bundle; any real navigation attempt is hostile
    // or a bug. Dev server reloads stay on the same origin.
    const devUrl = process.env['ELECTRON_RENDERER_URL'];
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
      console.warn('[security] blocked navigation to', url);
    }
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => {
    // The renderer never needs runtime permissions (camera, mic, geoloc, …).
    callback(false);
  });
}

function initialOverlayBounds(): OverlayBounds {
  const saved = loadSettings().overlayBounds;
  if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
    const rect = { x: saved.x, y: saved.y, width: saved.width, height: saved.height };
    if (isRectVisibleOnAnyDisplay(rect, screen.getAllDisplays())) {
      return saved;
    }
  }
  return centeredOverlayBounds(saved?.width, saved?.height);
}

function centeredOverlayBounds(width?: number, height?: number): OverlayBounds {
  const display = screen.getPrimaryDisplay();
  const w = width ?? DEFAULT_OVERLAY_SIZE.width;
  const h = height ?? DEFAULT_OVERLAY_SIZE.height;
  return {
    x: Math.round(display.workArea.x + (display.workArea.width - w) / 2),
    // Sit in the upper third — near where questions usually are, not covering them.
    y: Math.round(display.workArea.y + display.workArea.height * 0.12),
    width: w,
    height: h,
  };
}

let persistBoundsTimer: NodeJS.Timeout | null = null;
function schedulePersistBounds(): void {
  if (persistBoundsTimer) clearTimeout(persistBoundsTimer);
  persistBoundsTimer = setTimeout(() => {
    persistBoundsTimer = null;
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    const b = overlayWindow.getBounds();
    updateSettings({ overlayBounds: b });
  }, 400);
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) return overlayWindow;

  const bounds = initialOverlayBounds();
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    minWidth: OVERLAY_MIN_SIZE.width,
    minHeight: OVERLAY_MIN_SIZE.height,
    show: false,
    frame: false,
    transparent: false,
    vibrancy: 'hud',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    roundedCorners: true,
    alwaysOnTop: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    hiddenInMissionControl: true,
    hasShadow: true,
    title: 'ArNega',
    webPreferences: {
      preload: preloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: isDev,
    },
  });

  overlayWindow.setAlwaysOnTop(true, 'floating');
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Best-effort: ask macOS to exclude the overlay from ordinary screen
  // capture. This is NOT a guarantee — see docs/PRIVACY.md. The env flag
  // exists only for development screenshots / the capture self-test.
  if (process.env['ARNEGA_DEBUG_NO_CONTENT_PROTECTION'] !== '1') {
    overlayWindow.setContentProtection(true);
  }

  hardenWebContents(overlayWindow);
  loadRenderer(overlayWindow, 'overlay');

  overlayWindow.on('moved', schedulePersistBounds);
  overlayWindow.on('resized', schedulePersistBounds);
  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  overlayWindow.once('ready-to-show', () => {
    showOverlay();
  });

  return overlayWindow;
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow && !overlayWindow.isDestroyed() ? overlayWindow : null;
}

/**
 * Called every time the overlay is shown (launch, global shortcut, dock,
 * second instance). index.ts registers a throttled model warm-up here so the
 * weights start loading while the user is still reading their screen, instead
 * of blocking their first token after Enter.
 */
let overlayShownHook: (() => void) | null = null;
export function setOverlayShownHook(fn: () => void): void {
  overlayShownHook = fn;
}

export function showOverlay(): void {
  const win = getOverlayWindow() ?? createOverlayWindow();
  win.show();
  win.focus();
  win.webContents.send(IPC.windowShown);
  overlayShownHook?.();
}

export function hideOverlay(): void {
  getOverlayWindow()?.hide();
}

export function toggleOverlay(): void {
  const win = getOverlayWindow();
  if (win?.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    showOverlay();
  }
}

/** Renderer-driven height adjustment as answer content grows. */
export function resizeOverlayHeight(contentHeight: number): void {
  const win = getOverlayWindow();
  if (!win) return;
  const display = screen.getDisplayMatching(win.getBounds());
  const maxHeight = Math.min(OVERLAY_MAX_HEIGHT, Math.round(display.workArea.height * 0.72));
  const height = Math.max(
    OVERLAY_MIN_SIZE.height,
    Math.min(maxHeight, Math.round(contentHeight)),
  );
  const bounds = win.getBounds();
  if (Math.abs(bounds.height - height) < 8) return;
  // Keep the top edge fixed; grow downward.
  win.setBounds({ ...bounds, height }, true);
}

export function resetOverlayPosition(): void {
  const win = getOverlayWindow();
  const bounds = centeredOverlayBounds();
  updateSettings({ overlayBounds: bounds });
  if (win) {
    win.setBounds(bounds, true);
    showOverlay();
  }
}

/**
 * Hide app windows for a clean capture; returns a restore function.
 * The overlay also has content protection, but hiding guarantees the
 * screenshot sent to the model never contains ArNega itself.
 */
export function hideWindowsForCapture(): () => void {
  const wins = [overlayWindow, settingsWindow].filter(
    (w): w is BrowserWindow => !!w && !w.isDestroyed() && w.isVisible(),
  );
  const hadFocus = wins.some((w) => w.isFocused());
  for (const w of wins) w.hide();
  return () => {
    for (const w of wins) w.showInactive();
    if (hadFocus) wins[0]?.focus();
  };
}

// --- settings window -------------------------------------------------------

export function openSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 760,
    height: 620,
    minWidth: 640,
    minHeight: 520,
    show: false,
    title: 'ArNega Settings',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0C0E13',
    fullscreenable: false,
    webPreferences: {
      preload: preloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      devTools: isDev,
    },
  });

  hardenWebContents(settingsWindow);
  loadRenderer(settingsWindow, 'settings');

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
  });
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function closeSettingsWindow(): void {
  settingsWindow?.close();
}

/** Send an event to every live renderer. */
export function broadcast(channel: string, payload?: unknown): void {
  for (const win of [overlayWindow, settingsWindow]) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

export { shell };
