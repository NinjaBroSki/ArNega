/**
 * Client for the local Ollama server. This module is the ONLY place in the
 * desktop app that performs AI inference networking, and every request goes
 * to the loopback endpoint defined in @arnega/shared (127.0.0.1:11434).
 * There are no cloud AI endpoints anywhere in ArNega.
 */
import { existsSync } from 'node:fs';
import {
  bytesToGb,
  DEFAULT_MODEL,
  isVisionCapable,
  NdjsonBuffer,
  OLLAMA_HOST,
  OLLAMA_PROBE_TIMEOUT_MS,
  parseChatLine,
  parsePullLine,
  type ChatDelta,
  type ModelInfo,
  type OllamaModel,
  type PullProgress,
} from '@arnega/shared';

// --- availability ----------------------------------------------------------

const OLLAMA_BINARY_CANDIDATES = [
  '/usr/local/bin/ollama',
  '/opt/homebrew/bin/ollama',
  '/Applications/Ollama.app',
];

export function ollamaBinaryInstalled(): boolean | undefined {
  try {
    return OLLAMA_BINARY_CANDIDATES.some((p) => existsSync(p));
  } catch {
    return undefined;
  }
}

export interface OllamaProbe {
  reachable: boolean;
  binaryInstalled: boolean | undefined;
  models: OllamaModel[];
}

export async function probeOllama(): Promise<OllamaProbe> {
  const binaryInstalled = ollamaBinaryInstalled();
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS),
    });
    if (!res.ok) return { reachable: false, binaryInstalled, models: [] };
    const data = (await res.json()) as { models?: OllamaModel[] };
    return { reachable: true, binaryInstalled, models: data.models ?? [] };
  } catch {
    return { reachable: false, binaryInstalled, models: [] };
  }
}

// --- model metadata --------------------------------------------------------

interface ShowResponse {
  capabilities?: string[];
}

const capabilitiesCache = new Map<string, string[] | undefined>();

async function modelCapabilities(name: string): Promise<string[] | undefined> {
  if (capabilitiesCache.has(name)) return capabilitiesCache.get(name);
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/show`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS),
    });
    if (!res.ok) {
      capabilitiesCache.set(name, undefined);
      return undefined;
    }
    const data = (await res.json()) as ShowResponse;
    capabilitiesCache.set(name, data.capabilities);
    return data.capabilities;
  } catch {
    capabilitiesCache.set(name, undefined);
    return undefined;
  }
}

export async function listModelInfos(models: OllamaModel[]): Promise<ModelInfo[]> {
  const infos = await Promise.all(
    models.map(async (m): Promise<ModelInfo> => {
      const caps = await modelCapabilities(m.name);
      return {
        name: m.name,
        sizeGb: bytesToGb(m.size),
        vision: isVisionCapable(m, caps),
        isDefault: m.name === DEFAULT_MODEL,
      };
    }),
  );
  // Vision-capable first, default model at the top.
  return infos.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.vision !== b.vision) return a.vision ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function modelSupportsThinking(name: string): Promise<boolean> {
  const caps = await modelCapabilities(name);
  if (caps) return caps.map((c) => c.toLowerCase()).includes('thinking');
  return name.toLowerCase().includes('thinking');
}

// --- chat streaming --------------------------------------------------------

export interface ChatStreamOptions {
  model: string;
  system: string;
  user: string;
  /** Base64 screenshot; omitted only in text-only integration tests. */
  imageBase64?: string;
  numCtx: number;
  keepAlive: string;
  temperature: number;
  think: boolean;
  signal: AbortSignal;
  onDelta: (delta: ChatDelta) => void;
}

/**
 * Stream a chat completion from local Ollama. Resolves when the stream ends
 * (including cancellation via the AbortSignal, which resolves quietly).
 */
export async function chatStream(opts: ChatStreamOptions): Promise<void> {
  const body = {
    model: opts.model,
    stream: true,
    think: opts.think,
    keep_alive: opts.keepAlive,
    options: {
      num_ctx: opts.numCtx,
      temperature: opts.temperature,
    },
    messages: [
      { role: 'system', content: opts.system },
      {
        role: 'user',
        content: opts.user,
        ...(opts.imageBase64 ? { images: [opts.imageBase64] } : {}),
      },
    ],
  };

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    let message = `Ollama returned HTTP ${res.status}`;
    try {
      const err = (await res.json()) as { error?: string };
      if (err.error) message = err.error;
    } catch {
      // keep the generic message
    }
    opts.onDelta({ content: '', thinking: '', done: true, error: message });
    return;
  }

  if (!res.body) {
    opts.onDelta({ content: '', thinking: '', done: true, error: 'Empty response from Ollama' });
    return;
  }

  const decoder = new TextDecoder();
  const buffer = new NdjsonBuffer();
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of buffer.push(decoder.decode(value, { stream: true }))) {
        const delta = parseChatLine(line);
        if (delta) opts.onDelta(delta);
      }
    }
    for (const line of buffer.flush()) {
      const delta = parseChatLine(line);
      if (delta) opts.onDelta(delta);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Ask Ollama to load the model into memory (empty generate request) so the
 * first real question doesn't pay the model load cost.
 */
export async function warmUpModel(model: string, keepAlive: string): Promise<void> {
  await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: keepAlive }),
    // Model load on first launch can take a while on cold disk cache.
    signal: AbortSignal.timeout(120_000),
  });
}

// --- pulling the default model --------------------------------------------

export interface PullOptions {
  model: string;
  signal: AbortSignal;
  onProgress: (progress: PullProgress) => void;
}

export async function pullModel(opts: PullOptions): Promise<void> {
  const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: opts.model, stream: true }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    opts.onProgress({
      status: 'error',
      done: true,
      error: `Ollama returned HTTP ${res.status} for the model download`,
    });
    return;
  }

  const decoder = new TextDecoder();
  const buffer = new NdjsonBuffer();
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of buffer.push(decoder.decode(value, { stream: true }))) {
        const progress = parsePullLine(line);
        if (progress) opts.onProgress(progress);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
