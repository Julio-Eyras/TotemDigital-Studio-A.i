# Guia de Integração - Player Client Interativo

## 🎯 Passo a Passo para Integrar

### 1. Incluir Scripts no Player

Adicione os scripts no HTML do player:

```html
<!-- Bibliotecas externas -->
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>

<!-- Serviços do Player -->
<script src="core/cache/LocalPlaylistManager.js"></script>
<script src="core/interruption/InterruptionManager.js"></script>
<script src="core/services/FacialRecognitionService.js"></script>
<script src="core/services/TagReaderService.js"></script>
<script src="core/services/VisualNetworkService.js"></script>
<script src="core/integration/InteractivePlayer.js"></script>
```

### 2. Configurar API Client

```javascript
window.apiClient = {
    baseURL: 'http://seu-servidor.com',
    getToken: () => localStorage.getItem('token'),
    get: async (url) => {
        const response = await fetch(`${window.apiClient.baseURL}${url}`, {
            headers: {
                'Authorization': `Bearer ${window.apiClient.getToken()}`
            }
        });
        return { data: await response.json() };
    },
    post: async (url, data) => {
        const response = await fetch(`${window.apiClient.baseURL}${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.apiClient.getToken()}`
            },
            body: JSON.stringify(data)
        });
        return { data: await response.json() };
    }
};
```

### 3. Configurar Media Player

```javascript
window.mediaPlayer = {
    play: async (media, options) => {
        // Implementar reprodução de mídia
        // options.onEnd() deve ser chamado quando terminar
    }
};
```

### 4. Inicializar Player Interativo

```javascript
const player = new InteractivePlayer({
    totemId: 'TOTEM_001', // Obter do servidor
    enableFacialRecognition: true,
    enableTagReader: true,
    enableVisualNetwork: true,
    defaultInteractiveContentId: 999, // ID do conteúdo padrão
    signalingServer: 'ws://seu-servidor.com:8080'
});

// Inicializar
await player.initialize();

// Carregar playlist
await player.loadPlaylist(1);
```

### 5. Funcionamento Automático

O sistema funciona automaticamente:
- **Reconhecimento Facial**: Detecta rostos e interrompe conteúdo
- **Tags**: Lê tags e interrompe conteúdo
- **Rede**: Compartilha eventos entre totens
- **Cache**: Mantém tudo em cache local

## 🔧 Configurações Avançadas

### Desabilitar Serviços Específicos

```javascript
const player = new InteractivePlayer({
    enableFacialRecognition: false, // Desabilitar reconhecimento
    enableTagReader: true,
    enableVisualNetwork: false
});
```

### Configurar Prioridades

```javascript
// No conteúdo da playlist, adicionar:
{
    id: 1,
    media: {...},
    priority: 'interactive', // 'normal', 'high', 'critical', 'interactive'
    interruptible: true
}
```

## 📝 Notas Importantes

- **Privacidade**: Reconhecimento facial é opcional
- **Performance**: Serviços rodam em background
- **Offline**: Funciona sem internet (usa cache)
- **Segurança**: Tags e reconhecimento são configuráveis

