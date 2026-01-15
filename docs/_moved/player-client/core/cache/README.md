# Sistema de Cache e Download de Mídias

Este diretório contém os módulos para download, cache e distribuição local de mídias baseados no `DispatchPlan` do Dispatcher-Totem.

## 📁 Arquivos

### `MediaDownloader.js`
Sistema completo de download e cache de mídias:
- ✅ Download assíncrono de mídias do `DispatchPlan`
- ✅ Cache local com validação de checksums SHA-256
- ✅ Política de limpeza LRU (Least Recently Used)
- ✅ Modo offline com fallback para último `DispatchPlan`
- ✅ Retry automático de downloads falhos
- ✅ Suporte a downloads simultâneos limitados
- ✅ Validação de integridade de arquivos

### `LocalHttpServer.js`
Servidor HTTP local para totens servirem mídias às Smart TVs:
- ✅ Servidor HTTP simples na porta 8080 (configurável)
- ✅ Serve mídias do cache local
- ✅ Suporte a Range requests (streaming parcial)
- ✅ Endpoint opcional para `DispatchPlan`
- ✅ CORS habilitado para acesso de TVs

### `../examples/DispatcherIntegrationExample.js`
Exemplo completo de integração:
- ✅ Inicialização de todos os componentes
- ✅ Sincronização periódica do `DispatchPlan`
- ✅ Heartbeat com telemetria
- ✅ Modo offline automático

## 🚀 Uso Básico

### 1. Inicializar MediaDownloader

```javascript
const MediaDownloader = require('./MediaDownloader');
const apiClient = require('../api/client');

const downloader = new MediaDownloader({
  cacheDir: './cache',
  maxCacheSize: 32 * 1024 * 1024 * 1024, // 32GB
  apiClient: apiClient,
  fileSystem: fileSystemAdapter,
  storage: storageAdapter
});
```

### 2. Processar DispatchPlan

```javascript
// Obter DispatchPlan do backend
const dispatchPlan = await apiClient.getDispatchPlan(uin, token, deviceId);

// Processar e baixar mídias
const stats = await downloader.processDispatchPlan(dispatchPlan);
console.log(`Download: ${stats.success} sucesso, ${stats.failed} falhas`);
```

### 3. Obter Mídia do Cache

```javascript
// Obter caminho local de uma mídia
const cached = await downloader.getCachedMedia(mediaId);
if (cached && cached.valid) {
  console.log('Mídia disponível em:', cached.localPath);
}
```

### 4. Iniciar Servidor HTTP Local (Totem)

```javascript
const LocalHttpServer = require('../server/LocalHttpServer');

const server = new LocalHttpServer({
  port: 8080,
  cacheDir: './cache',
  mediaDownloader: downloader,
  apiClient: apiClient
});

await server.start();
console.log('Servidor iniciado em:', server.getBaseUrl());
```

## 📋 Estrutura de Cache

```
cache/
├── media/
│   ├── {mediaId}_{checksum}.mp4
│   ├── {mediaId}_{checksum}.jpg
│   └── ...
├── metadata.json          # Metadados de mídias
└── dispatch_plan.json     # Último DispatchPlan (modo offline)
```

## 🔧 Configuração

### MediaDownloader

```javascript
{
  cacheDir: './cache',                    // Diretório de cache
  maxCacheSize: 32 * 1024 * 1024 * 1024, // Tamanho máximo (32GB)
  cacheThreshold: 0.8,                    // Limite antes de limpar (80%)
  maxConcurrentDownloads: 2,              // Downloads simultâneos
  downloadTimeout: 300000,                // Timeout (5 minutos)
  maxRetries: 3,                          // Tentativas de retry
  retryDelay: 5000,                       // Delay entre retries (5s)
  keepHistoryPlans: 3                     // Manter N planos anteriores
}
```

### LocalHttpServer

```javascript
{
  port: 8080,                             // Porta do servidor
  host: '0.0.0.0',                        // Interface (todas)
  cacheDir: './cache',                    // Diretório de cache
  mediaDownloader: downloader,             // Instância do MediaDownloader
  apiClient: apiClient                     // Instância do APIClient
}
```

## 🔄 Fluxo Completo

```
1. Player inicializa
   ↓
2. Obtém token de dispositivo (/api/player/token)
   ↓
3. Obtém DispatchPlan (/api/player/dispatch)
   ↓
4. MediaDownloader processa plano
   ├─ Verifica cache local
   ├─ Baixa mídias faltantes
   ├─ Valida checksums
   └─ Salva em cache
   ↓
5. Totem inicia servidor HTTP local (opcional)
   ↓
6. Player reproduz mídias do cache local
   ↓
7. Smart TVs acessam mídias via HTTP local do totem
   ↓
8. Sincronização periódica (ex: 15 minutos)
   ├─ Verifica novo DispatchPlan
   ├─ Baixa mídias novas
   └─ Limpa cache antigo (LRU)
```

## 🌐 Modo Offline

Quando a Internet cai:

1. **Detecção**: Timeout em `/api/player/dispatch`
2. **Fallback**: Carrega último `DispatchPlan` do cache
3. **Validação**: Verifica mídias disponíveis no cache
4. **Reprodução**: Continua usando mídias locais
5. **Serviço**: Totem continua servindo TVs via HTTP local

```javascript
// Modo offline automático
const lastPlan = await downloader.loadLastDispatchPlan();
if (lastPlan) {
  console.log('Usando plano em cache (modo offline)');
  // Continuar reprodução...
}
```

## 📊 Estatísticas

```javascript
const stats = downloader.getStats();
console.log({
  total: stats.total,           // Total de downloads
  success: stats.success,        // Sucessos
  failed: stats.failed,         // Falhas
  skipped: stats.skipped,       // Pulados (já em cache)
  activeDownloads: stats.activeDownloads, // Downloads ativos
  queueLength: stats.queueLength,          // Fila de downloads
  cacheSize: stats.cacheSize              // Tamanho do cache
});
```

## 🔒 Validação de Integridade

Todas as mídias são validadas com checksums SHA-256:

```javascript
// Validação automática durante download
const isValid = await downloader.validateChecksum(localPath, expectedChecksum);

// Se inválido, arquivo é removido e baixado novamente
```

## 🧹 Limpeza de Cache (LRU)

Cache é limpo automaticamente quando:
- Espaço disponível < 20% do máximo
- Novas mídias precisam ser baixadas
- Mídias não usadas há > 7 dias

**Política LRU**: Remove mídias menos recentemente acessadas primeiro, preservando sempre as mídias do plano atual.

## 📝 Notas Importantes

1. **Totem vs TV**: 
   - Totem: Cache completo + servidor HTTP local
   - TV: Cache leve (opcional) + busca do totem

2. **Plataformas**:
   - Node.js/Electron: Suporte completo
   - Browser: Sem servidor HTTP local (limitações)
   - webOS/Tizen: Cache leve apenas

3. **Segurança**:
   - Tokens HMAC para autenticação
   - Validação de checksums obrigatória
   - CORS configurado no servidor local

4. **Performance**:
   - Downloads simultâneos limitados (padrão: 2)
   - Cache em memória para metadados
   - Range requests para streaming parcial

## 🔗 Ver Também

- `../api/client.js` - Cliente API com endpoints do dispatcher
- `../examples/DispatcherIntegrationExample.js` - Exemplo completo
- `../../docs/GUIA_INTEGRACAO_PLAYER_DISPATCHER.md` - Guia de integração
- `../../docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md` - Arquitetura completa
