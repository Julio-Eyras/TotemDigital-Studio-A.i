/**
 * FxUtils - Utilitários para efeitos visuais
 * 
 * Funções auxiliares para gradientes, blur, glow, cores, etc.
 */

/**
 * Converte cor hexadecimal para RGBA
 */
export function hexToRgba(hex, alpha = 1.0) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Cria gradiente linear
 */
export function createLinearGradient(ctx, x0, y0, x1, y1, colors) {
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  colors.forEach(({ stop, color }) => {
    gradient.addColorStop(stop, color);
  });
  return gradient;
}

/**
 * Cria gradiente radial
 */
export function createRadialGradient(ctx, x0, y0, r0, x1, y1, r1, colors) {
  const gradient = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  colors.forEach(({ stop, color }) => {
    gradient.addColorStop(stop, color);
  });
  return gradient;
}

/**
 * Aplica blur gaussiano simples (aproximação)
 */
export function applyBlur(ctx, canvas, radius = 5) {
  if (!ctx.filter) {
    // Fallback: usar shadowBlur para simular blur
    ctx.shadowBlur = radius;
    ctx.shadowColor = 'transparent';
    return;
  }
  ctx.filter = `blur(${radius}px)`;
}

/**
 * Aplica glow effect usando múltiplas camadas
 */
export function applyGlow(ctx, color, intensity = 10, blur = 20) {
  ctx.shadowBlur = blur;
  ctx.shadowColor = color;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  return intensity;
}

/**
 * Remove glow
 */
export function removeGlow(ctx) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

/**
 * Interpolação linear entre dois valores
 */
export function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Interpolação de cor entre duas cores hex
 */
export function lerpColor(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  
  const r = Math.round(lerp(r1, r2, t));
  const g = Math.round(lerp(g1, g2, t));
  const b = Math.round(lerp(b1, b2, t));
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Easing functions
 */
export const easing = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => t * (2 - t),
  easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeInCubic: (t) => t * t * t,
  easeOutCubic: (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  bounce: (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  elastic: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
};

/**
 * Paletas de cores pré-definidas
 */
export const colorPalettes = {
  neon: {
    primary: '#00ffff',
    secondary: '#ff00ff',
    accent: '#ffff00',
    background: '#000000',
  },
  cyberpunk: {
    primary: '#ff0080',
    secondary: '#00ff80',
    accent: '#8000ff',
    background: '#0a0a0a',
  },
  ocean: {
    primary: '#00d4ff',
    secondary: '#0099ff',
    accent: '#0066ff',
    background: '#001122',
  },
  fire: {
    primary: '#ff4400',
    secondary: '#ff8800',
    accent: '#ffcc00',
    background: '#110000',
  },
  aurora: {
    primary: '#00ff88',
    secondary: '#88ff00',
    accent: '#00ffcc',
    background: '#001122',
  },
  default: {
    primary: '#00ffd5',
    secondary: '#6b00ff',
    accent: '#ff00ff',
    background: '#000000',
  },
};

/**
 * Obtém paleta de cores (com fallback)
 */
export function getColorPalette(paletteName = 'default') {
  return colorPalettes[paletteName] || colorPalettes.default;
}

/**
 * Aplica blend mode (se suportado)
 */
export function setBlendMode(ctx, mode = 'normal') {
  if (ctx.globalCompositeOperation) {
    ctx.globalCompositeOperation = mode;
  }
}

/**
 * Restaura blend mode padrão
 */
export function resetBlendMode(ctx) {
  if (ctx.globalCompositeOperation) {
    ctx.globalCompositeOperation = 'source-over';
  }
}

