/**
 * DeviceInfoService - Coleta informações únicas do hardware
 * Responsável por gerar UIN (Unique Identifier) baseado no hardware
 */

class DeviceInfoService {
  constructor() {
    this.uin = null;
    this.hardwareInfo = null;
    this.configKey = 'smartsignage_config';
  }

  /**
   * Coleta informações do hardware via webOS APIs
   * @returns {Promise<Object>} Informações do hardware
   */
  async collectHardwareInfo() {
    try {
      const info = {
        macAddress: await this.getMacAddress(),
        deviceId: await this.getDeviceId(),
        serialNumber: await this.getSerialNumber(),
        platform: 'webOS',
        hostname: await this.getHostname(),
        modelName: await this.getModelName()
      };

      // Gerar hardware hash
      info.hardwareHash = this.generateHardwareHash(info);

      this.hardwareInfo = info;
      console.log('[DeviceInfo] Hardware info coletado:', {
        ...info,
        hardwareHash: '***' // Não logar hash completo por segurança
      });

      return info;
    } catch (error) {
      console.error('[DeviceInfo] Erro ao coletar hardware info:', error);
      throw error;
    }
  }

  /**
   * Obtém MAC Address via webOS
   */
  async getMacAddress() {
    try {
      // webOS fornece via SystemInfo API
      if (typeof webOS !== 'undefined' && webOS.systemInfo) {
        const network = await this.getSystemInfo('network');
        if (network && network.macAddress) {
          return network.macAddress;
        }
      }

      // Fallback: tentar via outras APIs
      // Em alguns casos pode não estar disponível
      console.warn('[DeviceInfo] MAC Address não disponível via API padrão');
      return 'unknown';
    } catch (error) {
      console.warn('[DeviceInfo] Erro ao obter MAC Address:', error);
      return 'unknown';
    }
  }

  /**
   * Obtém Device ID do webOS
   */
  async getDeviceId() {
    try {
      if (typeof webOS !== 'undefined' && webOS.systemInfo) {
        const system = await this.getSystemInfo('system');
        if (system && system.deviceId) {
          return system.deviceId;
        }
      }

      // Fallback: usar hostname ou gerar ID baseado em outras informações
      const hostname = await this.getHostname();
      return hostname || 'webos-device-' + Date.now();
    } catch (error) {
      console.warn('[DeviceInfo] Erro ao obter Device ID:', error);
      return 'unknown';
    }
  }

  /**
   * Obtém Serial Number da TV
   */
  async getSerialNumber() {
    try {
      if (typeof webOS !== 'undefined' && webOS.systemInfo) {
        const system = await this.getSystemInfo('system');
        if (system && system.serialNumber) {
          return system.serialNumber;
        }
      }
      return 'unknown';
    } catch (error) {
      console.warn('[DeviceInfo] Erro ao obter Serial Number:', error);
      return 'unknown';
    }
  }

  /**
   * Obtém hostname do dispositivo
   */
  async getHostname() {
    try {
      return window.location.hostname || 'webos-device';
    } catch (error) {
      return 'webos-device';
    }
  }

  /**
   * Obtém nome do modelo da TV
   */
  async getModelName() {
    try {
      if (typeof webOS !== 'undefined' && webOS.systemInfo) {
        const system = await this.getSystemInfo('system');
        if (system && system.modelName) {
          return system.modelName;
        }
      }
      return 'LG-webOS';
    } catch (error) {
      return 'LG-webOS';
    }
  }

  /**
   * Helper para obter SystemInfo do webOS
   */
  async getSystemInfo(type) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof webOS !== 'undefined' && webOS.systemInfo) {
          webOS.systemInfo.getProperty(type, (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error(`SystemInfo ${type} não disponível`));
            }
          });
        } else {
          reject(new Error('webOS SystemInfo API não disponível'));
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gera UIN único baseado nas informações do hardware
   * Formato: LG_{MAC}_{DEVICEID}
   */
  generateUIN(hardwareInfo) {
    const parts = [];

    // Adicionar prefixo
    parts.push('LG');

    // Adicionar MAC (sem dois pontos)
    if (hardwareInfo.macAddress && hardwareInfo.macAddress !== 'unknown') {
      const mac = hardwareInfo.macAddress.replace(/[:-]/g, '').toUpperCase();
      parts.push(mac);
    }

    // Adicionar Device ID (primeiros 8 caracteres)
    if (hardwareInfo.deviceId && hardwareInfo.deviceId !== 'unknown') {
      const deviceId = hardwareInfo.deviceId.substring(0, 8).toUpperCase();
      parts.push(deviceId);
    }

    // Se não conseguir MAC nem Device ID, usar hash
    if (parts.length <= 1) {
      parts.push(this.simpleHash(JSON.stringify(hardwareInfo)).substring(0, 12));
    }

    const uin = parts.join('_');
    console.log('[DeviceInfo] UIN gerado:', uin);
    return uin;
  }

  /**
   * Gera hash único do hardware (para validação de duplicação)
   */
  generateHardwareHash(hardwareInfo) {
    const data = [
      hardwareInfo.macAddress,
      hardwareInfo.deviceId,
      hardwareInfo.serialNumber
    ]
      .filter(item => item && item !== 'unknown')
      .join(':');

    return this.simpleHash(data);
  }

  /**
   * Hash simples (substituir por crypto API se disponível)
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Registra totem no backend
   */
  async registerWithBackend(apiUrl) {
    try {
      const hardwareInfo = await this.collectHardwareInfo();
      const uin = this.generateUIN(hardwareInfo);

      console.log('[DeviceInfo] Registrando no backend:', { apiUrl, uin });

      const response = await fetch(`${apiUrl}/player/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uin: uin,
          hardware: hardwareInfo
        })
      });

      const result = await response.json();

      if (response.ok) {
        this.uin = uin;
        this.saveUIN(uin);
        console.log('[DeviceInfo] Registro bem-sucedido:', { uin });
        return { success: true, uin, result };
      } else {
        throw new Error(result.error || result.message || 'Registro falhou');
      }
    } catch (error) {
      console.error('[DeviceInfo] Erro ao registrar no backend:', error);
      throw error;
    }
  }

  /**
   * Obtém UIN salvo ou null
   */
  getUIN() {
    if (this.uin) {
      return this.uin;
    }

    try {
      const saved = localStorage.getItem('smartsignage_uin');
      if (saved) {
        this.uin = saved;
        return saved;
      }
    } catch (error) {
      console.warn('[DeviceInfo] Erro ao ler UIN do localStorage:', error);
    }

    return null;
  }

  /**
   * Salva UIN localmente
   */
  saveUIN(uin) {
    try {
      localStorage.setItem('smartsignage_uin', uin);
      this.uin = uin;
      console.log('[DeviceInfo] UIN salvo localmente:', uin);
    } catch (error) {
      console.error('[DeviceInfo] Erro ao salvar UIN:', error);
    }
  }

  /**
   * Salva configuração completa
   */
  saveConfig(config) {
    try {
      localStorage.setItem(this.configKey, JSON.stringify(config));
    } catch (error) {
      console.error('[DeviceInfo] Erro ao salvar config:', error);
    }
  }

  /**
   * Carrega configuração salva
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.warn('[DeviceInfo] Erro ao carregar config:', error);
    }
    return null;
  }
}

// Exportar para uso global
window.DeviceInfoService = DeviceInfoService;

