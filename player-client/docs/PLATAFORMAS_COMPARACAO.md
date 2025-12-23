# 📺 Comparação de Plataformas - Smart Signage Players

Visão geral e comparação entre todas as implementações de players.

---

## 🎯 Plataformas Implementadas

### 1. LG webOS (HLS) - NOVO ✅
**Localização:** `platforms/webos/SmartSignage-LG-PLAYER-HLS/`

**Características:**
- ✅ HLS nativo (.m3u8)
- ✅ Hardware decoding
- ✅ CPU < 10%
- ✅ JavaScript vanilla
- ✅ HTML5 `<video>` nativo
- ✅ Auto-registro (UIN)
- ✅ Watchdog 3 camadas
- ✅ Fallback offline

**Status:** ✅ Fase 1 completa

**Documentação:**
- [Plano Completo](../../docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [Instalação](webos/SmartSignage-LG-PLAYER-HLS/docs/INSTALACAO_TV.md)

---

### 2. LG webOS (Legacy) - EXISTENTE ✅
**Localização:** `platforms/webos/org/`

**Características:**
- ✅ PlaylistManager completo
- ✅ Scheduler
- ✅ Cache local
- ✅ SmartDisplayFX
- ✅ API Client
- ✅ Heartbeat Service

**Status:** ✅ Completo

**Documentação:**
- [README](webos/org/README.md)
- [Deploy](webos/org/DEPLOY.md)

---

### 3. Samsung Tizen - EXISTENTE ✅
**Localização:** `platforms/tizen/`

**Características:**
- ✅ PlaylistManager completo
- ✅ Scheduler
- ✅ Cache local
- ✅ SmartDisplayFX
- ✅ API Client
- ✅ Heartbeat Service
- ✅ Similar ao webOS Legacy

**Status:** ✅ Completo

**Documentação:**
- [README](tizen/README.md)

---

### 4. Android TV - EXISTENTE ✅
**Localização:** `platforms/android/`

**Características:**
- ✅ Kotlin/Android nativo
- ✅ PlaylistManager
- ✅ Scheduler
- ✅ MediaPlayer Android
- ✅ SmartDisplayFX (WebView)
- ✅ API Client
- ✅ Heartbeat Service

**Status:** ✅ Completo

**Documentação:**
- [README](android/README.md)
- [Deploy](android/DEPLOY.md)
- [Testing](android/TESTING.md)

---

## 📊 Matriz de Funcionalidades

| Funcionalidade | LG webOS HLS | LG webOS Legacy | Tizen | Android TV |
|----------------|--------------|-----------------|-------|------------|
| **HLS Streaming** | ✅ Nativo | ✅ Suportado | ✅ Suportado | ✅ Suportado |
| **Playlist Local** | ❌ | ✅ | ✅ | ✅ |
| **Scheduler** | ❌ | ✅ | ✅ | ✅ |
| **Cache Local** | ❌ | ✅ | ✅ | ✅ |
| **SmartDisplayFX** | ❌ (Fase 2) | ✅ | ✅ | ✅ |
| **Auto-registro** | ✅ | ✅ | ✅ | ✅ |
| **Heartbeat** | ✅ | ✅ | ✅ | ✅ |
| **Watchdog** | ✅ 3 camadas | ⚠️ Básico | ⚠️ Básico | ⚠️ Básico |
| **Fallback Offline** | ✅ | ⚠️ | ⚠️ | ⚠️ |
| **Hardware Decoding** | ✅ Automático | ✅ | ✅ | ✅ |
| **CPU Usage** | < 10% | ~15-20% | ~15-20% | ~20-30% |

---

## 🎯 Quando Usar Cada Plataforma

### LG webOS HLS (Novo)
**Ideal para:**
- ✅ Operação 24/7 pura
- ✅ Streaming HLS contínuo
- ✅ Máxima estabilidade
- ✅ CPU mínimo crítico
- ✅ Simplicidade de manutenção

**Não ideal para:**
- ❌ Playlists locais complexas
- ❌ SmartDisplayFX (ainda)
- ❌ Cache offline extensivo

### LG webOS Legacy / Tizen
**Ideal para:**
- ✅ Playlists locais
- ✅ SmartDisplayFX
- ✅ Agendamento complexo
- ✅ Cache offline
- ✅ Funcionalidades avançadas

**Não ideal para:**
- ❌ CPU mínimo crítico
- ❌ Operação 24/7 pura (mais complexo)

### Android TV
**Ideal para:**
- ✅ Dispositivos Android TV
- ✅ Integração com ecossistema Android
- ✅ Funcionalidades nativas Android
- ✅ SmartDisplayFX via WebView

**Não ideal para:**
- ❌ TVs LG/Samsung
- ❌ CPU mínimo crítico

---

## 🔄 Estratégia de Desenvolvimento

### Fase Atual
- ✅ **LG webOS HLS:** Core minimalista completo
- ✅ **Outras plataformas:** Funcionais e completas

### Fase 2 (Futuro)
- 🔄 **LG webOS HLS:** Adicionar SmartDisplayFX (opcional)
- 🔄 **LG webOS HLS:** Adicionar PlaylistManager (se necessário)
- 🔄 **Todas:** Melhorias e otimizações

---

## 📚 Documentação por Plataforma

### LG webOS HLS
- [Plano Completo](../../docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [Resumo Executivo](../../docs/RESUMO_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [Instalação](webos/SmartSignage-LG-PLAYER-HLS/docs/INSTALACAO_TV.md)
- [Alinhamento](webos/SmartSignage-LG-PLAYER-HLS/docs/ALINHAMENTO_PLATAFORMAS.md)

### Outras Plataformas
- Ver README.md em cada diretório

---

**Última atualização:** 2025-12-19

