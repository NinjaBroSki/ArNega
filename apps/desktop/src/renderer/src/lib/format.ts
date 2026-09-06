/** Small formatting helpers for the UI. */

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${Math.round(mb)} MB`;
}

export function formatDuration(ms?: number): string {
  if (ms === undefined || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTokensPerSecond(tps?: number): string {
  if (!tps) return '';
  return `${tps} tok/s`;
}
