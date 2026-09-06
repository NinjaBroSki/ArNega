import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

// In a plain browser during development (no Electron preload), install the
// mock API so every UI state can be exercised and visually reviewed.
if (import.meta.env.DEV && !('arnega' in window)) {
  const { installMockApi } = await import('./dev/mockApi');
  installMockApi();
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
