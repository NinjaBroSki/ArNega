/**
 * macOS Screen Recording permission handling. ArNega needs only this one
 * permission — no microphone, camera, contacts, or location.
 */
import { shell, systemPreferences } from 'electron';
import type { ScreenPermissionState } from '@arnega/shared';

export function screenPermissionState(): ScreenPermissionState {
  if (process.platform !== 'darwin') return 'unknown';
  try {
    const status = systemPreferences.getMediaAccessStatus('screen');
    switch (status) {
      case 'granted':
        return 'granted';
      case 'denied':
        return 'denied';
      case 'not-determined':
        return 'not-determined';
      case 'restricted':
        return 'restricted';
      default:
        return 'unknown';
    }
  } catch {
    return 'unknown';
  }
}

/** Open the Screen Recording pane of System Settings. */
export async function openScreenRecordingSettings(): Promise<void> {
  await shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  );
}
