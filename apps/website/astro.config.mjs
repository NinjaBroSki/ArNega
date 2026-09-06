// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

/**
 * Deployment configuration.
 *
 * In CI (GitHub Pages workflow) these are injected automatically from the
 * repository context, so the deployed site always has the right URLs:
 *   PUBLIC_ARNEGA_REPO = owner/repo        (e.g. "octocat/ArNega")
 *   PUBLIC_SITE_URL    = https://octocat.github.io/ArNega
 *   PUBLIC_BASE_PATH   = /ArNega/
 *
 * Locally, defaults keep `npm run dev`/`preview` working at the root path.
 * A future custom domain only needs PUBLIC_SITE_URL + PUBLIC_BASE_PATH=/
 * (plus a CNAME file) — no architecture changes.
 */
const site = process.env.PUBLIC_SITE_URL ?? 'http://localhost:4321';
const base = process.env.PUBLIC_BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  integrations: [react(), sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
