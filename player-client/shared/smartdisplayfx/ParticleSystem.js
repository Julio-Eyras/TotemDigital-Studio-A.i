/**
 * ParticleSystem - Sistema de partículas avançado com física
 */

export class Particle {
  constructor(x, y, vx = 0, vy = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = 1.0; // 1.0 = vivo, 0.0 = morto
    this.decay = 0.02; // Taxa de decaimento
    this.size = 2;
    this.color = '#ffffff';
    this.gravity = 0;
    this.friction = 0.98;
    this.trail = []; // Histórico de posições para trail
    this.maxTrailLength = 5;
  }

  update(deltaTime = 16.67) {
    // Aplicar física
    this.vy += this.gravity * (deltaTime / 16.67);
    
    // Aplicar atrito
    this.vx *= this.friction;
    this.vy *= this.friction;
    
    // Atualizar posição
    this.x += this.vx * (deltaTime / 16.67);
    this.y += this.vy * (deltaTime / 16.67);
    
    // Adicionar ao trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.maxTrailLength) {
      this.trail.shift();
    }
    
    // Decaimento de vida
    this.life -= this.decay * (deltaTime / 16.67);
    
    return this.life > 0;
  }

  draw(ctx) {
    if (this.life <= 0) return;
    
    const alpha = this.life;
    
    // Desenhar trail
    if (this.trail.length > 1) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }
    
    // Desenhar partícula
    ctx.fillStyle = this.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class ParticleEmitter {
  constructor(x, y, config = {}) {
    this.x = x;
    this.y = y;
    this.particles = [];
    this.config = {
      count: config.count || 20,
      speed: config.speed || 2,
      spread: config.spread || Math.PI * 2,
      gravity: config.gravity || 0.1,
      decay: config.decay || 0.02,
      size: config.size || 2,
      color: config.color || '#ffffff',
      burst: config.burst || false, // true = todas de uma vez, false = contínuo
      rate: config.rate || 5, // partículas por frame (se não burst)
      ...config,
    };
    
    this.lastEmitTime = Date.now();
    this.emittedCount = 0;
  }

  emit() {
    if (this.config.burst) {
      // Emitir todas de uma vez
      for (let i = 0; i < this.config.count; i++) {
        this._createParticle();
      }
    } else {
      // Emitir continuamente
      const now = Date.now();
      const timeSinceLastEmit = now - this.lastEmitTime;
      const emitInterval = 1000 / this.config.rate;
      
      if (timeSinceLastEmit >= emitInterval && this.emittedCount < this.config.count) {
        this._createParticle();
        this.lastEmitTime = now;
        this.emittedCount++;
      }
    }
  }

  _createParticle() {
    const angle = (Math.random() * this.config.spread) - (this.config.spread / 2);
    const speed = this.config.speed * (0.5 + Math.random() * 0.5);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    
    const particle = new Particle(this.x, this.y, vx, vy);
    particle.gravity = this.config.gravity;
    particle.decay = this.config.decay;
    particle.size = this.config.size * (0.5 + Math.random() * 0.5);
    particle.color = this.config.color;
    particle.maxTrailLength = this.config.trailLength || 5;
    
    this.particles.push(particle);
  }

  update(deltaTime = 16.67) {
    // Emitir novas partículas
    if (this.emittedCount < this.config.count) {
      this.emit();
    }
    
    // Atualizar partículas existentes
    this.particles = this.particles.filter(particle => {
      return particle.update(deltaTime);
    });
  }

  draw(ctx) {
    this.particles.forEach(particle => {
      particle.draw(ctx);
    });
  }

  isComplete() {
    return this.emittedCount >= this.config.count && this.particles.length === 0;
  }
}

