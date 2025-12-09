/**
 * Facial Recognition Service - Smart Signage Pro v2.1
 * Serviço de reconhecimento facial para interação
 */

class FacialRecognitionService {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      camera: config.camera || 'front',
      detectionInterval: config.detectionInterval || 33, // 30 FPS
      minConfidence: config.minConfidence || 0.7,
      minFaceSize: config.minFaceSize || 50,
      ...config
    };

    this.camera = null;
    this.videoElement = null;
    this.faceDetector = null;
    this.recognitionActive = false;
    this.lastDetection = null;
    this.detectionCooldown = 2000; // 2 segundos entre detecções
    this.onFaceDetectedCallback = null;
  }

  /**
   * Inicializa detecção facial
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('[FacialRecognition] Serviço desabilitado');
      return;
    }

    try {
      // 1. Solicitar acesso à câmera
      const constraints = {
        video: {
          facingMode: this.config.camera === 'front' ? 'user' : 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      };

      this.camera = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[FacialRecognition] Câmera inicializada');

      // 2. Criar elemento de vídeo (oculto)
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.camera;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);

      // 3. Aguardar vídeo estar pronto
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play();
          resolve();
        };
      });

      // 4. Inicializar detector de faces
      await this.initializeFaceDetector();

      // 5. Iniciar detecção contínua
      this.startDetection();

      console.log('[FacialRecognition] Serviço inicializado com sucesso');
    } catch (error) {
      console.error('[FacialRecognition] Erro ao inicializar:', error);
      throw error;
    }
  }

  /**
   * Inicializa detector de faces
   */
  async initializeFaceDetector() {
    // Opção 1: MediaPipe Face Detection (recomendado)
    if (typeof FaceDetector !== 'undefined') {
      // Face Detection API nativa (Chrome/Edge)
      this.faceDetector = new FaceDetector({
        fastMode: true,
        maxDetectedFaces: 5
      });
      console.log('[FacialRecognition] Usando Face Detection API nativa');
      return;
    }

    // Opção 2: TensorFlow.js
    if (typeof tf !== 'undefined') {
      await this.loadTensorFlowModel();
      console.log('[FacialRecognition] Usando TensorFlow.js');
      return;
    }

    // Opção 3: MediaPipe via CDN
    await this.loadMediaPipe();
    console.log('[FacialRecognition] Usando MediaPipe');
  }

  /**
   * Carrega modelo TensorFlow.js
   */
  async loadTensorFlowModel() {
    // Carregar modelo BlazeFace ou similar
    // Exemplo: https://github.com/tensorflow/tfjs-models/tree/master/face-detection
    console.warn('[FacialRecognition] TensorFlow.js não implementado ainda');
  }

  /**
   * Carrega MediaPipe
   */
  async loadMediaPipe() {
    // Carregar MediaPipe Face Detection
    // Exemplo: https://github.com/google/mediapipe
    console.warn('[FacialRecognition] MediaPipe não implementado ainda');
  }

  /**
   * Loop de detecção
   */
  async startDetection() {
    if (this.recognitionActive) return;
    
    this.recognitionActive = true;
    console.log('[FacialRecognition] Iniciando detecção contínua');

    while (this.recognitionActive && this.camera) {
      try {
        // 1. Capturar frame
        const frame = await this.captureFrame();

        // 2. Detectar faces
        const faces = await this.detectFaces(frame);

        // 3. Processar detecções
        if (faces.length > 0) {
          await this.processFaces(faces);
        }

        // 4. Aguardar próximo frame
        await this.sleep(this.config.detectionInterval);
      } catch (error) {
        console.error('[FacialRecognition] Erro no loop de detecção:', error);
        await this.sleep(1000); // Aguardar 1 segundo em caso de erro
      }
    }
  }

  /**
   * Captura frame do vídeo
   */
  async captureFrame() {
    if (!this.videoElement || this.videoElement.readyState !== 4) {
      return null;
    }

    // Criar canvas temporário
    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);

    return canvas;
  }

  /**
   * Detecta faces no frame
   */
  async detectFaces(frame) {
    if (!frame || !this.faceDetector) return [];

    try {
      // Face Detection API nativa
      if (this.faceDetector instanceof FaceDetector) {
        const faces = await this.faceDetector.detect(frame);
        return faces.map(face => ({
          boundingBox: face.boundingBox,
          landmarks: face.landmarks,
          confidence: 1.0 // API nativa não retorna confidence
        }));
      }

      // Outros detectores...
      return [];
    } catch (error) {
      console.error('[FacialRecognition] Erro ao detectar faces:', error);
      return [];
    }
  }

  /**
   * Processa faces detectadas
   */
  async processFaces(faces) {
    // Verificar cooldown
    const now = Date.now();
    if (this.lastDetection && (now - this.lastDetection) < this.detectionCooldown) {
      return; // Aguardar cooldown
    }

    // Filtrar faces por tamanho mínimo
    const validFaces = faces.filter(face => {
      const box = face.boundingBox;
      const size = Math.min(box.width, box.height);
      return size >= this.config.minFaceSize;
    });

    if (validFaces.length === 0) return;

    // Atualizar último tempo de detecção
    this.lastDetection = now;

    // Extrair características (opcional)
    const features = await this.extractFeatures(validFaces[0]);

    // Buscar conteúdo associado
    const contentId = await this.getContentForFace(features);

    // Enviar sinal de interrupção
    await this.triggerInterrupt({
      type: 'facial_recognition',
      priority: 3, // INTERACTIVE
      contentId: contentId,
      duration: 10000, // 10 segundos
      metadata: {
        faceCount: validFaces.length,
        confidence: validFaces[0].confidence,
        features: features
      }
    });
  }

  /**
   * Extrai características da face (opcional)
   */
  async extractFeatures(face) {
    // Implementar extração de características
    // Exemplo: idade estimada, gênero, emoção
    return {
      age: null,
      gender: null,
      emotion: null
    };
  }

  /**
   * Busca conteúdo associado à face
   */
  async getContentForFace(features) {
    // Opção 1: Conteúdo padrão para qualquer rosto
    const defaultContent = this.config.defaultContentId;
    if (defaultContent) {
      return defaultContent;
    }

    // Opção 2: Buscar no servidor (reconhecimento)
    try {
      const apiClient = window.apiClient;
      if (apiClient) {
        const response = await apiClient.post('/api/facial-recognition/match', {
          features: features
        });
        if (response.data && response.data.contentId) {
          return response.data.contentId;
        }
      }
    } catch (error) {
      console.error('[FacialRecognition] Erro ao buscar conteúdo:', error);
    }

    // Opção 3: Conteúdo padrão do sistema
    return null; // Player usará conteúdo padrão
  }

  /**
   * Envia sinal de interrupção
   */
  async triggerInterrupt(signal) {
    console.log('[FacialRecognition] Enviando sinal de interrupção:', signal);

    // Enviar para InterruptionManager
    const interruptionManager = window.interruptionManager;
    if (interruptionManager) {
      await interruptionManager.handleInterrupt(signal);
    }

    // Callback customizado
    if (this.onFaceDetectedCallback) {
      this.onFaceDetectedCallback(signal);
    }
  }

  /**
   * Para detecção
   */
  stop() {
    this.recognitionActive = false;
    
    if (this.camera) {
      this.camera.getTracks().forEach(track => track.stop());
      this.camera = null;
    }

    if (this.videoElement) {
      this.videoElement.remove();
      this.videoElement = null;
    }

    console.log('[FacialRecognition] Serviço parado');
  }

  /**
   * Callbacks
   */
  onFaceDetected(callback) {
    this.onFaceDetectedCallback = callback;
  }

  /**
   * Utilitário: sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar
if (typeof window !== 'undefined') {
  window.FacialRecognitionService = FacialRecognitionService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FacialRecognitionService;
}

