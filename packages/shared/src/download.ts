/**
 * Pure helpers for building GitHub release / download URLs and artifact names.
 *
 * These are intentionally free of any environment access so they can be unit
 * tested and reused by both the website (which resolves the repo slug from
 * build-time env) and the release tooling.
 */

export type Arch = 'arm64';
export type MacArtifactKind = 'dmg' | 'zip';

/** `owner/repo`, e.g. "NinjaBroSki/ArNega". */
export type RepoSlug = string;

const GITHUB = 'https://github.com';

function assertSlug(slug: RepoSlug): void {
  if (!/^[^/\s]+\/[^/\s]+$/.test(slug)) {
    throw new Error(`Invalid repo slug: "${slug}" (expected "owner/repo")`);
  }
}

/** Normalize a version to a `v`-prefixed tag (accepts "0.1.0" or "v0.1.0"). */
export function toTag(version: string): string {
  return version.startsWith('v') ? version : `v${version}`;
}

export function repoUrl(slug: RepoSlug): string {
  assertSlug(slug);
  return `${GITHUB}/${slug}`;
}

export function releasesUrl(slug: RepoSlug): string {
  return `${repoUrl(slug)}/releases`;
}

export function latestReleaseUrl(slug: RepoSlug): string {
  return `${repoUrl(slug)}/releases/latest`;
}

export function releaseTagUrl(slug: RepoSlug, version: string): string {
  return `${repoUrl(slug)}/releases/tag/${toTag(version)}`;
}

/**
 * Stable "latest" download URL. GitHub resolves `/releases/latest/download/NAME`
 * to the newest release's asset with that exact NAME, so the website's primary
 * Download button uses the un-versioned alias names below and never needs
 * editing per release.
 */
export function latestDownloadUrl(slug: RepoSlug, assetName: string): string {
  return `${repoUrl(slug)}/releases/latest/download/${assetName}`;
}

/** Download URL for a specific tagged release asset. */
export function taggedDownloadUrl(slug: RepoSlug, version: string, assetName: string): string {
  return `${repoUrl(slug)}/releases/download/${toTag(version)}/${assetName}`;
}

// --- Artifact naming -------------------------------------------------------

/** Versioned artifact name, e.g. "ArNega-0.1.0-mac-arm64.dmg". */
export function versionedAssetName(version: string, kind: MacArtifactKind, arch: Arch = 'arm64'): string {
  const v = version.startsWith('v') ? version.slice(1) : version;
  return `ArNega-${v}-mac-${arch}.${kind}`;
}

/**
 * Stable alias name (no version), used for the permanent "latest" download link.
 * The release workflow uploads a copy of the versioned artifact under this name.
 */
export function stableAssetName(kind: MacArtifactKind, arch: Arch = 'arm64'): string {
  return `ArNega-mac-${arch}.${kind}`;
}

/** Name of the checksums file uploaded with every release. */
export const CHECKSUMS_FILE = 'SHA256SUMS.txt';

export function checksumsUrl(slug: RepoSlug): string {
  return latestDownloadUrl(slug, CHECKSUMS_FILE);
}

/** Convenience bundle the website uses for its download section. */
export interface DownloadLinks {
  primaryDmg: string;
  zip: string;
  checksums: string;
  releases: string;
  latestRelease: string;
  source: string;
}

export function buildDownloadLinks(slug: RepoSlug): DownloadLinks {
  return {
    primaryDmg: latestDownloadUrl(slug, stableAssetName('dmg')),
    zip: latestDownloadUrl(slug, stableAssetName('zip')),
    checksums: checksumsUrl(slug),
    releases: releasesUrl(slug),
    latestRelease: latestReleaseUrl(slug),
    source: repoUrl(slug),
  };
}
