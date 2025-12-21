/**
 * SmartDisplayFX Configuration
 * 
 * Configuração de MQTT e backend para SmartDisplayFX.
 * Pode ser sobrescrita por variáveis de ambiente ou configuração do app.
 */

export const mqttConfig = {
  // URL do broker MQTT (WebSocket ou TCP)
  url: typeof window !== 'undefined' && window.APP_CONFIG?.mqttUrl 
    ? window.APP_CONFIG.mqttUrl 
    : process.env.SMARTDISPLAYFX_MQTT_URL || 'ws://localhost:9001',
  
  // Prefixo dos tópicos MQTT
  prefix: typeof window !== 'undefined' && window.APP_CONFIG?.mqttPrefix 
    ? window.APP_CONFIG.mqttPrefix 
    : process.env.SMARTDISPLAYFX_MQTT_PREFIX || 'smartdisplay',
  
  // Credenciais (opcionais)
  username: typeof window !== 'undefined' && window.APP_CONFIG?.mqttUsername 
    ? window.APP_CONFIG.mqttUsername 
    : process.env.SMARTDISPLAYFX_MQTT_USERNAME || undefined,
  
  password: typeof window !== 'undefined' && window.APP_CONFIG?.mqttPassword 
    ? window.APP_CONFIG.mqttPassword 
    : process.env.SMARTDISPLAYFX_MQTT_PASSWORD || undefined,
};

export const backendConfig = {
  // URL base da API do backend
  baseUrl: typeof window !== 'undefined' && window.APP_CONFIG?.apiUrl 
    ? window.APP_CONFIG.apiUrl 
    : process.env.API_URL || 'http://localhost:3000/api',
  
  // Função para obter token de autenticação
  getAuthToken: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('token');
    }
    return null;
  },
};

