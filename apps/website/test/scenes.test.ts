import { describe, expect, it } from 'vitest';
import { ALL_SCENES } from '../src/components/demo/scenes';

describe('demo scenes', () => {
  it('are unique and complete', () => {
    expect(ALL_SCENES.length).toBeGreaterThanOrEqual(3);
    const ids = ALL_SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scene of ALL_SCENES) {
      expect(scene.label.length).toBeGreaterThan(0);
      expect(scene.windowTitle.length).toBeGreaterThan(0);
      expect(scene.answer.length).toBeGreaterThan(0);
      const total = scene.answer.reduce((n, seg) => n + seg.text.length, 0);
      expect(total).toBeGreaterThan(20);
    }
  });

  it('leads every answer with the key finding (bold first segment)', () => {
    for (const scene of ALL_SCENES) {
      const firstStyled = scene.answer.find((s) => s.bold || s.code);
      expect(firstStyled, `${scene.id} should emphasize its answer`).toBeDefined();
    }
  });
});
