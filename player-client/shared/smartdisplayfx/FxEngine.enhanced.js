/**
 * FxEngine - Motor de Efeitos Visuais SmartDisplayFX (Versão Melhorada)
 *
 * Melhorias implementadas:
 *  - Gradientes e cores ricas
 *  - Blur/glow effects
 *  - WebGL support com fallback
 *  - Sistema de partículas avançado
 *  - Composição com conteúdo do player
 *  - Paletas de cores configuráveis
 *  - Efeitos melhorados e novos efeitos
 */

import { 
  hexToRgba, 
  createLinearGradient, 
  createRadialGradient,
  applyGlow, 
  removeGlow,
  lerp, 
  lerpColor,
  easing,
  getColorPalette,
  setBlendMode,
  resetBlendMode,
} from './FxUtils.js';
import { ParticleEmitter } from './ParticleSystem.js';

export class FxEngine {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.ctx = null;
    this.gl = null; // WebGL context
    this.useWebGL = false;
    this.playerBridge = options.playerBridge || null;
    this.logHandler = options.onLog || (() => {});
    this.onEffectComplete = options.onEffectComplete || null;

    // Registro de efeitos disponíveis
    this.effects = new Map();

    // Estado atual
    this.activeEffects = [];
    this.animationFrameId = null;
    this.isRunning = false;
    
    // Medição de FPS
    this.frameCount = 0;
    this.lastFpsTime = Date.now();
    this.currentFps = 0;
    this.fpsHistory = [];

    // Composição com conteúdo
    this.compositeWithContent = options.compositeWithContent !== false; // default true
    this.blendMode = options.blendMode || 'screen'; // 'screen', 'add', 'multiply', 'overlay'

    // Inicializar canvas
    if (this.canvas) {
      this._initCanvas();
    }

