# SmartDisplayFX - Integração no Player

Este diretório contém os componentes necessários para integrar SmartDisplayFX nos players.

## Componentes

- **SmartDisplayFlowClient.js**: Cliente do protocolo SmartDisplayFlow (MQTT/LocalStorage)
- **mqtt-wrapper.js**: Wrapper universal para MQTT (browser/Electron/Node.js)
- **FxEngine.js**: Motor de efeitos FX (neon_warp, ripple_sync, etc.)
- **PlayerBridge.js**: Interface para integrar com o player principal
- **config.js**: Carregador de configuração do site do backend

## Integração Básica

### 1. Carregar Configuração do Site

```javascript
import { loadAndCreateClientOptions } from './smartdisplayfx/config.js';
import { SmartDisplayFlowClient } from './smartdisplayfx/SmartDisplayFlowClient.js';
import { FxEngine } from './smartdisplayfx/FxEngine.js';
import { PlayerBridge } from './smartdisplayfx/PlayerBridge.js';

// Configuração
const backendBaseUrl = 'http://localhost:3000';
const siteId = 'site-01';
const totemId = 'TOTEM_001'; // ID do totem atual

// Função para obter token de autenticação (se necessário)
async function getAuthToken() {
  // Implementar lógica de autenticação do player
  return null; // ou token JWT
}

// Carregar configuração do site
const clientOptions = await loadAndCreateClientOptions(
  backendBaseUrl,
  siteId,
  getAuthToken
);

// Criar cliente SmartDisplayFlow
const flowClient = new SmartDisplayFlowClient({
  siteId,
  totemId,
  backendBaseUrl,
  getAuthToken,
  ...clientOptions,
  onLog: (msg, extra) => console.log('[SmartDisplayFX]', msg, extra),
});

// Conectar
flowClient.connect(siteId, totemId);
```

### 2. Integrar com FxEngine

```javascript
import { FxEngine } from './smartdisplayfx/FxEngine.js';

// Criar FxEngine
const fxEngine = new FxEngine({
  canvas: document.getElementById('fx-canvas'), // Canvas para renderizar efeitos
  onLog: (msg, extra) => console.log('[FxEngine]', msg, extra),
});

// Registrar handlers de efeitos
flowClient.onEffect((payload, context) => {
  const { isOrigin, isTarget } = context;
  
  if (isTarget) {
    // Totem destino: executar efeito de entrada
    fxEngine.playEffect(payload.effect_id, {
      direction: 'in',
      edge: payload.to.edge,
      duration: payload.duration_ms,
      params: payload.params,
    });
    
    // Se houver content_id, exibir conteúdo
    if (payload.content_id) {
      // Implementar lógica para exibir conteúdo
      console.log('Exibir conteúdo:', payload.content_id);
    }
  } else if (isOrigin) {
    // Totem origem: executar efeito de saída
    fxEngine.playEffect(payload.effect_id, {
      direction: 'out',
      edge: payload.from.edge,
      duration: payload.duration_ms,
      params: payload.params,
    });
  }
});
```

### 3. Integrar com PlayerBridge

```javascript
import { PlayerBridge } from './smartdisplayfx/PlayerBridge.js';

// Criar PlayerBridge (implementar conforme plataforma)
class MyPlayerBridge extends PlayerBridge {
  connect() {
    // Conectar ao player principal
    // Exemplo: observar eventos do player
    this.playerInstance.addEventListener('contentchange', (event) => {
      this.currentContentId = event.contentId;
      this.onContentChange?.(event);
    });
  }
  
  getCurrentContentId() {
    // Implementar lógica para obter contentId atual
    return this.playerInstance?.currentContentId || null;
  }
  
  canInterrupt() {
    // Implementar lógica para verificar se pode interromper
    return this.currentPlaybackState === 'playing' && 
           this.currentMode !== 'promo';
  }
}

const playerBridge = new MyPlayerBridge({
  playerInstance: myPlayer, // Instância do player principal
  onLog: (msg, extra) => console.log('[PlayerBridge]', msg, extra),
});

playerBridge.connect();
```

### 4. Enviar Eventos de Interação

```javascript
// Quando detectar interação (tag RFID, touch, etc.)
async function handleInteraction(interactionType, data) {
  await flowClient.sendInteractionEvent({
    interactionType, // 'tag_id', 'touch', 'gesture', 'facial_recognition'
    tagId: data.tagId, // Se for tag_id
    contentId: data.contentId, // Opcional
    extra: data.extra, // Dados adicionais
  });
}

// Exemplo: Tag RFID
document.addEventListener('tagDetected', (event) => {
  handleInteraction('tag_id', {
    tagId: event.tagId,
  });
});
```

## Configuração por Plataforma

### webOS / Tizen

1. Incluir biblioteca MQTT via CDN no HTML:
```html
<script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
```

2. O SmartDisplayFlowClient detectará automaticamente `window.mqtt`.

### Electron

1. Instalar dependência:
```bash
npm install mqtt
```

2. O SmartDisplayFlowClient detectará automaticamente via `require('mqtt')`.

### Android TV

1. Incluir biblioteca MQTT via WebView ou nativo (Kotlin/Java).

## Exemplo Completo

Ver `examples/smartdisplayfx-integration.html` para um exemplo completo de integração.
