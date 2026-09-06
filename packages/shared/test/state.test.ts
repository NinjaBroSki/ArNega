import { describe, expect, it } from 'vitest';
import { deriveSetupState } from '../src/state.js';

describe('deriveSetupState', () => {
  it('is ready when reachable and the selected model is installed', () => {
    expect(
      deriveSetupState({ reachable: true, binaryInstalled: true, selectedModelInstalled: true }),
    ).toBe('ready');
  });

  it('reports model-missing when reachable without the selected model', () => {
    expect(
      deriveSetupState({ reachable: true, binaryInstalled: true, selectedModelInstalled: false }),
    ).toBe('model-missing');
  });

  it('reports ollama-missing when unreachable and the binary is known absent', () => {
    expect(
      deriveSetupState({ reachable: false, binaryInstalled: false, selectedModelInstalled: false }),
    ).toBe('ollama-missing');
  });

  it('reports ollama-not-running when unreachable but the binary exists', () => {
    expect(
      deriveSetupState({ reachable: false, binaryInstalled: true, selectedModelInstalled: false }),
    ).toBe('ollama-not-running');
  });

  it('treats unknown binary state as not-running (safer message)', () => {
    expect(
      deriveSetupState({
        reachable: false,
        binaryInstalled: undefined,
        selectedModelInstalled: false,
      }),
    ).toBe('ollama-not-running');
  });
});
