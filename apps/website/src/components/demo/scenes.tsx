/**
 * Sample scenes for the product demos. All content is invented sample
 * material rendered from scratch — no screenshots of real products.
 */
import type { JSX } from 'react';

export interface AnswerSegment {
  text: string;
  bold?: boolean;
  code?: boolean;
}

export interface DemoScene {
  id: string;
  label: string;
  windowTitle: string;
  screen: JSX.Element;
  answer: AnswerSegment[];
}

function WinDots(): JSX.Element {
  return (
    <>
      <span className="win-dot" style={{ background: '#f26d63' }} />
      <span className="win-dot" style={{ background: '#f5bf4f' }} />
      <span className="win-dot" style={{ background: '#58c556' }} />
    </>
  );
}

export { WinDots };

export const calculusScene: DemoScene = {
  id: 'math',
  label: 'Math',
  windowTitle: 'Practice Exam — Question 7 of 20',
  screen: (
    <>
      <div className="scene-question">Question 7</div>
      <div className="scene-math">
        ∫<sub>0</sub>
        <sup>π</sup> sin²(x) dx&nbsp;=&nbsp;?
      </div>
      <div className="scene-choices">
        <div className="scene-choice">
          <span className="c-letter">A</span>π
        </div>
        <div className="scene-choice">
          <span className="c-letter">B</span>π / 2
        </div>
        <div className="scene-choice">
          <span className="c-letter">C</span>2π
        </div>
        <div className="scene-choice">
          <span className="c-letter">D</span>0
        </div>
      </div>
    </>
  ),
  answer: [
    { text: 'π/2', bold: true },
    { text: ' — option ' },
    { text: 'B', bold: true },
    { text: '. Over [0, π], sin²(x) averages to ½, so the integral is π · ½ = π/2.' },
  ],
};

export const codeScene: DemoScene = {
  id: 'code',
  label: 'Code',
  windowTitle: 'profile.tsx — my-app',
  screen: (
    <div className="scene-code">
      <span className="tok-kw">useEffect</span>
      {'(() => {\n  '}
      <span className="tok-fn">fetchProfile</span>
      {'(userId).'}
      <span className="tok-fn">then</span>
      {'(setProfile);\n}, '}
      <span className="tok-err">[]</span>
      {');'}
      {'\n\n'}
      <span className="tok-dim">{'// bug: profile never updates when the route changes'}</span>
    </div>
  ),
  answer: [
    { text: 'Add ' },
    { text: 'userId', code: true },
    { text: ' to the dependency array', bold: true },
    {
      text: ' — the effect runs once with the first render’s value, so navigating to another user keeps showing stale data.',
    },
  ],
};

export const chartScene: DemoScene = {
  id: 'chart',
  label: 'Charts',
  windowTitle: 'Q3-report.pdf — Page 12',
  screen: (
    <>
      <div className="scene-question">Revenue by region ($M) · Q2 vs Q3</div>
      <div className="scene-chart" role="img" aria-label="Bar chart of revenue by region">
        {[
          { name: 'NA', prev: 62, now: 66 },
          { name: 'EMEA', prev: 42, now: 58 },
          { name: 'APAC', prev: 38, now: 46 },
          { name: 'LATAM', prev: 22, now: 24 },
        ].map((r) => (
          <div className="scene-bar" key={r.name}>
            <div className="bar-pair">
              <div className="bar" style={{ height: `${r.prev}px` }} />
              <div className="bar now" style={{ height: `${r.now}px` }} />
            </div>
            {r.name}
          </div>
        ))}
      </div>
      <div className="scene-chart-caption">Which region grew fastest quarter over quarter?</div>
    </>
  ),
  answer: [
    { text: 'EMEA', bold: true },
    {
      text: ' grew fastest — about +38% QoQ (4.2 → 5.8), ahead of APAC at +21% and NA at +6%.',
    },
  ],
};

export const ALL_SCENES: DemoScene[] = [calculusScene, codeScene, chartScene];
