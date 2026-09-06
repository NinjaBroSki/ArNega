#!/usr/bin/env node
/**
 * Rasterize the ArNega brand SVGs into the PNG assets used by the desktop app
 * (electron-builder icon) and the website (favicons, touch icon, social image).
 *
 * Usage: npm run gen:icons
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'packages/branding/assets');
const desktopBuild = join(root, 'apps/desktop/build');
const websitePublic = join(root, 'apps/website/public');

async function render(svgPath, outPath, size, { density = 300 } = {}) {
  await sharp(svgPath, { density })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log(`  ${outPath.replace(root + '/', '')} (${size}x${size})`);
}

async function main() {
  await mkdir(desktopBuild, { recursive: true });
  await mkdir(websitePublic, { recursive: true });

  console.log('Desktop app icon:');
  // electron-builder generates the .icns from a single 1024px icon.png
  await render(join(assets, 'icon-1024.svg'), join(desktopBuild, 'icon.png'), 1024, {
    density: 300,
  });

  console.log('Website favicons:');
  await render(join(assets, 'favicon.svg'), join(websitePublic, 'favicon-32.png'), 32);
  await render(join(assets, 'favicon.svg'), join(websitePublic, 'favicon-16.png'), 16);
  await render(join(assets, 'icon-1024.svg'), join(websitePublic, 'apple-touch-icon.png'), 180);
  await render(join(assets, 'icon-1024.svg'), join(websitePublic, 'icon-512.png'), 512);

  console.log('Preview renders (for docs/README):');
  const docsAssets = join(root, 'docs/assets');
  await mkdir(docsAssets, { recursive: true });
  await render(join(assets, 'symbol.svg'), join(docsAssets, 'symbol-256.png'), 256);
  await render(join(assets, 'icon-1024.svg'), join(docsAssets, 'icon-256.png'), 256);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
