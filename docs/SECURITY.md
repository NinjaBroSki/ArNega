# Security

ArNega is a fully local macOS app: screenshots go to an Ollama server on `127.0.0.1:11434` and nowhere else. There are no accounts, no cloud services, no API keys, no telemetry, and no auto-update pings. That keeps the attack surface small, and the app is built to keep it that way.

To report a vulnerability, see [Reporting a vulnerability](#reporting-a-vulnerability). There is no security email address; use GitHub.

## Electron hardening, as implemented

Every item below is in the shipped code, not aspirational. File references are repo-relative.

| Control | Implementation |
| --- | --- |
| `contextIsolation: true` | Both windows (overlay and settings), `apps/desktop/src/main/windows.ts` |
| `sandbox: true` | Both windows |
| `nodeIntegration: false` | Both windows |
| DevTools disabled in production | `devTools` is enabled only when the dev server env var is present |
| Minimal typed preload | `apps/desktop/src/preload/index.ts` exposes exactly one object, `window.arnega` (the `ArnegaApi` type). No raw `ipcRenderer`, no Node globals, no dynamic channel names — every channel string is a constant from `packages/shared/src/ipc.ts`. |
| IPC sender validation | Every `ipcMain.handle` registration in `apps/desktop/src/main/ipc.ts` goes through a wrapper that checks `event.senderFrame.url` — it must be the dev-server URL (dev) or a `file://` URL (production) or the call is rejected. |
| Settings payload allowlist | `arnega:update-settings` copies only eight allowlisted keys out of the payload; everything else is dropped. Values are then normalized and clamped by the shared settings normalizer (e.g. `numCtx` clamped to 2048–32768). |
| External links by symbolic name only | The renderer can never pass a URL. It names one of four symbolic targets (`ollama-download`, `model-info`, `repo`, `releases`) and `apps/desktop/src/main/external.ts` maps that to a fixed URL; unknown targets are refused and logged. |
| `window.open` denied | `setWindowOpenHandler(() => ({ action: 'deny' }))` on every window |
| `will-navigate` guard | Any navigation off the bundled `file://` renderer (or the dev-server origin in dev) is prevented and logged |
| Permission requests denied | `setPermissionRequestHandler` always answers `false` — the renderer can never obtain camera, microphone, geolocation, or any other Chromium runtime permission |
| CSP meta tag | `apps/desktop/src/renderer/index.html` ships `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:* http://localhost:*`. Scripts are strictly local; the `localhost` connect allowance exists for the dev server, and the renderer code makes no network requests in production (all Ollama traffic originates in the main process). |
| Inert markdown links | Links in model answers render with no `href` and `pointer-events: none`. Model output is untrusted text and can never trigger navigation or a click-through. |

Related, though it is input handling rather than Chromium hardening: Enter is an ordinary key handler that fires only while the ArNega overlay window is focused. There is no global Enter hook and no keystroke capture outside the app's own windows. The only global shortcut (default `Cmd+Shift+Space`, configurable) toggles overlay visibility.

## Threat model

The renderer loads only the bundled local files — no remote content, ever — so compromising it requires either a malicious build or an attacker who can already modify files on the machine. Still, the design assumes the renderer could be hostile and limits what that buys an attacker.

**A fully compromised renderer could:**

- Trigger a capture-and-solve cycle and read the streamed answer text.
- Change the eight allowlisted settings (model name, answer style, screenshot quality, global shortcut, launch-at-login, `numCtx`, `keepAlive`, cursor capture) within their normalized ranges.
- Open the four allowlisted URLs in the default browser.
- Write up to 2 MB of text to the clipboard.
- Show, hide, and resize the app's own windows; delete the app's settings file.
- Start or cancel a pull of the fixed default model.
- Reach HTTP services listening on `localhost` (the CSP permits `http://localhost:*`), including a local Ollama.

**A compromised renderer could not:**

- Read or write arbitrary files, or execute anything — no Node, no Electron internals (sandbox + context isolation + no node integration).
- Access raw screenshot bytes. Capture, downscaling, and the Ollama request all happen in the main process; only answer tokens and status events cross the IPC boundary to the renderer.
- Open arbitrary URLs or windows, navigate the app to remote content, or load remote scripts.
- Obtain any Chromium runtime permission (camera, microphone, geolocation, notifications, …).
- Exfiltrate to a remote host from the page — `connect-src` allows only `'self'` and localhost.

The main process treats Ollama responses as untrusted data: the stream is parsed as NDJSON, the thinking channel is parsed but never displayed, and answer text renders as markdown with inert links.

## IPC surface

The complete renderer-reachable surface, defined in `packages/shared/src/ipc.ts` and handled in `apps/desktop/src/main/ipc.ts`. Every invoke channel enforces the sender check described above before its handler runs.

| Channel | Purpose | Payload validation |
| --- | --- | --- |
| `arnega:solve` | Capture the screen and stream an answer | No payload |
| `arnega:cancel` | Abort the in-flight generation | No payload |
| `arnega:get-status` | Read setup state, settings, permission state, models | No payload |
| `arnega:refresh-status` | Re-probe Ollama, then return status | No payload |
| `arnega:update-settings` | Change user settings | Object filtered to an allowlist of 8 keys; values normalized/clamped; a failed shortcut registration is reverted |
| `arnega:pull-default-model` | Download the fixed default model via Ollama | No payload — the model name is not renderer-controlled |
| `arnega:cancel-pull` | Cancel that download | No payload |
| `arnega:open-external` | Open an allowlisted page in the browser | Must be one of 4 symbolic targets; unknown values refused |
| `arnega:open-screen-permission` | Open macOS Screen Recording settings | No payload — fixed `x-apple.systempreferences:` URL |
| `arnega:hide-window` | Hide the overlay | No payload |
| `arnega:open-settings-window` | Open the settings window | No payload |
| `arnega:close-settings-window` | Close the settings window | No payload |
| `arnega:resize-overlay` | Grow/shrink the overlay with content | Must be a finite number; height clamped to min/max bounds against the current display |
| `arnega:reset-window-position` | Re-center the overlay | No payload |
| `arnega:clear-local-state` | Delete `settings.json`, reset shortcut, disable launch-at-login | No payload |
| `arnega:copy-text` | Copy the answer to the clipboard | Must be a string ≤ 2,000,000 characters |

Main-to-renderer events (`arnega:gen-event`, `arnega:setup-status`, `arnega:settings-changed`, `arnega:window-shown`) are one-way notifications carrying typed payloads; the preload exposes them only as subscribe functions.

## Supply chain

- **No runtime CDN dependencies.** The renderer is fully bundled; nothing is fetched from the network at runtime except the local Ollama API.
- **Install-script trust is limited to the toolchain.** The only dependencies expected to run install scripts are the Electron, esbuild, and sharp toolchain (app binary, bundler, icon generation). Nothing else in the tree needs postinstall trust.
- **No auto-updater.** The app never phones home to check for updates. New versions are a manual download from GitHub Releases.
- **Release verification.** Each release publishes `SHA256SUMS.txt` alongside the `.dmg`/`.zip`; verify downloads against it. Current builds are ad-hoc signed (no Developer ID yet), so Gatekeeper will warn — the supported path is System Settings → Privacy & Security → "Open Anyway". Never disable Gatekeeper or SIP to run ArNega.

## Reporting a vulnerability

Use GitHub — there is no security email address:

- **Preferred, for anything exploitable:** open a private report via the repository's **Security → Advisories → "Report a vulnerability"** (GitHub private vulnerability reporting), so details stay private until a fix ships.
- **For non-sensitive hardening suggestions:** open a regular GitHub issue.

Please include the app version, macOS version, and reproduction steps. This is a small project without a formal SLA, but security reports are taken seriously and handled first.

## Non-goals

Honest limits — things this design does not and cannot defend against:

- **A malicious local admin, root, or malware already on the machine.** Anything running with your privileges can read the screen, read `~/Library/Application Support/ArNega/settings.json`, tamper with the app bundle, or replace the local Ollama install. ArNega does not attempt to defend against a compromised host.
- **Capture privacy is best-effort only.** The overlay enables `setContentProtection(true)`, hides itself before every capture, skips the taskbar and Mission Control — but macOS capture behavior varies across APIs, apps, and OS versions. ArNega never claims to be invisible in screen shares or recordings; do not rely on it being so.
- **A tampered local Ollama.** ArNega trusts that `127.0.0.1:11434` is the Ollama server the user installed. Its responses are handled as untrusted data, but the server itself runs outside ArNega's control.

Settings are the only data ArNega persists (`settings.json`, written atomically, self-healing if corrupt). Screenshots are held in memory — or, on the fallback `screencapture` path, in a random temp file deleted in a `finally` block — and are never written to durable storage.
