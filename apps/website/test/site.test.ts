import { describe, expect, it } from 'vitest';
import {
  DMG_NAME,
  DMG_STABLE_NAME,
  FOOTER_PAGES,
  links,
  NAV_ITEMS,
  REPO_SLUG,
  SITE,
  VERSION,
  withBase,
} from '../src/lib/site';

describe('site config', () => {
  it('has a valid repo slug', () => {
    expect(REPO_SLUG).toMatch(/^[^/\s]+\/[^/\s]+$/);
  });

  it('produces a stable latest-download URL for the primary CTA', () => {
    expect(links.primaryDmg).toBe(
      `https://github.com/${REPO_SLUG}/releases/latest/download/${DMG_STABLE_NAME}`,
    );
  });

  it('names the versioned DMG consistently with the release workflow', () => {
    expect(DMG_NAME).toBe(`ArNega-${VERSION}-mac-arm64.dmg`);
  });

  it('links checksums, releases, and source on github', () => {
    expect(links.checksums).toContain('SHA256SUMS.txt');
    expect(links.releases).toBe(`https://github.com/${REPO_SLUG}/releases`);
    expect(links.source).toBe(`https://github.com/${REPO_SLUG}`);
  });

  it('describes the site honestly (no unsupported platform claims)', () => {
    const text = `${SITE.description} ${SITE.tagline}`.toLowerCase();
    expect(text).not.toContain('windows');
    expect(text).not.toContain('undetectable');
  });
});

describe('navigation', () => {
  it('has unique, well-formed anchor items', () => {
    const hrefs = NAV_ITEMS.map((n) => n.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href).toMatch(/^#[a-z-]+$/);
  });

  it('footer pages point at real routes', () => {
    expect(FOOTER_PAGES.map((p) => p.href)).toEqual(['privacy', 'terms', 'responsible-use']);
  });
});

describe('withBase', () => {
  it('joins paths against the configured base', () => {
    expect(withBase('privacy')).toBe('/privacy');
    expect(withBase('/privacy')).toBe('/privacy');
    expect(withBase('')).toBe('/');
  });
});
