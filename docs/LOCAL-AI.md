# Local AI

ArNega runs all AI inference on your Mac through [Ollama](https://ollama.com). The only inference endpoint the app ever contacts is the loopback server at `http://127.0.0.1:11434` (`OLLAMA_HOST` in `packages/shared/src/config.ts`), and `apps/desktop/src/main/ollama.ts` is the only module in the desktop app that performs AI networking. There are no cloud AI SDKs, no API keys, and no telemetry anywhere in the codebase.

This document explains the model choice, the exact Ollama API usage, how streaming and the thinking channel work, and how to tune performance.

## Why qwen3-vl:8b-thinking-q4_K_M

The default model is `qwen3-vl:8b-thinking-q4_K_M` (`DEFAULT_MODEL` in `packages/shared/src/config.ts`). It was chosen because screen question-answering needs three things at once:

- **Vision.** The model receives a JPEG of your screen, not extracted text, so it must be genuinely multimodal.
- **OCR-grade reading.** Screens are dense: small UI text, code, tables, charts, math notation. The Qwen3-VL family reads on-screen text well for its size.
- **Reasoning.** Many screen questions (math problems, multiple choice, code errors) benefit from the model working through the problem before answering. The `thinking` variant emits a separate reasoning channel that ArNega uses for exactly this (see below).

The `8b` parameter count at `q4_K_M` quantization is roughly a 6 GB download and fits comfortably in 16 GB of unified memory alongside the app, Ollama's KV cache, and your other software. Larger models answer better but do not leave that headroom; smaller vision models misread screens noticeably more often. The defaults (`keep_alive`, `num_ctx` below) are tuned for a 16 GB Apple Silicon machine.

## Endpoints and payload shapes

Everything goes to `http://127.0.0.1:11434`. Client code lives in `apps/desktop/src/main/ollama.ts`.

| Endpoint | Used for | Notes |
| --- | --- | --- |
| `GET /api/tags` | Health probe + installed model list | 2.5 s timeout (`OLLAMA_PROBE_TIMEOUT_MS`); polled every 20 s while idle |
| `POST /api/show` | Per-model `capabilities` (vision, thinking) | Results cached in-process per model name |
| `POST /api/chat` | The actual question | Streaming NDJSON |
| `POST /api/generate` | Warm-up (empty prompt loads the model) | 120 s timeout for cold loads |
| `POST /api/pull` | In-app download of the default model | Streaming NDJSON progress |

The chat request body (`chatStream` in `ollama.ts`):

```json
{
  "model": "qwen3-vl:8b-thinking-q4_K_M",
  "stream": true,
  "think": true,
  "keep_alive": "30m",
  "options": {
    "num_ctx": 8192,
    "temperature": 0.2
  },
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    {
      "role": "user",
      "content": "<style instruction>",
      "images": ["<base64 JPEG of the captured display>"]
    }
  ]
}
```

Details:

- The system prompt and the short user instruction come from `packages/shared/src/prompts.ts`. The user never types a prompt in the default Enter flow; the app supplies a fixed instruction plus the selected answer style (`direct` / `normal` / `detailed`).
- `think` is set per model by `modelSupportsThinking`: true when `/api/show` lists a `thinking` capability, with a fallback to checking whether the model name contains `thinking`.
- `keep_alive` and `num_ctx` come from settings (defaults `"30m"` and `8192`); `temperature` is fixed at `0.2` (`DEFAULT_TEMPERATURE`) — screen answers should be precise, not creative.
- Cancellation uses an `AbortController` wired to the overlay's Cancel button; aborting resolves the stream quietly.

## The thinking channel: parsed, never rendered

With `think: true`, thinking-capable models stream two channels: `message.thinking` (internal reasoning) and `message.content` (the visible answer). ArNega's policy:

- Both channels are **parsed** (`parseChatLine` in `packages/shared/src/ollama-parser.ts` returns `{ content, thinking, done }` deltas).
- Thinking text is **never displayed and never forwarded to the renderer**. In `apps/desktop/src/main/solve.ts`, the first thinking delta only flips the overlay's phase indicator to "thinking" so the user knows the model is working; the thinking text itself is dropped. Only `content` deltas are broadcast to the overlay.

This keeps answers clean (thinking output is verbose and often messy) while still letting the UI distinguish "reasoning" from "waiting."

## Streaming: NDJSON parsing

Ollama streams newline-delimited JSON. The parsing layer is pure TypeScript in `packages/shared/src/ollama-parser.ts` so it can be unit tested without I/O:

- `NdjsonBuffer` accumulates raw `fetch` chunks and splits on `\n`, holding any partial trailing line until the next chunk (a JSON object can be split across network chunks). `flush()` drains the remainder when the stream ends.
- `parseChatLine` parses one line into a `ChatDelta`. It understands both the `/api/chat` shape (`{ message: { content, thinking } }`) and the `/api/generate` shape (`{ response, thinking }`). It never throws: malformed JSON becomes a delta carrying an `error`, and an Ollama `{ "error": ... }` line becomes a terminal error delta.
- The final line (`done: true`) carries Ollama's timing stats (`total_duration`, `load_duration`, `prompt_eval_count`, `eval_count`, ...), converted from nanoseconds to milliseconds; `tokensPerSecond` derives decode speed from them.

The same pattern (`NdjsonBuffer` + `parsePullLine`) handles `/api/pull` progress lines, which report per-layer `completed` / `total` bytes.

## Getting the model

The default model is a one-time ~6 GB download that ArNega never starts without your approval. Two equivalent paths:

- **In-app:** when Ollama is running but the model is missing, the overlay offers the download. Accepting calls `POST /api/pull` with streamed progress — status text, percent, and byte counts are shown live, and the download can be cancelled (`apps/desktop/src/main/status.ts`). When the pull finishes, the app re-probes and warms the model up.
- **CLI:** run `ollama pull qwen3-vl:8b-thinking-q4_K_M` in a terminal. ArNega polls `/api/tags` and picks the model up automatically once it is installed.

Either way the model is stored and managed by Ollama, not by ArNega.

## Warm-up and keep-alive

Loading ~6 GB of weights into memory takes seconds; ArNega tries to pay that cost before you press Enter, not after:

- **Warm-up:** on launch (once the stack reports ready) and whenever you switch models in Settings, the app sends an empty `POST /api/generate` with just `{ model, keep_alive }`, which tells Ollama to load the model without generating anything (`warmUpModel` in `ollama.ts`, triggered from `apps/desktop/src/main/index.ts` and the settings IPC handler). The overlay shows "Loading model into memory…" during this. A failed warm-up is non-fatal — the first real request loads the model on demand instead.
- **Keep-alive:** every request passes `keep_alive` (default `"30m"`), so Ollama keeps the model resident for that long after each use. Repeated questions inside the window skip the reload entirely.

## Performance tuning

Three settings drive the speed/quality tradeoff. All live in Settings and persist to `~/Library/Application Support/ArNega/settings.json`.

### Screenshot quality presets

Captures happen at full physical resolution and are downscaled (never upscaled) per preset before JPEG encoding (`packages/shared/src/screenshot.ts`). Image size directly drives prompt-evaluation time — the largest chunk of time-to-first-token on a warm model.

| Preset | Max long edge | JPEG quality | When to use |
| --- | --- | --- | --- |
| Fast | 1280 px | 62% | Quick answers on simple screens; smallest and fastest to analyze |
| Balanced (default) | 1680 px | 78% | Readable text with good speed; recommended |
| High detail | 2440 px | 92% | Dense screens, small fonts, fine charts; noticeably slower |

If the model misreads small text, step up a preset before blaming the model. If answers feel slow, step down.

### `num_ctx` (context window)

Default `8192`, clamped to `2048`–`32768` (`packages/shared/src/settings.ts`).

- **Lower** values shrink the KV cache and reduce memory pressure, but risk truncation: the image tokens, system prompt, and — on thinking models — the reasoning itself all consume context. Too small and long reasoning chains get cut off mid-thought.
- **Higher** values give thinking room for hard problems at the cost of more memory reserved by Ollama. On a 16 GB machine, `8192` is a deliberate middle ground; raise it only if you routinely ask questions that need long reasoning.

### `keep_alive`

Default `"30m"`. Any Ollama duration string works (e.g. `"5m"`, `"1h"`; Ollama treats `0` as unload-immediately and a negative value as keep-loaded-indefinitely).

- **Longer** keeps first-token latency low across a whole work session, at the cost of ~6 GB of memory staying claimed by Ollama while idle.
- **Shorter** returns memory to the system sooner, but the next question after an idle gap pays the multi-second model reload.

### Reading the numbers

Every request measures `captureMs`, `requestSentMs`, `firstTokenMs`, and `totalMs`, shown subtly in the overlay footer (`apps/desktop/src/main/solve.ts`). Use them to see where your time actually goes before changing settings: a large `firstTokenMs` on the first question of a session is usually model load; consistently large `firstTokenMs` is image prompt evaluation (try a smaller preset) or thinking time.

## Choosing another vision model

The Settings model picker lists installed models that ArNega detects as vision-capable, with the default model pinned to the top.

Detection (`packages/shared/src/models.ts` + `apps/desktop/src/main/ollama.ts`):

1. **Authoritative:** `POST /api/show` for each installed model; a model is vision-capable when its `capabilities` array contains `vision`. Results are cached per model name.
2. **Fallback** (when `/api/show` is unavailable or returns no capabilities): family markers from `/api/tags` details (`clip`, `mllama`, `qwen3vl`, `qwen2vl`, `llava`, `mistral3`), then a name heuristic over well-known vision families (`qwen3-vl`, `qwen2.5-vl`, `llava`, `llama3.2-vision`, `minicpm-v`, `moondream`, `gemma3`, `pixtral`, and others).

Non-vision models are filtered out of the picker — you cannot normally select one. If a non-vision model ends up selected anyway (an edited settings file, or a vision model the heuristics misclassify), ArNega still attaches the screenshot to the request; Ollama will typically return an error, or the model will answer while ignoring the image entirely. Answers about your screen require a real vision model. Conversely, if a genuinely vision-capable model is missing from the list, the `/api/show` capability check is the first thing to investigate.

Thinking support is detected independently (see above), so non-thinking vision models like LLaVA work fine — they simply stream content without a reasoning channel, and `think` is sent as `false`.

## Realistic expectations

Local 8-billion-parameter models are useful, not infallible. Set expectations accordingly:

- **The model makes mistakes.** Expect occasional misread digits or small text, OCR slips on dense or low-contrast screens, arithmetic errors, and confidently wrong answers. Verify anything that matters. A higher screenshot preset helps with reading errors; nothing eliminates reasoning errors.
- **8 GB machines will struggle.** The default model wants ~6 GB for weights plus KV cache on top; ArNega's defaults are tuned for 16 GB of unified memory. On 8 GB Macs expect heavy swapping, slow responses, or out-of-memory failures (the app surfaces these with a suggestion to close memory-heavy apps or pick a smaller model). A smaller vision model is the practical answer there, with a corresponding accuracy cost.
- **First-token latency has several ingredients:** model load (seconds when cold — warm-up and `keep_alive` exist to hide this), prompt evaluation of the image (scales with preset size), and — on thinking models — however long the model chooses to reason before its first visible token. Hard questions legitimately take longer to start answering; the overlay's "thinking" phase indicates this is happening.
- **Ollama must be running.** If the server stops responding mid-session, the overlay says so plainly and the app keeps re-probing every 20 seconds until it is back.
