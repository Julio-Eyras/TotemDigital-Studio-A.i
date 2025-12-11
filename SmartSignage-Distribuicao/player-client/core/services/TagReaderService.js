/**
 * Tag Reader Service - Smart Signage Pro v2.1
 * Serviço para leitura de tags (RFID/NFC/QR Code)
 */

class TagReaderService {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      types: config.types || ['rfid', 'nfc', 'qr_code'],
      readInterval: config.readInterval || 100,
      tagTimeout: config.tagTimeout || 5000,
      ...config
    };

    this.readers = [];
    this.activeTags = new Map();
    this.onTagDetectedCallback = null;
    this.readingActive = false;
    this.qrCodeScanner = null;
  }

  /**
   * Inicializa leitores disponíveis
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('[TagReader] Serviço desabilitado');
      return;
    }

    try {
      // 1. Verificar e inicializar leitores disponíveis
      if (this.config.types.includes('nfc') && await this.hasNFCReader()) {
        await this.initNFCReader();
      }

      if (this.config.types.includes('qr_code')) {
        await this.initQRCodeReader();
      }

      if (this.config.types.includes('rfid') && await this.hasRFIDReader()) {
        await this.initRFIDReader();
      }

      // 2. Iniciar leitura contínua
      this.startReading();

      console.log('[TagReader] Serviço inicializado com sucesso');
    } catch (error) {
      console.error('[TagReader] Erro ao inicializar:', error);
      throw error;
    }
  }

  /**
   * Verifica se há leitor NFC disponível
   */
  async hasNFCReader() {
    // Web NFC API (Chrome/Edge Android)
    if ('NDEFReader' in window) {
      return true;
    }

    // Verificar se há leitor NFC físico conectado
    // (implementação específica da plataforma)
    return false;
  }

  /**
   * Inicializa leitor NFC
   */
  async initNFCReader() {
    if ('NDEFReader' in window) {
      try {
        const reader = new NDEFReader();
        
        reader.onreading = (event) => {
          this.handleNFCTag(event);
        };

        reader.onreadingerror = (error) => {
          console.error('[TagReader] Erro ao ler NFC:', error);
        };

        await reader.scan();
        this.readers.push({ type: 'nfc', reader });
        console.log('[TagReader] Leitor NFC inicializado');
      } catch (error) {
        console.warn('[TagReader] NFC não disponível:', error);
      }
    }
  }

  /**
   * Inicializa leitor QR Code
   */
  async initQRCodeReader() {
    // Usar biblioteca como jsQR ou QuaggaJS
    // Por enquanto, criar estrutura básica
    
    // Verificar se há câmera disponível
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      // Criar elemento de vídeo para scanner
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.style.display = 'none';
      document.body.appendChild(video);

      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      this.qrCodeScanner = {
        video,
        stream,
        scanning: false
      };

      // Iniciar scan de QR Code
      this.startQRCodeScanning();

      console.log('[TagReader] Leitor QR Code inicializado');
    } catch (error) {
      console.warn('[TagReader] QR Code não disponível:', error);
    }
  }

  /**
   * Inicia scan de QR Code
   */
  async startQRCodeScanning() {
    if (!this.qrCodeScanner || this.qrCodeScanner.scanning) return;

    this.qrCodeScanner.scanning = true;

    // Carregar jsQR se disponível
    if (typeof jsQR === 'undefined') {
      // Tentar carregar dinamicamente
      await this.loadQRCodeLibrary();
    }

    const scan = async () => {
      if (!this.qrCodeScanner || !this.qrCodeScanner.scanning) return;

      try {
        const video = this.qrCodeScanner.video;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        if (typeof jsQR !== 'undefined') {
          const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height));
          
          if (code && code.data) {
            await this.handleQRCode(code.data);
          }
        }

        // Continuar scan
        requestAnimationFrame(scan);
      } catch (error) {
        console.error('[TagReader] Erro no scan QR Code:', error);
        setTimeout(scan, 100);
      }
    };

    scan();
  }

  /**
   * Carrega biblioteca QR Code
   */
  async loadQRCodeLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof jsQR !== 'undefined') {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Verifica se há leitor RFID disponível
   */
  async hasRFIDReader() {
    // Verificar se há leitor RFID físico conectado
    // (implementação específica da plataforma - geralmente via USB/Serial)
    // Por enquanto, retornar false
    return false;
  }

  /**
   * Inicializa leitor RFID
   */
  async initRFIDReader() {
    // Implementação específica da plataforma
    // Exemplo: comunicação serial com leitor RFID USB
    console.warn('[TagReader] RFID não implementado ainda (requer hardware específico)');
  }

  /**
   * Loop de leitura contínua
   */
  startReading() {
    if (this.readingActive) return;
    
    this.readingActive = true;
    console.log('[TagReader] Iniciando leitura contínua');

    // Limpar tags expiradas periodicamente
    setInterval(() => {
      this.cleanExpiredTags();
    }, 1000);
  }

  /**
   * Processa tag NFC detectada
   */
  async handleNFCTag(event) {
    const tagId = this.extractTagId(event);
    const tagData = this.extractTagData(event);

    await this.processTag({
      id: tagId,
      type: 'nfc',
      data: tagData,
      timestamp: new Date()
    });
  }

  /**
   * Processa QR Code detectado
   */
  async handleQRCode(data) {
    // Verificar cooldown
    const now = Date.now();
    const lastRead = this.activeTags.get(data);
    if (lastRead && (now - lastRead.detectedAt.getTime()) < this.config.tagTimeout) {
      return; // Tag já foi processada recentemente
    }

    await this.processTag({
      id: data,
      type: 'qr_code',
      data: { raw: data },
      timestamp: new Date()
    });
  }

  /**
   * Extrai ID da tag NFC
   */
  extractTagId(event) {
    // Tentar extrair ID único da tag
    if (event.message && event.message.records && event.message.records.length > 0) {
      const record = event.message.records[0];
      if (record.id) {
        return record.id;
      }
    }

    // Usar serial number se disponível
    if (event.serialNumber) {
      return event.serialNumber;
    }

    // Gerar ID baseado em hash dos dados
    return this.hashTagData(event);
  }

  /**
   * Extrai dados da tag NFC
   */
  extractTagData(event) {
    const data = {};

    if (event.message && event.message.records) {
      event.message.records.forEach((record, index) => {
        data[`record_${index}`] = {
          recordType: record.recordType,
          mediaType: record.mediaType,
          data: this.decodeNDEFRecord(record)
        };
      });
    }

    return data;
  }

  /**
   * Decodifica registro NDEF
   */
  decodeNDEFRecord(record) {
    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      return decoder.decode(record.data);
    } else if (record.recordType === 'url') {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(record.data);
    } else {
      // Dados binários
      return Array.from(new Uint8Array(record.data));
    }
  }

  /**
   * Gera hash dos dados da tag
   */
  hashTagData(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `tag_${Math.abs(hash)}`;
  }

  /**
   * Processa tag detectada
   */
  async processTag(tag) {
    console.log('[TagReader] Tag detectada:', tag);

    // 1. Verificar se tag já está ativa (evitar duplicatas)
    if (this.activeTags.has(tag.id)) {
      const existing = this.activeTags.get(tag.id);
      const timeSinceDetection = Date.now() - existing.detectedAt.getTime();
      
      if (timeSinceDetection < this.config.tagTimeout) {
        return; // Tag já processada recentemente
      }
    }

    // 2. Registrar tag como ativa
    this.activeTags.set(tag.id, {
      id: tag.id,
      type: tag.type,
      detectedAt: tag.timestamp,
      data: tag.data
    });

    // 3. Buscar conteúdo associado à tag
    const contentId = await this.getContentForTag(tag.id);

    // 4. Enviar sinal de interrupção
    await this.triggerInterrupt({
      type: 'tag_id',
      priority: 3, // INTERACTIVE
      contentId: contentId,
      duration: 10000, // 10 segundos
      metadata: {
        tagId: tag.id,
        tagType: tag.type,
        tagData: tag.data
      }
    });

    // 5. Remover tag após timeout (evitar repetição)
    setTimeout(() => {
      this.activeTags.delete(tag.id);
    }, this.config.tagTimeout);
  }

  /**
   * Busca conteúdo associado à tag
   */
  async getContentForTag(tagId) {
    // 1. Verificar cache local
    const cacheKey = `tag_content_${tagId}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      // Verificar se cache não expirou (1 hora)
      if (Date.now() - data.timestamp < 3600000) {
        return data.contentId;
      }
    }

    // 2. Buscar no servidor
    try {
      const apiClient = window.apiClient;
      if (apiClient) {
        const response = await apiClient.get(`/api/tags/${tagId}/content`);
        
        if (response.data && response.data.contentId) {
          // Cachear resultado
          localStorage.setItem(cacheKey, JSON.stringify({
            contentId: response.data.contentId,
            timestamp: Date.now()
          }));

          return response.data.contentId;
        }
      }
    } catch (error) {
      console.error('[TagReader] Erro ao buscar conteúdo:', error);
    }

    // 3. Conteúdo padrão configurado
    if (this.config.defaultContentId) {
      return this.config.defaultContentId;
    }

    // 4. Retornar null (player usará conteúdo padrão)
    return null;
  }

  /**
   * Envia sinal de interrupção
   */
  async triggerInterrupt(signal) {
    console.log('[TagReader] Enviando sinal de interrupção:', signal);

    // Enviar para InterruptionManager
    const interruptionManager = window.interruptionManager;
    if (interruptionManager) {
      await interruptionManager.handleInterrupt(signal);
    }

    // Callback customizado
    if (this.onTagDetectedCallback) {
      this.onTagDetectedCallback(signal);
    }
  }

  /**
   * Limpa tags expiradas
   */
  cleanExpiredTags() {
    const now = Date.now();
    for (const [tagId, tagInfo] of this.activeTags.entries()) {
      const age = now - tagInfo.detectedAt.getTime();
      if (age > this.config.tagTimeout * 2) {
        this.activeTags.delete(tagId);
      }
    }
  }

  /**
   * Para leitura
   */
  stop() {
    this.readingActive = false;

    // Parar leitores NFC
    for (const reader of this.readers) {
      if (reader.type === 'nfc' && reader.reader.abort) {
        reader.reader.abort();
      }
    }

    // Parar scanner QR Code
    if (this.qrCodeScanner) {
      this.qrCodeScanner.scanning = false;
      if (this.qrCodeScanner.stream) {
        this.qrCodeScanner.stream.getTracks().forEach(track => track.stop());
      }
      if (this.qrCodeScanner.video) {
        this.qrCodeScanner.video.remove();
      }
      this.qrCodeScanner = null;
    }

    this.readers = [];
    this.activeTags.clear();

    console.log('[TagReader] Serviço parado');
  }

  /**
   * Callbacks
   */
  onTagDetected(callback) {
    this.onTagDetectedCallback = callback;
  }

  /**
   * Obtém status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      readingActive: this.readingActive,
      activeTags: this.activeTags.size,
      readers: this.readers.map(r => r.type)
    };
  }
}

// Exportar
if (typeof window !== 'undefined') {
  window.TagReaderService = TagReaderService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TagReaderService;
}

