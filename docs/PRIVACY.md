# Privacy engineering notes

This is the engineering-level privacy document for ArNega. The website privacy
page states the promises; this document shows where each promise lives in the
code, enumerates every byte the app stores or transmits, and tells you how to
verify all of it yourself instead of taking our word for it.

Scope: the macOS desktop app (`apps/desktop`). The website is a static Astro
build with no analytics, cookies, or tracking scripts.

## Summary

- All AI inference happens on your Mac, via a local Ollama server at
  `http://127.0.0.1:11434`. There are no cloud AI endpoints, SDKs, or API keys
  anywhere in the codebase.
- Screenshots are processed in memory and sent only to that loopback endpoint.
- The only data ArNega persists is one settings file.
- There is no telemetry, analytics, crash reporting, account system, or
  auto-update ping.

## Data flow of one capture

What happens when you press Enter (implemented in
`apps/desktop/src/main/solve.ts`):

```
Enter (overlay focused — there is no global Enter hook)
  │
  ▼
hide ArNega windows                  guarantees the overlay is not in the shot;
  │  wait 80 ms (compositor settle)  content protection is also enabled as
  ▼                                  defense-in-depth
capture target display               desktopCapturer, full physical resolution,
  │                                  entirely in memory (fallback: see below)
  ▼
downscale + JPEG encode              per quality preset (fast 1280 / balanced
  │                                  1680 / high 2440 px long edge)
  ▼
base64 encode                        still in memory
  │
  ▼
POST http://127.0.0.1:11434/api/chat body: system prompt + style instruction +
  │                                  the image; never leaves the machine
  ▼
stream NDJSON deltas                 thinking channel parsed but never
  │                                  displayed; answer tokens stream into
  ▼                                  the overlay
render answer in overlay             held in renderer memory only; gone when
                                     the app quits
```

The image buffer, base64 string, and answer text are ordinary process memory.
None of them are written to disk by ArNega, and no history of questions or
answers is kept anywhere.

Per-request timings (`captureMs`, `requestSentMs`, `firstTokenMs`, `totalMs`)
are measured in memory, shown in the overlay footer, and discarded with the
rest of the request state.

### The `screencapture` fallback and its temp file

The primary capture path (`desktopCapturer` in
`apps/desktop/src/main/capture.ts`) is fully in-memory. If it fails, the app
falls back to the macOS `/usr/sbin/screencapture` utility, which can only
write to a file. In that case:

- The file is a PNG at a random path:
  `$TMPDIR/arnega-capture-<16 hex chars>.png`.
- It is read back into memory and deleted in a `finally` block, so it exists
  on disk for milliseconds under normal operation, whether the capture
  succeeds or fails.
- Honest caveat: if the process were killed in the window between write and
  delete, the file could linger in the temp directory until macOS cleans it
  up. This is the only code path in the app that ever puts screen content on
  disk, and it runs only when the in-memory path has already failed.

## What is stored, and where

### `~/Library/Application Support/ArNega/settings.json`

The only file ArNega writes. Schema and validation:
`packages/shared/src/settings.ts`; persistence:
`apps/desktop/src/main/settings-store.ts`.

Complete contents:

| Key | What it is |
|---|---|
| `schemaVersion` | Settings format version (currently `1`) |
| `model` | Selected Ollama model name (default `qwen3-vl:8b-thinking-q4_K_M`) |
| `answerStyle` | `direct` / `normal` / `detailed` |
| `screenshotQuality` | `fast` / `balanced` / `high` |
| `globalShortcut` | Show/hide accelerator (default `CommandOrControl+Shift+Space`) |
| `launchAtLogin` | Boolean |
| `numCtx` | Context window (clamped 2048–32768, default 8192) |
| `keepAlive` | Ollama keep-alive duration (default `"30m"`) |
| `captureCursor` | Boolean |
| `overlayBounds` | Last overlay window position/size (optional) |

Notes:

- No question text, no answers, no screenshots, no identifiers, no timestamps.
- Writes are atomic (write to `settings.json.tmp`, then rename), so a crash
  cannot leave a half-written file.
- A corrupt or hand-edited file is normalized back to safe defaults on load
  (`normalizeSettings`); nothing invalid can persist.
- Settings updates arriving over IPC are filtered to an allowlist of known
  keys and re-validated — the renderer cannot smuggle arbitrary data into the
  file.
- "Clear local state" in Settings deletes this file and resets to defaults.

### Chromium cache directories (not ArNega data)

ArNega is an Electron app, so Chromium creates its standard bookkeeping
directories under `~/Library/Application Support/ArNega/` (e.g. `Cache/`,
`GPUCache/`, `Code Cache/`, `Preferences`, and similar). These are created by
the browser engine for its own operation — ArNega does not write application
data into them, and the renderer loads only the bundled local UI. Deleting the
entire `~/Library/Application Support/ArNega/` directory removes everything,
including these.

