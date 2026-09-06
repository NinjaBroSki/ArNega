/**
 * Preload — the only bridge between the sandboxed renderer and the main
 * process. Exposes exactly the typed `ArnegaApi` surface; no Node, no raw
 * ipcRenderer, no arbitrary channels.
 */
import { contextBridge, ipcRenderer } from 'electron';
import {
  APP_VERSION,
  IPC,
  type AppStatus,
  type ArnegaApi,
  type ArNegaSettings,
  type ExternalLinkTarget,
  type GenEvent,
  type SetupStatus,
  type SolveResult,
  type UpdateSettingsResult,
} from '@arnega/shared';

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: ArnegaApi = {
  solve: () => ipcRenderer.invoke(IPC.solve) as Promise<SolveResult>,
  cancel: () => ipcRenderer.invoke(IPC.cancel) as Promise<void>,
  getStatus: () => ipcRenderer.invoke(IPC.getStatus) as Promise<AppStatus>,
  refreshStatus: () => ipcRenderer.invoke(IPC.refreshStatus) as Promise<AppStatus>,
  updateSettings: (update: Partial<ArNegaSettings>) =>
    ipcRenderer.invoke(IPC.updateSettings, update) as Promise<UpdateSettingsResult>,
  pullDefaultModel: () => ipcRenderer.invoke(IPC.pullDefaultModel) as Promise<void>,
  cancelPull: () => ipcRenderer.invoke(IPC.cancelPull) as Promise<void>,
  openExternal: (target: ExternalLinkTarget) =>
    ipcRenderer.invoke(IPC.openExternal, target) as Promise<void>,
  openScreenRecordingSettings: () =>
    ipcRenderer.invoke(IPC.openScreenRecordingSettings) as Promise<void>,
  hideWindow: () => ipcRenderer.invoke(IPC.hideWindow) as Promise<void>,
  openSettingsWindow: () => ipcRenderer.invoke(IPC.openSettingsWindow) as Promise<void>,
  closeSettingsWindow: () => ipcRenderer.invoke(IPC.closeSettingsWindow) as Promise<void>,
  resizeOverlay: (contentHeight: number) =>
    ipcRenderer.invoke(IPC.resizeOverlay, contentHeight) as Promise<void>,
  resetWindowPosition: () => ipcRenderer.invoke(IPC.resetWindowPosition) as Promise<void>,
  clearLocalState: () => ipcRenderer.invoke(IPC.clearLocalState) as Promise<void>,
  copyText: (text: string) => ipcRenderer.invoke(IPC.copyText, text) as Promise<void>,
  onGenEvent: (cb: (event: GenEvent) => void) => subscribe(IPC.genEvent, cb),
  onSetupStatus: (cb: (status: SetupStatus) => void) => subscribe(IPC.setupStatus, cb),
  onSettingsChanged: (cb: (settings: ArNegaSettings) => void) =>
    subscribe(IPC.settingsChanged, cb),
  onWindowShown: (cb: () => void) => subscribe(IPC.windowShown, cb),
  appVersion: APP_VERSION,
  platform: process.platform,
};

contextBridge.exposeInMainWorld('arnega', api);
