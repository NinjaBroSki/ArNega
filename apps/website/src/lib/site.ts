/**
 * Site-wide configuration. The repository slug is injected at build time by
 * the GitHub Pages workflow (PUBLIC_ARNEGA_REPO = owner/repo), so deployed
 * download links always point at the right place; the fallback keeps local
 * dev working.
 */
import {
  APP_VERSION,
  buildDownloadLinks,
  DEFAULT_MODEL,
  DEFAULT_REPO_SLUG,
  OLLAMA_DOWNLOAD_URL,
  stableAssetName,
  versionedAssetName,
} from '@arnega/shared';

export const REPO_SLUG: string =
  (import.meta.env?.PUBLIC_ARNEGA_REPO as string | undefined) || DEFAULT_REPO_SLUG;

export const VERSION = APP_VERSION;
export const MODEL = DEFAULT_MODEL;
export const OLLAMA_URL = OLLAMA_DOWNLOAD_URL;

export const links = buildDownloadLinks(REPO_SLUG);

export const DMG_NAME = versionedAssetName(VERSION, 'dmg');
export const DMG_STABLE_NAME = stableAssetName('dmg');

export const SITE = {
  name: 'ArNega',
  tagline: 'See it. Press Enter. Get the answer.',
  description:
    'ArNega is a free local screen assistant for macOS. It reads what is on your screen and answers using AI that runs entirely on your Mac through Ollama — no API keys, no subscriptions, no accounts.',
  keywords:
    'local screen AI, free AI screen assistant, Ollama screen assistant, local vision AI Mac, screen question answering, Cluely alternative',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** In-page anchors on the home page. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Why local', href: '#why-local' },
  { label: 'Requirements', href: '#requirements' },
  { label: 'Setup', href: '#setup' },
  { label: 'FAQ', href: '#faq' },
];

export const FOOTER_PAGES: NavItem[] = [
  { label: 'Privacy', href: 'privacy' },
  { label: 'Terms', href: 'terms' },
  { label: 'Responsible use', href: 'responsible-use' },
];

/** Join the Astro base path with a site-relative path. */
export function withBase(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return cleanBase + path.replace(/^\//, '');
}
