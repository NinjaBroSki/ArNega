import type { JSX } from 'react';
import { DemoStage } from './DemoStage';
import { calculusScene } from './scenes';

/** The hero animation: the calculus scene playing on a loop. */
export function HeroDemo(): JSX.Element {
  return <DemoStage scene={calculusScene} loop autoPlay />;
}
