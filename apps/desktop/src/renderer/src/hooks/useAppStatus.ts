import { useCallback, useEffect, useState } from 'react';
import type { AppStatus, ArNegaSettings, SetupStatus } from '@arnega/shared';

/**
 * Live view of app status (setup state, settings, models, permission).
 * Subscribes to main-process broadcasts and refreshes when the window is
 * summoned.
 */
export function useAppStatus(): {
  status: AppStatus | null;
  refresh: () => Promise<void>;
} {
  const [status, setStatus] = useState<AppStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await window.arnega.refreshStatus();
      setStatus(next);
    } catch (err) {
      console.error('refreshStatus failed', err);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    void window.arnega
      .getStatus()
      .then((s) => {
        if (!disposed) setStatus(s);
      })
      .catch((err) => console.error('getStatus failed', err));

    const offSetup = window.arnega.onSetupStatus((setup: SetupStatus) => {
      setStatus((prev) => (prev ? { ...prev, setup } : prev));
    });
    const offSettings = window.arnega.onSettingsChanged((settings: ArNegaSettings) => {
      setStatus((prev) => (prev ? { ...prev, settings } : prev));
    });
    const offShown = window.arnega.onWindowShown(() => {
      void window.arnega.getStatus().then((s) => {
        if (!disposed) setStatus(s);
      });
    });

    return () => {
      disposed = true;
      offSetup();
      offSettings();
      offShown();
    };
  }, []);

  return { status, refresh };
}
