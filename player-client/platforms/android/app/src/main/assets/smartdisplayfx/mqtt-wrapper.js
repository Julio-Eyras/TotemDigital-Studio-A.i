/**
 * MQTT Wrapper - Compatibilidade entre CDN e npm
 * 
 * Tenta carregar MQTT de diferentes fontes:
 * 1. window.mqtt (CDN - webOS/Tizen)
 * 2. require('mqtt') (npm - Electron)
 * 3. import('mqtt') (ES6 modules)
 */

let mqttClient = null;

// Tentar carregar via window.mqtt (CDN)
if (typeof window !== 'undefined' && window.mqtt) {
  mqttClient = window.mqtt;
}

// Tentar carregar via require (CommonJS - Electron)
if (!mqttClient && typeof require !== 'undefined') {
  try {
    mqttClient = require('mqtt');
  } catch (e) {
    // require não disponível ou mqtt não instalado
  }
}

// Tentar carregar via import dinâmico (ES6 modules)
if (!mqttClient && typeof window !== 'undefined') {
  // Será carregado dinamicamente quando necessário
}

export function getMqttClient() {
  return mqttClient;
}

export function setMqttClient(client) {
  mqttClient = client;
}

export async function loadMqttClient() {
  if (mqttClient) {
    return mqttClient;
  }

  // Tentar import dinâmico
  if (typeof window !== 'undefined') {
    try {
      const mqttModule = await import('mqtt');
      mqttClient = mqttModule.default || mqttModule;
      return mqttClient;
    } catch (e) {
      console.warn('Failed to load mqtt via dynamic import', e);
    }
  }

  return null;
}

