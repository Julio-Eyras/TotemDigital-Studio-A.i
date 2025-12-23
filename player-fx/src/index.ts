/**
 * SmartDisplayFX Plus Player - Entry Point
 * Ponto de entrada principal do player
 */

import { SmartDisplayFXPlayer } from './core/Player';
import { State } from './core/State';

// Obter configuração da URL ou localStorage
function getConfigFromURL(): { totemId: string; siteId: string; brokerUrl?: string; apiBaseUrl?: string } {
  const params = new URLSearchParams(window.location.search);
  const totemId = params.get('totemId') || localStorage.getItem('totemId') || '';
  const siteId = params.get('siteId') || localStorage.getItem('siteId') || '';
  const brokerUrl = params.get('brokerUrl') || undefined;
  const apiBaseUrl = params.get('apiBaseUrl') || 'http://localhost:3000';

  return { totemId, siteId, brokerUrl, apiBaseUrl };
}

// Atualizar UI de status
function updateStatusUI() {
  const state = State.getInstance();
  const stateData = state.get();

  // Status de conexão
  const connectionStatus = document.getElementById('connection-status');
  const mqttStatus = document.getElementById('mqtt-status');
  if (connectionStatus && mqttStatus) {
    connectionStatus.className = `status-indicator ${stateData.isConnected ? 'connected' : ''}`;
    mqttStatus.textContent = stateData.isConnected ? 'Conectado' : 'Desconectado';
  }

  // Totem ID
  const totemIdEl = document.getElementById('totem-id');
  if (totemIdEl) {
    totemIdEl.textContent = localStorage.getItem('totemId') || '-';
  }

  // Site ID
  const siteIdEl = document.getElementById('site-id');
  if (siteIdEl) {
    siteIdEl.textContent = localStorage.getItem('siteId') || '-';
  }

  // Efeitos ativos
  const activeEffectsEl = document.getElementById('active-effects');
  if (activeEffectsEl) {
    activeEffectsEl.textContent = String(stateData.activeEffects.size);
  }

  // Time offset
  const timeOffsetEl = document.getElementById('time-offset');
  if (timeOffsetEl) {
    timeOffsetEl.textContent = `${stateData.serverTimeOffset}ms`;
  }
}

// Inicializar player
async function initPlayer() {
  const config = getConfigFromURL();

  if (!config.totemId || !config.siteId) {
    console.error('❌ totemId e siteId são obrigatórios');
    alert('Erro: totemId e siteId são obrigatórios. Use ?totemId=XXX&siteId=YYY na URL');
    return;
  }

  // Salvar no localStorage
  localStorage.setItem('totemId', config.totemId);
  localStorage.setItem('siteId', config.siteId);

  // Criar player
  const player = new SmartDisplayFXPlayer({
    totemId: config.totemId,
    siteId: config.siteId,
    brokerUrl: config.brokerUrl,
    apiBaseUrl: config.apiBaseUrl,
    debug: true,
  });

  // Iniciar player
  try {
    await player.start();
    console.log('✅ Player iniciado com sucesso');
  } catch (error) {
    console.error('❌ Erro ao iniciar player:', error);
  }

  // Atualizar UI periodicamente
  setInterval(updateStatusUI, 1000);
  updateStatusUI();

  // Expor player globalmente para debug
  (window as any).player = player;
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlayer);
} else {
  initPlayer();
}

