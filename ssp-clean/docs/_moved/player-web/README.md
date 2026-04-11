# Player Web (Browser)

Player HTML5 para streaming direto de mídias do DispatchPlan. **Não usa cache local** - apenas streaming.

## 🚀 Uso

### Abrir no navegador

```html
<!-- Com configuração via URL -->
http://localhost:8080/index.html?api=http://servidor:3000&uin=TOTEM_001&secret=secret

<!-- Ou configurar via JavaScript -->
<script>
    window.API_BASE_URL = 'http://servidor:3000';
    window.TOTEM_UIN = 'TOTEM_001';
    window.TOTEM_SECRET = 'secret';
</script>
```

### Características

- ✅ **DispatchPlan Nativo**: Usa DispatchPlan diretamente (sem conversão)
- ✅ **Streaming Apenas**: Não usa cache local (streaming direto)
- ✅ **HTML5 MediaPlayer**: Usa elementos nativos do HTML5
- ✅ **Validação Temporal**: validityStart/validityEnd implementados
- ✅ **Heartbeat**: Envio periódico de métricas
- ✅ **Sincronização**: Atualização automática do DispatchPlan

## 📋 Componentes

### index.html
Página principal com container do player.

### js/app.js
Aplicativo principal que gerencia DispatchPlan e reprodução.

### js/api/client.js
Cliente HTTP usando fetch API.

## 🎯 Diferenças do player-web

**player-web é diferente dos outros players:**

- ❌ **Sem cache local**: Apenas streaming (IndexedDB pode ser usado para metadados, mas não para mídias)
- ❌ **Sem servidor HTTP local**: Não serve mídias para outros dispositivos
- ❌ **Sem descoberta de totem**: Conecta diretamente ao servidor central
- ✅ **Streaming direto**: Usa URLs do DispatchPlan diretamente

## 📝 Requisitos

- Navegador moderno com suporte a:
  - HTML5 Video
  - HTML5 Canvas (para deviceId)
  - Fetch API
  - localStorage

## 🔧 Configuração

### Via URL Parameters

```
?api=http://servidor:3000&uin=TOTEM_001&secret=secret
```

### Via JavaScript

```javascript
window.API_BASE_URL = 'http://servidor:3000';
window.TOTEM_UIN = 'TOTEM_001';
window.TOTEM_SECRET = 'secret';
```

## ✅ Status

- ✅ DispatchPlan nativo implementado
- ✅ Streaming de vídeo, imagem e HTML
- ✅ Validação temporal
- ✅ Heartbeat e sincronização
