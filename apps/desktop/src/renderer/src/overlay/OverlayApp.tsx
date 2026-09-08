import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  tokensPerSecond,
  type ChatDelta,
  type GenerationPhase,
  type GenTimings,
} from '@arnega/shared';
import { BrandSymbol } from '../components/BrandSymbol';
import { CheckIcon, CloseIcon, CopyIcon, GearIcon, StopIcon } from '../components/Icons';
import { useAppStatus } from '../hooks/useAppStatus';
import { formatDuration } from '../lib/format';
import { normalizeMathDelimiters } from '../lib/math';
import { SetupCard } from './SetupCard';

interface GenState {
  phase: GenerationPhase;
  answer: string;
  error?: string;
  timings?: GenTimings;
  stats?: ChatDelta['stats'];
}

const IDLE_GEN: GenState = { phase: 'idle', answer: '' };
const ACTIVE_PHASES: GenerationPhase[] = ['capturing', 'sending', 'thinking', 'answering'];

const PHASE_LABEL: Partial<Record<GenerationPhase, string>> = {
  capturing: 'Capturing screen…',
  sending: 'Reading the screen…',
  thinking: 'Thinking…',
};

function statusTone(state: string, busy: boolean): 'ok' | 'warn' | 'danger' | 'busy' | 'idle' {
  if (busy) return 'busy';
  switch (state) {
    case 'ready':
      return 'ok';
    case 'error':
      return 'danger';
    case 'checking':
    case 'model-loading':
    case 'model-downloading':
      return 'busy';
    default:
      return 'warn';
  }
}

function statusLabel(state: string, busy: boolean, progress?: number): string {
  if (busy) return 'Answering';
  switch (state) {
    case 'ready':
      return 'Ready';
    case 'checking':
      return 'Checking…';
    case 'ollama-missing':
      return 'Ollama needed';
    case 'ollama-not-running':
      return 'Ollama offline';
    case 'model-missing':
      return 'Model needed';
    case 'model-downloading':
      return progress !== undefined ? `Downloading ${progress.toFixed(0)}%` : 'Downloading…';
    case 'model-loading':
      return 'Loading model';
    case 'error':
      return 'Error';
    default:
      return '';
  }
}

