import React from 'react';
import ReactDOM from 'react-dom/client';

// App simples para build
function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Smart Signage Pro v2.0</h1>
      <p>Sistema de Sinalização Digital Profissional</p>
      <p>Frontend em desenvolvimento - Backend funcionando!</p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px' }}>
        <h3>Status do Sistema:</h3>
        <ul>
          <li>✅ Backend: Funcionando</li>
          <li>✅ API: Disponível</li>
          <li>✅ Banco de Dados: Configurado</li>
          <li>🔄 Frontend: Em desenvolvimento</li>
        </ul>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
