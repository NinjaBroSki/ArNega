/**
 * The only external URLs the app will ever open — an explicit allowlist,
 * triggered exclusively by user clicks. The renderer can only name a target;
 * it can never supply a raw URL.
 */
import { shell } from 'electron';
import {
  DEFAULT_REPO_SLUG,
  MODEL_INFO_URL,
  OLLAMA_DOWNLOAD_URL,
  releasesUrl,
  repoUrl,
  type ExternalLinkTarget,
} from '@arnega/shared';

const EXTERNAL_URLS: Record<ExternalLinkTarget, string> = {
  'ollama-download': OLLAMA_DOWNLOAD_URL,
  'model-info': MODEL_INFO_URL,
  repo: repoUrl(DEFAULT_REPO_SLUG),
  releases: releasesUrl(DEFAULT_REPO_SLUG),
};

export async function openExternalTarget(target: unknown): Promise<void> {
  if (typeof target !== 'string' || !(target in EXTERNAL_URLS)) {
    console.warn('[external] refused to open unknown target:', target);
    return;
  }
  await shell.openExternal(EXTERNAL_URLS[target as ExternalLinkTarget]);
}
