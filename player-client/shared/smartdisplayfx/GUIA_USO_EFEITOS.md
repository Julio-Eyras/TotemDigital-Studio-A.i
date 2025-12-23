# 🎨 Guia de Uso dos Efeitos SmartDisplayFX

**Versão**: 2.0  
**Data**: 2025-01-15

---

## 📋 Índice

1. [Efeitos Disponíveis](#efeitos-disponíveis)
2. [Paletas de Cores](#paletas-de-cores)
3. [Parâmetros de Efeitos](#parâmetros-de-efeitos)
4. [Exemplos de Uso](#exemplos-de-uso)
5. [Criando Efeitos Customizados](#criando-efeitos-customizados)

---

## 🎯 Efeitos Disponíveis

### Efeitos Melhorados (4)

#### 1. `neon_warp_v1` - Fluxo Neon entre Totens
**Descrição**: Efeito de linha vertical com gradiente e glow que se move entre totens.

**Uso ideal**: Transferência visual de conteúdo entre totens adjacentes.

**Parâmetros**:
```javascript
{
  palette: 'neon' | 'cyberpunk' | 'ocean' | 'fire' | 'aurora' | 'default'
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'neon_warp_v1',
  from: { totem: 'TOTEM_001', edge: 'right' },
  to: { totem: 'TOTEM_002', edge: 'left' },
  duration_ms: 1600,
  params: {
    palette: 'cyberpunk'
  }
}, { isOrigin: true, isTarget: false });
```

---

#### 2. `ripple_sync_v1` - Ondas Concêntricas
**Descrição**: Múltiplas ondas concêntricas que se expandem com gradientes radiais.

**Uso ideal**: Destaque de conteúdo, sincronização visual.

**Parâmetros**:
```javascript
{
  palette: string // Paleta de cores
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'ripple_sync_v1',
  duration_ms: 2000,
  params: {
    palette: 'ocean'
  }
}, { isOrigin: false, isTarget: true });
```

---

#### 3. `particle_burst_v1` - Explosão de Partículas
**Descrição**: Partículas com física básica (gravidade) que explodem em todas as direções.

**Uso ideal**: Transições energéticas, celebrações, chamadas de atenção.

**Parâmetros**:
```javascript
{
  palette: string,
  particleCount: number, // Default: 40
  gravity: number,       // Default: 0.15
  decay: number          // Default: 0.015
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'particle_burst_v1',
  duration_ms: 1800,
  params: {
    palette: 'fire',
    particleCount: 60,
    gravity: 0.2
  }
}, { isOrigin: false, isTarget: true });
```

---

#### 4. `ambient_wave_v1` - Ondas Ambiente
**Descrição**: Ondas horizontais suaves com gradientes que fluem pela tela.

**Uso ideal**: Efeitos de fundo, atmosfera, transições suaves.

**Parâmetros**:
```javascript
{
  palette: string
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'ambient_wave_v1',
  duration_ms: 3000,
  params: {
    palette: 'aurora'
  }
}, { isOrigin: false, isTarget: false });
```

---

### Novos Efeitos (5)

#### 5. `energy_beam_v1` - Feixe de Energia
**Descrição**: Feixe de energia brilhante que se move entre totens com glow intenso.

**Uso ideal**: Transferência de conteúdo importante, destaque visual forte.

**Parâmetros**:
```javascript
{
  palette: string
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'energy_beam_v1',
  from: { totem: 'TOTEM_001', edge: 'right' },
  to: { totem: 'TOTEM_002', edge: 'left' },
  duration_ms: 1500,
  params: {
    palette: 'neon'
  }
}, { isOrigin: true, isTarget: true });
```

---

#### 6. `sparkle_burst_v1` - Explosão de Brilhos
**Descrição**: Partículas em formato de estrela que explodem com rotação e glow.

**Uso ideal**: Celebrações, eventos especiais, destaque premium.

**Parâmetros**:
```javascript
{
  palette: string,
  sparkleCount: number // Default: 40
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'sparkle_burst_v1',
  duration_ms: 2000,
  params: {
    palette: 'aurora',
    sparkleCount: 60
  }
}, { isOrigin: false, isTarget: true });
```

---

#### 7. `shockwave_v1` - Onda de Choque
**Descrição**: Múltiplas ondas de choque concêntricas que se expandem com intensidade.

**Uso ideal**: Anúncios importantes, alertas, chamadas de atenção.

**Parâmetros**:
```javascript
{
  palette: string
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'shockwave_v1',
  duration_ms: 1800,
  params: {
    palette: 'cyberpunk'
  }
}, { isOrigin: false, isTarget: true });
```

---

#### 8. `data_stream_v1` - Fluxo de Dados
**Descrição**: Múltiplos streams de dados paralelos que fluem entre totens.

**Uso ideal**: Transferência de informação, conteúdo tecnológico.

**Parâmetros**:
```javascript
{
  palette: string
}
```

**Exemplo**:
```javascript
fxEngine.playEffect({
  effect_id: 'data_stream_v1',
  from: { totem: 'TOTEM_001', edge: 'right' },
  to: { totem: 'TOTEM_002', edge: 'left' },
  duration_ms: 2000,
  params: {
    palette: 'neon'
  }
}, { isOrigin: true, isTarget: true });
```

---

#### 9. `content_fade_v1` - Transição Fade
**Descrição**: Overlay com fade in/out para transições suaves entre conteúdos.

**Uso ideal**: Mudança de conteúdo, transições entre playlists.

**Parâmetros**:
```javascript
{
  palette: string,
  direction: 'in' | 'out' // Default: 'in'
}
```

**Exemplo**:
```javascript
// Fade out (conteúdo desaparece)
fxEngine.playEffect({
  effect_id: 'content_fade_v1',
  duration_ms: 1000,
  params: {
    palette: 'default',
    direction: 'out'
  }
}, { isOrigin: false, isTarget: false });

// Fade in (conteúdo aparece)
fxEngine.playEffect({
  effect_id: 'content_fade_v1',
  duration_ms: 1000,
  params: {
    palette: 'default',
    direction: 'in'
  }
}, { isOrigin: false, isTarget: false });
```

---

## 🎨 Paletas de Cores

### 1. `neon` - Cores Neon Vibrantes
- **Primary**: `#00ffff` (Ciano)
- **Secondary**: `#ff00ff` (Magenta)
- **Accent**: `#ffff00` (Amarelo)
- **Uso**: Efeitos vibrantes, chamadas de atenção

### 2. `cyberpunk` - Estilo Cyberpunk
- **Primary**: `#ff0080` (Rosa elétrico)
- **Secondary**: `#00ff80` (Verde neon)
- **Accent**: `#8000ff` (Roxo)
- **Uso**: Conteúdo tecnológico, futurista

### 3. `ocean` - Tons de Azul Oceano
- **Primary**: `#00d4ff` (Azul claro)
- **Secondary**: `#0099ff` (Azul médio)
- **Accent**: `#0066ff` (Azul escuro)
- **Uso**: Conteúdo calmo, profissional

### 4. `fire` - Tons de Fogo
- **Primary**: `#ff4400` (Laranja)
- **Secondary**: `#ff8800` (Laranja claro)
- **Accent**: `#ffcc00` (Amarelo)
- **Uso**: Energia, urgência, promoções

### 5. `aurora` - Cores Aurora Boreal
- **Primary**: `#00ff88` (Verde água)
- **Secondary**: `#88ff00` (Verde limão)
- **Accent**: `#00ffcc` (Turquesa)
- **Uso**: Elegância, sofisticação

### 6. `default` - Paleta Padrão
- **Primary**: `#00ffd5` (Ciano claro)
- **Secondary**: `#6b00ff` (Roxo)
- **Accent**: `#ff00ff` (Magenta)
- **Uso**: Padrão, versátil

---

## ⚙️ Parâmetros de Efeitos

### Parâmetros Comuns

Todos os efeitos suportam:
- `palette`: Nome da paleta de cores (string)

### Parâmetros Específicos

#### `particle_burst_v1`
- `particleCount`: Número de partículas (number, default: 40)
- `gravity`: Força da gravidade (number, default: 0.15)
- `decay`: Taxa de decaimento (number, default: 0.015)

#### `sparkle_burst_v1`
- `sparkleCount`: Número de brilhos (number, default: 40)

#### `content_fade_v1`
- `direction`: Direção do fade ('in' | 'out', default: 'in')

---

## 💡 Exemplos de Uso

### Exemplo 1: Sequência de Efeitos

```javascript
// 1. Fade out do conteúdo atual
await fxEngine.playEffect({
  effect_id: 'content_fade_v1',
  duration_ms: 500,
  params: { direction: 'out', palette: 'default' }
}, { isOrigin: false, isTarget: false });

// 2. Mudar conteúdo do player
playerBridge.changeContent(newContentId);

// 3. Fade in do novo conteúdo
await fxEngine.playEffect({
  effect_id: 'content_fade_v1',
  duration_ms: 500,
  params: { direction: 'in', palette: 'default' }
}, { isOrigin: false, isTarget: false });
```

### Exemplo 2: Transferência entre Totens

```javascript
// Totem origem: efeito de saída
fxEngine.playEffect({
  effect_id: 'energy_beam_v1',
  from: { totem: 'TOTEM_001', edge: 'right' },
  to: { totem: 'TOTEM_002', edge: 'left' },
  content_id: 123,
  duration_ms: 1600,
  params: { palette: 'neon' }
}, { isOrigin: true, isTarget: false });

// Totem destino: efeito de entrada (recebido via MQTT)
// O backend publica automaticamente para o totem destino
```

### Exemplo 3: Celebração

```javascript
// Explosão de brilhos para celebrar evento
fxEngine.playEffect({
  effect_id: 'sparkle_burst_v1',
  duration_ms: 2500,
  params: {
    palette: 'aurora',
    sparkleCount: 80
  }
}, { isOrigin: false, isTarget: false });
```

### Exemplo 4: Anúncio Importante

```javascript
// Onda de choque para chamar atenção
fxEngine.playEffect({
  effect_id: 'shockwave_v1',
  duration_ms: 2000,
  params: {
    palette: 'cyberpunk'
  }
}, { isOrigin: false, isTarget: false });
```

---

## 🔧 Criando Efeitos Customizados

### Exemplo: Efeito Customizado Simples

```javascript
// Registrar novo efeito
fxEngine.registerEffect('meu_efeito_v1', (ctx, canvas, progress, params, { edge, useWebGL }) => {
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const palette = getColorPalette(params?.palette || 'default');
  
  // Seu código de renderização aqui
  ctx.fillStyle = hexToRgba(palette.primary, progress);
  ctx.fillRect(0, 0, width, height);
});

// Usar o efeito
fxEngine.playEffect({
  effect_id: 'meu_efeito_v1',
  duration_ms: 2000,
  params: { palette: 'neon' }
}, { isOrigin: false, isTarget: false });
```

### Exemplo: Efeito com Gradiente e Glow

```javascript
fxEngine.registerEffect('efeito_glow_v1', (ctx, canvas, progress, params, { edge }) => {
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const palette = getColorPalette(params?.palette || 'neon');
  const intensity = Math.sin(progress * Math.PI);

  // Criar gradiente
  const gradient = createLinearGradient(ctx, 0, 0, width, height, [
    { stop: 0, color: hexToRgba(palette.primary, intensity) },
    { stop: 1, color: hexToRgba(palette.secondary, intensity) },
  ]);

  // Aplicar glow
  applyGlow(ctx, palette.primary, intensity * 20, 30);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  removeGlow(ctx);
});
```

---

## 📊 Performance

### Otimizações Automáticas

- ✅ **WebGL**: Usado automaticamente quando disponível
- ✅ **Fallback Canvas 2D**: Sempre disponível
- ✅ **FPS Monitoring**: Medição em tempo real
- ✅ **Telemetria**: Dados de performance enviados ao backend

### Dicas de Performance

1. **Use paletas simples** para melhor performance
2. **Reduza particleCount** se FPS < 30
3. **Use durações menores** para efeitos mais leves
4. **Evite múltiplos efeitos simultâneos** em hardware limitado

---

## 🎯 Boas Práticas

1. **Escolha a paleta certa** para o contexto
2. **Use durações apropriadas** (1000-2000ms é ideal)
3. **Teste em hardware real** antes de produção
4. **Monitore FPS** via telemetria
5. **Combine efeitos** para experiências ricas

---

## 📚 Referências

- **FxUtils.js**: Utilitários (gradientes, cores, easing)
- **ParticleSystem.js**: Sistema de partículas
- **FxEngine.js**: Motor principal de efeitos
- **MELHORIAS_FXENGINE_IMPLEMENTADAS.md**: Documentação técnica completa

---

**Versão**: 2.0  
**Última atualização**: 2025-01-15

