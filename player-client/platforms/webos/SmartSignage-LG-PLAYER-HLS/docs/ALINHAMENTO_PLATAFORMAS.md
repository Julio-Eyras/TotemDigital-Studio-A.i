# 🔄 Alinhamento com Outras Plataformas

Documento comparativo e de alinhamento entre as implementações de players para diferentes plataformas.

---

## 📊 Visão Geral das Plataformas

| Plataforma | Localização | Status | Tecnologia |
|------------|-------------|--------|------------|
| **LG webOS (HLS)** | `webos/SmartSignage-LG-PLAYER-HLS/` | ✅ Novo | HTML5 + HLS nativo |
| **LG webOS (Legacy)** | `webos/org/` | ✅ Existente | HTML5 + PlaylistManager |
| **Samsung Tizen** | `tizen/` | ✅ Existente | HTML5 + PlaylistManager |
| **Android TV** | `android/` | ✅ Existente | Kotlin + Android MediaPlayer |

---

## 🏗️ Arquitetura Comparativa

### Componentes Comuns (Todas as Plataformas)

#### 1. API Client
- **Tizen/webOS Legacy:** `core/api/client.js`
- **Android TV:** `APIClient.kt`
- **LG webOS HLS:** `js/command-fetcher.js` + `js/heartbeat-service.js`

#### 2. Playlist Manager
- **Tizen/webOS Legacy:** `core/playlist/manager.js`
- **Android TV:** `PlaylistManager.kt`
- **LG webOS HLS:** ❌ Não implementado (usa HLS único do backend)

#### 3. Heartbeat Service
- **Tizen/webOS Legacy:** `core/heartbeat/service.js`
- **Android TV:** `HeartbeatService.kt`
- **LG webOS HLS:** ✅ `js/heartbeat-service.js`

#### 4. Media Player
- **Tizen/webOS Legacy:** `player/media-player.js`
- **Android TV:** `MediaPlayer.kt`
- **LG webOS HLS:** ✅ `js/hls-player.js` (HTML5 nativo)

#### 5. Scheduler
- **Tizen/webOS Legacy:** `core/scheduler/scheduler.js`
- **Android TV:** `Scheduler.kt`
- **LG webOS HLS:** ❌ Não implementado (backend gerencia)

#### 6. Cache
- **Tizen/webOS Legacy:** `core/cache/`
- **Android TV:** Implementado
- **LG webOS HLS:** ❌ Não implementado (HLS streaming)

#### 7. SmartDisplayFX
- **Tizen/webOS Legacy:** ✅ Implementado
- **Android TV:** ✅ Implementado (`SmartDisplayFxManager.kt`)
- **LG webOS HLS:** ❌ Não implementado (fase futura)

---

## 🔍 Diferenças Principais

### LG webOS HLS (Novo) vs Outras Plataformas

#### Abordagem Simplificada
- **LG webOS HLS:** Focado em HLS streaming único
- **Outras:** Gerenciam playlists locais com múltiplos itens

#### Backend vs Local
- **LG webOS HLS:** Backend gera playlist HLS, player apenas reproduz
- **Outras:** Player baixa e gerencia playlist localmente

#### Cache
- **LG webOS HLS:** Não cacheia (streaming contínuo)
- **Outras:** Cache local de mídias e playlists

#### SmartDisplayFX
- **LG webOS HLS:** Não implementado (planejado para Fase 2)
- **Outras:** Totalmente integrado

---

## 🎯 Estratégia de Alinhamento

### Opção 1: Manter Abordagem Minimalista (Atual)
**Vantagens:**
- ✅ CPU baixíssimo (< 10%)
- ✅ Máxima estabilidade 24/7
- ✅ Simplicidade de manutenção
- ✅ Ideal para operação contínua

**Desvantagens:**
- ❌ Não suporta playlists locais
- ❌ Não tem SmartDisplayFX
- ❌ Não tem cache

**Quando usar:**
- Operação 24/7 pura
- Apenas streaming HLS
- Máxima estabilidade

