#!/usr/bin/env node
/**
 * Headless page screenshot tool for visual QA (uses the repo's Electron).
 *
 *   npx electron scripts/snap.mjs '<json-spec>'
 *
 * Spec: { "shots": [ { "url", "out", "width", "height", "fullPage", "delay", "css", "js" } ] }
 * Dev-only utility — not part of the shipped app.
 */
import { app, BrowserWindow } from 'electron';

const spec = JSON.parse(process.argv[process.argv.length - 1]);

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.dock?.hide();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let sharedWin = null;

async function shoot({ url, out, width = 1440, height = 900, fullPage = false, delay = 900, css, js }) {
  if (!sharedWin || sharedWin.isDestroyed()) {
    sharedWin = new BrowserWindow({
      width,
      height,
      show: false,
      frame: false,
      webPreferences: { offscreen: true, backgroundThrottling: false },
    });
    sharedWin.webContents.setFrameRate(10);
  }
  const win = sharedWin;
  win.setContentSize(width, height);
  await win.loadURL(url);
  if (css) await win.webContents.insertCSS(css);
  if (js) await win.webContents.executeJavaScript(js, true).catch(() => {});
  await sleep(delay);

  if (fullPage) {
    const contentHeight = await win.webContents.executeJavaScript(
      'Math.min(document.documentElement.scrollHeight, 12000)',
    );
    win.setContentSize(width, Math.max(height, contentHeight));
    await sleep(500);
  }

  const image = await win.webContents.capturePage();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(out, image.toPNG());
  console.log(`saved ${out} (${image.getSize().width}x${image.getSize().height})`);
}

app.whenReady().then(async () => {
  try {
    for (const shot of spec.shots) {
      await shoot(shot);
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
