/**
 * The Enter workflow: capture the screen → send to local Ollama → stream the
 * answer to the overlay. One generation at a time; Enter during generation is
 * ignored (the UI offers Cancel).
 */
import {
  buildUserInstruction,
  DEFAULT_TEMPERATURE,
  IPC,
  SYSTEM_PROMPT,
  type CaptureMode,
  type ChatDelta,
  type GenEvent,
  type GenTimings,
  type SolveResult,
} from '@arnega/shared';
import {
  captureDisplay,
  captureRegionInteractive,
  targetDisplayForCapture,
  type CaptureResult,
} from './capture.js';
import { chatStream, modelSupportsThinking } from './ollama.js';
import { loadSettings } from './settings-store.js';
import { currentStatus, refreshSetup } from './status.js';
import { broadcast, getOverlayWindow, hideWindowsForCapture } from './windows.js';

/**
 * Hide the overlay during capture. Content protection alone excludes the
 * window from capture on modern macOS, but hiding guarantees a clean shot on
 * every OS version and capture path. The brief blink doubles as feedback
 * that Enter registered. Set ARNEGA_NO_HIDE_CAPTURE=1 to rely on content
 * protection only (used by the capture self-test during development).
 */
const HIDE_DURING_CAPTURE = process.env['ARNEGA_NO_HIDE_CAPTURE'] !== '1';

/** Two compositor frames plus margin, so the hide is committed before capture. */
const CAPTURE_SETTLE_MS = 80;

let inflight: { requestId: number; controller: AbortController } | null = null;
let counter = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isGenerating(): boolean {
  return inflight !== null;
}

export function cancelGeneration(): void {
  inflight?.controller.abort();
}

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('socket')) {
    return 'Ollama stopped responding. Make sure the Ollama app is running, then try again.';
  }
  if (msg.includes('not found') && msg.includes('model')) {
    return 'The selected model is not installed in Ollama anymore. Open Settings to pick a model.';
  }
  if (msg.includes('permission') || msg.includes('screen recording') || msg.includes('empty')) {
    return 'Screen capture failed. Check that ArNega has Screen Recording permission in System Settings.';
  }
  if (msg.includes('memory') || msg.includes('unable to allocate')) {
    return 'The model ran out of memory. Try closing memory-heavy apps, or switch to a smaller model.';
  }
  return raw;
}

export async function runSolve(mode: CaptureMode = 'full'): Promise<SolveResult> {
  if (inflight) {
    return { ok: false, error: 'Already answering — cancel first or wait for it to finish.' };
  }

  const setup = currentStatus();
  if (setup.state !== 'ready' && setup.state !== 'model-loading') {
    void refreshSetup();
    return { ok: false, error: 'Local AI is not ready yet.' };
  }

  const requestId = ++counter;
  const controller = new AbortController();
  inflight = { requestId, controller };

  const t0 = performance.now();
  const ms = (): number => Math.round(performance.now() - t0);
  const timings: GenTimings = {};
  const emit = (ev: GenEvent): void => broadcast(IPC.genEvent, ev);

  try {
    emit({ requestId, type: 'phase', phase: 'capturing' });
    const settings = loadSettings();

    const overlay = getOverlayWindow();
    const overlayBounds = overlay && overlay.isVisible() ? overlay.getBounds() : null;
    const display = targetDisplayForCapture(overlayBounds);

    let capture: CaptureResult;
    const restore = HIDE_DURING_CAPTURE ? hideWindowsForCapture() : null;
    try {
      if (restore) await sleep(CAPTURE_SETTLE_MS);
      if (mode === 'region') {
        const snip = await captureRegionInteractive();
        if (!snip) {
          // user pressed Esc in the crosshair UI — end quietly
          emit({ requestId, type: 'phase', phase: 'cancelled' });
          return { ok: true, requestId };
        }
        capture = snip;
      } else {
        capture = await captureDisplay(display, settings.screenshotQuality);
      }
    } finally {
      restore?.();
    }
    timings.captureMs = ms();

    emit({ requestId, type: 'phase', phase: 'sending' });
    // Deep reasoning only when the user asked for it: thinking editions spend
    // many seconds on hidden chain-of-thought before the first visible token.
    const think =
      settings.answerStyle === 'detailed' && (await modelSupportsThinking(settings.model));
    timings.requestSentMs = ms();

    let sawThinking = false;
    let sawContent = false;
    let streamError: string | null = null;
    let finalStats: ChatDelta['stats'];

    await chatStream({
      model: settings.model,
      system: SYSTEM_PROMPT,
      user: buildUserInstruction(settings.answerStyle),
      imageBase64: capture.base64,
      numCtx: settings.numCtx,
      keepAlive: settings.keepAlive,
      temperature: DEFAULT_TEMPERATURE,
      think,
      signal: controller.signal,
      onDelta: (d) => {
        if (d.error) {
          streamError = d.error;
          return;
        }
        if (d.thinking && !sawThinking && !sawContent) {
          sawThinking = true;
          emit({ requestId, type: 'phase', phase: 'thinking' });
        }
        if (d.content) {
          if (!sawContent) {
            sawContent = true;
            timings.firstTokenMs = ms();
            emit({ requestId, type: 'phase', phase: 'answering' });
          }
          emit({ requestId, type: 'delta', text: d.content });
        }
        if (d.done && d.stats) {
          finalStats = d.stats;
        }
      },
    });

    if (controller.signal.aborted) {
      emit({ requestId, type: 'phase', phase: 'cancelled' });
      return { ok: true, requestId };
    }
    if (streamError) {
      emit({ requestId, type: 'error', message: friendlyError(streamError) });
      void refreshSetup();
      return { ok: true, requestId };
    }

    timings.totalMs = ms();
    emit({ requestId, type: 'done', stats: finalStats, timings });
    return { ok: true, requestId };
  } catch (err) {
    if (controller.signal.aborted) {
      emit({ requestId, type: 'phase', phase: 'cancelled' });
      return { ok: true, requestId };
    }
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    console.error('[solve] failed:', err);
    emit({ requestId, type: 'error', message: friendlyError(message) });
    void refreshSetup();
    return { ok: true, requestId };
  } finally {
    inflight = null;
  }
}
