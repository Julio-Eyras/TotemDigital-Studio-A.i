# Guia Completo de Implementação - Player Client

## 📋 Visão Geral

Este documento consolida toda a implementação realizada para integrar os players com o sistema Dispatcher-Totem, incluindo cache local, servidor HTTP local e descoberta automática de totem.

---

## 🎯 Componentes Implementados

### 1. Sistema de Cache Local

#### Android
- **Arquivo:** `platforms/android/.../cache/MediaCacheManager.kt`
- **Funcionalidades:**
  - Download automático de mídias do DispatchPlan
  - Cache em `/sdcard/SmartSignage/cache/media/`
  - Validação SHA-256
  - Política LRU
  - Modo offline

#### webOS
- **Arquivo:** `platforms/webos/.../cache/MediaCacheManager.js`
- **Funcionalidades:**
  - Download via webOS FileSystem API
  - Cache em `/media/internal/smartsignage/cache/`
  - Limite: 500MB
  - Validação SHA-256
  - Política LRU

#### Tizen
- **Arquivo:** `platforms/tizen/.../cache/MediaCacheManager.js`
- **Funcionalidades:**
  - Download via Tizen FileSystem API
  - Cache em `/media/internal/smartsignage/cache/`
  - Limite: 500MB
  - Validação SHA-256
  - Política LRU

---

### 2. Servidor HTTP Local (Totens)

#### Android
- **Arquivo:** `platforms/android/.../server/LocalHttpServer.kt`
- **Porta:** 8080 (configurável)
- **Endpoints:**
  - `GET /health` - Health check com totemUIN
  - `GET /media/{mediaId}_{checksum}.{ext}` - Serve mídias do cache

#### Linux/Windows
- **Arquivo:** `platforms/linux-windows/local-http-server.js`
- **Porta:** 8080 (configurável)
- **Endpoints:** Mesmos do Android
- **Uso:** `node local-http-server.js`

---

### 3. Descoberta de Totem Local

#### webOS
- **Arquivo:** `platforms/webos/.../totem/TotemConnectionManager.js`
- **Métodos:**
  - Configuração manual (`TOTEM_IP`)
  - Descoberta mDNS/Bonjour
  - Varredura de rede local

#### Tizen
- **Arquivo:** `platforms/tizen/.../totem/TotemConnectionManager.js`
- **Métodos:**
  - Configuração manual (`TOTEM_IP`)
  - Descoberta SSDP
  - Varredura de rede local

---

## 🔄 Fluxo Completo de Integração

### Totem (Android Box / Linux / Windows)

```
1. Inicialização
   ↓
2. Obter deviceId
   ↓
3. Obter token de dispositivo (/api/player/token)
   ↓
4. Obter DispatchPlan (/api/player/dispatch)
   ↓
5. Processar cache local (download mídias)
   ├─ MediaCacheManager.processDispatchPlan()
   ├─ Download em background
   ├─ Validação de checksums
   └─ Armazenamento local
   ↓
6. Iniciar servidor HTTP local (porta 8080)
   ├─ LocalHttpServer.start()
   ├─ Serve mídias do cache
   └─ Health check disponível
   ↓
7. Registrar serviço de descoberta (mDNS/SSDP)
   ├─ Anunciar IP e porta
   └─ Incluir totemUIN
   ↓
8. Reproduzir conteúdo (usando caminhos locais)
   ↓
9. Smart TVs conectam ao totem via HTTP local
```

### Smart TV (webOS / Tizen)

```
1. Inicialização
   ↓
2. TotemConnectionManager.determineConnectionStrategy()
   ├─ Tentar configuração manual
   ├─ Tentar descoberta automática
   └─ Fallback: servidor central
   ↓
3. Obter deviceId
   ↓
4. Obter token de dispositivo (/api/player/token)
   ├─ Via totem local (se disponível)
   └─ Via servidor central (fallback)
   ↓
5. Obter DispatchPlan (/api/player/dispatch)
   ├─ Via totem local (dispatcher local)
   └─ Via servidor central (fallback)
   ↓
6. Processar cache local (download mídias)
   ├─ MediaCacheManager.processDispatchPlan()
   ├─ Download em background
   └─ Armazenamento local
   ↓
7. Reproduzir conteúdo (priorização)
   ├─ Prioridade 1: Totem HTTP Local
   │   └─ http://{totem_ip}:8080/media/{mediaId}_{checksum}.{ext}
   ├─ Prioridade 2: Cache Local da TV
   │   └─ file:///media/internal/smartsignage/cache/{mediaId}_{checksum}.{ext}
   └─ Prioridade 3: URL Remota
       └─ URL original do DispatchPlan
```

---

## 📝 Configuração

### Totem (Android Box)

```kotlin
// Inicializar cache
val cacheManager = MediaCacheManager(context)

// Inicializar servidor HTTP local
val server = LocalHttpServer(context, cacheManager, port = 8080)
server.start()

// Obter URL base
val baseUrl = server.getBaseUrl() // http://192.168.1.100:8080
```

### Totem (Linux/Windows)

```bash
# Variáveis de ambiente
export PORT=8080
export CACHE_DIR=./cache/media
export TOTEM_UIN=TOTEM_001

# Iniciar servidor
node local-http-server.js
```

### Smart TV (webOS)

```javascript
const CONFIG = {
  // Descoberta
  TOTEM_IP: null,              // null = descoberta automática
  TOTEM_PORT: 8080,
  AUTO_DISCOVERY: true,
  
  // Fallback
  API_BASE_URL: 'http://servidor-central:3000',
  
  // Cache
  CACHE_ENABLED: true,
  CACHE_MAX_SIZE: 500 * 1024 * 1024  // 500MB
};
```

