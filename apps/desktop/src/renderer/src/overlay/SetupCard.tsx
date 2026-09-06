import type { AppStatus } from '@arnega/shared';
import { formatBytes } from '../lib/format';

/**
 * Beautiful representations of every local-AI setup state: Ollama missing,
 * not running, model missing/downloading/loading, permission problems, and
 * errors. Rendered in the overlay in place of the idle prompt.
 */
export function SetupCard({
  status,
  onRefresh,
}: {
  status: AppStatus;
  onRefresh: () => void;
}): React.JSX.Element | null {
  const { setup, screenPermission } = status;

  switch (setup.state) {
    case 'checking':
      return (
        <div className="setup">
          <div className="aurora-line" />
          <div className="title">Checking local AI…</div>
        </div>
      );

    case 'ollama-missing':
      return (
        <div className="setup">
          <div className="title">Install Ollama to get started</div>
          <p className="desc">
            Ollama is a free app that runs AI models locally on your Mac — it&apos;s how ArNega
            answers questions without any cloud API.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => void window.arnega.openExternal('ollama-download')}>
              Get Ollama
            </button>
            <button className="btn" onClick={onRefresh}>
              Check again
            </button>
          </div>
        </div>
      );

    case 'ollama-not-running':
      return (
        <div className="setup">
          <div className="title">Ollama isn&apos;t running</div>
          <p className="desc">
            Open the Ollama app (or run <code>ollama serve</code> in Terminal), then check again.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={onRefresh}>
              Check again
            </button>
          </div>
        </div>
      );

    case 'model-missing':
      return (
        <div className="setup">
          <div className="title">One-time model download</div>
          <p className="desc">
            ArNega uses <strong>Qwen3-VL 8B</strong>, a local vision model that reads your screen.
            It&apos;s about a <strong>6&nbsp;GB</strong> download through Ollama — once it&apos;s on
            your Mac, everything runs locally.
          </p>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => void window.arnega.pullDefaultModel()}>
              Download model
            </button>
            <button className="btn" onClick={onRefresh}>
              Check again
            </button>
          </div>
        </div>
      );

    case 'model-downloading': {
      const pct = setup.progressPercent;
      const bytes =
        setup.downloadedBytes && setup.totalBytes
          ? `${formatBytes(setup.downloadedBytes)} of ${formatBytes(setup.totalBytes)}`
          : '';
      return (
        <div className="setup">
          <div className="title">Downloading model…</div>
          <div className="progress-track" role="progressbar" aria-valuenow={pct ?? undefined} aria-valuemin={0} aria-valuemax={100}>
            <div
              className={`progress-fill${pct === undefined ? ' indeterminate' : ''}`}
              style={pct !== undefined ? { width: `${pct}%` } : undefined}
            />
          </div>
          <div className="progress-meta">
            {pct !== undefined ? `${pct.toFixed(0)}%` : ''}
            {bytes ? ` · ${bytes}` : ''}
          </div>
          <div className="actions">
            <button className="btn" onClick={() => void window.arnega.cancelPull()}>
              Cancel download
            </button>
          </div>
        </div>
      );
    }

    case 'model-loading':
      return (
        <div className="setup">
          <div className="aurora-line" />
          <div className="title">Loading model…</div>
          <p className="desc">Getting the model ready in memory. This takes a few seconds.</p>
        </div>
      );

    case 'error':
      return (
        <div className="setup error">
          <div className="title">Something went wrong</div>
          <p className="desc">{setup.detail ?? 'An unexpected error occurred.'}</p>
          <div className="actions">
            <button className="btn btn-primary" onClick={onRefresh}>
              Try again
            </button>
          </div>
        </div>
      );

    case 'ready':
      if (screenPermission === 'denied' || screenPermission === 'restricted') {
        return (
          <div className="setup">
            <div className="title">Allow screen capture</div>
            <p className="desc">
              macOS requires Screen Recording permission for ArNega to see your screen. Enable it
              for ArNega in System Settings, then come back.
            </p>
            <div className="actions">
              <button
                className="btn btn-primary"
                onClick={() => void window.arnega.openScreenRecordingSettings()}
              >
                Open System Settings
              </button>
              <button className="btn" onClick={onRefresh}>
                Check again
              </button>
            </div>
          </div>
        );
      }
      return null;

    default:
      return null;
  }
}
