#!/usr/bin/env node
/**
 * First-time developer setup: validates prerequisites, installs workspace
 * dependencies, and reports the state of the local AI stack.
 *
 *   npm run setup
 *
 * This never downloads the multi-GB AI model on its own — model download is
 * always user-approved, either in the app or manually via `ollama pull`.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const REQUIRED_NODE_MAJOR = 20;
const DEFAULT_MODEL = 'qwen3-vl:8b-instruct';
const OLLAMA_URL = 'http://127.0.0.1:11434';

const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ! ${msg}`);
const fail = (msg) => console.log(`  ✗ ${msg}`);

console.log('\nArNega development setup\n========================\n');

// 1. Node version -----------------------------------------------------------
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor >= REQUIRED_NODE_MAJOR) {
  ok(`Node ${process.versions.node}`);
} else {
  fail(`Node ${process.versions.node} — ArNega needs Node ${REQUIRED_NODE_MAJOR}+.`);
  console.log('    Install the current LTS from https://nodejs.org and re-run.');
  process.exit(1);
}

// 2. Dependencies -----------------------------------------------------------
console.log('\nInstalling workspace dependencies…');
const install = spawnSync('npm', ['install'], { stdio: 'inherit' });
if (install.status !== 0) {
  fail('npm install failed — see the output above.');
  process.exit(1);
}
ok('Dependencies installed');

// 3. Ollama -----------------------------------------------------------------
console.log('\nLocal AI stack:');
const ollamaCandidates = ['/usr/local/bin/ollama', '/opt/homebrew/bin/ollama'];
const hasBinary =
  ollamaCandidates.some((p) => existsSync(p)) ||
  spawnSync('which', ['ollama']).status === 0;

if (hasBinary) {
  try {
    const version = execSync('ollama --version', { encoding: 'utf8' }).trim();
    ok(version);
  } catch {
    ok('ollama binary found');
  }
} else {
  warn('Ollama is not installed. Get it from https://ollama.com/download');
}

let reachable = false;
try {
  const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
  reachable = res.ok;
  if (reachable) {
    ok(`Ollama server responding at ${OLLAMA_URL}`);
    const data = await res.json();
    const models = (data.models ?? []).map((m) => m.name);
    if (models.includes(DEFAULT_MODEL)) {
      ok(`Default model installed: ${DEFAULT_MODEL}`);
    } else {
      warn(`Default model not installed: ${DEFAULT_MODEL}`);
      console.log('    It is a ~6 GB one-time download. When you want it, run:');
      console.log(`      ollama pull ${DEFAULT_MODEL}`);
      console.log('    (ArNega also offers this download in-app.)');
    }
  }
} catch {
  reachable = false;
}
if (hasBinary && !reachable) {
  warn('Ollama server is not running. Open the Ollama app or run `ollama serve`.');
}

// 4. Next steps -------------------------------------------------------------
console.log(`
Next steps:
  npm run dev:desktop     start the desktop app with hot reload
  npm run dev:website     start the marketing site at http://localhost:4321
  npm run check           typecheck + lint + tests
  npm run dist:desktop    build the production .app / DMG / ZIP
`);