export function OverlayApp(): React.JSX.Element {
  const { status, refresh } = useAppStatus();
  const [gen, setGen] = useState<GenState>(IDLE_GEN);
  const [copied, setCopied] = useState(false);
  const [elapsedS, setElapsedS] = useState(0);
  const genStartRef = useRef<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const busy = ACTIVE_PHASES.includes(gen.phase);

  useEffect(() => {
    document.body.dataset.view = 'overlay';
  }, []);

  // --- generation events from main -----------------------------------------
  useEffect(() => {
    return window.arnega.onGenEvent((event) => {
      switch (event.type) {
        case 'phase':
          setGen((prev) => {
            if (event.phase === 'capturing') {
              genStartRef.current = Date.now();
              return { phase: 'capturing', answer: '' };
            }
            if (event.phase === 'cancelled') {
              return prev.answer
                ? { ...prev, phase: 'cancelled' }
                : { phase: 'idle', answer: '' };
            }
            return { ...prev, phase: event.phase };
          });
          break;
        case 'delta':
          setGen((prev) => ({
            ...prev,
            phase: 'answering',
            answer: prev.answer + event.text,
          }));
          break;
        case 'done':
          setGen((prev) => ({
            ...prev,
            phase: 'done',
            stats: event.stats,
            timings: event.timings,
          }));
          break;
        case 'error':
          setGen((prev) => ({ ...prev, phase: 'failed', error: event.message }));
          break;
      }
    });
  }, []);

  // --- keyboard ------------------------------------------------------------
  const ask = useCallback(
    (mode: 'full' | 'region' = 'full') => {
      if (!status || status.setup.state !== 'ready') {
        void refresh();
        return;
      }
      if (busy) return;
      setCopied(false);
      void window.arnega.solve(mode).then((result) => {
        if (!result.ok && result.error) {
          // e.g. not ready — the setup card explains what's going on
          console.warn('solve rejected:', result.error);
        }
      });
    },
    [status, busy, refresh],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        // Shift+Enter: drag-select just the problem — far fewer image tokens
        // (seconds instead of tens of seconds) and sharper text for the model.
        ask(e.shiftKey ? 'region' : 'full');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void window.arnega.hideWindow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ask]);

  // --- auto-scroll during streaming ---------------------------------------
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [gen.answer]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
  }, []);

  useEffect(() => {
    if (busy) stickToBottom.current = true;
  }, [busy]);

  // Live elapsed indicator while working — local models can take a while on
  // dense screens, and a ticking count reads as progress instead of a hang.
  useEffect(() => {
    if (!busy) {
      setElapsedS(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedS(Math.round((Date.now() - genStartRef.current) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [busy]);

  // --- content-driven window resizing --------------------------------------
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let raf = 0;
    const requestFit = (): void => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const chrome = 38 /* header */ + 36 /* footer */ + 8;
        const desired = content.scrollHeight + chrome;
        void window.arnega.resizeOverlay(desired);
      });
    };

    const observer = new ResizeObserver(requestFit);
    observer.observe(content);
    requestFit();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [gen.phase]);

  // --- actions -------------------------------------------------------------
  const copyAnswer = useCallback(() => {
    if (!gen.answer) return;
    void window.arnega.copyText(gen.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [gen.answer]);

  const cancel = useCallback(() => {
    void window.arnega.cancel();
  }, []);

  // --- render --------------------------------------------------------------
  const setup = status?.setup;
  const setupCard = status ? <SetupCard status={status} onRefresh={() => void refresh()} /> : null;
  const showAnswer = gen.answer.length > 0 || gen.phase === 'failed';
  const tone = statusTone(setup?.state ?? 'checking', busy);
  const label = statusLabel(setup?.state ?? 'checking', busy, setup?.progressPercent);

  const permissionBlocked =
    setup?.state === 'ready' &&
    (status?.screenPermission === 'denied' || status?.screenPermission === 'restricted');

  let body: React.JSX.Element;
  if (showAnswer) {
    body = (
      <div className="answer-scroll" ref={scrollRef} onScroll={onScroll}>
        <div ref={contentRef}>
          {gen.phase === 'failed' ? (
            <div className="setup error" style={{ padding: '18px 8px' }}>
              <div className="title">Couldn&apos;t answer that</div>
              <p className="desc">{gen.error}</p>
              <div className="actions">
                <span className="hint">
                  <span className="kbd">↵</span> Try again
                </span>
              </div>
            </div>
          ) : (
            <div className="answer-md" aria-live="polite">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#f07f7f' }]]}
                components={{
                  a: ({ children }) => <a>{children}</a>,
                }}
              >
                {normalizeMathDelimiters(gen.answer)}
              </ReactMarkdown>
              {gen.phase === 'answering' && <span className="stream-caret" aria-hidden="true" />}
            </div>
          )}
        </div>
      </div>
    );
  } else if (busy) {
    body = (
      <div className="busy" ref={contentRef}>
        <div className="aurora-line" />
        <div className="phase">
          {PHASE_LABEL[gen.phase] ?? 'Working…'}
          {elapsedS >= 3 && <span className="phase-elapsed"> {elapsedS}s</span>}
        </div>
      </div>
    );
  } else if (setup && (setup.state !== 'ready' || permissionBlocked) && setupCard) {
    body = <div ref={contentRef}>{setupCard}</div>;
  } else {
    body = (
      <div className="idle" ref={contentRef}>
        <div className="prompt">
          Press <span className="enter-key">↵</span> to ask about your screen
        </div>
        <div className="sub">
          <span className="kbd">⇧↵</span> snip a region — fastest and sharpest. Everything stays on
          your Mac.
        </div>
      </div>
    );
  }

  const tps = tokensPerSecond(gen.stats);

  return (
    <div className="overlay-root">
      <header className="overlay-header">
        <div className="brand">
          <BrandSymbol size={15} />
          ArNega
        </div>
        <div className="spacer" />
        <span className="status-chip" title={label}>
          <span className="status-dot" data-tone={tone} />
          {label}
        </span>
        <button
          className="icon-btn"
          title="Settings"
          aria-label="Open settings"
          onClick={() => void window.arnega.openSettingsWindow()}
        >
          <GearIcon />
        </button>
        <button
          className="icon-btn"
          title="Hide (Esc)"
          aria-label="Hide ArNega"
          onClick={() => void window.arnega.hideWindow()}
        >
          <CloseIcon />
        </button>
      </header>

      <main className="overlay-content">{body}</main>

      <footer className="overlay-footer">
        {busy ? (
          <button className="btn btn-danger" onClick={cancel} aria-label="Stop generating">
            <StopIcon size={11} /> <span style={{ marginLeft: 6 }}>Stop</span>
          </button>
        ) : showAnswer && gen.phase !== 'failed' ? (
          <>
            <button className="btn" onClick={copyAnswer} aria-label="Copy answer">
              {copied ? <CheckIcon size={11} /> : <CopyIcon size={11} />}
              <span style={{ marginLeft: 6 }}>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <span className="hint">
              <span className="kbd">↵</span> Ask again · <span className="kbd">⇧↵</span> Snip
            </span>
          </>
        ) : (
          <span className="hint">
            <span className="kbd">esc</span> Hide
          </span>
        )}
        <div className="spacer" />
        {gen.phase === 'done' && gen.timings?.totalMs !== undefined && (
          <span className="timing-chip">
            {formatDuration(gen.timings.totalMs)}
            {tps ? ` · ${tps} tok/s` : ''}
          </span>
        )}
        {gen.phase === 'cancelled' && <span className="timing-chip">Stopped</span>}
      </footer>
    </div>
  );
}
