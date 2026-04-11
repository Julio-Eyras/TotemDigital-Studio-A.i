# 📺 SmartSignage-LG-PLAYER-HLS - Resumo Executivo

## 🎯 O que é?

Player oficial para **LG Smart TVs (webOS)** do sistema Smart Signage Pro, otimizado para operação **24/7** em Smart Display.

---

## 🏗️ Arquitetura Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BACKEND SMART SIGNAGE PRO                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  REST API    │  │  WebSocket   │  │  HLS Server  │             │
│  │  • validate  │  │  (Futuro)    │  │  • .m3u8     │             │
│  │  • heartbeat │  │              │  │  • segmentos │             │
│  │  • commands  │  │              │  │              │             │
│  │  • register  │  │              │  │              │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
└─────────┼──────────────────┼──────────────────┼─────────────────────┘
          │                  │                  │
          │ HTTP Polling     │ WebSocket        │ HLS Stream
          │ (15s)            │ (futuro)         │ (.m3u8)
          │                  │                  │
┌─────────┴──────────────────┴──────────────────┴──────────────┐
│          SMART SIGNAGE LG PLAYER (webOS App)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              CORE LAYER                                │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │  HTML5 <video> (Nativo)                         │ │  │
│  │  │  • HLS (.m3u8) suporte nativo                   │ │  │
│  │  │  • Hardware decoding automático                 │ │  │
│  │  │  • CPU < 10%                                    │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          CONTROL LAYER                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │ Command      │  │ Heartbeat    │  │ Fallback   │ │  │
│  │  │ Fetcher      │  │ Service      │  │ Manager    │ │  │
│  │  │ (polling)    │  │ (30s)        │  │            │ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  │  ┌──────────────┐  ┌──────────────┐                  │  │
│  │  │ Watchdog     │  │ Device Info  │                  │  │
│  │  │ (3 camadas)  │  │ Service      │                  │  │
│  │  └──────────────┘  └──────────────┘                  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         webOS INTEGRATION                              │  │
│  │  • Kiosk Mode (visible: false)                        │  │
│  │  • Auto-launch                                         │  │
│  │  • Hardware APIs (MAC, Device ID, Serial)             │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo Principal de Funcionamento

```
INÍCIO
  │
  ├─► Coleta Hardware (MAC, Device ID, Serial)
  │   └─► Gera UIN único
  │
  ├─► Registra no Backend (/api/player/register)
  │   └─► Salva UIN localmente
  │
  ├─► Obtém Token (/api/player/token)
  │
  ├─► Valida Totem (/api/player/validate)
  │   └─► Recebe playlist inicial
  │
  ├─► Inicia Player
  │   ├─► HTML5 <video> com HLS
  │   ├─► Hardware decoding
  │   └─► Reprodução automática
  │
  └─► LOOP 24/7
      ├─► Polling Comandos (15s)
      │   └─► PLAY / RESTART / STOP
      │
      ├─► Envia Heartbeat (30s)
      │   └─► Status, uptime, métricas
      │
      ├─► Watchdog (20s)
      │   └─► Detecta e corrige freezes
      │
      └─► Fallback (se erro)
          └─► USB/SSD → Stream principal
```

---

## 🎨 Características Principais

### ✅ Tecnologias
- **HLS nativo** (.m3u8) - Suporte built-in do webOS
- **Hardware decoding** - GPU faz todo trabalho (CPU < 10%)
- **JavaScript vanilla** - Zero bibliotecas pesadas
- **HTML5 <video>** - Apenas elemento nativo

### ✅ Funcionalidades
- **Auto-registro** - Coleta hardware e registra automaticamente
- **Comandos remotos** - HTTP polling (15s) + WebSocket (futuro)
- **Monitoramento** - Heartbeat a cada 30s
- **Robustez** - Watchdog 3 camadas + fallback offline
- **Modo kiosk** - App invisível, auto-launch

### ✅ Integração
- **Backend total** - Usa todos endpoints existentes
- **Playlist dinâmica** - Backend gera HLS, player só reproduz
- **Logs e analytics** - Envia dados ao backend
- **Atualizações OTA** - Auto-update via backend

---

## 📊 Especificações Técnicas

| Aspecto | Especificação |
|---------|---------------|
| **Plataforma** | LG webOS (3.5+) |
| **Formato Vídeo** | HLS (.m3u8) |
| **Codecs** | H.264 (High/Main), H.265 (Main) |
| **Consumo CPU** | < 10% |
| **Memória** | < 100MB |
| **Comunicação** | HTTP Polling (15s) + WebSocket (futuro) |
| **Heartbeat** | 30 segundos |
| **Watchdog** | 20 segundos (3 camadas) |
| **Fallback** | USB/SSD → Cache |

---

## 🔐 Identificação e Segurança

### UIN (Unique Identifier)
1. Coleta hardware (MAC + Device ID + Serial)
2. Gera string única: `LG_{MAC}_{DEVICEID}`
3. Registra no backend via `/api/player/register`
4. Backend valida e aprova (ou requer aprovação manual)

### Autenticação
- Token HMAC via `/api/player/token?uin={UIN}`
- Token expira em 1 hora (renovado automaticamente)
- Usado em todas requisições

---

## 🚀 Próximos Passos

### Fase 1: Fundamentos ✅ Planejado
- Estrutura de diretórios
- appinfo.json (kiosk mode)
- HTML5 player básico

### Fase 2-7: Implementação 🔄 Aguardando
- Player core completo
- Integração com backend
- Testes e otimização

### Futuro: Expansões 💡
- Multi-stream / VideoWall
- Analytics avançado
- Integração com IAs
- Multi-plataforma (Tizen, Android TV)

---

## 📝 Resumo em 3 Pontos

1. **Player minimal** - HTML5 nativo, HLS, hardware decoding, CPU baixíssimo
2. **Integração total** - Usa todos endpoints do backend Smart Signage Pro
3. **24/7 robusto** - Watchdog, fallback, auto-recuperação, modo kiosk

---

**Status:** ✅ Planejamento completo - Pronto para implementação

**Documentação completa:** `docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md`

