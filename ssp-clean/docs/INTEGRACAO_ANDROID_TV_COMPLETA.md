# Integração SmartDisplayFX - Android TV (COMPLETA)

## ✅ O que foi implementado

### 1. Dependências ✅
- **Paho MQTT Android**: `org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5`
- **Paho MQTT Android Service**: `org.eclipse.paho:org.eclipse.paho.android.service:1.1.1`
- **WebView**: `androidx.webkit:webkit:1.9.0`

### 2. Assets ✅
- **Criado**: `app/src/main/assets/smartdisplayfx/`
- **Arquivos copiados**:
  - `SmartDisplayFlowClient.js`
  - `FxEngine.js`
  - `PlayerBridge.js`
  - `config.js`
  - `mqtt-wrapper.js`
- **HTML criado**: `index.html` com canvas e carregamento de módulos

### 3. Layout ✅
- **WebView adicionado**: `fx_webview` sobreposto ao player
- **Transparente**: Para não interferir no player

### 4. Código Kotlin ✅
- **SmartDisplayFxManager.kt**: Gerenciador completo
  - Setup de WebView
  - Interface JavaScript (AndroidInterface)
  - Inicialização de SmartDisplayFX via JavaScript
  - Suporte a MQTT nativo (opcional)
- **MainActivity.kt**: Integração
  - Inicialização do SmartDisplayFxManager
  - Cleanup no onDestroy

## 📋 Como Funciona

### Fluxo de Inicialização

1. **MainActivity.onCreate()**:
   - Cria `SmartDisplayFxManager` com configuração
   - Carrega HTML do SmartDisplayFX em WebView

2. **WebView carrega HTML**:
   - Importa módulos ES6
   - Expõe globalmente via `window.SmartDisplayFX`
   - Notifica Android quando pronto

3. **SmartDisplayFxManager.initializeSmartDisplayFX()**:
   - Injeta JavaScript para inicializar SmartDisplayFX
   - Cria `FxEngine` com canvas
   - Cria `SmartDisplayFlowClient` com MQTT
   - Conecta handlers

4. **Quando efeito é recebido**:
   - Via MQTT nativo (Android) ou via JavaScript (WebView)
   - `FxEngine` renderiza efeito no canvas

## 🔧 Configuração

### SmartDisplayFxConfig

```kotlin
val config = SmartDisplayFxConfig(
    siteId = "site-01",
    totemId = "totem-001",
    mqttUrl = "ws://seu-broker:9001",
    mqttPrefix = "smartdisplay",
    mqttUsername = null, // opcional
    mqttPassword = null, // opcional
    backendBaseUrl = "http://seu-backend:3000/api"
)
```

### Obter de Configuração Real

Pode ser obtido de:
- `SharedPreferences`
- Arquivo de configuração
- API do backend
- Variáveis de ambiente

## 🚀 Como Buildar e Testar

### 1. Build

```bash
cd player-client/platforms/android
./gradlew assembleDebug
```

Isso gera: `app/build/outputs/apk/debug/app-debug.apk`

### 2. Instalar no Dispositivo

```bash
# Via USB
adb install app/build/outputs/apk/debug/app-debug.apk

# Via ADB over network
adb connect <DEVICE_IP>
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 3. Verificar Logs

```bash
adb logcat | grep -E "SmartDisplayFx|MainActivity"
```

## ⚠️ Requisitos

1. **Android TV/Box**: Android 7.0+ (API 24+)
2. **MQTT Broker**: Deve estar rodando e acessível
3. **Configuração**: `mqttUrl` deve estar correto
4. **Internet**: Para carregar assets e conectar MQTT

## 🐛 Troubleshooting

### SmartDisplayFX não inicializa
- Verificar logs: `adb logcat | grep SmartDisplayFx`
- Verificar se assets foram copiados: `adb shell ls /data/data/com.smartsignage.player/files/`
- Verificar se WebView está carregando HTML

### MQTT não conecta
- Verificar URL do broker
- Verificar credenciais (se necessário)
- Verificar firewall/network
- Verificar logs do MQTT client

### Efeitos não aparecem
- Verificar se canvas existe no HTML
- Verificar se `FxEngine` foi inicializado
- Verificar logs de recebimento de efeitos
- Verificar se WebView está visível

## 📝 Diferenças das Outras Plataformas

| Aspecto | webOS | Linux Electron | Android TV |
|---------|-------|----------------|------------|
| **MQTT** | CDN (`mqtt.js`) | npm (`mqtt`) | Paho MQTT Android |
| **Renderização** | Canvas direto | Canvas direto | WebView + Canvas |
| **Integração** | JavaScript puro | JavaScript puro | Kotlin + JavaScript |
| **Build** | `.ipk` | `.AppImage`, `.deb` | `.apk` |

## 🎯 Próximos Passos

1. **Testar build** (`./gradlew assembleDebug`)
2. **Testar em TV/Box real**
3. **Validar comunicação MQTT**
4. **Validar efeitos FX**
5. **Conectar PlayerBridge ao ExoPlayer real**

## 🔄 Melhorias Futuras

1. **PlayerBridge Real**:
   - Conectar ao ExoPlayer
   - Obter estado real de playback
   - Obter contentId atual

2. **Configuração Dinâmica**:
   - Carregar de SharedPreferences
   - Atualizar via API

3. **MQTT Híbrido**:
   - Usar MQTT nativo para melhor performance
   - Fallback para JavaScript se necessário

---

**Status**: ✅ Integração completa, pronto para testes

