# SmartSignage Android TV Player HLS

Player HLS minimalista para Android TV usando ExoPlayer.

## ✅ Características

- ✅ **HLS nativo** - ExoPlayer com suporte built-in (.m3u8)
- ✅ **Hardware decoding** - GPU decodifica, CPU ~15%
- ✅ **24/7 operação** - Watchdog multi-camadas
- ✅ **Auto-registro** - UIN baseado em hardware
- ✅ **Fallback offline** - USB/SSD quando stream falha
- ✅ **HTTP Polling** - Comandos remotos via polling
- ✅ **Heartbeat** - Monitoramento contínuo

## 📋 Estrutura

```
SmartSignage-ANDROID-PLAYER-HLS/
├── app/
│   ├── build.gradle          # Dependências (ExoPlayer)
│   └── src/main/
│       ├── java/com/smartsignage/player/hls/
│       │   ├── HLSPlayer.kt      # Player ExoPlayer minimalista
│       │   ├── MainActivity.kt    # Aplicação principal
│       │   ├── DeviceInfoService.kt # Coleta hardware, UIN
│       │   ├── CommandFetcher.kt # Polling de comandos
│       │   ├── HeartbeatService.kt # Heartbeat
│       │   └── FallbackManager.kt # Fallback offline
│       └── res/
│           └── layout/
│               └── activity_main.xml
└── README.md
```

## 🚀 Build e Instalação

### Pré-requisitos

- Android Studio
- Android SDK 21+ (Android 5.0+)
- Android TV ou emulador

### Build

```bash
cd player-client/platforms/android/SmartSignage-ANDROID-PLAYER-HLS
./gradlew assembleDebug
```

### Instalação

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.smartsignage.player.hls/.MainActivity
```

## ⚙️ Configuração

Edite `MainActivity.kt` para configurar:

```kotlin
config = Config(
    apiBaseUrl = "http://SEU_SERVIDOR:3000/api",
    streamUrl = "http://SEU_SERVIDOR:3000/hls/canal01/playlist.m3u8"
)
```

## 📚 Documentação

- [Plano Completo](../../../../docs/PLANO_FINAL_SMARTSIGNAGE_LG_PLAYER_HLS.md)
- [HLS Suporte em Todas as Plataformas](../webos/SmartSignage-LG-PLAYER-HLS/docs/HLS_SUPORTE_PLATAFORMAS.md)

