#!/usr/bin/env node
/**
 * Set the ArNega version everywhere it matters, from one command:
 *
 *   node scripts/set-version.mjs 0.2.0
 *
 * Updates: packages/shared/src/version.ts (the runtime source of truth) and
 * the version fields of the root + workspace package.json files.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error('Usage: node scripts/set-version.mjs <semver>   e.g. 0.2.0');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// 1. shared version constant
const versionTs = join(root, 'packages/shared/src/version.ts');
const tsSource = readFileSync(versionTs, 'utf8');
const nextTs = tsSource.replace(/APP_VERSION = '[^']+'/, `APP_VERSION = '${version}'`);
writeFileSync(versionTs, nextTs);
console.log(`  ✓ ${versionTs.replace(root + '/', '')}`);

// 2. package.json files
const packages = [
  'package.json',
  'apps/desktop/package.json',
  'apps/website/package.json',
  'packages/shared/package.json',
  'packages/branding/package.json',
];
for (const rel of packages) {
  const path = join(root, rel);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ✓ ${rel}`);
}

console.log(`\nVersion set to ${version}. Tag with: git tag v${version}`);
