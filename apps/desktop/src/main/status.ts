/**
 * Tracks the state of the local AI stack (Ollama + model) and broadcasts
 * changes to the renderer. Steady states are derived by the pure reducer in
 * @arnega/shared; transient states (downloading, loading) are set here.
 */
import {
  DEFAULT_MODEL,
  deriveSetupState,
  IPC,
  type ModelInfo,
  type SetupStatus,
} from '@arnega/shared';
import { listModelInfos, probeOllama, pullModel, warmUpModel } from './ollama.js';
import { loadSettings } from './settings-store.js';
import { broadcast } from './windows.js';

let current: SetupStatus = { state: 'checking' };
let models: ModelInfo[] = [];
let pullAbort: AbortController | null = null;
let warming = false;

export function currentStatus(): SetupStatus {
  return current;
}

export function currentModels(): ModelInfo[] {
  return models;
}

export function isDownloadingModel(): boolean {
  return pullAbort !== null;
}

function setStatus(next: SetupStatus): void {
  current = next;
  broadcast(IPC.setupStatus, current);
}

/** Re-probe Ollama and derive the steady state (unless a download is active). */
export async function refreshSetup(): Promise<SetupStatus> {
  if (pullAbort) return current;
  const settings = loadSettings();
  const probe = await probeOllama();
  const selectedModelInstalled = probe.models.some(
    (m) => m.name === settings.model || m.model === settings.model,
  );
  models = probe.reachable ? await listModelInfos(probe.models) : [];
  const state = deriveSetupState({
    reachable: probe.reachable,
    binaryInstalled: probe.binaryInstalled,
    selectedModelInstalled,
  });
  // Don't downgrade a model-loading warmup that's still in progress.
  if (warming && state === 'ready') return current;
  setStatus({ state });
  return current;
}

/**
 * Preload the selected model into memory so the first Enter is fast.
 * Shows the `model-loading` state while Ollama loads weights.
 */
export async function warmUp(): Promise<void> {
  if (warming || pullAbort) return;
  const settings = loadSettings();
  warming = true;
  setStatus({ state: 'model-loading', detail: 'Loading model into memory…' });
  try {
    await warmUpModel(settings.model, settings.keepAlive);
    setStatus({ state: 'ready' });
  } catch (err) {
    console.warn('[status] warm-up failed:', err);
    // Not fatal — generation will load the model on demand.
    setStatus({ state: 'ready' });
  } finally {
    warming = false;
  }
}

/** Download the default model via Ollama, streaming progress to the UI. */
export async function startPullDefaultModel(): Promise<void> {
  if (pullAbort) return;
  pullAbort = new AbortController();
  setStatus({
    state: 'model-downloading',
    detail: 'Contacting Ollama…',
    progressPercent: 0,
  });
  try {
    let failed: string | null = null;
    await pullModel({
      model: DEFAULT_MODEL,
      signal: pullAbort.signal,
      onProgress: (p) => {
        if (p.error) {
          failed = p.error;
          return;
        }
        if (p.done) return;
        setStatus({
          state: 'model-downloading',
          detail: p.status,
          progressPercent: p.percent,
          downloadedBytes: p.completed,
          totalBytes: p.total,
        });
      },
    });
    pullAbort = null;
    if (failed) {
      setStatus({ state: 'error', detail: `Model download failed: ${failed}` });
      return;
    }
    await refreshSetup();
    if (current.state === 'ready') {
      void warmUp();
    }
  } catch (err) {
    const aborted = pullAbort?.signal.aborted ?? false;
    pullAbort = null;
    if (aborted) {
      await refreshSetup();
    } else {
      console.error('[status] model pull failed:', err);
      setStatus({
        state: 'error',
        detail: 'Model download failed. Check that Ollama is running and try again.',
      });
    }
  } finally {
    pullAbort = null;
  }
}

export function cancelPull(): void {
  pullAbort?.abort();
}

export function setErrorStatus(detail: string): void {
  setStatus({ state: 'error', detail });
}
