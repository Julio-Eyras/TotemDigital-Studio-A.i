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

// Ruído conhecido: extensões do navegador e avisos de acessibilidade do MUI Modal.
if (typeof window !== 'undefined') {
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
