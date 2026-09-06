/**
 * Single source of truth for the ArNega application version.
 *
 * `scripts/set-version.mjs <version>` updates this constant together with the
 * package.json files across the monorepo so releases stay consistent.
 */
export const APP_VERSION = '0.1.1';

/** Human-facing product name. */
export const APP_NAME = 'ArNega';

/** Reverse-DNS application identifier used by Electron / electron-builder. */
export const APP_ID = 'com.arnega.app';
