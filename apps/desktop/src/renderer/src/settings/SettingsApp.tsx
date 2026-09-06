import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_MODEL,
  DEFAULT_SHORTCUT,
  displayModelName,
  type AnswerStyle,
  type ArNegaSettings,
  type ScreenshotQuality,
} from '@arnega/shared';
import { useAppStatus } from '../hooks/useAppStatus';
import { ShortcutRecorder } from './ShortcutRecorder';

const ANSWER_STYLES: { id: AnswerStyle; label: string }[] = [
  { id: 'direct', label: 'Direct' },
  { id: 'normal', label: 'Normal' },
  { id: 'detailed', label: 'Detailed' },
];

const SCREENSHOT_QUALITIES: { id: ScreenshotQuality; label: string }[] = [
  { id: 'fast', label: 'Fast' },
  { id: 'balanced', label: 'Balanced' },
  { id: 'high', label: 'High detail' },
];

export function SettingsApp(): React.JSX.Element {
  const { status } = useAppStatus();
  const [warning, setWarning] = useState<string | undefined>();
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    document.body.dataset.view = 'settings';
  }, []);

  const settings = status?.settings;

  const update = useCallback(async (patch: Partial<ArNegaSettings>) => {
    setWarning(undefined);
    try {
      const result = await window.arnega.updateSettings(patch);
      setWarning(result.warning);
    } catch (err) {
      console.error('updateSettings failed', err);
    }
  }, []);

  if (!settings) {
    return <div className="settings-root" />;
  }

  const visionModels = (status?.models ?? []).filter((m) => m.vision);
  const modelInList =
    visionModels.some((m) => m.name === settings.model) || settings.model === DEFAULT_MODEL;

  return (
    <div className="settings-root">
      <div className="settings-titlebar">ArNega Settings</div>
      <div className="settings-scroll">
        {/* MODEL */}
        <section className="settings-section" aria-label="Model">
          <div className="section-label">Model</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Local vision model</div>
                <div className="row-sub">
                  Runs through Ollama on this Mac. {displayModelName(DEFAULT_MODEL)} (8B, thinking)
                  is the recommended default.
                </div>
              </div>
              <select
                className="select"
                value={settings.model}
                aria-label="Local vision model"
                onChange={(e) => void update({ model: e.target.value })}
              >
                {!modelInList && <option value={settings.model}>{settings.model}</option>}
                {!visionModels.some((m) => m.name === DEFAULT_MODEL) && (
                  <option value={DEFAULT_MODEL}>{DEFAULT_MODEL} (default)</option>
                )}
                {visionModels.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                    {m.sizeGb ? ` — ${m.sizeGb}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {visionModels.length === 0 && (
              <div className="settings-note">
                No vision-capable models detected yet. The overlay will offer the one-time default
                model download when Ollama is running.
              </div>
            )}
          </div>
        </section>

        {/* ANSWER STYLE */}
        <section className="settings-section" aria-label="Answer style">
          <div className="section-label">Answer style</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">How much explanation</div>
                <div className="row-sub">
                  Direct gives just the answer; Detailed walks through the reasoning.
                </div>
              </div>
              <div className="segmented" role="group" aria-label="Answer style">
                {ANSWER_STYLES.map((s) => (
                  <button
                    key={s.id}
                    aria-pressed={settings.answerStyle === s.id}
                    onClick={() => void update({ answerStyle: s.id })}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SCREENSHOT */}
        <section className="settings-section" aria-label="Screenshot">
          <div className="section-label">Screenshot</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Capture quality</div>
                <div className="row-sub">
                  Higher detail helps with dense text but takes longer to analyze.
                </div>
              </div>
              <div className="segmented" role="group" aria-label="Screenshot quality">
                {SCREENSHOT_QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    aria-pressed={settings.screenshotQuality === q.id}
                    onClick={() => void update({ screenshotQuality: q.id })}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SHORTCUT */}
        <section className="settings-section" aria-label="Shortcut">
          <div className="section-label">Shortcut</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Show / hide ArNega</div>
                <div className="row-sub">Works everywhere. Click the shortcut to change it.</div>
              </div>
              <ShortcutRecorder
                value={settings.globalShortcut}
                onChange={(accelerator) => void update({ globalShortcut: accelerator })}
              />
              {settings.globalShortcut !== DEFAULT_SHORTCUT && (
                <button className="btn" onClick={() => void update({ globalShortcut: DEFAULT_SHORTCUT })}>
                  Reset
                </button>
              )}
            </div>
            {warning && <div className="settings-note field-warning">{warning}</div>}
          </div>
        </section>

        {/* SYSTEM */}
        <section className="settings-section" aria-label="System">
          <div className="section-label">System</div>
          <div className="settings-card">
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Launch at login</div>
                <div className="row-sub">Start ArNega automatically when you log in.</div>
              </div>
              <button
                className="switch"
                role="switch"
                aria-checked={settings.launchAtLogin}
                aria-label="Launch at login"
                onClick={() => void update({ launchAtLogin: !settings.launchAtLogin })}
              />
            </div>
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Overlay position</div>
                <div className="row-sub">Bring the overlay back to the center of the main display.</div>
              </div>
              <button className="btn" onClick={() => void window.arnega.resetWindowPosition()}>
                Reset position
              </button>
            </div>
            <div className="settings-row">
              <div className="row-text">
                <div className="row-title">Clear local state</div>
                <div className="row-sub">
                  Deletes ArNega&apos;s settings file and restores every default.
                </div>
              </div>
              {confirmClear ? (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      void window.arnega.clearLocalState();
                      setConfirmClear(false);
                    }}
                  >
                    Confirm
                  </button>
                  <button className="btn" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn" onClick={() => setConfirmClear(true)}>
                  Clear…
                </button>
              )}
            </div>
          </div>
        </section>

        {/* PRIVACY */}
        <section className="settings-section" aria-label="Privacy">
          <div className="section-label">Privacy</div>
          <div className="settings-card">
            <div className="settings-note">
              <strong>Everything stays on your Mac.</strong> Screenshots are processed in memory and
              sent only to Ollama at <strong>127.0.0.1:11434</strong> — never to a cloud AI service.
              ArNega has no accounts, no telemetry, and no analytics. The only file it stores is
              this settings file in your Library folder.
            </div>
          </div>
        </section>

        <div style={{ textAlign: 'center', color: 'var(--an-text-3)', fontSize: 11 }}>
          ArNega {window.arnega.appVersion}
        </div>
      </div>
    </div>
  );
}
