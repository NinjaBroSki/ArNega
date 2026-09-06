# Releasing ArNega

This is the step-by-step runbook for cutting an ArNega release. The short version:

```
node scripts/set-version.mjs X.Y.Z
npm install
git commit -am "release: vX.Y.Z"
git tag vX.Y.Z
git push origin main vX.Y.Z
```

Pushing the tag triggers `.github/workflows/release.yml`, which tests, builds the macOS Apple Silicon app on a GitHub runner, and publishes a GitHub Release with stable download names the website links to. Everything below explains each step, what the workflow does, and how to verify and recover.

## Prerequisites

- Push access to the repository, including permission to push tags. The workflow itself needs no secrets — the public build is unsigned, so there are no signing credentials to configure.
- A clean working tree on `main` with `npm run check` (typecheck + lint + unit tests) passing locally.
- Node.js >= 20 locally (`engines` in the root `package.json`; CI uses Node 24).
- Optionally, an Apple Silicon Mac for a local packaging dry run (see [Local packaging](#local-packaging-for-testing)).

Releases target macOS on Apple Silicon only. Do not tag a release expecting Windows or Intel artifacts — the workflow builds `--mac --arm64` and nothing else.

## 1. Bump the version

There is a single runtime source of truth for the version, `APP_VERSION` in `packages/shared/src/version.ts`, plus the `version` fields of five `package.json` files. Never edit them by hand; sync them all with one command:

```
node scripts/set-version.mjs 0.2.0
```

The script:

- validates the argument as semver (`X.Y.Z`, optionally with a suffix like `-rc.1` — but see the prerelease caution below);
- rewrites `APP_VERSION` in `packages/shared/src/version.ts`;
- sets `version` in the root `package.json`, `apps/desktop/package.json`, `apps/website/package.json`, `packages/shared/package.json`, and `packages/branding/package.json`.

Then run:

```
npm install
```

This is not optional: `package-lock.json` records the workspace versions, and the release workflow runs `npm ci`, which fails when `package.json` and the lockfile disagree. Commit the lockfile change along with the version bump.

**Prerelease caution:** `set-version.mjs` accepts suffixed versions, and a tag like `v0.2.0-rc.1` matches the workflow's `v*.*.*` trigger — but the workflow publishes every tag as a full release, which immediately becomes `latest` and gets served to every visitor of the website's Download button. Until the workflow marks suffixed versions as prereleases, only tag plain `X.Y.Z` versions.

## 2. Commit, tag, push

```
git add -A
git commit -m "release: v0.2.0"
git tag v0.2.0
git push origin main
git push origin v0.2.0
```

Push the branch before (or together with) the tag so the tagged commit exists on `main`. The tag must be exactly `v` + the version you set — the workflow verifies this and fails the build on a mismatch.

## 3. What the release workflow does

`.github/workflows/release.yml` triggers on any pushed tag matching `v*.*.*` and runs with `contents: write` (needed to create the release). It has two jobs.

### Job 1: `test` (ubuntu-latest)

Checkout, Node 24 with npm cache, `npm ci`, then:

1. `npm run typecheck` — all four workspaces
2. `npm run lint`
3. `npm run test` — shared and desktop unit test suites

If any of these fail, the build job never starts and no release is created. The live Ollama integration suite is not part of CI — run it manually on a dev machine when it matters (`npx vitest run -c vitest.integration.config.ts` in `apps/desktop`).

### Job 2: `build-and-release` (macos-14, needs `test`)

`macos-14` and later standard GitHub runners are Apple Silicon machines, so no paid or self-hosted runners are needed for an arm64 build.

**Tag/version guard.** The job strips the leading `v` from the tag and compares it to `version` in `apps/desktop/package.json`. On mismatch it fails with instructions to run `scripts/set-version.mjs` and re-tag. This is the backstop that prevents shipping a DMG whose embedded version disagrees with its tag.

**Build.** `npm run build -w @arnega/desktop` runs the electron-vite production build.

**Packaging.** In `apps/desktop`, `npx electron-builder --mac --arm64 --publish never` produces the DMG and ZIP in `apps/desktop/release/`. The step sets `CSC_IDENTITY_AUTO_DISCOVERY=false` so electron-builder does not look for signing certificates on the runner and instead produces the documented unsigned build (ad-hoc signature — required for arm64 binaries to run at all). Artifact naming comes from `artifactName` in `apps/desktop/electron-builder.yml`: `ArNega-<version>-mac-arm64.dmg` and `.zip`.

**Staging and stable aliases.** The versioned DMG and ZIP are copied into `dist-release/`, then copied again under stable names:

- `ArNega-mac-arm64.dmg`
- `ArNega-mac-arm64.zip`

These aliases exist so the website's permanent download link keeps working release after release (next section).

**Checksums.** `shasum -a 256 * > SHA256SUMS.txt` inside `dist-release/` covers all four binaries — versioned and stable names — and the file is printed into the job log, so the log itself is a record of the published checksums.

**Release creation.** `softprops/action-gh-release@v2` creates a GitHub Release named `ArNega vX.Y.Z` with `generate_release_notes: true` (auto-generated changelog from merged PRs/commits) appended to a fixed body that names the DMG to download, explains the Gatekeeper "Open Anyway" step for the unnotarized build, and lists requirements (macOS 12+ on Apple Silicon, Ollama, the ~6 GB one-time model pull). All five files in `dist-release/` are attached as release assets.

## How the website download links resolve

GitHub redirects

```
https://github.com/<owner>/<repo>/releases/latest/download/<asset-name>
```

to the asset with that exact filename on the newest non-draft, non-prerelease release. The website's Download button points at `/releases/latest/download/ArNega-mac-arm64.dmg` — the stable alias — so the site never needs editing when a new version ships.

This only works because the asset filename is identical in every release. Consequences:

- **Never rename the stable aliases** in the "Stage release assets" step of `release.yml`. A renamed asset breaks the live Download button for every visitor until the site is rebuilt.
- **Never change `artifactName`** in `apps/desktop/electron-builder.yml` without updating the `cp` lines in `release.yml` that reference the versioned filenames — the staging step fails (which is the good outcome) or silently ships wrong names (which is not).
- The versioned filenames still exist on every release for anyone who wants a specific version or wants to verify against `SHA256SUMS.txt` by exact name.

## Verifying a release

After the workflow goes green:

1. **Assets.** The release page should list exactly five files: the versioned DMG and ZIP, the two stable aliases, and `SHA256SUMS.txt`.
2. **Stable link.** Confirm the permanent URL redirects to the new version:

   ```
   curl -sIL https://github.com/<owner>/<repo>/releases/latest/download/ArNega-mac-arm64.dmg | grep -i location
   ```

3. **Checksums.** Download the DMG and the checksum file, then:

   ```
   shasum -a 256 -c <(grep ArNega-mac-arm64.dmg SHA256SUMS.txt)
   ```

   The stable alias and the versioned DMG should have identical hashes (they are byte-for-byte copies).
4. **Install test.** On an Apple Silicon Mac: mount the DMG, drag ArNega to Applications, launch. macOS will likely block the first launch of the unnotarized build — approve it via System Settings → Privacy & Security → "Open Anyway" (never disable Gatekeeper). Grant Screen Recording permission when prompted, make sure Ollama is running, and confirm the core flow: overlay appears, Enter captures and streams an answer.
5. **Website.** No action needed — the Download button resolves to the new release automatically.

## Hotfix and re-release guidance

**Prefer a new patch version.** If something is wrong with `v0.2.0`, fix it and ship `v0.2.1` with the normal flow. Versions are cheap; ambiguity about what bits a version number refers to is not.

**Re-releasing the same version** is acceptable only when the broken release was never announced and (as far as you can tell) never downloaded. If you must:

1. Delete the GitHub Release first (release page → Delete). Deleting the tag does *not* delete the release, and an orphaned release would keep serving the old assets.
2. Delete the tag: `git push origin --delete vX.Y.Z` and `git tag -d vX.Y.Z` locally.
3. Fix, re-tag, and push the tag again to re-run the workflow.

Cautions:

- Between deleting the release and the new one publishing, `/releases/latest/download/...` falls back to the *previous* release — the website briefly serves the older version. That is degraded but safe; a deleted-and-not-yet-replaced release is why you delete only after the fix is ready to push.
- Anyone who fetched the old tag keeps it locally; a moved tag makes their clone silently disagree with the repository. This is the main reason moved tags are reserved for never-distributed releases.
- Never publish different bits under a version number that has already been downloaded — the old and new files share a filename but have different checksums, which is indistinguishable from tampering to anyone verifying against a saved `SHA256SUMS.txt`.

## Local packaging for testing

To produce the same DMG and ZIP locally (Apple Silicon Mac required):

```
npm run dist:desktop
```

This runs `electron-vite build && electron-builder --mac --arm64` in the desktop workspace and writes `ArNega-<version>-mac-arm64.dmg` and `.zip` to `apps/desktop/release/`. Without signing certificates configured, the output is ad-hoc signed — the same as the CI build. For a faster inner loop, build an unpacked app directory instead:

```
npm run dist:dir -w @arnega/desktop
```

Use local packaging to test the installer experience before tagging. The assets that ship are always the CI-built ones: the runner is a known, clean environment, and the checksums in the job log document exactly what was published.

## Future: signed builds

The pipeline is ready for Developer ID signing without structural changes: provide `CSC_LINK` / `CSC_KEY_PASSWORD` as repository secrets and remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the packaging step (`hardenedRuntime` and the entitlements file in `apps/desktop/build/` are already configured). Notarization is a separate follow-up: enable `notarize` in `electron-builder.yml` with `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` secrets. See `docs/MACOS-DISTRIBUTION.md` for the distribution details.
