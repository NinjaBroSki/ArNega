/**
 * Setup / availability state machine for the local AI stack.
 *
 * Transient states (`checking`, `model-downloading`, `model-loading`, `error`)
 * are set imperatively by the app; the steady states are derived from probe
 * results by the pure reducer below so the logic is unit-testable.
 */

export type SetupState =
  | 'checking'
  | 'ready'
  | 'ollama-missing'
  | 'ollama-not-running'
  | 'model-missing'
  | 'model-downloading'
  | 'model-loading'
  | 'error';

export interface OllamaProbeResult {
  /** True when the HTTP endpoint at 127.0.0.1:11434 responded. */
  reachable: boolean;
  /** Whether the `ollama` binary exists on this machine (best-effort). */
  binaryInstalled: boolean | undefined;
  /** True when the currently selected model is installed. */
  selectedModelInstalled: boolean;
}

/** Derive the steady setup state from a probe of the local Ollama stack. */
export function deriveSetupState(probe: OllamaProbeResult): SetupState {
  if (!probe.reachable) {
    return probe.binaryInstalled === false ? 'ollama-missing' : 'ollama-not-running';
  }
  return probe.selectedModelInstalled ? 'ready' : 'model-missing';
}

export interface SetupStatus {
  state: SetupState;
  /** Optional human-readable detail (error text, download stage, etc.). */
  detail?: string;
  /** 0..100 while downloading the model. */
  progressPercent?: number;
  /** Bytes for the current download layer, when known. */
  downloadedBytes?: number;
  totalBytes?: number;
}

/** Generation lifecycle for the overlay UI. */
export type GenerationPhase =
  | 'idle'
  | 'capturing'
  | 'sending'
  | 'thinking'
  | 'answering'
  | 'done'
  | 'cancelled'
  | 'failed';
