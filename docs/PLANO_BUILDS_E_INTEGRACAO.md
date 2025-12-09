# Plano de Builds e Integração SmartDisplayFX

## 🎯 Objetivo

Integrar SmartDisplayFX nos players de todas as plataformas e gerar builds prontos para testes reais.

---

## 1. ESTRUTURA PROPOSTA

### Módulo Unificado SmartDisplayFX

```
player-client/
├── shared/
│   └── smartdisplayfx/          # NOVO: módulo compartilhado
│       ├── SmartDisplayFlowClient.js
│       ├── FxEngine.js
│       ├── PlayerBridge.js
│       └── config.js            # Configuração MQTT
└── platforms/
    ├── webos/
    ├── android/
    ├── linux-electron/
    └── ...
```

### Vantagens:
- ✅ Código compartilhado (DRY)
- ✅ Fácil manutenção
- ✅ Builds consistentes

---

## 2. INTEGRAÇÃO POR PLATAFORMA

### 2.1. webOS (LG) - ALTA PRIORIDADE

**Arquivo**: `player-client/platforms/webos/build.sh`

**Modificações necessárias**:

```bash
# Adicionar ao build.sh:

# Copiar SmartDisplayFX
echo "Copying SmartDisplayFX modules..."
mkdir -p "$APP_DIR/js/smartdisplayfx"
cp ../../shared/smartdisplayfx/SmartDisplayFlowClient.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/FxEngine.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/PlayerBridge.js "$APP_DIR/js/smartdisplayfx/"
cp ../../shared/smartdisplayfx/config.js "$APP_DIR/js/smartdisplayfx/"
```

**Integração no player** (`src/js/app.js`):

```javascript
// Adicionar ao início do arquivo
import { SmartDisplayFlowClient } from '../js/smartdisplayfx/SmartDisplayFlowClient.js';
import { FxEngine } from '../js/smartdisplayfx/FxEngine.js';
import { WebPlayerBridge } from '../js/smartdisplayfx/PlayerBridge.js';
import { mqttConfig } from '../js/smartdisplayfx/config.js';

// Inicializar SmartDisplayFX
const fxClient = new SmartDisplayFlowClient({
  siteId: config.siteId,
  totemId: config.totemId,
  transportType: 'mqtt',
  mqttUrl: mqttConfig.url,
  mqttPrefix: mqttConfig.prefix,
  mqttOptions: {
    username: mqttConfig.username,
    password: mqttConfig.password,
  },
  backendBaseUrl: config.apiUrl,
  getAuthToken: () => localStorage.getItem('token'),
});

const fxEngine = new FxEngine({
  canvas: document.getElementById('fx-canvas'),
  playerBridge: new WebPlayerBridge({
    videoElement: document.getElementById('video-player'),
  }),
});

fxClient.onEffect((payload, ctx) => {
  fxEngine.playEffect(payload, ctx);
});

fxClient.connect(config.siteId, config.totemId);
```

**MQTT Client**:
- Opção 1: Incluir `mqtt.js` via CDN no `index.html`
- Opção 2: Bundle `mqtt.js` no build

**HTML** (`src/index.html`):

```html
<!-- Adicionar canvas para FX -->
<canvas id="fx-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1000;"></canvas>

<!-- MQTT Client -->
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
```

**Configuração** (`shared/smartdisplayfx/config.js`):

```javascript
export const mqttConfig = {
  url: window.APP_CONFIG?.mqttUrl || 'ws://localhost:9001',
  prefix: window.APP_CONFIG?.mqttPrefix || 'smartdisplay',
  username: window.APP_CONFIG?.mqttUsername || undefined,
  password: window.APP_CONFIG?.mqttPassword || undefined,
};
```

**Build**:
```bash
cd player-client/platforms/webos
./build.sh
# Gera: com.smartsignage.player_1.0.0_all.ipk
```

---

### 2.2. Android TV - MÉDIA PRIORIDADE

**Estratégia**: WebView com SmartDisplayFX

**Arquivo**: `player-client/platforms/android/app/src/main/java/.../MainActivity.kt`

**Modificações**:

```kotlin
// Adicionar WebView para SmartDisplayFX
class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // WebView para SmartDisplayFX
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            loadUrl("file:///android_asset/smartdisplayfx/index.html")
        }
        
        // Adicionar WebView como overlay
        val layout = findViewById<FrameLayout>(R.id.main_layout)
        layout.addView(webView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))
    }
}
```

**Assets**: Criar `app/src/main/assets/smartdisplayfx/`

**MQTT Client**: Paho MQTT Android

**build.gradle**:

```gradle
dependencies {
    implementation 'org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5'
    implementation 'org.eclipse.paho:org.eclipse.paho.android.service:1.1.1'
}
```

**Build**:
```bash
cd player-client/platforms/android
./gradlew assembleDebug
# Gera: app/build/outputs/apk/debug/app-debug.apk
```

---

### 2.3. Linux Electron (SBC) - MÉDIA PRIORIDADE

**Arquivo**: `player-client/platforms/linux-electron/build.sh`

**Modificações**:

```bash
# Adicionar ao build.sh:

# Copiar SmartDisplayFX
echo "Copying SmartDisplayFX modules..."
mkdir -p renderer/js/smartdisplayfx
cp ../../shared/smartdisplayfx/SmartDisplayFlowClient.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/FxEngine.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/PlayerBridge.js renderer/js/smartdisplayfx/
cp ../../shared/smartdisplayfx/config.js renderer/js/smartdisplayfx/
```

