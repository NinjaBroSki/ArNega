/**
 * Screen capture pipeline.
 *
 * Everything happens in memory: capture → optimize → base64 → dispose.
 * Screenshots are never written to disk by the primary path. The fallback
 * path (`screencapture` CLI) uses a temp file for a few milliseconds and
 * removes it in a `finally` block.
 */
import { desktopCapturer, nativeImage, screen } from 'electron';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { computeResizeTarget, presetFor, type ScreenshotQuality } from '@arnega/shared';
import { pickTargetDisplay, type Rect } from './display.js';

const execFileAsync = promisify(execFile);

export interface CaptureResult {
  base64: string;
  width: number;
  height: number;
  byteLength: number;
  method: 'desktopCapturer' | 'screencapture';
}

export function targetDisplayForCapture(overlayBounds: Rect | null) {
  const displays = screen.getAllDisplays();
  let cursor: { x: number; y: number } | null = null;
  try {
    cursor = screen.getCursorScreenPoint();
  } catch {
    cursor = null;
  }
  return pickTargetDisplay(displays, overlayBounds, cursor);
}

function optimize(image: Electron.NativeImage, quality: ScreenshotQuality): CaptureResult {
  const preset = presetFor(quality);
  const size = image.getSize();
  if (size.width === 0 || size.height === 0) {
    throw new Error('Captured image was empty');
  }
  const target = computeResizeTarget(size.width, size.height, preset);
  const scaled = target.resized
    ? image.resize({ width: target.width, height: target.height, quality: 'best' })
    : image;
  const jpeg = scaled.toJPEG(Math.round(preset.jpegQuality * 100));
  return {
    base64: jpeg.toString('base64'),
    width: target.width,
    height: target.height,
    byteLength: jpeg.byteLength,
    method: 'desktopCapturer',
  };
}

async function captureViaDesktopCapturer(
  display: Electron.Display,
  quality: ScreenshotQuality,
): Promise<CaptureResult> {
  const physical = {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: physical,
  });
  if (sources.length === 0) {
    throw new Error('No screen sources available (missing Screen Recording permission?)');
  }
  const source =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0]!;
  return optimize(source.thumbnail, quality);
}

async function captureViaScreencaptureCli(
  display: Electron.Display,
  quality: ScreenshotQuality,
): Promise<CaptureResult> {
  // Map the Electron display to screencapture's 1-based display index.
  // Display ordering matches the arrangement order closely enough for a
  // fallback path; the primary path handles multi-display precisely.
  const displays = screen.getAllDisplays();
  const index = Math.max(0, displays.findIndex((d) => d.id === display.id)) + 1;
  const tmpFile = join(tmpdir(), `arnega-capture-${randomBytes(8).toString('hex')}.png`);
  try {
    await execFileAsync('/usr/sbin/screencapture', ['-x', '-D', String(index), '-t', 'png', tmpFile], {
      timeout: 10_000,
    });
    const buffer = await readFile(tmpFile);
    const image = nativeImage.createFromBuffer(buffer);
    const result = optimize(image, quality);
    return { ...result, method: 'screencapture' };
  } finally {
    await rm(tmpFile, { force: true }).catch(() => {});
  }
}

/**
 * Capture one display, optimized per the quality preset. Uses Electron's
 * desktopCapturer (fully in memory); falls back to the macOS `screencapture`
 * utility if that fails.
 */
export async function captureDisplay(
  display: Electron.Display,
  quality: ScreenshotQuality,
): Promise<CaptureResult> {
  try {
    return await captureViaDesktopCapturer(display, quality);
  } catch (primaryError) {
    console.warn('[capture] desktopCapturer failed, falling back to screencapture:', primaryError);
    try {
      return await captureViaScreencaptureCli(display, quality);
    } catch (fallbackError) {
      console.error('[capture] screencapture fallback failed:', fallbackError);
      throw primaryError instanceof Error
        ? primaryError
        : new Error('Screen capture failed');
    }
  }
}