### Opção 2: Alinhar com Arquitetura Existente
**Vantagens:**
- ✅ Compatibilidade com outras plataformas
- ✅ Suporte a SmartDisplayFX
- ✅ Playlists locais
- ✅ Cache e agendamento

**Desvantagens:**
- ❌ Maior complexidade
- ❌ Mais CPU (ainda baixo, mas não < 10%)
- ❌ Mais código para manter

**Quando usar:**
- Precisa de SmartDisplayFX
- Precisa de playlists locais
- Precisa de cache offline

### Opção 3: Híbrida (Recomendada)
**Estratégia:**
- **Core HLS:** Manter minimalista (atual)
- **Extensões:** Adicionar módulos opcionais
  - SmartDisplayFX (opcional)
  - PlaylistManager (opcional, se backend não gerar HLS)
  - Cache (opcional, para fallback)

**Implementação:**
```javascript
// app.js
class SmartSignageApp {
  async init() {
    // Core HLS (sempre)
    await this.initHLSPlayer();
    
    // Extensões (opcionais, via config)
    if (this.config.enableSmartDisplayFX) {
      await this.initSmartDisplayFX();
    }
    
    if (this.config.enableLocalPlaylist) {
      await this.initPlaylistManager();
    }
  }
}
```

---

## 📋 Checklist de Alinhamento

### Funcionalidades Core
- [x] API Client / Command Fetcher
- [x] Heartbeat Service
- [x] Media Player (HLS)
- [x] Device Info / UIN
- [x] Fallback Manager
- [x] Watchdog

### Funcionalidades Avançadas (Fase 2)
- [ ] SmartDisplayFX Integration
- [ ] PlaylistManager (opcional)
- [ ] Scheduler (opcional)
- [ ] Cache Local (opcional)
- [ ] Multi-stream / VideoWall

---

## 🔄 Migração/Integração

### Para Adicionar SmartDisplayFX

1. **Copiar módulos:**
   ```bash
   cp -r ../../shared/smartdisplayfx/* js/smartdisplayfx/
   ```

2. **Incluir no HTML:**
   ```html
   <script src="js/smartdisplayfx/FxEngine.js"></script>
   <script src="js/smartdisplayfx/PlayerBridge.js"></script>
   <script src="js/smartdisplayfx/SmartDisplayFlowClient.js"></script>
   ```

3. **Integrar no app.js:**
   ```javascript
   async initSmartDisplayFX() {
     // Similar ao código em tizen/src/js/app.js
   }
   ```

### Para Adicionar PlaylistManager

1. **Copiar core:**
   ```bash
   cp -r ../../core/playlist js/playlist
   ```

2. **Adaptar para HLS:**
   - Converter itens de playlist para HLS
   - Ou usar playlist HLS única do backend

---

## 📊 Comparação de Performance

| Métrica | LG webOS HLS | Tizen/webOS Legacy | Android TV |
|---------|--------------|---------------------|------------|
| CPU Usage | < 10% | ~15-20% | ~20-30% |
| Memory | < 100MB | ~150-200MB | ~200-300MB |
| Startup Time | < 2s | ~3-5s | ~5-8s |
| Complexity | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 🎯 Recomendações

### Para Operação 24/7 Pura
**Usar:** LG webOS HLS (atual)
- Máxima estabilidade
- CPU mínimo
- Simplicidade

### Para Funcionalidades Avançadas
**Usar:** Tizen/webOS Legacy ou Android TV
- SmartDisplayFX
- Playlists complexas
- Cache offline

### Para Melhor dos Dois Mundos
**Usar:** LG webOS HLS + Extensões (Fase 2)
- Core minimalista
- Extensões opcionais
- Flexibilidade

---

## 📝 Próximos Passos

1. **Fase 1 (Atual):** ✅ Core HLS minimalista
2. **Fase 2:** Adicionar SmartDisplayFX (opcional)
3. **Fase 3:** Adicionar PlaylistManager (se necessário)
4. **Fase 4:** Multi-stream / VideoWall

---

**Última atualização:** 2025-12-19