**package.json**:

```json
{
  "dependencies": {
    "mqtt": "^5.0.0"
  }
}
```

**Integração**: Similar ao webOS

**Build**:
```bash
cd player-client/platforms/linux-electron
npm install
./build.sh
npm run build
```

---

### 2.4. Tizen (Samsung) - BAIXA PRIORIDADE

**Estratégia**: Similar ao webOS

**Build Script**: Criar `build.sh` similar ao webOS

**MQTT**: `mqtt.js` via CDN

---

### 2.5. Windows Electron - BAIXA PRIORIDADE

**Estratégia**: Similar ao Linux Electron

**Build Script**: Criar `build.sh` ou `build.ps1`

---

## 3. PROCESSO DE BUILD UNIFICADO

### Script Master: `build-all.sh`

```bash
#!/bin/bash
# Build script para todas as plataformas

PLATFORMS=("webos" "linux-electron" "android" "tizen" "windows-electron")

for platform in "${PLATFORMS[@]}"; do
    echo "Building $platform..."
    cd "platforms/$platform"
    
    if [ -f "build.sh" ]; then
        ./build.sh
    elif [ -f "build.ps1" ]; then
        pwsh build.ps1
    elif [ -f "build.gradle" ]; then
        ./gradlew assembleDebug
    fi
    
    cd ../..
done

echo "All builds complete!"
```

---

## 4. CONFIGURAÇÃO DE AMBIENTE

### Arquivo: `player-client/shared/config/environment.js`

```javascript
// Configuração por ambiente
export const config = {
  development: {
    apiUrl: 'http://localhost:3000/api',
    mqttUrl: 'ws://localhost:9001',
    mqttPrefix: 'smartdisplay',
  },
  production: {
    apiUrl: process.env.API_URL || 'https://api.smartsignage.pro/api',
    mqttUrl: process.env.MQTT_URL || 'wss://mqtt.smartsignage.pro',
    mqttPrefix: 'smartdisplay',
  },
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env];
};
```

---

## 5. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Estrutura (1 dia)
- [ ] Criar `player-client/shared/smartdisplayfx/`
- [ ] Copiar arquivos SmartDisplayFX para shared
- [ ] Criar `config.js` para MQTT

### Fase 2: webOS (2-3 dias)
- [ ] Atualizar `build.sh` para incluir SmartDisplayFX
- [ ] Integrar no `app.js`
- [ ] Adicionar canvas no HTML
- [ ] Testar build local

### Fase 3: Linux Electron (2-3 dias)
- [ ] Atualizar `build.sh`
- [ ] Adicionar `mqtt` ao `package.json`
- [ ] Integrar no renderer
- [ ] Testar build local

### Fase 4: Android TV (3-4 dias)
- [ ] Criar WebView para SmartDisplayFX
- [ ] Adicionar Paho MQTT
- [ ] Criar assets HTML/JS
- [ ] Testar build local

### Fase 5: Outras Plataformas (2-3 dias)
- [ ] Tizen: criar build script
- [ ] Windows: criar build script
- [ ] Linux C++: avaliar estratégia

### Fase 6: Build Unificado (1 dia)
- [ ] Criar `build-all.sh`
- [ ] Testar builds de todas as plataformas
- [ ] Documentar processo

---

## 6. TESTES

### Testes Locais (antes de deploy)

1. **webOS**:
   ```bash
   # Emulador webOS
   ares-launch --device emulator com.smartsignage.player
   ```

2. **Android TV**:
   ```bash
   # Emulador Android TV
   adb install app-debug.apk
   ```

3. **Linux Electron**:
   ```bash
   # Executar localmente
   npm start
   ```

### Testes em Dispositivos Reais

1. **webOS (LG TV)**:
   - Instalar via `ares-install`
   - Testar comunicação MQTT
   - Testar efeitos FX

2. **Android TV**:
   - Instalar via ADB
   - Testar comunicação MQTT
   - Testar efeitos FX

3. **Linux Electron (SBC)**:
   - Instalar em Orange Pi
   - Testar comunicação MQTT
   - Testar efeitos FX

---

## 7. PRÓXIMOS PASSOS IMEDIATOS

1. **Criar estrutura shared**:
   ```bash
   mkdir -p player-client/shared/smartdisplayfx
   cp Player-SmartDisplayFX-client/core/sync/SmartDisplayFlowClient.js player-client/shared/smartdisplayfx/
   cp Player-SmartDisplayFX-client/core/fx/FxEngine.js player-client/shared/smartdisplayfx/
   cp Player-SmartDisplayFX-client/core/integration/PlayerBridge.js player-client/shared/smartdisplayfx/
   ```

2. **Criar config.js**:
   ```bash
   touch player-client/shared/smartdisplayfx/config.js
   ```

3. **Atualizar build.sh do webOS**:
   - Adicionar cópia de SmartDisplayFX

4. **Testar build webOS**:
   ```bash
   cd player-client/platforms/webos
   ./build.sh
   ```

---

**Tempo Estimado Total**: 2-3 semanas

**Prioridade**: 
1. webOS (ALTA)
2. Linux Electron (MÉDIA)
3. Android TV (MÉDIA)
4. Outras (BAIXA)

