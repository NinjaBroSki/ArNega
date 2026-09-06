import type { ArnegaApi } from '@arnega/shared';

declare global {
  interface Window {
    arnega: ArnegaApi;
  }
}

export {};