## Network audit

Every outbound request the app can make. There are no others.

### Loopback (127.0.0.1:11434) — automatic, local machine only

All in `apps/desktop/src/main/ollama.ts`. These go to the local Ollama server
and never leave your Mac.

| Endpoint | Method | When | Payload |
|---|---|---|---|
| `/api/tags` | GET | Availability probe on launch and setup refresh (2.5 s timeout) | none |
| `/api/show` | POST | Detecting model capabilities (vision/thinking), cached per model name | `{ model }` |
| `/api/chat` | POST | You press Enter | System prompt, style instruction, screenshot (base64), sampling options |
| `/api/generate` | POST | Model warm-up (empty prompt so the first question skips load time) | `{ model, keep_alive }` |
| `/api/pull` | POST | You click the in-app button to download the default model | `{ model, stream: true }` |

Note on `/api/pull`: ArNega's request goes to your local Ollama server, but
Ollama itself then downloads the model (~6 GB, one time) from its registry
over the internet. That download is performed by Ollama, not ArNega, and only
happens when you explicitly start it — in-app or via
`ollama pull qwen3-vl:8b-thinking-q4_K_M`.

### External URLs — user click only, opened in your default browser

`apps/desktop/src/main/external.ts` is the only place the app calls
`shell.openExternal`, against a hard-coded allowlist. The renderer cannot pass
a URL — it can only name one of four symbolic targets, which the main process
maps:

| Target | URL |
|---|---|
| `ollama-download` | `https://ollama.com/download` |
| `model-info` | `https://ollama.com/library/qwen3-vl` |
| `repo` | GitHub repository page |
| `releases` | GitHub releases page |

Opening a page in your browser is not a request made *by* ArNega — the app
transmits nothing to these sites. `window.open` is denied globally,
off-origin navigation is blocked, and markdown links inside model answers are
rendered inert (no `href`, no pointer events), so answer content can never
trigger navigation.

### Platform caveat

The tables above cover ArNega's own code. Electron/Chromium and macOS may
perform their own system-level network activity outside any app's control —
for example TLS certificate revocation checks or OS services. ArNega does not
add to, depend on, or piggyback data onto any of that. If you run a firewall
like Little Snitch you may see such platform traffic attributed to the
process; none of it carries ArNega data.

## What is NOT collected

- No telemetry or analytics (no analytics SDK exists in the dependency tree).
- No crash reporting (Electron's crash reporter is never started; crashes stay
  on your machine).
- No accounts, sign-in, or user identifiers of any kind.
- No API keys — there is nothing to send them to.
- No auto-update mechanism, so no update pings. You update by downloading a
  new release yourself.
- No question/answer history stored anywhere.
- The website served from GitHub Pages has no analytics, cookies, or trackers.

## Permissions

Screen Recording is the only macOS permission ArNega needs (checked via
`systemPreferences.getMediaAccessStatus('screen')`; the in-app button
deep-links to that pane of System Settings). No microphone, camera, contacts,
location, or anything else.

## Capture privacy is best-effort

The overlay window enables `setContentProtection(true)`, hides itself during
capture, skips the taskbar and Mission Control, and floats above other
windows. This keeps the overlay out of ArNega's own screenshots and, on
modern macOS, out of most third-party captures.

We deliberately do not claim the overlay is invisible or undetectable. macOS
capture behavior varies by OS version and capture method, and other software
on your machine may still be able to observe or record it. Treat content
protection as a courtesy, not a guarantee.

## Verify it yourself

Don't trust this document — check it against the code and the running app.

Audit the source for network calls:

```sh
# Every URL in the desktop app and shared packages
grep -rn "https\?://" apps/desktop/src packages/shared/src

# Every fetch call site
grep -rn "fetch(" apps/desktop/src packages/shared/src

# Every place a URL can be opened externally
grep -rn "openExternal" apps/desktop/src

# Confirm no analytics/telemetry SDKs in the dependency tree
npm ls --all 2>/dev/null | grep -iE "sentry|segment|amplitude|mixpanel|posthog|bugsnag|datadog" || echo "none"
```

Expected results: the only runtime host is `http://127.0.0.1:11434`
(`packages/shared/src/config.ts`); the only external URLs are the four
allowlisted targets in `apps/desktop/src/main/external.ts` plus link `href`s
on the static website.

Observe the running app:

- Run a firewall such as Little Snitch or LuLu and use ArNega normally. You
  should see loopback traffic to port 11434 and nothing else from the app
  (modulo the platform caveat above).
- `lsof -i -a -p <ArNega pid>` while answering a question shows the app's open
  sockets: loopback only.
- Watch the model side too: Ollama logs each request it serves
  (`~/.ollama/logs/`), all from 127.0.0.1.

Inspect stored data:

```sh
cat ~/Library/Application\ Support/ArNega/settings.json
```

That file, in full, is everything ArNega remembers about you.
