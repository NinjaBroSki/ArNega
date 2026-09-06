/**
 * Static configuration shared across the desktop app and website.
 *
 * All AI inference is local. The only network endpoint the desktop runtime
 * talks to for inference is the loopback Ollama server below.
 */

/** Loopback Ollama endpoint. ArNega never sends inference anywhere else. */
export const OLLAMA_HOST = 'http://127.0.0.1:11434';

/**
 * Default local vision model. The instruct edition answers immediately —
 * the "-thinking" edition reasons (hidden) for many seconds before the first
 * visible token, which feels slow in an Enter-to-answer workflow. Users who
 * want deep reasoning can install a thinking model and pick the Detailed
 * answer style.
 */
export const DEFAULT_MODEL = 'qwen3-vl:8b-instruct';

/** The optional deep-reasoning sibling of the default model. */
export const THINKING_MODEL = 'qwen3-vl:8b-thinking-q4_K_M';

/**
 * How long Ollama keeps the model resident after a request, so repeated
 * questions do not pay the reload cost. Tuned for an M4 / 16 GB machine.
 */
export const DEFAULT_KEEP_ALIVE = '30m';

/**
 * Default context window for screen Q&A. Kept modest to bound KV-cache memory
 * on 16 GB machines; users can raise it in settings if they routinely ask
 * questions that need more room for long reasoning.
 */
export const DEFAULT_NUM_CTX = 8192;

/** Sampling temperature. Low, because we want precise answers, not prose. */
export const DEFAULT_TEMPERATURE = 0.2;

/** Official Ollama download page (used only when the user explicitly clicks). */
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

/** Official page for the default model (informational link only). */
export const MODEL_INFO_URL = 'https://ollama.com/library/qwen3-vl';

/**
 * Fallback GitHub repository slug for local development.
 *
 * In CI this is overridden by the real repository via `github.repository`
 * (injected as PUBLIC_ARNEGA_REPO during the Pages build), so the deployed
 * website always points at the correct release URLs. Update this constant if
 * you want local `npm run dev:website` previews to show your real links.
 */
export const DEFAULT_REPO_SLUG = 'NinjaBroSki/ArNega';

/** Request timeout (ms) for quick Ollama health/list probes. */
export const OLLAMA_PROBE_TIMEOUT_MS = 2500;
