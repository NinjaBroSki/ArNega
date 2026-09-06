import { useState, type JSX } from 'react';
import { DemoStage } from './DemoStage';
import { ALL_SCENES } from './scenes';

/** Tabbed demo — the same Enter workflow across different kinds of work. */
export function ProductDemo(): JSX.Element {
  const [active, setActive] = useState(0);
  const scene = ALL_SCENES[active] ?? ALL_SCENES[0]!;

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="demo-tabs" role="tablist" aria-label="Demo scenarios">
        {ALL_SCENES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <DemoStage scene={scene} loop={false} autoPlay />
    </div>
  );
}
