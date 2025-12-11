/**
 * Visual Network Service - Smart Signage Pro v2.1
 * Serviço para comunicação entre totens em rede
 */

class VisualNetworkService {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      signalingServer: config.signalingServer || 'ws://localhost:8080',
      maxPeers: config.maxPeers || 5,
      broadcastRadius: config.broadcastRadius || 50, // metros
      totemId: config.totemId || null,
      ...config
    };

    this.ws = null;
    this.peers = new Map();
    this.networkId = null;
    this.connected = false;
    this.onInteractionReceivedCallback = null;
  }

  /**
   * Conecta totem à rede
   */
  async connectToNetwork() {
    if (!this.config.enabled) {
      console.log('[VisualNetwork] Serviço desabilitado');
      return;
    }

    try {
      // 1. Obter ID do totem
      this.networkId = this.config.totemId || await this.getTotemId();
      
      if (!this.networkId) {
        throw new Error('Totem ID não disponível');
      }

      // 2. Conectar ao servidor de sinalização (WebSocket)
      await this.connectToSignalingServer();

      // 3. Descobrir totens próximos
      const nearbyTotems = await this.discoverNearbyTotems();

      // 4. Estabelecer conexões P2P (opcional - WebRTC)
      // Por enquanto, usar apenas WebSocket para simplicidade
      // for (const totem of nearbyTotems) {
      //   await this.connectToPeer(totem);
      // }

      this.connected = true;
      console.log('[VisualNetwork] Conectado à rede');
    } catch (error) {
      console.error('[VisualNetwork] Erro ao conectar:', error);
      throw error;
    }
  }

  /**
   * Obtém ID do totem
   */
  async getTotemId() {
    // Tentar obter do localStorage ou configuração
    const stored = localStorage.getItem('totem_id');
    if (stored) {
      return stored;
    }

    // Tentar obter do servidor via API
    try {
      const apiClient = window.apiClient;
      if (apiClient) {
        const response = await apiClient.get('/api/player/validate');
        if (response.data && response.data.totem) {
          const totemId = response.data.totem.id;
          localStorage.setItem('totem_id', totemId);
          return totemId;
        }
      }
    } catch (error) {
      console.error('[VisualNetwork] Erro ao obter totem ID:', error);
    }

    return null;
  }

  /**
   * Conecta ao servidor de sinalização
   */
  async connectToSignalingServer() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.signalingServer);

        this.ws.onopen = () => {
          console.log('[VisualNetwork] WebSocket conectado');
          
          // Registrar totem no servidor
          this.send({
            type: 'register',
            totemId: this.networkId,
            timestamp: new Date().toISOString()
          });

          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[VisualNetwork] Erro ao processar mensagem:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[VisualNetwork] Erro WebSocket:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[VisualNetwork] WebSocket desconectado');
          this.connected = false;
          
          // Tentar reconectar após 5 segundos
          setTimeout(() => {
            if (!this.connected) {
              this.connectToSignalingServer();
            }
          }, 5000);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Processa mensagens recebidas
   */
  handleMessage(message) {
    switch (message.type) {
      case 'interaction':
        this.onInteractionReceived(message.data);
        break;

      case 'nearby_totems':
        this.handleNearbyTotems(message.data);
        break;

      case 'peer_offer':
        this.handlePeerOffer(message.data);
        break;

      case 'peer_answer':
        this.handlePeerAnswer(message.data);
        break;

      case 'ice_candidate':
        this.handleICECandidate(message.data);
        break;

      default:
        console.warn('[VisualNetwork] Tipo de mensagem desconhecido:', message.type);
    }
  }

  /**
   * Descobre totens próximos
   */
  async discoverNearbyTotems() {
    // Solicitar lista de totens próximos ao servidor
    this.send({
      type: 'discover',
      totemId: this.networkId,
      radius: this.config.broadcastRadius
    });

    // Retornar lista vazia por enquanto (será preenchida via mensagem)
    return [];
  }

  /**
   * Processa lista de totens próximos
   */
  handleNearbyTotems(totems) {
    console.log('[VisualNetwork] Totens próximos:', totems);
    // Implementar conexão P2P se necessário
  }

  /**
   * Compartilha evento de interação
   */
  async broadcastInteraction(interaction) {
    if (!this.connected) {
      console.warn('[VisualNetwork] Não conectado, não é possível fazer broadcast');
      return;
    }

    const event = {
      totemId: this.networkId,
      type: interaction.type,
      timestamp: new Date().toISOString(),
      metadata: interaction.metadata
    };

    // 1. Enviar para servidor central
    this.send({
      type: 'interaction',
      data: event
    });

    // 2. Broadcast para totens próximos (via servidor)
    this.send({
      type: 'broadcast',
      data: event,
      radius: this.config.broadcastRadius
    });

    console.log('[VisualNetwork] Interação broadcasted:', event);
  }

  /**
   * Recebe interação de outro totem
   */
  onInteractionReceived(interaction) {
    console.log('[VisualNetwork] Interação recebida:', interaction);

    // Callback customizado
    if (this.onInteractionReceivedCallback) {
      this.onInteractionReceivedCallback(interaction);
    }

    // Processar interação baseado no tipo
    this.processInteraction(interaction);
  }

  /**
   * Processa interação recebida
   */
  async processInteraction(interaction) {
    switch (interaction.type) {
      case 'facial_recognition':
        // Se pessoa foi detectada em outro totem, mostrar conteúdo relacionado
        await this.showRelatedContent(interaction);
        break;

      case 'tag_id':
        // Se tag foi lida em outro totem, sincronizar
        await this.syncTagContent(interaction);
        break;

      default:
        console.log('[VisualNetwork] Tipo de interação não processado:', interaction.type);
    }
  }

  /**
   * Mostra conteúdo relacionado
   */
  async showRelatedContent(interaction) {
    // Buscar conteúdo relacionado baseado na interação
    try {
      const apiClient = window.apiClient;
      if (apiClient) {
        const response = await apiClient.post('/api/network/related-content', {
          interaction: interaction,
          totemId: this.networkId
        });

        if (response.data && response.data.contentId) {
          // Enviar sinal de interrupção para mostrar conteúdo relacionado
          const interruptionManager = window.interruptionManager;
          if (interruptionManager) {
            await interruptionManager.handleInterrupt({
              type: 'network_interaction',
              priority: 2, // CRITICAL
              contentId: response.data.contentId,
              duration: 8000,
              metadata: {
                sourceTotem: interaction.totemId,
                originalInteraction: interaction
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('[VisualNetwork] Erro ao buscar conteúdo relacionado:', error);
    }
  }

  /**
   * Sincroniza conteúdo de tag
   */
  async syncTagContent(interaction) {
    // Se mesma tag foi lida em outro totem, pode sincronizar conteúdo
    console.log('[VisualNetwork] Sincronizando conteúdo de tag:', interaction);
  }

  /**
   * Envia mensagem via WebSocket
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[VisualNetwork] WebSocket não está aberto');
    }
  }

  /**
   * Desconecta da rede
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Fechar conexões P2P
    for (const [peerId, peer] of this.peers) {
      peer.close();
    }
    this.peers.clear();

    this.connected = false;
    console.log('[VisualNetwork] Desconectado da rede');
  }

  /**
   * Callbacks
   */
  onInteractionReceived(callback) {
    this.onInteractionReceivedCallback = callback;
  }

  /**
   * Obtém status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      connected: this.connected,
      networkId: this.networkId,
      peers: this.peers.size,
      maxPeers: this.config.maxPeers
    };
  }

  // Métodos para WebRTC (implementação futura)
  async connectToPeer(totem) {
    // Implementar conexão WebRTC P2P
    console.warn('[VisualNetwork] WebRTC P2P não implementado ainda');
  }

  handlePeerOffer(data) {
    // Implementar handling de oferta WebRTC
  }

  handlePeerAnswer(data) {
    // Implementar handling de resposta WebRTC
  }

  handleICECandidate(data) {
    // Implementar handling de ICE candidate
  }
}

// Exportar
if (typeof window !== 'undefined') {
  window.VisualNetworkService = VisualNetworkService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VisualNetworkService;
}

