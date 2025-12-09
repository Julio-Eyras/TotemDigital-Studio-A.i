/**
 * SmartDisplayFX Configuration Loader
 * 
 * Carrega configuração do site (broker_url, etc.) do backend
 * e fornece configuração pronta para o SmartDisplayFlowClient
 */

/**
 * Carrega configuração do site do backend
 * @param {string} backendBaseUrl - URL base do backend (ex: 'http://localhost:3000')
 * @param {string} siteId - ID do site
 * @param {Function} getAuthToken - Função opcional para obter token de autenticação
 * @returns {Promise<Object>} Configuração do site
 */
export async function loadSiteConfig(backendBaseUrl, siteId, getAuthToken = null) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    
    if (typeof getAuthToken === 'function') {
      const token = await getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${backendBaseUrl}/api/smartdisplayfx/sites/${siteId}/config`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro ao carregar configuração do site: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('Resposta inválida do servidor');
    }

    return result.data;
  } catch (error) {
    console.error('Erro ao carregar configuração do site:', error);
    throw error;
  }
}

/**
 * Cria opções para SmartDisplayFlowClient a partir da configuração do site
 * @param {Object} siteConfig - Configuração do site retornada por loadSiteConfig
 * @param {Object} overrides - Opções para sobrescrever (opcional)
 * @returns {Object} Opções para SmartDisplayFlowClient
 */
export function createClientOptions(siteConfig, overrides = {}) {
  const brokerConfig = siteConfig.broker_config || {};
  const topics = brokerConfig.topics || {};

  // Construir URL do broker
  let brokerUrl = siteConfig.broker_url;
  if (!brokerUrl) {
    // Fallback: tentar construir a partir do broker_config
    if (brokerConfig.host && brokerConfig.port) {
      const protocol = brokerConfig.ssl ? 'wss://' : 'ws://';
      brokerUrl = `${protocol}${brokerConfig.host}:${brokerConfig.port}`;
    } else {
      // Último fallback
      brokerUrl = 'ws://localhost:9001';
    }
  }

  // Construir opções MQTT
  const mqttOptions = {
    username: brokerConfig.username || undefined,
    password: brokerConfig.password || undefined,
    clientId: `smartdisplayfx_${siteConfig.site_id}_${Date.now()}`,
    reconnectPeriod: 5000,
    keepalive: 60,
    ...brokerConfig.mqtt_options,
    ...overrides.mqttOptions,
  };

  return {
    transportType: 'auto', // Tenta MQTT primeiro, fallback para LocalStorage
    mqttUrl: brokerUrl,
    mqttPrefix: siteConfig.mqtt_prefix || 'smartdisplay',
    mqttOptions,
    ...overrides,
  };
}

/**
 * Carrega configuração e cria opções para SmartDisplayFlowClient em uma única chamada
 * @param {string} backendBaseUrl - URL base do backend
 * @param {string} siteId - ID do site
 * @param {Function} getAuthToken - Função opcional para obter token
 * @param {Object} overrides - Opções para sobrescrever
 * @returns {Promise<Object>} Opções prontas para SmartDisplayFlowClient
 */
export async function loadAndCreateClientOptions(backendBaseUrl, siteId, getAuthToken = null, overrides = {}) {
  const siteConfig = await loadSiteConfig(backendBaseUrl, siteId, getAuthToken);
  return createClientOptions(siteConfig, overrides);
}
