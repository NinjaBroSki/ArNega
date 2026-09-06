/**
 * Development-only mock of the preload API, used when the renderer runs in a
 * plain browser (no Electron). Enables visual QA of every overlay/settings
 * state via `?mock=<scenario>`:
 *
 *   ready · ollama-missing · ollama-not-running · model-missing ·
 *   downloading · model-loading · error · perm-denied · answer ·
 *   answer-long · answer-code · answer-fail
 *
 * Never bundled into production paths that matter — installed only when
 * `window.arnega` is absent in dev builds.
 */
import {
  DEFAULT_SETTINGS,
  type AppStatus,
  type ArnegaApi,
  type ArNegaSettings,
  type GenEvent,
  type SetupStatus,
} from '@arnega/shared';

const SHORT_ANSWER = `**42 m/s** (option C).

Using \`v = u + at\` with u = 12 m/s, a = 6 m/s² and t = 5 s → v = 12 + 30 = 42 m/s.`;

const CODE_ANSWER = `**The bug: \`useEffect\` is missing \`userId\` in its dependency array**, so the profile never refetches when the route changes.

\`\`\`tsx
useEffect(() => {
  let cancelled = false;
  fetchProfile(userId).then((p) => {
    if (!cancelled) setProfile(p);
  });
  return () => {
    cancelled = true;
  };
}, [userId]); // ← add userId here
\`\`\`

Without it, the effect runs once with the first \`userId\` and keeps showing stale data. The cleanup flag also prevents a state update after unmount.`;

const LONG_ANSWER = `**The integral evaluates to \`π²/6 ≈ 1.6449\`** — this is the Basel problem.

### Why

The sum shown on screen is

$$\\sum_{n=1}^{\\infty} \\frac{1}{n^2}$$

1. Expand \`sin(x)/x\` as an infinite product: \`∏ (1 − x²/n²π²)\`.
2. Compare the \`x²\` coefficient with the Taylor series \`1 − x²/6 + …\`.
3. Matching coefficients gives \`∑ 1/n² = π²/6\`.

| n | Partial sum |
|---|-------------|
| 10 | 1.5498 |
| 100 | 1.6350 |
| 1000 | 1.6439 |

The partial sums on your screen (1.6350 at n=100) are consistent with convergence to **π²/6**, so the answer to select is **B**.`;

type Scenario = string;

function makeStatus(scenario: Scenario): AppStatus {
  const settings: ArNegaSettings = { ...DEFAULT_SETTINGS };
  const base: AppStatus = {
    setup: { state: 'ready' },
    settings,
    screenPermission: 'granted',
    models: [
      { name: 'qwen3-vl:8b-thinking-q4_K_M', sizeGb: '6.1 GB', vision: true, isDefault: true },
      { name: 'llava:13b', sizeGb: '8.0 GB', vision: true, isDefault: false },
    ],
    appVersion: '0.1.0',
  };
  const withSetup = (setup: SetupStatus): AppStatus => ({ ...base, setup });

  switch (scenario) {
    case 'ollama-missing':
      return { ...withSetup({ state: 'ollama-missing' }), models: [] };
    case 'ollama-not-running':
      return { ...withSetup({ state: 'ollama-not-running' }), models: [] };
    case 'model-missing':
      return { ...withSetup({ state: 'model-missing' }), models: [] };
    case 'downloading':
      return withSetup({
        state: 'model-downloading',
        detail: 'downloading sha256:8f2a…',
        progressPercent: 37.4,
        downloadedBytes: 2.3 * 1024 ** 3,
        totalBytes: 6.1 * 1024 ** 3,
      });
    case 'model-loading':
      return withSetup({ state: 'model-loading' });
    case 'error':
      return withSetup({
        state: 'error',
        detail: 'Model download failed. Check that Ollama is running and try again.',
      });
    case 'perm-denied':
      return { ...base, screenPermission: 'denied' };
    case 'checking':
      return withSetup({ state: 'checking' });
    default:
      return base;
  }
}

export function installMockApi(): void {
  const params = new URLSearchParams(location.search);
  const scenario = params.get('mock') ?? 'ready';
  let status = makeStatus(scenario);

  const genListeners = new Set<(e: GenEvent) => void>();
  const emit = (e: GenEvent): void => genListeners.forEach((cb) => cb(e));
  let requestId = 0;

  function playStream(text: string, fail = false): void {
    const id = ++requestId;
    const send = (e: GenEvent, delay: number): void => {
      setTimeout(() => emit(e), delay);
    };
    send({ requestId: id, type: 'phase', phase: 'capturing' }, 0);
    send({ requestId: id, type: 'phase', phase: 'sending' }, 350);
    send({ requestId: id, type: 'phase', phase: 'thinking' }, 900);
    if (fail) {
      send(
        {
          requestId: id,
          type: 'error',
          message: 'Ollama stopped responding. Make sure the Ollama app is running, then try again.',
        },
        2200,
      );
      return;
    }
    const tokens = text.match(/\S+\s*/g) ?? [];
    let t = 1900;
    tokens.forEach((token) => {
      send({ requestId: id, type: 'delta', text: token }, t);
      t += 24;
    });
    send(
      {
        requestId: id,
        type: 'done',
        stats: { evalCount: 180, evalDurationMs: 4300, promptEvalCount: 1210 },
        timings: { captureMs: 260, requestSentMs: 420, firstTokenMs: 1900, totalMs: t },
      },
      t + 60,
    );
  }

  const api: ArnegaApi = {
    solve: async () => {
      const text =
        scenario === 'answer-code' ? CODE_ANSWER : scenario === 'answer-long' ? LONG_ANSWER : SHORT_ANSWER;
      playStream(text, scenario === 'answer-fail');
      return { ok: true, requestId };
    },
    cancel: async () => {
      emit({ requestId, type: 'phase', phase: 'cancelled' });
    },
    getStatus: async () => status,
    refreshStatus: async () => status,
    updateSettings: async (update) => {
      status = { ...status, settings: { ...status.settings, ...update } as ArNegaSettings };
      return { settings: status.settings };
    },
    pullDefaultModel: async () => {
      status = makeStatus('downloading');
    },
    cancelPull: async () => {
      status = makeStatus('model-missing');
    },
    openExternal: async (t) => console.log('[mock] openExternal', t),
    openScreenRecordingSettings: async () => console.log('[mock] open settings pane'),
    hideWindow: async () => console.log('[mock] hide'),
    openSettingsWindow: async () => {
      location.search = '?view=settings&mock=' + scenario;
    },
    closeSettingsWindow: async () => {
      location.search = '?view=overlay&mock=' + scenario;
    },
    resizeOverlay: async () => {},
    resetWindowPosition: async () => {},
    clearLocalState: async () => {},
    copyText: async (text) => console.log('[mock] copy', text.length, 'chars'),
    onGenEvent: (cb) => {
      genListeners.add(cb);
      return () => genListeners.delete(cb);
    },
    onSetupStatus: () => () => {},
    onSettingsChanged: () => () => {},
    onWindowShown: () => () => {},
    appVersion: '0.1.0',
    platform: 'darwin',
  };

  (window as unknown as { arnega: ArnegaApi }).arnega = api;
  document.body.classList.add('mock');

  // Auto-play a generation for the answer scenarios.
  if (scenario.startsWith('answer')) {
    setTimeout(() => void api.solve(), 400);
  }
}
