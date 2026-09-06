# Website developer guide

The ArNega website lives in `apps/website`. It is a static Astro 5 site with two small React islands, deployed to GitHub Pages by `.github/workflows/pages.yml`. It exists to explain the product honestly and hand out the download link — nothing more.

Design constraints, in order:

- **Static output.** `astro build` emits plain HTML/CSS/JS into `apps/website/dist`. No server, no API routes at runtime.
- **System fonts only.** All type stacks come from `packages/branding/assets/tokens.css` (`--an-font-display`, `--an-font-text`, `--an-font-mono`) and resolve to fonts already on the visitor's machine. No web-font downloads.
- **No external requests.** The page loads no third-party scripts, stylesheets, fonts, images, or pixels. The only off-site traffic is user-initiated navigation: the Download button and links to GitHub and ollama.com.
- **No tracking.** See [No-tracking policy](#no-tracking-policy).

## Stack

| Piece | Choice |
| --- | --- |
| Framework | Astro 5 (`astro.config.mjs`), `@astrojs/sitemap`, `@astrojs/react` |
| Islands | React 19 — only the two demo animations hydrate (`client:load` / `client:visible`); everything else is static HTML |
| Styling | Plain CSS (`src/styles/site.css`) on top of shared design tokens from `@arnega/branding` |
| Shared logic | `@arnega/shared` — version, model name, download-URL builders |
| Tests | Vitest (`apps/website/test/`) |

## Commands

From the repo root (npm workspaces, Node >= 20):

```sh
npm run dev:website        # astro dev at http://localhost:4321
npm run build:website      # astro build -> apps/website/dist
npm run typecheck          # includes `astro check` for the website workspace
```

Inside the workspace (or with `-w @arnega/website` from the root):

```sh
npm run preview            # serve the production build locally
npm run test               # vitest run (10 tests)
```

Note: the root `npm test` runs the shared and desktop suites; website tests run via the workspace command above (CI runs them too). Asset generation is separate: `npm run gen:icons` regenerates favicons and app icons, and `node scripts/generate-og.mjs` regenerates the social image.

## File map: `apps/website/src`

```
src/
├── layouts/
│   └── Base.astro          # <head> (SEO meta, OG, favicons, JSON-LD slot),
│                           #   scroll-reveal script, reduced-motion handling
├── pages/
│   ├── index.astro         # landing page: hero, how-it-works, why-local,
│   │                       #   demo, comparison, requirements, download,
│   │                       #   setup, FAQ; injects SoftwareApplication JSON-LD
│   ├── privacy.astro       # privacy page
│   ├── terms.astro         # terms page
│   ├── responsible-use.astro
│   ├── 404.astro
│   └── robots.txt.ts       # build-time endpoint: robots.txt with absolute
│                           #   sitemap URL derived from the deployed site URL
├── components/
│   ├── Nav.astro           # sticky nav, mobile burger (aria-expanded/controls)
│   ├── Footer.astro        # footer links + version line
│   ├── Logo.astro          # inline SVG brand mark
│   └── demo/
│       ├── DemoStage.tsx   # the animated overlay demo (pure CSS/JSX, no video)
│       ├── HeroDemo.tsx    # island: looping hero scene (client:load)
│       ├── ProductDemo.tsx # island: tabbed scenes (client:visible)
│       ├── scenes.tsx      # demo scene content (screens + streamed answers)
│       └── demo.css
├── lib/
│   └── site.ts             # SITE metadata, REPO_SLUG resolution, download
│                           #   links, VERSION, nav/footer items, withBase()
└── styles/
    └── site.css            # page styles + prefers-reduced-motion overrides
```

Static assets live in `apps/website/public` (favicons, `og.png`) and are generated — do not hand-edit them; rerun the scripts instead.

## URL configuration: repo, base path, site URL

The site never hard-codes its own deployment location. Three build-time environment variables carry it, injected by `.github/workflows/pages.yml` from the repository context:

```yaml
PUBLIC_ARNEGA_REPO: ${{ github.repository }}                        # owner/repo
PUBLIC_SITE_URL: https://<owner>.github.io/<repo>
PUBLIC_BASE_PATH: /<repo>/
```

They flow into two places:

- `apps/website/astro.config.mjs` reads `PUBLIC_SITE_URL` and `PUBLIC_BASE_PATH` into Astro's `site` and `base`. Locally they default to `http://localhost:4321` and `/`, so `dev`/`preview` work at the root path with no setup.
- `apps/website/src/lib/site.ts` reads `PUBLIC_ARNEGA_REPO` into `REPO_SLUG`, falling back to `DEFAULT_REPO_SLUG` from `packages/shared/src/config.ts` (currently `gollapally/ArNega`). The fallback exists only so local previews render working links; deployed builds always use the injected slug, so a fork's Pages deployment automatically points at the fork's own releases.

Everything else derives from those values:

- **Download links** come from `buildDownloadLinks(REPO_SLUG)` in `packages/shared/src/download.ts`. The primary CTA uses the stable alias `https://github.com/<owner>/<repo>/releases/latest/download/ArNega-mac-arm64.dmg`, which GitHub resolves to the newest release — the button never needs editing per release. Checksums (`SHA256SUMS.txt`), releases, and source links are built the same way.
- **Internal URLs** go through `withBase()` in `src/lib/site.ts`, which joins Astro's `BASE_URL` with a site-relative path. Any new link to a page or `public/` asset must use it, or it will break under the `/<repo>/` base path on GitHub Pages.
- **Canonical URLs, OG URLs, sitemap, and robots.txt** all resolve against `Astro.site`, so they are correct for whatever host the build targets.

`pages.yml` runs on pushes to `main` that touch `apps/website/**`, `packages/**`, or the workflow itself, builds with `npm ci && npm run build -w @arnega/website`, and deploys `apps/website/dist` via `actions/deploy-pages`.

## Version display

There is one version source: `APP_VERSION` in `packages/shared/src/version.ts` (kept in sync with the package.json files by `scripts/set-version.mjs`). The website imports it at build time as `VERSION` in `src/lib/site.ts` and renders it in three places:

- the download panel chip on the home page (`v0.1.0 · latest release`),
- the footer meta line (`v0.1.0 · macOS Apple Silicon`),
- the `softwareVersion` field of the home page's JSON-LD.

Because the site is static, the displayed version is baked in at build time. A release's version-bump commit touches `packages/shared`, which matches the `packages/**` path filter in `pages.yml`, so pushing it to `main` redeploys the site with the new number automatically.

## SEO inventory

All of it lives in `src/layouts/Base.astro` unless noted:

- **Meta**: per-page `<title>` and `description` (props with sensible defaults from `SITE` in `src/lib/site.ts`), `keywords`, `canonical` link, `theme-color`, `color-scheme: dark`.
- **Open Graph / Twitter**: `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (1200x630 with width/height/alt), `twitter:card summary_large_image` plus title/description/image.
- **OG image**: `apps/website/public/og.png`, generated by `scripts/generate-og.mjs` — an inline SVG (system-safe font stack, no external assets) rasterized with sharp. Rerun the script after brand or tagline changes; it also writes the `og-source.svg` intermediate.
- **Favicons**: `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png` in `public/`, generated by `scripts/generate-icons.mjs` (`npm run gen:icons`).
- **Sitemap**: `@astrojs/sitemap` emits `sitemap-index.xml`; `Base.astro` advertises it with a `<link rel="sitemap">`.
- **robots.txt**: `src/pages/robots.txt.ts` is a build-time endpoint that allows all agents and points at the absolute sitemap URL for the deployed site.
- **JSON-LD**: `index.astro` passes a `SoftwareApplication` object (OS, category, version, download URL, price 0/USD) into `Base.astro`, which serializes it into a `<script type="application/ld+json">`.

## Accessibility and motion

- Semantic landmarks throughout: `nav` (with `aria-label="Main"`), `main`, `footer`, one `h1` per page, ordered headings.
- Icon-only links carry `aria-label`s; decorative SVGs are `aria-hidden="true"`.
- The mobile menu button manages `aria-expanded` and `aria-controls`; the tabbed demo uses `role="tablist"`/`role="tab"` with `aria-selected`; the FAQ uses native `<details>`/`<summary>`, so it is keyboard-operable for free. Interactive elements have `:focus-visible` styles.
- **Reduced motion** is handled at three layers:
  1. `site.css` — under `@media (prefers-reduced-motion: reduce)`, scroll-reveal elements render fully visible, `scroll-behavior` falls back to `auto`, and all animations/transitions are collapsed to effectively zero duration.
  2. `Base.astro`'s inline script checks the media query before wiring the `IntersectionObserver` scroll-reveal and, when reduction is requested, marks everything revealed immediately.
  3. `DemoStage.tsx` checks the same query and, when set, skips the animation entirely and renders the finished answer statically. It also animates only while visible in the viewport.
- The demo is pure CSS/JSX — no video, no GIFs, no external assets — so it stays crisp, lightweight, and translatable.

## No-tracking policy

The website has no analytics, no cookies, no tracking pixels, no fingerprinting, and no third-party embeds of any kind. The only client-side scripts are the two React islands and two small inline scripts (scroll reveal and the mobile menu), all cosmetic and all served from the site's own origin. Nothing on the page phones home; requests to GitHub or ollama.com happen only when a visitor clicks a link. Keep it that way: any PR that adds an external request or an analytics snippet to `apps/website` should be rejected. `test/site.test.ts` also guards the copy against unsupported claims (no "Windows", no "undetectable").

## Adding a custom domain later

The architecture already supports it — the change is configuration only:

1. Add a `CNAME` file containing the domain (e.g. `arnega.example.com`) to `apps/website/public/` so it is copied into every build, and configure the domain in the repository's GitHub Pages settings plus your DNS.
2. In `.github/workflows/pages.yml`, set:
   ```yaml
   PUBLIC_SITE_URL: https://arnega.example.com
   PUBLIC_BASE_PATH: /
   ```

Canonical URLs, OG URLs, the sitemap, robots.txt, and every internal `withBase()` link all derive from those two variables, so no source changes are needed. `PUBLIC_ARNEGA_REPO` stays as is — download links point at GitHub Releases regardless of where the site is hosted.

## Tests

`apps/website/test/` holds 10 Vitest tests:

- `site.test.ts` — the repo slug is well-formed; the primary CTA is the stable `releases/latest/download` alias; the versioned DMG name matches the release workflow's naming; checksums/releases/source links are correct; site copy makes no unsupported platform claims; nav anchors are unique and well-formed; footer pages map to real routes; `withBase()` joins paths correctly.
- `scenes.test.ts` — demo scenes are unique and complete, and every scene's answer emphasizes its key finding.

Run them with `npm run test -w @arnega/website`. `astro check` (via the root `npm run typecheck`) type-checks the `.astro` and `.tsx` sources.