### Smart TV (Tizen)

```javascript
const CONFIG = {
  // Descoberta
  totem_ip: null,              // null = descoberta automática
  totem_port: 8080,
  auto_discovery: true,
  
  // Fallback
  api_base_url: 'http://servidor-central:3000',
  
  // Cache
  cache_enabled: true,
  cache_max_size: 500 * 1024 * 1024  // 500MB
};
```

---

## 🧪 Testes

### Teste de Integração Dispatcher

```bash
cd player-client/test
node test-dispatcher-integration.js
```

### Teste de Servidor HTTP Local

```bash
# Iniciar servidor
cd player-client/platforms/linux-windows
node local-http-server.js

# Em outro terminal, testar health check
curl http://localhost:8080/health

# Testar servir mídia (requer arquivo no cache)
curl http://localhost:8080/media/123_abc123.mp4
```

---

## 📊 Priorização de Mídias

### Ordem de Prioridade

1. **Totem HTTP Local**
   - URL: `http://{totem_ip}:8080/media/{mediaId}_{checksum}.{ext}`
   - Vantagem: Baixa latência, reduz tráfego externo
   - Quando usar: Totem local disponível e mídia em cache

2. **Cache Local da TV**
   - URL: `file:///media/internal/smartsignage/cache/{mediaId}_{checksum}.{ext}`
   - Vantagem: Funciona offline, sem latência de rede
   - Quando usar: Mídia já baixada localmente

3. **URL Remota**
   - URL: URL original do DispatchPlan
   - Vantagem: Sempre disponível (se internet funcionando)
   - Quando usar: Totem e cache local indisponíveis

---

## 🔍 Descoberta de Totem

### Métodos de Descoberta

1. **Configuração Manual**
   ```javascript
   CONFIG.TOTEM_IP = '192.168.1.100';
   ```
   - Prioridade mais alta
   - Testa conexão imediatamente

2. **mDNS/Bonjour** (webOS)
   - Serviço: `_smartsignage-totem._tcp.local`
   - Porta: 8080
   - Descobre automaticamente na rede local

3. **SSDP** (Tizen)
   - URN: `urn:smartsignage-totem:device:1`
   - Descobre via multicast UDP

4. **Varredura de Rede**
   - Testa IPs comuns na subnet (1-10)
   - Último recurso se outros métodos falharem

---

## 🎯 Totem como Dispatcher Local

### Funcionalidades

1. **Cache de DispatchPlan**
   - Armazena último DispatchPlan recebido
   - Serve para TVs mesmo se servidor central offline

2. **Processamento Local**
   - Aplica regras de mixagem localmente
   - Filtra campanhas por horário/localização
   - Prioriza conteúdo local

3. **Servidor HTTP Local**
   - Serve mídias do cache (porta 8080)
   - Reduz carga na rede
   - Baixa latência para TVs

4. **Proxy para Servidor Central**
   - Pode fazer proxy de requisições
   - Cacheia respostas quando possível
   - Reduz tráfego externo

---

## 📚 Documentação Relacionada

- `REFATORACAO_DISPATCHER_COMPLETA.md` - Refatoração dos players
- `IMPLEMENTACAO_CACHE_SERVIDOR_LOCAL.md` - Cache e servidor HTTP
- `INTEGRACAO_TOTEM_CONNECTION_MANAGER.md` - Descoberta de totem
- `docs/ARQUITETURA-DESCOBERTA-TOTEM-LOCAL.md` - Arquitetura completa
- `docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md` - Arquitetura de cache
- `docs/GUIA_INTEGRACAO_PLAYER_DISPATCHER.md` - Guia de integração

---

## ✅ Checklist de Validação

### Android
- [x] MediaCacheManager implementado
- [x] LocalHttpServer implementado
- [x] Integração com PlaylistManager
- [x] Integração com PlayerViewModel
- [x] Health check com totemUIN
- [ ] Teste em dispositivo real
- [ ] Teste de servidor HTTP local

### webOS
- [x] MediaCacheManager implementado
- [x] TotemConnectionManager implementado
- [x] Integração com app.js
- [x] Priorização de caminhos locais
- [x] Modo offline
- [ ] Teste em TV webOS real

### Tizen
- [x] MediaCacheManager implementado
- [x] TotemConnectionManager implementado
- [x] Integração com app.js
- [x] Priorização de caminhos locais
- [x] Modo offline
- [ ] Teste em TV Tizen real

### Linux/Windows
- [x] LocalHttpServer implementado
- [x] Health check com totemUIN
- [x] Suporte a Range requests
- [ ] Teste em ambiente real

---

## 🚀 Próximos Passos

1. **Testes em Dispositivos Reais**
   - Validar funcionamento em cada plataforma
   - Testar descoberta automática
   - Medir performance

2. **Otimizações**
   - Compressão de metadados
   - Download incremental
   - Prefetch inteligente

3. **Monitoramento**
   - Métricas de cache hit/miss
   - Estatísticas de download
   - Alertas de espaço insuficiente

---

## 🎉 Status Final

**Implementação:** 100% completa
**Integração:** Todos os players integrados
**Documentação:** Completa
**Testes:** Scripts criados

**Sistema pronto para:**
- ✅ Descoberta automática de totem local
- ✅ Cache local em todas as plataformas
- ✅ Servidor HTTP local em totens
- ✅ Priorização de caminhos locais
- ✅ Modo offline completo
- ✅ Totem como dispatcher e cache local
