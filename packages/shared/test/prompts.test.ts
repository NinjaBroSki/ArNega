import { describe, expect, it } from 'vitest';
import {
  buildUserInstruction,
  buildUserInstructionWithNote,
  SYSTEM_PROMPT,
} from '../src/prompts.js';

describe('prompts', () => {
  it('system prompt covers the critical reading instructions', () => {
    for (const marker of ['negation', 'units', 'multiple choice', 'direct answer']) {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain(marker);
    }
  });

  it('varies the instruction by answer style', () => {
    const direct = buildUserInstruction('direct');
    const detailed = buildUserInstruction('detailed');
    expect(direct).toContain('DIRECT');
    expect(detailed).toContain('DETAILED');
    expect(direct).not.toEqual(detailed);
  });

  it('appends an optional user note when provided', () => {
    expect(buildUserInstructionWithNote('normal', ' focus on question 3 ')).toContain(
      'focus on question 3',
    );
    expect(buildUserInstructionWithNote('normal', '   ')).toBe(buildUserInstruction('normal'));
  });
});
