import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

function isBenignConsoleNoise(message: string): boolean {
  return (
    message.includes('A listener indicated an asynchronous response') ||
    message.includes('message channel closed') ||
    message.includes('Extension context invalidated') ||
    (message.includes('requestFullscreen') && message.includes('user gesture')) ||
    message.includes('Blocked aria-hidden') ||
    message.includes('aria-hidden on an element')
  );
}

const CHUNK_RELOAD_SESSION_KEY = 'ss_chunk_reload_once';

function isChunkLoadFailure(message: string, reason: unknown): boolean {
  const name = reason instanceof Error ? reason.name : '';
  return (
    name === 'ChunkLoadError' ||
    /Loading chunk [\w-]+ failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

function tryReloadOnceAfterChunkFailure(): boolean {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, '1');
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

// Ruído conhecido: extensões do navegador e avisos de acessibilidade do MUI Modal.
// ChunkLoadError: main.js em cache após deploy — recarrega uma vez para buscar index.html novo.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_SESSION_KEY);
    } catch {
      /* ignore */
    }
  });

  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const errorMessage = args.map((arg) => String(arg)).join(' ');
    if (isBenignConsoleNoise(errorMessage)) {
      return;
    }
    originalError.apply(console, args);
  };

  window.addEventListener('error', (event) => {
    if (isBenignConsoleNoise(event.message || '')) {
      event.preventDefault();
      return;
    }
    if (isChunkLoadFailure(event.message || '', event.error)) {
      if (tryReloadOnceAfterChunkFailure()) event.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const errorMessage =
      (reason instanceof Error ? reason.message : '') ||
      (typeof reason === 'string' ? reason : '') ||
      String(reason ?? '');
    if (isBenignConsoleNoise(errorMessage)) {
      event.preventDefault();
      return;
    }
    if (isChunkLoadFailure(errorMessage, reason)) {
      if (tryReloadOnceAfterChunkFailure()) event.preventDefault();
    }
  });
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
