# macOS Distribution

How ArNega is packaged and distributed for macOS, what the current unsigned build
means for users, and the exact path to Developer ID signing and notarization later.

ArNega ships for **macOS 12+ on Apple Silicon (arm64) only**. Windows and Intel
builds are not available yet.

## Current state: unsigned (ad-hoc) build

`electron-builder` (configured in `apps/desktop/electron-builder.yml`) produces:

- `ArNega-<version>-mac-arm64.dmg`
- `ArNega-<version>-mac-arm64.zip`

both in `apps/desktop/release/`. The release workflow
(`.github/workflows/release.yml`) additionally publishes stable-named aliases
(`ArNega-mac-arm64.dmg` / `.zip`) and a `SHA256SUMS.txt` on each GitHub Release,
so the website's `/releases/latest/download/` link never changes.

### What "ad-hoc signed" means technically

There is no Developer ID certificate involved yet. CI sets
`CSC_IDENTITY_AUTO_DISCOVERY: 'false'` so electron-builder skips certificate
discovery and falls back to an **ad-hoc signature** (the `-` signing identity).

Key points:

- Apple Silicon **requires** every binary to carry *some* code signature to
  execute at all, so an unsigned-in-the-colloquial-sense app is still ad-hoc
  signed. Ad-hoc signatures carry no identity: no team, no certificate chain,
  nothing Apple can verify.
- Because there is no Developer ID identity, the build is also **not
  notarized** (`notarize: false` in `apps/desktop/electron-builder.yml`), so
  Gatekeeper treats it as coming from an unidentified developer.
- `hardenedRuntime: true` and the entitlements file
  (`apps/desktop/build/entitlements.mac.plist`) are already configured. They
  are effectively inert for an ad-hoc build but mean the switch to real signing
  is a credentials-only change (see below). The entitlements are the minimal
  set Electron needs under the hardened runtime: `allow-jit`,
  `allow-unsigned-executable-memory`, and `allow-dyld-environment-variables`.
- `gatekeeperAssess: false` only tells electron-builder not to run a local
  `spctl` assessment during packaging; it has no effect on users' machines.

You can inspect a build yourself:

```sh
codesign -dv --verbose=2 /Applications/ArNega.app   # shows "Signature=adhoc"
spctl -a -vv /Applications/ArNega.app               # shows "rejected" until approved
```

And verify a download against the release checksums:

```sh
shasum -a 256 -c SHA256SUMS.txt --ignore-missing
```

## The quarantine attribute

When you download a file with a browser, macOS attaches the
`com.apple.quarantine` extended attribute to it. The attribute propagates to
the app bundle when you open the DMG or unzip the archive. On the app's
**first launch**, Gatekeeper assesses any quarantined app: it checks for a
valid Developer ID signature and a notarization ticket. The ArNega build has
neither, so the launch is blocked with a warning.

Once you approve the app through one of the supported flows below, macOS
records the approval and does not re-assess that copy. Replacing the app with
a new version starts the process over, because each release is a different
quarantined file.

## Gatekeeper: what users see and the supported approval flow

### macOS 15 (Sequoia) and later

1. Double-click ArNega. macOS shows a dialog like *"Apple could not verify
   'ArNega' is free of malware…"* with only **Done** and **Move to Trash** —
   there is no Open button. Click **Done** (not Move to Trash).
2. Open **System Settings → Privacy & Security**, scroll to the **Security**
   section. You will see *"'ArNega' was blocked to protect your Mac."*
3. Click **Open Anyway**, authenticate, and confirm **Open** in the final
   dialog.

This is required once per downloaded copy. On macOS 15+, the old right-click
bypass no longer works for unnotarized apps — **Open Anyway** is the only
supported path.

### macOS 12–14

Either use the **Open Anyway** flow above, or:

1. In Finder, **Control-click (right-click) the app → Open**.
2. The dialog now includes an **Open** button. Click it.

### Never disable Gatekeeper or SIP

Do **not** run `spctl --master-disable`, do not disable System Integrity
Protection, and do not apply any system-wide security override to launch
ArNega. Those changes weaken protection for everything on the machine, not
just this app. The per-app approval flows above are the only supported way to
run the unsigned build. If a third-party guide tells you to strip attributes
or disable security features globally, don't follow it.

