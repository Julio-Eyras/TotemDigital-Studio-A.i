/**
 * MQTTClient - Cliente MQTT para SmartDisplayFX
 * Gerencia conexão MQTT over WebSocket
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { Config } from '../core/Config';

export type MessageHandler = (topic: string, message: any) => void;

export class MQTTClient {
  private config: Config;
  private client: MqttClient | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Conecta ao broker MQTT
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const brokerUrl = this.config.getValue('brokerUrl');
      const brokerConfig = this.config.getValue('brokerConfig') || {};
      const totemId = this.config.getValue('totemId');
      const siteId = this.config.getValue('siteId');

      const options: IClientOptions = {
        clientId: brokerConfig.clientId || `smartdisplayfx_${totemId}_${Date.now()}`,
        username: brokerConfig.username,
        password: brokerConfig.password,
        keepalive: brokerConfig.keepalive || 60,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
      };

      console.log(`🔌 Conectando ao broker MQTT: ${brokerUrl}`);

      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        console.log('✅ Conectado ao broker MQTT');
        this.isConnected = true;
        this.reconnectAttempts = 0;

        // Subscrever nos topics do site
        const topics = [
          `smartdisplay/${siteId}/effect`,
          `smartdisplay/${siteId}/timeline`,
          `smartdisplay/${siteId}/sync_time`,
          `smartdisplay/${siteId}/telemetry`,
        ];

        topics.forEach(topic => {
          this.client?.subscribe(topic, { qos: 1 }, (err) => {
            if (err) {
              console.error(`Erro ao subscrever em ${topic}:`, err);
            } else {
              console.log(`📡 Inscrito em ${topic}`);
            }
          });
        });

        resolve();
      });

      this.client.on('error', (error) => {
        console.error('❌ Erro MQTT:', error);
        this.isConnected = false;
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.client.on('reconnect', () => {
        this.reconnectAttempts++;
        console.log(`🔄 Reconectando... (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Máximo de tentativas de reconexão atingido');
          this.client?.end();
        }
      });

      this.client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(topic, data);
        } catch (error) {
          console.error('Erro ao processar mensagem MQTT:', error);
        }
      });

      this.client.on('close', () => {
        console.log('🔌 Conexão MQTT fechada');
        this.isConnected = false;
      });
    });
  }

  /**
   * Desconecta do broker
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      console.log('🔌 Desconectado do broker MQTT');
    }
  }

  /**
   * Registra handler para mensagens
   */
  onMessage(handler: MessageHandler): void {
    const key = 'all';
    if (!this.handlers.has(key)) {
      this.handlers.set(key, []);
    }
    this.handlers.get(key)!.push(handler);
  }

  /**
   * Processa mensagem recebida
   */
  private handleMessage(topic: string, message: any): void {
    // Notificar todos os handlers
    const allHandlers = this.handlers.get('all') || [];
    allHandlers.forEach(handler => {
      try {
        handler(topic, message);
      } catch (error) {
        console.error('Erro em handler de mensagem:', error);
      }
    });
  }

  /**
   * Publica mensagem
   */
  publish(topic: string, message: any, options?: { qos?: number; retain?: boolean }): void {
    if (!this.client || !this.isConnected) {
      console.warn('⚠️ Cliente MQTT não conectado, mensagem não enviada');
      return;
    }

    const payload = JSON.stringify(message);
    this.client.publish(topic, payload, options || { qos: 0 }, (error) => {
      if (error) {
        console.error('Erro ao publicar mensagem:', error);
      }
    });
  }

  /**
   * Verifica se está conectado
   */
  isConnectedToBroker(): boolean {
    return this.isConnected;
  }
}

