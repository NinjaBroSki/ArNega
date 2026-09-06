import { describe, expect, it } from 'vitest';
import {
  buildDownloadLinks,
  checksumsUrl,
  latestDownloadUrl,
  latestReleaseUrl,
  releasesUrl,
  releaseTagUrl,
  repoUrl,
  stableAssetName,
  taggedDownloadUrl,
  toTag,
  versionedAssetName,
} from '../src/download.js';

const SLUG = 'octocat/ArNega';

describe('artifact names', () => {
  it('builds versioned artifact names', () => {
    expect(versionedAssetName('0.1.0', 'dmg')).toBe('ArNega-0.1.0-mac-arm64.dmg');
    expect(versionedAssetName('v0.1.0', 'zip')).toBe('ArNega-0.1.0-mac-arm64.zip');
  });
  it('builds stable alias names without a version', () => {
    expect(stableAssetName('dmg')).toBe('ArNega-mac-arm64.dmg');
    expect(stableAssetName('zip')).toBe('ArNega-mac-arm64.zip');
  });
});

describe('toTag', () => {
  it('prefixes v when missing and preserves existing v', () => {
    expect(toTag('0.1.0')).toBe('v0.1.0');
    expect(toTag('v0.1.0')).toBe('v0.1.0');
  });
});

describe('URL builders', () => {
  it('builds repo / releases URLs', () => {
    expect(repoUrl(SLUG)).toBe('https://github.com/octocat/ArNega');
    expect(releasesUrl(SLUG)).toBe('https://github.com/octocat/ArNega/releases');
    expect(latestReleaseUrl(SLUG)).toBe('https://github.com/octocat/ArNega/releases/latest');
    expect(releaseTagUrl(SLUG, '0.1.0')).toBe(
      'https://github.com/octocat/ArNega/releases/tag/v0.1.0',
    );
  });

  it('builds the stable latest-download URL used by the website CTA', () => {
    expect(latestDownloadUrl(SLUG, stableAssetName('dmg'))).toBe(
      'https://github.com/octocat/ArNega/releases/latest/download/ArNega-mac-arm64.dmg',
    );
  });

  it('builds tagged download URLs', () => {
    expect(taggedDownloadUrl(SLUG, '0.1.0', versionedAssetName('0.1.0', 'dmg'))).toBe(
      'https://github.com/octocat/ArNega/releases/download/v0.1.0/ArNega-0.1.0-mac-arm64.dmg',
    );
  });

  it('builds the checksums URL', () => {
    expect(checksumsUrl(SLUG)).toBe(
      'https://github.com/octocat/ArNega/releases/latest/download/SHA256SUMS.txt',
    );
  });

  it('rejects malformed slugs', () => {
    expect(() => repoUrl('not-a-slug')).toThrow();
    expect(() => repoUrl('a/b/c')).toThrow();
    expect(() => repoUrl('a b/c')).toThrow();
  });
});

describe('buildDownloadLinks', () => {
  it('bundles all links consistently', () => {
    const links = buildDownloadLinks(SLUG);
    expect(links.primaryDmg).toContain('/releases/latest/download/ArNega-mac-arm64.dmg');
    expect(links.zip).toContain('/releases/latest/download/ArNega-mac-arm64.zip');
    expect(links.checksums).toContain('SHA256SUMS.txt');
    expect(links.source).toBe('https://github.com/octocat/ArNega');
  });
});
