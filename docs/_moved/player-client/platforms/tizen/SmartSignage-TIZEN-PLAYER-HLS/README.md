# SmartSignage Tizen Player HLS

Player HLS minimalista para Samsung Smart TVs (Tizen).

## ✅ Características

- ✅ **HLS nativo** - Suporte built-in do Tizen (.m3u8)
- ✅ **Hardware decoding** - GPU decodifica, CPU < 10%
- ✅ **24/7 operação** - Watchdog multi-camadas
- ✅ **Auto-registro** - UIN baseado em hardware
- ✅ **Fallback offline** - USB/SSD quando stream falha
- ✅ **HTTP Polling** - Comandos remotos via polling
- ✅ **Heartbeat** - Monitoramento contínuo

## 📋 Estrutura

```
SmartSignage-TIZEN-PLAYER-HLS/
├── config.xml              # Manifest Tizen
├── index.html              # HTML principal
├── styles.css              # CSS minimal
├── js/
│   ├── device-info.js      # Coleta hardware, UIN
│   ├── hls-player.js       # Player HLS nativo
│   ├── command-fetcher.js # Polling de comandos
│   ├── heartbeat-service.js # Heartbeat
│   ├── fallback-manager.js # Fallback offline
│   └── app.js              # Aplicação principal
├── config/
│   └── config.example.json # Configuração exemplo
└── README.md
```

## 🚀 Build e Instalação

### Pré-requisitos

- Tizen Studio instalado
- TV Samsung em modo desenvolvedor
- Certificado de desenvolvedor configurado

### Build

```bash
cd player-client/platforms/tizen/SmartSignage-TIZEN-PLAYER-HLS
tizen package -t wgt
```

### Instalação

```bash
tizen install -n SmartSignage-TIZEN-PLAYER-HLS.wgt -d <device_id>
tizen run -p com.smartsignage.tizenplayer.hls -d <device_id>
```

## ⚙️ Configuração

Edite `config/config.example.json` e renomeie para `config.json`:

```json
{
  "api_base_url": "http://SEU_SERVIDOR:3000/api",
  "stream_url": "http://SEU_SERVIDOR:3000/hls/canal01/playlist.m3u8"
}
```

## 📚 Documentação

- [Plano Completo](../../../../docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [HLS Suporte em Todas as Plataformas](docs/HLS_SUPORTE_PLATAFORMAS.md)

