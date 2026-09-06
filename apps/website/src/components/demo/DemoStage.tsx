/**
 * The animated demo stage: a stylized desktop, a sample task window, and the
 * ArNega overlay playing the Enter → analyze → answer loop. Pure CSS/JSX —
 * no video, no external assets. Respects prefers-reduced-motion (renders the
 * finished answer statically).
 */
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import './demo.css';
import { WinDots, type AnswerSegment, type DemoScene } from './scenes';

type Phase = 'idle' | 'press' | 'analyzing' | 'streaming' | 'done';

function OverlaySymbol(): JSX.Element {
  return (
    <svg viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <rect x="16" y="16" width="224" height="224" rx="56" fill="rgba(255,255,255,0.08)" />
      <g stroke="#7FB6E8" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M169 85 V123 Q169 140 152 140 H92" />
        <path d="M116 114 L87 140 L116 167" />
      </g>
    </svg>
  );
}

function renderSegments(segments: AnswerSegment[], visibleChars: number): JSX.Element[] {
  const out: JSX.Element[] = [];
  let used = 0;
  segments.forEach((seg, i) => {
    if (used >= visibleChars) return;
    const take = Math.min(seg.text.length, visibleChars - used);
    const text = seg.text.slice(0, take);
    used += take;
    if (seg.bold) {
      out.push(<strong key={i}>{text}</strong>);
    } else if (seg.code) {
      out.push(
        <span className="ov-code" key={i}>
          {text}
        </span>,
      );
    } else {
      out.push(<span key={i}>{text}</span>);
    }
  });
  return out;
}

const TIMINGS = {
  idle: 1600,
  press: 480,
  analyzing: 1700,
  charMs: 14,
  done: 4200,
};

export function DemoStage({
  scene,
  loop = false,
  autoPlay = true,
}: {
  scene: DemoScene;
  loop?: boolean;
  autoPlay?: boolean;
}): JSX.Element {
  const totalChars = useMemo(
    () => scene.answer.reduce((n, s) => n + s.text.length, 0),
    [scene],
  );

  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  const [phase, setPhase] = useState<Phase>(reduced || !autoPlay ? 'done' : 'idle');
  const [chars, setChars] = useState(reduced || !autoPlay ? totalChars : 0);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Restart when the scene changes (product demo tabs).
  useEffect(() => {
    if (reduced) {
      setPhase('done');
      setChars(totalChars);
      return;
    }
    setPhase('idle');
    setChars(0);
  }, [scene, reduced, totalChars]);

  // Only animate while visible.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;

    let timer: ReturnType<typeof setTimeout>;
    switch (phase) {
      case 'idle':
        timer = setTimeout(() => setPhase('press'), TIMINGS.idle);
        break;
      case 'press':
        timer = setTimeout(() => setPhase('analyzing'), TIMINGS.press);
        break;
      case 'analyzing':
        timer = setTimeout(() => {
          setChars(0);
          setPhase('streaming');
        }, TIMINGS.analyzing);
        break;
      case 'streaming':
        if (chars >= totalChars) {
          setPhase('done');
        } else {
          timer = setTimeout(() => setChars((c) => Math.min(totalChars, c + 2)), TIMINGS.charMs);
        }
        break;
      case 'done':
        if (loop) {
          timer = setTimeout(() => {
            setChars(0);
            setPhase('idle');
          }, TIMINGS.done);
        }
        break;
    }
    return () => clearTimeout(timer);
  }, [phase, chars, totalChars, loop, reduced, inView]);

  const busy = phase === 'analyzing';
  const showAnswer = phase === 'streaming' || phase === 'done';

  return (
    <div className="demo-stage" ref={rootRef} aria-label="ArNega demo: press Enter, get the answer">
      <div className="demo-menubar" aria-hidden="true">
        <span className="apple"></span>
        <span>Finder</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span className="mb-spacer" />
        <span>Fri 9:41 AM</span>
      </div>

      <div className="demo-window">
        <div className="win-titlebar">
          <WinDots />
          <span className="win-title">{scene.windowTitle}</span>
        </div>
        <div className="win-body">{scene.screen}</div>
      </div>

      <div
        className="demo-enter-float"
        data-visible={phase === 'idle' || phase === 'press'}
        data-pressed={phase === 'press'}
        aria-hidden="true"
      >
        <span className="big-key">↵</span>
        press Enter
      </div>

      <div className="demo-overlay" data-active={busy || showAnswer}>
        <div className="ov-header">
          <OverlaySymbol />
          ArNega
          <span className="ov-spacer" />
          <span className="ov-status">
            <span className="ov-dot" data-busy={busy || phase === 'streaming'} />
            {busy ? 'Analyzing' : phase === 'streaming' ? 'Answering' : 'Ready'}
          </span>
        </div>
        <div className="ov-body">
          {phase === 'idle' || phase === 'press' ? (
            <div className="ov-idle">
              <span className="ov-prompt">
                Press <span className="demo-enter-key" data-pressed={phase === 'press'}>↵</span> to
                ask about your screen
              </span>
              <span className="ov-sub">Answers locally — nothing leaves your Mac</span>
            </div>
          ) : busy ? (
            <div className="ov-busy">
              <div className="demo-aurora" />
              <div className="ov-phase">Analyzing locally…</div>
            </div>
          ) : (
            <div className="ov-answer">
              {renderSegments(scene.answer, chars)}
              {phase === 'streaming' && <span className="demo-caret" />}
            </div>
          )}
        </div>
        <div className="ov-footer">
          <span>
            <span className="demo-kbd">↵</span> Ask
          </span>
          <span>
            <span className="demo-kbd">esc</span> Hide
          </span>
          <span className="ov-spacer" />
          {phase === 'done' && <span>2.8s · local</span>}
        </div>
      </div>
    </div>
  );
}
