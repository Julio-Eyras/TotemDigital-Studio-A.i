/**
 * EffectEngine - Engine de Efeitos Visuais
 * Gerencia renderização de efeitos FX
 */

import { Config } from '../core/Config';
import { State } from '../core/State';
import * as THREE from 'three';

export class EffectEngine {
  private config: Config;
  private state: State;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private effects: Map<string, any> = new Map();
  private container: HTMLElement | null = null;

  constructor(config: Config) {
    this.config = config;
    this.state = State.getInstance();
  }

  /**
   * Inicializa o engine
   */
  async init(): Promise<void> {
    // Criar container
    this.container = document.getElementById('smartdisplayfx-container') || document.body;

    // Criar cena Three.js
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Criar câmera
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.z = 5;

    // Criar renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Ajustar tamanho na resize
    window.addEventListener('resize', () => this.onResize());

    console.log('✅ Effect Engine inicializado');
  }

  /**
   * Reproduz um efeito
   */
  playEffect(effectId: string, params: any, duration: number, contentId?: number | null): void {
    console.log(`🎬 Reproduzindo efeito: ${effectId}`, params);

    // Verificar limite de efeitos concorrentes
    const activeEffects = this.state.get().activeEffects;
    if (activeEffects.size >= this.config.getValue('maxConcurrentEffects')) {
      console.warn('⚠️ Limite de efeitos concorrentes atingido');
      return;
    }

    // Criar ID único para este efeito
    const effectInstanceId = `${effectId}_${Date.now()}`;

    // Registrar efeito ativo
    this.state.addActiveEffect(effectInstanceId, {
      effectId,
      startTime: this.state.getSyncedTime(),
      duration,
      params,
    });

    // Carregar e executar efeito
    this.loadAndPlayEffect(effectId, params, duration, contentId, effectInstanceId);
  }

  /**
   * Carrega e reproduz efeito
   */
  private async loadAndPlayEffect(
    effectId: string,
    params: any,
    duration: number,
    contentId: number | null | undefined,
    instanceId: string
  ): Promise<void> {
    try {
      // Por enquanto, apenas log
      // TODO: Implementar efeitos específicos
      console.log(`Efeito ${effectId} carregado e reproduzido`, {
        params,
        duration,
        contentId,
        instanceId,
      });

      // Marcar como sucesso na telemetria
      setTimeout(() => {
        this.state.queueTelemetry({
          effectId,
          status: 'success',
          duration,
          metadata: { contentId, instanceId },
        });
        this.state.removeActiveEffect(instanceId);
      }, duration);
    } catch (error) {
      console.error(`Erro ao carregar efeito ${effectId}:`, error);
      this.state.queueTelemetry({
        effectId,
        status: 'failed',
        duration: 0,
        metadata: { error: String(error) },
      });
      this.state.removeActiveEffect(instanceId);
    }
  }

  /**
   * Renderiza frame
   */
  render(currentTime: number): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    // Renderizar cena
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Limpa recursos
   */
  cleanup(): void {
    if (this.renderer && this.container) {
      this.container.removeChild(this.renderer.domElement);
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
  }

  /**
   * Ajusta tamanho na resize
   */
  private onResize(): void {
    if (!this.camera || !this.renderer || !this.container) return;

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