## Screen Recording permission

Screen Recording is the **only** macOS permission ArNega needs (no microphone,
camera, contacts, or location — the `NSCameraUsageDescription` /
`NSMicrophoneUsageDescription` strings in `apps/desktop/electron-builder.yml`
exist only to state explicitly that those are not used).

What to expect:

- **First use:** the first time ArNega captures the screen (both the
  `desktopCapturer` path and the `/usr/sbin/screencapture` fallback are
  governed by the same permission), macOS shows its system prompt and adds
  ArNega to the Screen Recording list. macOS typically requires the app to be
  **quit and reopened** after the toggle is enabled.
- **Where the setting lives:** System Settings → Privacy & Security →
  **Screen & System Audio Recording** (called **Screen Recording** on macOS
  12–14). ArNega checks its status via
  `systemPreferences.getMediaAccessStatus('screen')` and its in-app button
  deep-links straight to the pane
  (`x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture`).
- **Periodic re-confirmation:** starting with macOS 15, the OS may
  periodically ask you to re-confirm that ArNega can record the screen (for
  example after OS updates or on a recurring schedule). Choosing *Continue to
  Allow* keeps things working. This prompt comes from macOS, not from ArNega.
- **Unsigned-build caveat:** macOS ties privacy grants to the app's code
  signature. Ad-hoc signatures differ between builds, so after updating to a
  new ArNega version macOS may treat it as a new app and ask you to grant
  Screen Recording again. This goes away once releases are Developer ID
  signed.

## Future: Developer ID signing and notarization

The packaging config was written so that moving to a fully signed, notarized
build is a matter of supplying credentials and flipping one flag — no
restructuring.

### Prerequisites

- An Apple Developer Program membership.
- A **Developer ID Application** certificate, exported with its private key as
  a `.p12` file.
- An [app-specific password](https://support.apple.com/102654) for the Apple ID
  used for notarization.

Never commit any of these to the repository, and never fabricate or share
them; they exist only as CI secrets or local environment variables.

### Environment variables / secrets

electron-builder and `@electron/notarize` consume the standard variables:

| Variable | Purpose |
| --- | --- |
| `CSC_LINK` | The Developer ID Application `.p12` — a `file://` path or base64-encoded contents |
| `CSC_KEY_PASSWORD` | Password for the `.p12` |
| `APPLE_ID` | Apple ID used to submit the notarization request |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for that Apple ID |
| `APPLE_TEAM_ID` | 10-character Apple Developer Team ID |

### Changes in `apps/desktop/electron-builder.yml`

```yaml
mac:
  notarize: true   # currently: false
```

That's the only config change. `hardenedRuntime: true`, `entitlements`, and
`entitlementsInherit` (both pointing at `build/entitlements.mac.plist`) are
already in place — the hardened runtime is a notarization requirement, and the
entitlements listed above are exactly what Electron needs to run under it.
With the `CSC_*` variables present, electron-builder signs with the Developer
ID identity instead of ad-hoc; with `notarize: true` and the `APPLE_*`
variables present, it submits the app to Apple's notary service via
`@electron/notarize` and staples the ticket automatically.

### Changes in `.github/workflows/release.yml`

In the *"Package DMG and ZIP"* step:

1. Remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`.
2. Add the secrets to the step's `env`:

```yaml
      - name: Package DMG and ZIP (signed + notarized)
        working-directory: apps/desktop
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npx electron-builder --mac --arm64 --publish never
```

Store all five values as GitHub Actions repository secrets (for `CSC_LINK`,
base64-encode the `.p12`: `base64 -i cert.p12 | pbcopy`). Nothing else in the
workflow changes — release asset staging, stable aliases, `SHA256SUMS.txt`,
and the GitHub Release step are signing-agnostic. Expect the packaging step to
take a few minutes longer while Apple's notary service processes the upload.

### What changes for users

Once releases are signed and notarized, the entire Gatekeeper section above
stops applying: users double-click and the app opens, and Screen Recording
grants survive updates because the signing identity is stable across releases.

## Related docs

- Release process and versioning: `scripts/set-version.mjs`,
  `.github/workflows/release.yml`
- Privacy and capture behavior: see the project README