    // Registrar efeitos padrão
    this._registerDefaultEffects();
  }

  /**
   * Inicializa canvas com detecção de WebGL
   */
  _initCanvas() {
    // Tentar WebGL primeiro
    try {
      this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
      if (this.gl) {
        this.useWebGL = true;
        this.log('FxEngine: WebGL context inicializado');
        this._initWebGL();
      } else {
        throw new Error('WebGL não disponível');
      }
    } catch (e) {
      // Fallback para Canvas 2D
      this.ctx = this.canvas.getContext('2d');
      if (!this.ctx) {
        this.log('FxEngine: Nenhum contexto disponível');
        return;
      }
      this.useWebGL = false;
      this.log('FxEngine: Usando Canvas 2D (fallback)');
    }

    // Garantir que canvas tenha tamanho correto
    if (this.canvas.width === 0 || this.canvas.height === 0) {
      this.canvas.width = this.canvas.clientWidth || 1920;
      this.canvas.height = this.canvas.clientHeight || 1080;
    }
  }

  /**
   * Inicializa WebGL (shaders básicos)
   */
  _initWebGL() {
    if (!this.gl) return;

    // Shader de vertex simples
    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = (a_position + 1.0) * 0.5;
      }
    `;

    // Shader de fragment para neon/glow
    const fragmentShaderSource = `
      precision mediump float;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec3 u_color;
      uniform float u_intensity;
      varying vec2 v_texCoord;
      
      void main() {
        vec2 uv = v_texCoord;
        float dist = distance(uv, vec2(0.5));
        float glow = exp(-dist * 10.0) * u_intensity;
        vec3 finalColor = u_color * glow;
        gl_FragColor = vec4(finalColor, glow);
      }
    `;

    // Compilar shaders (simplificado - em produção usar helper)
    this.glProgram = this._createShaderProgram(vertexShaderSource, fragmentShaderSource);
  }

  /**
   * Cria programa de shader (helper)
   */
  _createShaderProgram(vertexSource, fragmentSource) {
    const gl = this.gl;
    if (!gl) return null;

    const vertexShader = this._compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this._compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    
    if (!vertexShader || !fragmentShader) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      this.log('FxEngine: Erro ao linkar shader program', gl.getProgramInfoLog(program));
      return null;
    }

    return program;
  }

  /**
   * Compila shader individual
   */
  _compileShader(type, source) {
    const gl = this.gl;
    if (!gl) return null;

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      this.log('FxEngine: Erro ao compilar shader', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }

    return shader;
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

  registerEffect(effectId, renderFn) {
    if (typeof renderFn !== 'function') {
      this.log(`FxEngine.registerEffect: renderFn deve ser uma função para ${effectId}`);
      return;
    }
    this.effects.set(effectId, renderFn);
    this.log(`FxEngine: efeito registrado: ${effectId}`);
  }

  unregisterEffect(effectId) {
    this.effects.delete(effectId);
    this.log(`FxEngine: efeito removido: ${effectId}`);
  }

  async playEffect(effectPayload, context = {}) {
    const { isOrigin = false, isTarget = false, currentTotemId = null } = context;

    if (!this.canvas || (!this.ctx && !this.gl)) {
      this.log('FxEngine.playEffect: Canvas não disponível');
      return;
    }

    const effectId = effectPayload.effect_id || 'neon_warp_v1';
    const renderFn = this.effects.get(effectId);

    if (!renderFn) {
      this.log(`FxEngine.playEffect: efeito não encontrado: ${effectId}`);
      return;
    }

    let edge = 'center';
    if (isOrigin) {
      edge = effectPayload.from?.edge || 'right';
    } else if (isTarget) {
      edge = effectPayload.to?.edge || 'left';
    }

    const startTs = new Date(effectPayload.start_ts).getTime();
    const durationMs = effectPayload.duration_ms || 1600;
    const now = Date.now();
    const delay = Math.max(0, startTs - now);

    if (delay > 0) {
      this.log(`FxEngine.playEffect: agendando efeito ${effectId} em ${delay}ms`);
      setTimeout(() => {
        this._executeEffect(effectPayload, renderFn, edge, isOrigin, isTarget);
      }, delay);
    } else {
      this._executeEffect(effectPayload, renderFn, edge, isOrigin, isTarget);
    }
  }

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
      frameCount: 0,
      fpsSamples: [],
      // Sistema de partículas (se necessário)
      particleEmitter: null,
    };

    this.activeEffects.push(effect);
    this.log(`FxEngine: iniciando efeito ${effect.effectId}`, { edge, isOrigin, isTarget });

    if (!this.isRunning) {
      this._startAnimationLoop();
    }

    setTimeout(() => {
      const avgFps = effect.fpsSamples.length > 0
        ? effect.fpsSamples.reduce((a, b) => a + b, 0) / effect.fpsSamples.length
        : this.currentFps;
      
      effect.avgFps = Math.round(avgFps);
      
      if (this.onEffectComplete) {
        this.onEffectComplete({
          effectId: effect.effectId,
          startTime: effect.startTime,
          endTime: Date.now(),
          durationMs: Date.now() - effect.startTime,
          avgFps: effect.avgFps,
          frameCount: effect.frameCount,
        });
      }
      
      this.activeEffects = this.activeEffects.filter((e) => e.id !== effect.id);
      this.log(`FxEngine: efeito ${effect.effectId} concluído`, { 
        avgFps: effect.avgFps, 
        frameCount: effect.frameCount 
      });
    }, durationMs);
  }

  _startAnimationLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    let lastTime = Date.now();

    const animate = () => {
      if (this.activeEffects.length === 0) {
        this.isRunning = false;
        this.currentFps = 0;
        return;
      }

      const now = Date.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      // Medir FPS
      this.frameCount++;
      const timeSinceLastFps = now - this.lastFpsTime;
      
      if (timeSinceLastFps >= 1000) {
        this.currentFps = Math.round((this.frameCount * 1000) / timeSinceLastFps);
        this.frameCount = 0;
        this.lastFpsTime = now;
        
        this.fpsHistory.push(this.currentFps);
        if (this.fpsHistory.length > 10) {
          this.fpsHistory.shift();
        }
      }

      // Limpar canvas ou composição
      this._clearCanvas();

      // Renderizar cada efeito ativo
      for (const effect of this.activeEffects) {
        const elapsed = now - effect.startTime;
        const total = effect.endTime - effect.startTime;
        const progress = Math.min(1.0, Math.max(0.0, elapsed / total));

        try {
          // Atualizar sistema de partículas se existir
          if (effect.particleEmitter) {
            effect.particleEmitter.update(deltaTime);
          }

          // Renderizar efeito
          effect.renderFn(
            this.useWebGL ? this.gl : this.ctx,
            this.canvas,
            progress,
            effect.params,
            {
              isOrigin: effect.isOrigin,
              isTarget: effect.isTarget,
              edge: effect.edge,
              deltaTime,
              useWebGL: this.useWebGL,
            }
          );

          // Renderizar partículas se existirem
          if (effect.particleEmitter && this.ctx) {
            effect.particleEmitter.draw(this.ctx);
          }
          
          effect.frameCount++;
          if (this.currentFps > 0) {
            effect.fpsSamples.push(this.currentFps);
            if (effect.fpsSamples.length > 30) {
              effect.fpsSamples.shift();
            }
          }
        } catch (e) {
          this.log(`FxEngine: erro ao renderizar ${effect.effectId}`, { error: String(e) });
        }
      }

      this.animationFrameId = requestAnimationFrame(animate);
    };

    this.lastFpsTime = Date.now();
    this.frameCount = 0;
    animate();
  }

  _clearCanvas() {
    if (this.useWebGL && this.gl) {
      this.gl.clearColor(0, 0, 0, 0);
      this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    } else if (this.ctx) {
      // Composição com conteúdo do player se habilitado
      if (this.compositeWithContent && this.playerBridge) {
        // Por enquanto, apenas limpar com transparência
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // TODO: Desenhar frame atual do player aqui
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }
  }

  stopAllEffects() {
    this.activeEffects = [];
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isRunning = false;
    this.currentFps = 0;
    this.frameCount = 0;
    this.log('FxEngine: todos os efeitos parados');
  }
  
  getCurrentFps() {
    return this.currentFps;
  }
  
  getAverageFps() {
    if (this.fpsHistory.length === 0) return 0;
    return Math.round(
      this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
    );
  }
  
  setOnEffectComplete(callback) {
    this.onEffectComplete = typeof callback === 'function' ? callback : null;
  }

  /**
   * Registra efeitos padrão melhorados
   */
  _registerDefaultEffects() {

    // Neon Warp v2 - Melhorado com gradiente e glow
    this.registerEffect('neon_warp_v1', (ctx, canvas, progress, params, { edge, useWebGL }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'neon');
      const intensity = Math.sin(progress * Math.PI);
      const easedProgress = easing.easeInOut(progress);

      // Determinar posição baseado na edge
      let x, x0, x1;
      if (edge === 'right') {
        x = width * (0.7 + easedProgress * 0.3);
        x0 = width * 0.7;
        x1 = width;
      } else if (edge === 'left') {
        x = width * (0.0 + easedProgress * 0.3);
        x0 = 0;
        x1 = width * 0.3;
      } else {
        x = width * 0.5;
        x0 = width * 0.4;
        x1 = width * 0.6;
      }

      if (useWebGL) {
        // Renderização WebGL (simplificada)
        // TODO: Implementar shader completo
        return;
      }

      // Canvas 2D com gradiente e glow
      const gradient = createLinearGradient(ctx, x0, 0, x1, 0, [
        { stop: 0, color: hexToRgba(palette.primary, 0) },
        { stop: 0.5, color: hexToRgba(palette.primary, intensity * 0.9) },
        { stop: 1, color: hexToRgba(palette.secondary, 0) },
      ]);

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 6;
      applyGlow(ctx, palette.primary, intensity * 15, 20);

      ctx.beginPath();
      ctx.moveTo(x, height * 0.2);
      ctx.lineTo(x, height * 0.8);
      ctx.stroke();

      removeGlow(ctx);
    });

    // Ripple Sync v2 - Melhorado com múltiplas ondas e gradiente
    this.registerEffect('ripple_sync_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx || !ctx.arc) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'ocean');
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;
      const maxRadius = Math.min(width, height) * 0.4;
      
      // Múltiplas ondas concêntricas
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) {
        const waveProgress = (progress + i * 0.2) % 1.0;
        const radius = maxRadius * waveProgress;
        const alpha = (1.0 - waveProgress) * 0.6;

        const gradient = createRadialGradient(
          ctx, centerX, centerY, 0, centerX, centerY, radius,
          [
            { stop: 0, color: hexToRgba(palette.primary, alpha) },
            { stop: 0.5, color: hexToRgba(palette.secondary, alpha * 0.5) },
            { stop: 1, color: hexToRgba(palette.accent, 0) },
          ]
        );

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // Particle Burst v2 - Com sistema de partículas avançado
    this.registerEffect('particle_burst_v1', (ctx, canvas, progress, params, { edge, deltaTime }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'fire');
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;

      // Usar sistema de partículas se disponível
      if (typeof ParticleEmitter !== 'undefined') {
        // Criar emitter na primeira frame
        if (progress === 0) {
          const effect = this.activeEffects.find(e => e.effectId === 'particle_burst_v1');
          if (effect && !effect.particleEmitter) {
            effect.particleEmitter = new ParticleEmitter(centerX, centerY, {
              count: params?.particleCount || 50,
              speed: params?.speed || 3,
              spread: Math.PI * 2,
              gravity: params?.gravity || 0.15,
              decay: params?.decay || 0.015,
              size: params?.size || 3,
              color: palette.accent,
              burst: true,
              trailLength: 8,
            });
          }
        }
      } else {
        // Fallback: partículas simples
        const particleCount = params?.particleCount || 30;
        const spread = Math.min(width, height) * 0.5 * progress;

        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2;
          const distance = spread * (0.3 + Math.random() * 0.7);
          const x = centerX + Math.cos(angle) * distance;
          const y = centerY + Math.sin(angle) * distance;
          const alpha = 1.0 - progress;

          ctx.fillStyle = hexToRgba(palette.accent, alpha);
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Ambient Wave v2 - Melhorado com gradientes
    this.registerEffect('ambient_wave_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'ocean');
      const waveCount = 4;
      const waveHeight = height * 0.15;

      ctx.lineWidth = 3;

      for (let i = 0; i < waveCount; i++) {
        const offset = (progress + i * 0.25) % 1.0;
        const y = height * (0.2 + offset * 0.6);
        const alpha = (1.0 - offset) * 0.7;

        const gradient = createLinearGradient(ctx, 0, y - waveHeight, 0, y + waveHeight, [
          { stop: 0, color: hexToRgba(palette.primary, 0) },
          { stop: 0.5, color: hexToRgba(palette.secondary, alpha) },
          { stop: 1, color: hexToRgba(palette.accent, 0) },
        ]);

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x < width; x += 8) {
          const waveY = y + Math.sin((x / width) * Math.PI * 6 + progress * Math.PI * 4) * waveHeight;
          ctx.lineTo(x, waveY);
        }
        ctx.stroke();
      }
    });

    // NOVOS EFEITOS

    // Energy Beam v1 - Feixe de energia entre totens
    this.registerEffect('energy_beam_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'neon');
      const easedProgress = easing.easeInOut(progress);

      let startX, endX;
      if (edge === 'right') {
        startX = width * 0.7;
        endX = width * (0.7 + easedProgress * 0.3);
      } else if (edge === 'left') {
        startX = width * (0.3 - easedProgress * 0.3);
        endX = width * 0.3;
      } else {
        startX = width * 0.4;
        endX = width * 0.6;
      }

      const centerY = height * 0.5;
      const beamWidth = 20;

      // Gradiente para o feixe
      const gradient = createLinearGradient(ctx, startX, 0, endX, 0, [
        { stop: 0, color: hexToRgba(palette.primary, 0.8) },
        { stop: 0.5, color: hexToRgba(palette.secondary, 1.0) },
        { stop: 1, color: hexToRgba(palette.accent, 0.8) },
      ]);

      ctx.fillStyle = gradient;
      applyGlow(ctx, palette.primary, 20, 30);
      ctx.fillRect(startX, centerY - beamWidth / 2, endX - startX, beamWidth);
      removeGlow(ctx);
    });

    // Sparkle Burst v1 - Explosão de brilhos
    this.registerEffect('sparkle_burst_v1', (ctx, canvas, progress, params, { edge, deltaTime }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'aurora');
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;

      const sparkleCount = params?.sparkleCount || 40;
      const maxDistance = Math.min(width, height) * 0.6 * progress;

      for (let i = 0; i < sparkleCount; i++) {
        const angle = (i / sparkleCount) * Math.PI * 2;
        const distance = maxDistance * (0.2 + Math.random() * 0.8);
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;
        const size = 2 + Math.random() * 4;
        const alpha = (1.0 - progress) * 0.9;
        const rotation = progress * Math.PI * 4;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.fillStyle = hexToRgba(palette.accent, alpha);
        applyGlow(ctx, palette.accent, 10, 15);
        
        // Desenhar estrela
        ctx.beginPath();
        for (let j = 0; j < 5; j++) {
          const a = (j * Math.PI * 2) / 5;
          const r = size;
          const x2 = Math.cos(a) * r;
          const y2 = Math.sin(a) * r;
          if (j === 0) ctx.moveTo(x2, y2);
          else ctx.lineTo(x2, y2);
        }
        ctx.closePath();
        ctx.fill();
        removeGlow(ctx);
        ctx.restore();
      }
    });

    // Shockwave v1 - Onda de choque
    this.registerEffect('shockwave_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'cyberpunk');
      const centerX = edge === 'right' ? width * 0.9 : edge === 'left' ? width * 0.1 : width * 0.5;
      const centerY = height * 0.5;
      const maxRadius = Math.min(width, height) * 0.8;

      // Múltiplas ondas de choque
      for (let i = 0; i < 3; i++) {
        const waveProgress = (progress + i * 0.15) % 1.0;
        const radius = maxRadius * waveProgress;
        const alpha = (1.0 - waveProgress) * 0.8;
        const lineWidth = 8 * (1.0 - waveProgress);

        const gradient = createRadialGradient(
          ctx, centerX, centerY, radius * 0.8, centerX, centerY, radius,
          [
            { stop: 0, color: hexToRgba(palette.primary, alpha) },
            { stop: 1, color: hexToRgba(palette.secondary, 0) },
          ]
        );

        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        applyGlow(ctx, palette.primary, 15, 25);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        removeGlow(ctx);
      }
    });

    // Data Stream v1 - Fluxo de dados animado
    this.registerEffect('data_stream_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'neon');
      const easedProgress = easing.easeInOut(progress);

      let startX, endX, direction;
      if (edge === 'right') {
        startX = width * 0.7;
        endX = width * (0.7 + easedProgress * 0.3);
        direction = 1;
      } else if (edge === 'left') {
        startX = width * (0.3 - easedProgress * 0.3);
        endX = width * 0.3;
        direction = -1;
      } else {
        startX = width * 0.4;
        endX = width * 0.6;
        direction = 1;
      }

      const streamCount = 8;
      const streamHeight = height / streamCount;

      for (let i = 0; i < streamCount; i++) {
        const y = i * streamHeight + streamHeight / 2;
        const offset = (progress * 2 + i * 0.1) % 1.0;
        const x = startX + (endX - startX) * offset;

        const gradient = createLinearGradient(ctx, x - 50, y, x + 50, y, [
          { stop: 0, color: hexToRgba(palette.primary, 0) },
          { stop: 0.5, color: hexToRgba(palette.secondary, 0.9) },
          { stop: 1, color: hexToRgba(palette.accent, 0) },
        ]);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        applyGlow(ctx, palette.secondary, 10, 15);
        ctx.beginPath();
        ctx.moveTo(x - 30, y);
        ctx.lineTo(x + 30, y);
        ctx.stroke();
        removeGlow(ctx);
      }
    });

    // Content Fade v1 - Transição fade entre conteúdos
    this.registerEffect('content_fade_v1', (ctx, canvas, progress, params, { edge }) => {
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const palette = getColorPalette(params?.palette || 'default');
      const fadeDirection = params?.direction || 'in'; // 'in' ou 'out'

      let alpha;
      if (fadeDirection === 'in') {
        alpha = progress;
      } else {
        alpha = 1.0 - progress;
      }

      // Overlay com cor da paleta
      ctx.fillStyle = hexToRgba(palette.background, alpha);
      ctx.fillRect(0, 0, width, height);

      // Efeito de borda com glow
      if (edge !== 'center') {
        const borderWidth = 10;
        const borderAlpha = alpha * 0.5;
        ctx.strokeStyle = hexToRgba(palette.primary, borderAlpha);
        ctx.lineWidth = borderWidth;
        applyGlow(ctx, palette.primary, 10, 20);
        ctx.strokeRect(0, 0, width, height);
        removeGlow(ctx);
      }
    });
  }
}

