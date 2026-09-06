import { describe, expect, it } from 'vitest';
import {
  NdjsonBuffer,
  parseChatLine,
  parsePullLine,
  tokensPerSecond,
} from '../src/ollama-parser.js';

describe('NdjsonBuffer', () => {
  it('returns complete lines and buffers partial ones', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('{"a":1}\n{"b"')).toEqual(['{"a":1}']);
    expect(buf.push(':2}\n')).toEqual(['{"b":2}']);
    expect(buf.flush()).toEqual([]);
  });

  it('handles a chunk containing many lines', () => {
    const buf = new NdjsonBuffer();
    const lines = buf.push('{"a":1}\n{"b":2}\n{"c":3}\n');
    expect(lines).toHaveLength(3);
  });

  it('handles chunk boundaries in the middle of unicode-free tokens', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('{"message":{"content":"he')).toEqual([]);
    expect(buf.push('llo"},"done":false}\n')).toEqual([
      '{"message":{"content":"hello"},"done":false}',
    ]);
  });

  it('flush returns trailing content without newline', () => {
    const buf = new NdjsonBuffer();
    buf.push('{"done":true}');
    expect(buf.flush()).toEqual(['{"done":true}']);
    expect(buf.flush()).toEqual([]);
  });

  it('skips blank lines', () => {
    const buf = new NdjsonBuffer();
    expect(buf.push('\n\n{"a":1}\n\n')).toEqual(['{"a":1}']);
  });
});

describe('parseChatLine', () => {
  it('parses /api/chat content deltas', () => {
    const d = parseChatLine('{"message":{"role":"assistant","content":"42"},"done":false}');
    expect(d).toMatchObject({ content: '42', thinking: '', done: false });
  });

  it('separates thinking from content for thinking models', () => {
    const d = parseChatLine(
      '{"message":{"role":"assistant","content":"","thinking":"Let me check the units."},"done":false}',
    );
    expect(d).toMatchObject({ content: '', thinking: 'Let me check the units.', done: false });
  });

  it('parses legacy /api/generate response shape', () => {
    const d = parseChatLine('{"response":"answer text","done":false}');
    expect(d).toMatchObject({ content: 'answer text', done: false });
  });

  it('parses final stats and converts nanoseconds to ms', () => {
    const d = parseChatLine(
      JSON.stringify({
        message: { role: 'assistant', content: '' },
        done: true,
        total_duration: 5_000_000_000,
        load_duration: 1_000_000_000,
        prompt_eval_count: 900,
        prompt_eval_duration: 800_000_000,
        eval_count: 120,
        eval_duration: 3_000_000_000,
      }),
    );
    expect(d?.done).toBe(true);
    expect(d?.stats).toMatchObject({
      totalDurationMs: 5000,
      loadDurationMs: 1000,
      promptEvalCount: 900,
      evalCount: 120,
      evalDurationMs: 3000,
    });
  });

  it('surfaces server errors as delta errors', () => {
    const d = parseChatLine('{"error":"model not found"}');
    expect(d).toMatchObject({ done: true, error: 'model not found' });
  });

  it('never throws on malformed JSON', () => {
    const d = parseChatLine('{"message": <garbage>');
    expect(d?.error).toBe('Malformed stream chunk');
  });

  it('returns null for blank input', () => {
    expect(parseChatLine('  ')).toBeNull();
  });
});

describe('tokensPerSecond', () => {
  it('computes tokens/sec from stats', () => {
    expect(tokensPerSecond({ evalCount: 120, evalDurationMs: 3000 })).toBe(40);
  });
  it('returns undefined without stats', () => {
    expect(tokensPerSecond(undefined)).toBeUndefined();
    expect(tokensPerSecond({ evalCount: 0, evalDurationMs: 0 })).toBeUndefined();
  });
});

describe('parsePullLine', () => {
  it('parses layer download progress with percent', () => {
    const p = parsePullLine(
      '{"status":"downloading sha256:abc","digest":"sha256:abc","total":1000,"completed":250}',
    );
    expect(p).toMatchObject({ percent: 25, done: false, total: 1000, completed: 250 });
  });

  it('marks success as done', () => {
    expect(parsePullLine('{"status":"success"}')).toMatchObject({ done: true });
  });

  it('parses stage-only statuses without percent', () => {
    const p = parsePullLine('{"status":"verifying sha256 digest"}');
    expect(p?.percent).toBeUndefined();
    expect(p?.done).toBe(false);
  });

  it('surfaces pull errors', () => {
    const p = parsePullLine('{"error":"pull model manifest: file does not exist"}');
    expect(p?.error).toContain('manifest');
    expect(p?.done).toBe(true);
  });

  it('caps percent at 100', () => {
    const p = parsePullLine('{"status":"downloading","total":100,"completed":150}');
    expect(p?.percent).toBe(100);
  });
});
