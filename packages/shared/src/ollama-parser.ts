/**
 * Pure parsers for Ollama's newline-delimited JSON (NDJSON) streams.
 *
 * Kept free of I/O so they can be exhaustively unit tested. The main process
 * feeds raw chunks from `fetch` into `NdjsonBuffer` and maps the lines through
 * `parseChatLine` / `parsePullLine`.
 */

function nsToMs(ns?: number): number | undefined {
  return typeof ns === 'number' ? Math.round(ns / 1e6) : undefined;
}

/** Splits a byte/character stream into complete NDJSON lines across chunks. */
export class NdjsonBuffer {
  private buf = '';

  /** Append a chunk and return any now-complete lines (non-empty, trimmed). */
  push(chunk: string): string[] {
    this.buf += chunk;
    const parts = this.buf.split('\n');
    this.buf = parts.pop() ?? '';
    return parts.map((l) => l.trim()).filter((l) => l.length > 0);
  }

  /** Return any trailing buffered content as a final line. */
  flush(): string[] {
    const rest = this.buf.trim();
    this.buf = '';
    return rest ? [rest] : [];
  }
}

// --- Chat / generate stream ------------------------------------------------

export interface ChatDelta {
  /** Visible answer text for this chunk (may be empty). */
  content: string;
  /** Hidden reasoning text for this chunk (never displayed to the user). */
  thinking: string;
  done: boolean;
  error?: string;
  stats?: {
    totalDurationMs?: number;
    loadDurationMs?: number;
    promptEvalCount?: number;
    promptEvalDurationMs?: number;
    evalCount?: number;
    evalDurationMs?: number;
  };
}

/**
 * Parse one NDJSON line from `/api/chat` (preferred) or `/api/generate`.
 * Returns null for blank lines. Never throws on malformed JSON — instead
 * returns a delta carrying an `error` so the caller can surface it.
 */
export function parseChatLine(line: string): ChatDelta | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { content: '', thinking: '', done: false, error: 'Malformed stream chunk' };
  }

  if (typeof obj.error === 'string') {
    return { content: '', thinking: '', done: true, error: obj.error };
  }

  // /api/chat shape: { message: { content, thinking } }
  // /api/generate shape: { response, thinking }
  const message = (obj.message ?? {}) as Record<string, unknown>;
  const content =
    (typeof message.content === 'string' ? message.content : undefined) ??
    (typeof obj.response === 'string' ? obj.response : '') ??
    '';
  const thinking =
    (typeof message.thinking === 'string' ? message.thinking : undefined) ??
    (typeof obj.thinking === 'string' ? obj.thinking : '') ??
    '';

  const done = obj.done === true;
  const delta: ChatDelta = { content, thinking, done };

  if (done) {
    delta.stats = {
      totalDurationMs: nsToMs(obj.total_duration as number | undefined),
      loadDurationMs: nsToMs(obj.load_duration as number | undefined),
      promptEvalCount: obj.prompt_eval_count as number | undefined,
      promptEvalDurationMs: nsToMs(obj.prompt_eval_duration as number | undefined),
      evalCount: obj.eval_count as number | undefined,
      evalDurationMs: nsToMs(obj.eval_duration as number | undefined),
    };
  }
  return delta;
}

/** Tokens-per-second from final stats, when available. */
export function tokensPerSecond(stats?: ChatDelta['stats']): number | undefined {
  if (!stats?.evalCount || !stats.evalDurationMs || stats.evalDurationMs <= 0) return undefined;
  return Math.round((stats.evalCount / stats.evalDurationMs) * 1000 * 10) / 10;
}

// --- Pull stream -----------------------------------------------------------

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  /** 0..100 for the current layer, when total/completed are present. */
  percent?: number;
  done: boolean;
  error?: string;
}

export function parsePullLine(line: string): PullProgress | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return { status: 'error', done: false, error: 'Malformed pull chunk' };
  }

  if (typeof obj.error === 'string') {
    return { status: 'error', done: true, error: obj.error };
  }

  const status = typeof obj.status === 'string' ? obj.status : 'unknown';
  const total = typeof obj.total === 'number' ? obj.total : undefined;
  const completed = typeof obj.completed === 'number' ? obj.completed : undefined;
  const percent =
    total && total > 0 && typeof completed === 'number'
      ? Math.min(100, Math.round((completed / total) * 1000) / 10)
      : undefined;

  return {
    status,
    digest: typeof obj.digest === 'string' ? obj.digest : undefined,
    total,
    completed,
    percent,
    done: status === 'success',
  };
}
