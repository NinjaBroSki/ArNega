#!/usr/bin/env node
/**
 * Generate the 1200×630 social preview image (og.png) for the website from
 * an inline SVG. Uses system-safe font stacks; run `npm run gen:icons` first
 * if brand assets changed.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'apps/website/public');

const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="aurora" x1="80" y1="240" x2="360" y2="480" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6CA8FF"/>
      <stop offset="1" stop-color="#7CE3CE"/>
    </linearGradient>
    <radialGradient id="halo" cx="600" cy="0" r="720" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#6CA8FF" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#6CA8FF" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#6CA8FF" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="capfill" x1="150" y1="180" x2="150" y2="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1C222E"/>
      <stop offset="1" stop-color="#0D1017"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#0B0D12"/>
  <rect width="1200" height="630" fill="url(#halo)"/>

  <!-- subtle grid -->
  <g stroke="#FFFFFF" stroke-opacity="0.035">
    ${Array.from({ length: 22 }, (_, i) => `<line x1="${i * 56}" y1="0" x2="${i * 56}" y2="630"/>`).join('')}
    ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 56}" x2="1200" y2="${i * 56}"/>`).join('')}
  </g>

  <!-- symbol keycap -->
  <g transform="translate(84, 178)">
    <rect x="0" y="0" width="150" height="150" rx="36" fill="url(#capfill)"/>
    <rect x="1.5" y="1.5" width="147" height="147" rx="34.5" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="3" fill="none"/>
    <g stroke="url(#aurora)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M99 50 V72 Q99 82 89 82 H54"/>
      <path d="M68 68 L51 82 L68 96"/>
    </g>
  </g>

  <!-- wordmark + copy -->
  <text x="270" y="288" font-family="${FONT}" font-size="76" font-weight="700" letter-spacing="-2" fill="#F5F7FA">ArNega</text>

  <text x="86" y="420" font-family="${FONT}" font-size="46" font-weight="700" letter-spacing="-1" fill="#E7EBF1">See it. Press Enter. <tspan fill="#7FC4E8">Get the answer.</tspan></text>

  <text x="86" y="478" font-family="${FONT}" font-size="24" font-weight="400" fill="#A8B1BE">Free local screen AI for macOS — no API keys, no subscriptions.</text>

  <!-- support chips -->
  <g font-family="${FONT}" font-size="19" font-weight="500" fill="#A8B1BE">
    <rect x="86" y="520" width="182" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <text x="112" y="548">Apple Silicon</text>
    <rect x="284" y="520" width="130" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <text x="310" y="548">Local AI</text>
    <rect x="430" y="520" width="160" height="44" rx="22" fill="#FFFFFF" fill-opacity="0.05" stroke="#FFFFFF" stroke-opacity="0.12"/>
    <text x="456" y="548">Free to use</text>
  </g>
</svg>`;

await mkdir(out, { recursive: true });
await writeFile(join(out, 'og-source.svg'), svg);
await sharp(Buffer.from(svg), { density: 144 }).png().toFile(join(out, 'og.png'));
console.log('  apps/website/public/og.png (1200x630)');
