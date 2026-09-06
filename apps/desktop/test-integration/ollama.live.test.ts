/**
 * Live integration tests for the Ollama client against a real local server.
 * Uses a tiny text model (~90 MB) so the transport, streaming parser, pull
 * progress, and cancellation paths are exercised end-to-end without the
 * multi-GB default vision model.
 *
 * Requires: Ollama running at 127.0.0.1:11434.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  chatStream,
  listModelInfos,
  modelSupportsThinking,
  probeOllama,
  pullModel,
  warmUpModel,
} from '../src/main/ollama.js';
import type { ChatDelta, PullProgress } from '@arnega/shared';

const TINY_MODEL = 'smollm2:135m';

let reachable = false;

beforeAll(async () => {
  const probe = await probeOllama();
  reachable = probe.reachable;
  if (!reachable) {
    throw new Error('Ollama is not running at 127.0.0.1:11434 — start it and re-run.');
  }
});

describe('live Ollama integration', () => {
  it('probes the server and detects the binary', async () => {
    const probe = await probeOllama();
    expect(probe.reachable).toBe(true);
    expect(probe.binaryInstalled).toBe(true);
    expect(Array.isArray(probe.models)).toBe(true);
  });

  it('pulls a tiny model with streaming progress', async () => {
    const events: PullProgress[] = [];
    await pullModel({
      model: TINY_MODEL,
      signal: new AbortController().signal,
      onProgress: (p) => events.push(p),
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((e) => e.done)).toBe(true);
    expect(events.every((e) => !e.error)).toBe(true);
  });

  it('lists the model with metadata after the pull', async () => {
    const probe = await probeOllama();
    const names = probe.models.map((m) => m.name);
    expect(names).toContain(TINY_MODEL);
    const infos = await listModelInfos(probe.models);
    const tiny = infos.find((m) => m.name === TINY_MODEL);
    expect(tiny).toBeDefined();
    expect(tiny?.vision).toBe(false);
  });

  it('detects that the tiny model does not support thinking', async () => {
    expect(await modelSupportsThinking(TINY_MODEL)).toBe(false);
  });

  it('streams a chat completion token by token', async () => {
    const deltas: ChatDelta[] = [];
    await chatStream({
      model: TINY_MODEL,
      system: 'You are a terse assistant.',
      user: 'Reply with the single word: pong',
      numCtx: 2048,
      keepAlive: '1m',
      temperature: 0,
      think: false,
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
    });
    const text = deltas.map((d) => d.content).join('');
    const last = deltas.at(-1);
    expect(deltas.length).toBeGreaterThan(1);
    expect(text.length).toBeGreaterThan(0);
    expect(last?.done).toBe(true);
    expect(last?.stats?.evalCount).toBeGreaterThan(0);
    expect(deltas.every((d) => !d.error)).toBe(true);
  });

  it('cancels a generation promptly via AbortSignal', async () => {
    const controller = new AbortController();
    const started = Date.now();
    const promise = chatStream({
      model: TINY_MODEL,
      system: 'You are a storyteller.',
      user: 'Write a very long story about the ocean.',
      numCtx: 2048,
      keepAlive: '1m',
      temperature: 0.8,
      think: false,
      signal: controller.signal,
      onDelta: () => {
        // cancel as soon as the first token arrives
        controller.abort();
      },
    });
    await expect(promise).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(60_000);
  });

  it('surfaces a friendly error for a nonexistent model', async () => {
    const deltas: ChatDelta[] = [];
    await chatStream({
      model: 'definitely-not-a-real-model:1b',
      system: 'x',
      user: 'x',
      numCtx: 2048,
      keepAlive: '1m',
      temperature: 0,
      think: false,
      signal: new AbortController().signal,
      onDelta: (d) => deltas.push(d),
    });
    expect(deltas.at(-1)?.error).toBeTruthy();
  });

  it('warms a model up without error', async () => {
    await expect(warmUpModel(TINY_MODEL, '1m')).resolves.toBeUndefined();
  });
});
