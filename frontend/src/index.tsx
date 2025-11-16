import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Suprimir erro conhecido de extensões do navegador
// Este erro ocorre quando extensões do Chrome/Edge interceptam mensagens
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || '';
    // Suprimir erro específico de extensões do navegador
    if (
      errorMessage.includes('A listener indicated an asynchronous response') ||
      errorMessage.includes('message channel closed')
    ) {
      // Silenciar este erro específico (causado por extensões do navegador)
      return;
    }
    // Manter outros erros
    originalError.apply(console, args);
  };

  // Também capturar erros não tratados relacionados a extensões
  window.addEventListener('error', (event) => {
    const errorMessage = event.message || '';
    if (
      errorMessage.includes('A listener indicated an asynchronous response') ||
      errorMessage.includes('message channel closed')
    ) {
      event.preventDefault();
      return false;
    }
  });

  // Capturar promessas rejeitadas relacionadas a extensões
  window.addEventListener('unhandledrejection', (event) => {
    const errorMessage = event.reason?.message || event.reason?.toString() || '';
    if (
      errorMessage.includes('A listener indicated an asynchronous response') ||
      errorMessage.includes('message channel closed')
    ) {
      event.preventDefault();
      return false;
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

