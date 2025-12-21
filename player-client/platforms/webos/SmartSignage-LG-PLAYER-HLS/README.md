# SmartSignage-LG-PLAYER-HLS

Player oficial para **LG Smart TVs (webOS)** do sistema Smart Signage Pro, otimizado para operação **24/7**.

## 📋 Características

- ✅ **HLS nativo** - Suporte built-in do webOS (.m3u8)
- ✅ **Hardware decoding** - CPU < 10%
- ✅ **JavaScript vanilla** - Zero bibliotecas pesadas
- ✅ **HTML5 <video>** - Apenas elemento nativo
- ✅ **Auto-registro** - Coleta hardware e registra automaticamente
- ✅ **Comandos remotos** - HTTP polling + WebSocket
- ✅ **Monitoramento** - Heartbeat periódico
- ✅ **Robustez** - Watchdog 3 camadas + fallback offline
- ✅ **Modo kiosk** - App invisível, auto-launch

## 🚀 Quick Start

### Pré-requisitos

- LG TV com webOS 3.5+
- webOS CLI tools instaladas
- TV em modo desenvolvedor

### Instalação Rápida

**Windows:**
```batch
scripts\build.bat
scripts\deploy.bat lg_tv
ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

**Linux/Mac:**
```bash
./scripts/build.sh
./scripts/deploy.sh lg_tv
ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

### Documentação Completa

- 📖 **[Guia Completo de Instalação](docs/INSTALACAO_TV.md)** - Passo a passo detalhado
- 📖 **[Build e Instalação Rápida](BUILD_E_INSTALACAO.md)** - Guia resumido
- 📖 **[Guia de Testes](TESTE_RAPIDO.md)** - Como testar o app

## 📁 Estrutura

```
SmartSignage-LG-PLAYER-HLS/
├── appinfo.json          # Manifesto webOS
├── index.html            # Entry point
├── styles.css            # CSS minimal
├── js/
│   ├── device-info.js    # Coleta hardware / UIN
│   ├── hls-player.js     # Player HLS nativo
│   ├── command-fetcher.js # Busca comandos remotos
│   ├── heartbeat-service.js # Envia status
│   ├── fallback-manager.js  # Gerencia fallback
│   └── app.js            # Aplicação principal
├── config/
│   └── config.example.json
└── docs/
    └── ...
```

## 🔧 Configuração

Edite `config/config.json` ou defina via variáveis de ambiente no backend.

## 📖 Documentação

- [Plano Completo](../../../../docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [Resumo Executivo](../../../../docs/RESUMO_SMARTSIGNAGE_LG_PLAYER_HLS.md)

## 📝 Licença

MIT

