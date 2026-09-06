/**
 * Model metadata and vision-capability detection helpers.
 *
 * The authoritative capability check is Ollama's `/api/show` `capabilities`
 * array (which lists "vision" for multimodal models). When that is unavailable
 * we fall back to a name-based heuristic over well-known vision model families.
 */

import { DEFAULT_MODEL } from './config.js';

export interface OllamaModelDetails {
  family?: string;
  families?: string[] | null;
  parameter_size?: string;
  quantization_level?: string;
}

export interface OllamaModel {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
}

/** Known local vision-capable model family markers (lower-cased substrings). */
const VISION_NAME_MARKERS = [
  'qwen3-vl',
  'qwen2.5-vl',
  'qwen2-vl',
  'llava',
  'bakllava',
  'llama3.2-vision',
  'llama-3.2-vision',
  'minicpm-v',
  'moondream',
  'granite3.2-vision',
  'gemma3', // gemma3 (non-1b variants) are multimodal
  'mistral-small3.1',
  'internvl',
  'pixtral',
];

/** Vision family markers exposed via `details.families`. */
const VISION_FAMILY_MARKERS = ['clip', 'mllama', 'qwen3vl', 'qwen2vl', 'llava', 'mistral3'];

export function isLikelyVisionModelName(name: string): boolean {
  const n = name.toLowerCase();
  return VISION_NAME_MARKERS.some((m) => n.includes(m));
}

export function hasVisionFamily(details?: OllamaModelDetails): boolean {
  const fams = details?.families ?? (details?.family ? [details.family] : []);
  return (fams ?? []).some((f) => VISION_FAMILY_MARKERS.some((m) => f.toLowerCase().includes(m)));
}

/**
 * Best-effort vision detection combining an explicit capabilities list (from
 * `/api/show`, most reliable), family markers, and the name heuristic.
 */
export function isVisionCapable(model: OllamaModel, capabilities?: string[]): boolean {
  if (capabilities && capabilities.length > 0) {
    return capabilities.map((c) => c.toLowerCase()).includes('vision');
  }
  return hasVisionFamily(model.details) || isLikelyVisionModelName(model.name);
}

/** True when the exact default model tag is present in the installed list. */
export function hasDefaultModel(models: OllamaModel[]): boolean {
  return models.some((m) => m.name === DEFAULT_MODEL || m.model === DEFAULT_MODEL);
}

/** Human-friendly display name from an Ollama tag. */
export function displayModelName(name: string): string {
  const [base] = name.split(':');
  return base ?? name;
}

/** Rough GB from a byte size, for the settings list. */
export function bytesToGb(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
