/**
 * FxEngine - Motor de Efeitos Visuais SmartDisplayFX
 *
 * Responsável por:
 *  - registrar tipos de efeitos (neon_warp_v1, ripple_sync_v1, etc.);
 *  - renderizar efeitos em Canvas/WebGL para cada painel/totem;
 *  - expor API: playEffect(effectPayload, { isOrigin, isTarget })
 *
 * Integração:
 *  - Recebe mensagens effect_transfer do SmartDisplayFlowClient;
 *  - Comunica com o player principal via PlayerBridge;
 *  - Renderiza efeitos sobrepostos ou integrados ao conteúdo atual.
 */

export class FxEngine {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = null;
    this.playerBridge = options.playerBridge || null;
    this.logHandler = options.onLog || (() => {});

    // Registro de efeitos disponíveis
    this.effects = new Map();

    // Estado atual
    this.activeEffects = [];
    this.animationFrameId = null;
    this.isRunning = false;

    // Inicializar canvas se fornecido
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        this.log('FxEngine: Canvas 2D context não disponível, tentando WebGL...');
        this.ctx = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
      }
    }

    // Registrar efeitos padrão
    this._registerDefaultEffects();
  }

  setLogger(fn) {
    this.logHandler = typeof fn === 'function' ? fn : () => {};
  }

  log(msg, extra) {
    try {
      this.logHandler(msg, extra);
    } catch {
      // ignore
    }
  }

  /**
   * Registra um tipo de efeito.
   *
   * @param {string} effectId - ID do efeito (ex: 'neon_warp_v1')
   * @param {Function} renderFn - Função que renderiza o efeito:
   *   renderFn(ctx, canvas, progress, params, { isOrigin, isTarget })
   *   - ctx: contexto do canvas
   *   - canvas: elemento canvas
   *   - progress: 0.0 a 1.0 (progresso da animação)
   *   - params: parâmetros do efeito (do payload)
   *   - options: { isOrigin, isTarget, edge }
   */
  registerEffect(effectId, renderFn) {
    if (typeof renderFn !== 'function') {
      this.log(`FxEngine.registerEffect: renderFn deve ser uma função para ${effectId}`);
      return;
    }
    this.effects.set(effectId, renderFn);
    this.log(`FxEngine: efeito registrado: ${effectId}`);
  }

  /**
   * Remove um efeito do registro.
   */
  unregisterEffect(effectId) {
    this.effects.delete(effectId);
    this.log(`FxEngine: efeito removido: ${effectId}`);
  }

  /**
   * Executa um efeito baseado em um payload effect_transfer.
   *
   * @param {Object} effectPayload - Payload do SmartDisplayFlow:
   *   {
   *     msg_type: 'effect_transfer',
   *     effect_id: 'neon_warp_v1',
   *     from: { totem: 'TOTEM_001', edge: 'right' },
   *     to: { totem: 'TOTEM_002', edge: 'left' },
   *     content_id: 123,
   *     start_ts: '2024-01-01T12:00:00.000Z',
   *     duration_ms: 1600,
   *     params: { ... }
   *   }
   * @param {Object} context - Contexto adicional:
   *   { isOrigin: boolean, isTarget: boolean, currentTotemId: string }
   */
  async playEffect(effectPayload, context = {}) {
    const { isOrigin = false, isTarget = false, currentTotemId = null } = context;

    if (!this.canvas || !this.ctx) {
      this.log('FxEngine.playEffect: Canvas não disponível');
      return;
    }

    const effectId = effectPayload.effect_id || 'neon_warp_v1';
    const renderFn = this.effects.get(effectId);

    if (!renderFn) {
      this.log(`FxEngine.playEffect: efeito não encontrado: ${effectId}`);
      return;
    }

    // Determinar edge (borda) para renderização
    let edge = 'center';
    if (isOrigin) {
      edge = effectPayload.from?.edge || 'right';
    } else if (isTarget) {
      edge = effectPayload.to?.edge || 'left';
    }

    // Calcular timing
    const startTs = new Date(effectPayload.start_ts).getTime();
    const durationMs = effectPayload.duration_ms || 1600;
    const now = Date.now();
    const delay = Math.max(0, startTs - now);

    // Se ainda não chegou a hora, agendar
    if (delay > 0) {
      this.log(`FxEngine.playEffect: agendando efeito ${effectId} em ${delay}ms`);
      setTimeout(() => {
        this._executeEffect(effectPayload, renderFn, edge, isOrigin, isTarget);
      }, delay);
    } else {
      // Executar imediatamente
      this._executeEffect(effectPayload, renderFn, edge, isOrigin, isTarget);
    }
  }

  /**
   * Executa o efeito (interno).
   */
  _executeEffect(effectPayload, renderFn, edge, isOrigin, isTarget) {
    const durationMs = effectPayload.duration_ms || 1600;
    const startTime = Date.now();
    const endTime = startTime + durationMs;

    const effect = {
      id: `${effectPayload.effect_id}_${Date.now()}`,
      effectId: effectPayload.effect_id,
      renderFn,
      edge,
      isOrigin,
      isTarget,
      params: effectPayload.params || {},
      startTime,
      endTime,
    };

    this.activeEffects.push(effect);
    this.log(`FxEngine: iniciando efeito ${effect.effectId}`, { edge, isOrigin, isTarget });

    // Iniciar loop de animação se não estiver rodando
    if (!this.isRunning) {
      this._startAnimationLoop();
    }

    // Remover efeito após duração
    setTimeout(() => {
      this.activeEffects = this.activeEffects.filter((e) => e.id !== effect.id);
      this.log(`FxEngine: efeito ${effect.effectId} concluído`);
    }, durationMs);
  }

  /**
   * Loop de animação (requestAnimationFrame).
   */
  _startAnimationLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    const animate = () => {
      if (this.activeEffects.length === 0) {
        this.isRunning = false;
        return;
      }

      // Limpar canvas (ou fazer composição com conteúdo do player)
      this._clearCanvas();

      // Renderizar cada efeito ativo
      const now = Date.now();
      for (const effect of this.activeEffects) {
        const elapsed = now - effect.startTime;
        const total = effect.endTime - effect.startTime;
        const progress = Math.min(1.0, Math.max(0.0, elapsed / total));

        try {
          effect.renderFn(
            this.ctx,
            this.canvas,
            progress,
            effect.params,
            {
              isOrigin: effect.isOrigin,
              isTarget: effect.isTarget,
              edge: effect.edge,
            }
          );
        } catch (e) {
          this.log(`FxEngine: erro ao renderizar ${effect.effectId}`, { error: String(e) });
        }
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    animate();
  }

  /**
   * Limpa o canvas (ou faz composição com o player).
   */
  _clearCanvas() {
    if (!this.ctx || !this.canvas) return;

    // Se houver PlayerBridge, pode fazer composição
    // Por enquanto, apenas limpar
    if (this.ctx.clearRect) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Para todos os efeitos ativos.
   */
  stopAllEffects() {
    this.activeEffects = [];
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
    this.log('FxEngine: todos os efeitos parados');
  }

  /**
   * Registra efeitos padrão (implementações básicas).
   */
  _registerDefaultEffects() {
    // Neon Warp v1 - efeito de "fluxo" entre totens
    this.registerEffect('neon_warp_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx || !ctx.strokeStyle) return;

      const width = canvas.width;
      const height = canvas.height;
      const intensity = Math.sin(progress * Math.PI);

      ctx.strokeStyle = `rgba(0, 255, 255, ${0.8 * intensity})`;
      ctx.lineWidth = 4;
      ctx.beginPath();

      if (edge === 'right') {
        // Saindo pela direita
        const x = width * (0.7 + progress * 0.3);
        ctx.moveTo(x, height * 0.2);
        ctx.lineTo(x, height * 0.8);
      } else if (edge === 'left') {
        // Entrando pela esquerda
        const x = width * (0.0 + progress * 0.3);
        ctx.moveTo(x, height * 0.2);
        ctx.lineTo(x, height * 0.8);
      } else {
        // Centro (efeito local)
        const x = width * 0.5;
        ctx.moveTo(x, height * 0.2);
        ctx.lineTo(x, height * 0.8);
      }

      ctx.stroke();
    });

    // Ripple Sync v1 - efeito de "ondas" suaves
    this.registerEffect('ripple_sync_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx || !ctx.arc) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;
      const maxRadius = Math.min(width, height) * 0.3;
      const radius = maxRadius * progress;

      ctx.strokeStyle = `rgba(255, 100, 255, ${1.0 - progress})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Particle Burst v1 - efeito de "explosão" de partículas
    this.registerEffect('particle_burst_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx || !ctx.fillRect) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;
      const particleCount = 20;
      const spread = Math.min(width, height) * 0.4 * progress;

      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = spread * (0.5 + Math.random() * 0.5);
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const alpha = 1.0 - progress;

        ctx.fillStyle = `rgba(255, 200, 0, ${alpha})`;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    });

    // Ambient Wave v1 - efeito de "onda ambiente" suave
    this.registerEffect('ambient_wave_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx || !ctx.strokeStyle) return;

      const width = canvas.width;
      const height = canvas.height;
      const waveCount = 3;
      const waveHeight = height * 0.1;

      ctx.strokeStyle = `rgba(100, 200, 255, ${0.6 * (1.0 - progress)})`;
      ctx.lineWidth = 2;

      for (let i = 0; i < waveCount; i++) {
        const offset = (progress + i * 0.3) % 1.0;
        const y = height * (0.3 + offset * 0.4);

        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < width; x += 10) {
          const waveY = y + Math.sin((x / width) * Math.PI * 4 + progress * Math.PI * 2) * waveHeight;
          ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
    });
  }
}
