/**
 * MQTT Wrapper Universal - SmartDisplayFX
 * 
 * Wrapper que funciona em diferentes ambientes:
 * - Browser (webOS, Tizen, Android TV): usa CDN ou WebSocket nativo
 * - Electron: usa require('mqtt')
 * - Node.js: usa require('mqtt')
 * 
 * API:
 *   const mqtt = getMqttClient();
 *   if (mqtt) {
 *     const client = mqtt.connect(url, options);
 *   }
 */

/**
 * Detecta e retorna a biblioteca MQTT disponível no ambiente atual
 * @returns {Object|null} Biblioteca MQTT ou null se não disponível
 */
export function getMqttClient() {
  // 1. Browser com CDN (window.mqtt)
  if (typeof window !== 'undefined' && window.mqtt) {
    return window.mqtt;
  }

  // 2. Electron/Node.js com require
  if (typeof require !== 'undefined') {
    try {
      return require('mqtt');
    } catch (e) {
      // mqtt não instalado ou require não disponível
      return null;
    }
  }

  // 3. WebSocket nativo (fallback para implementação custom)
  // Por enquanto, retorna null e deixa o transporte usar WebSocket nativo
  return null;
}

/**
 * Cria uma conexão MQTT usando o método disponível
 * @param {string} url - URL do broker (ws://, wss://, mqtt://, mqtts://)
 * @param {Object} options - Opções de conexão MQTT
 * @returns {Object|null} Cliente MQTT ou null se não disponível
 */
export function createMqttConnection(url, options = {}) {
  const mqtt = getMqttClient();
  
  if (!mqtt) {
    return null;
  }

  try {
    return mqtt.connect(url, options);
  } catch (e) {
    console.error('Erro ao criar conexão MQTT:', e);
    return null;
  }
}

/**
 * Verifica se MQTT está disponível no ambiente atual
 * @returns {boolean}
 */
export function isMqttAvailable() {
  return getMqttClient() !== null;
}

/**
 * Obtém informações sobre o ambiente MQTT
 * @returns {Object} Informações do ambiente
 */
export function getMqttEnvironment() {
  const mqtt = getMqttClient();
  
  return {
    available: mqtt !== null,
    source: mqtt ? (
      typeof window !== 'undefined' && window.mqtt ? 'window.mqtt (CDN)' :
      typeof require !== 'undefined' ? 'require("mqtt") (npm)' :
      'unknown'
    ) : 'none',
    hasWebSocket: typeof WebSocket !== 'undefined',
    hasRequire: typeof require !== 'undefined',
    hasWindow: typeof window !== 'undefined'
  };
}
