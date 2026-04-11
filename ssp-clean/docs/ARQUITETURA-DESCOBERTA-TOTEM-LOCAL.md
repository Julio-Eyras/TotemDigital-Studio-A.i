# Arquitetura de Descoberta: Totem Local vs Servidor Central

## 📋 Visão Geral

As Smart TVs precisam decidir se devem se comunicar com:
1. **Totem Local** (dispatcher + cache local) - Prioridade alta
2. **Servidor Central** (dispatcher remoto) - Fallback

---

## 🔍 Processo de Descoberta

### 1. Descoberta do Totem Local

#### Método 1: Configuração Manual (Recomendado)

**Configuração na Smart TV:**
```javascript
const CONFIG = {
    TOTEM_IP: '192.168.1.100',  // IP do totem na rede local
    TOTEM_PORT: 8080,            // Porta do servidor HTTP local
    TOTEM_UIN: 'TOTEM_001',      // UIN do totem associado
    DISCOVERY_TIMEOUT: 5000,     // Timeout para descoberta (5s)
    USE_LOCAL_TOTEM: true        // Habilitar uso do totem local
};
```

#### Método 2: Descoberta Automática (mDNS/Bonjour)

**Implementação:**
```javascript
class TotemDiscovery {
    async discoverTotem() {
        // Tentar descobrir totem via mDNS/Bonjour
        // Serviço: _smartsignage-totem._tcp.local
        // Porta: 8080
        
        try {
            // webOS: usar webOS.service.request
            // Tizen: usar SSDP ou mDNS
            
            const totem = await this.discoverViaMDNS();
            if (totem) {
                return {
                    ip: totem.ip,
                    port: totem.port,
                    uin: totem.uin,
                    available: true
                };
            }
        } catch (error) {
            console.warn('[TotemDiscovery] Descoberta mDNS falhou', error);
        }
        
        return null;
    }
    
    async discoverViaMDNS() {
        // Implementação específica por plataforma
        // webOS: webOS.service.request('luna://com.webos.service.mdns', ...)
        // Tizen: tizen.network.getNetworkService('WIFI').getIPAddress()
        
        return null; // Placeholder
    }
}
```

#### Método 3: SSDP (Simple Service Discovery Protocol)

**Implementação:**
```javascript
class TotemDiscovery {
    async discoverViaSSDP() {
        // Enviar M-SEARCH multicast
        // Procurar por: urn:smartsignage-totem:device:1
        
        const ssdpMessage = [
            'M-SEARCH * HTTP/1.1',
            'HOST: 239.255.255.250:1900',
            'MAN: "ssdp:discover"',
            'ST: urn:smartsignage-totem:device:1',
            'MX: 3',
            ''
        ].join('\r\n');
        
        // Enviar via UDP multicast
        // Aguardar resposta com IP e porta do totem
        
        return null; // Placeholder
    }
}
```

---

## 🎯 Lógica de Decisão

### Fluxo de Decisão

```
┌─────────────────────────────────────┐
│ Smart TV Inicializa                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 1. Verificar Configuração Manual   │
│    (TOTEM_IP configurado?)         │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
       SIM           NÃO
        │             │
        ▼             ▼
┌──────────────┐  ┌──────────────────────┐
│ 2. Testar    │  │ 3. Descoberta Auto   │
│ Conexão      │  │    (mDNS/SSDP)       │
│ Totem Local  │  └──────────┬───────────┘
└──────┬───────┘             │
       │                      │
  ┌────┴────┐           ┌─────┴─────┐
  │         │           │           │
 DISPONÍVEL INDISPONÍVEL  ENCONTRADO NÃO ENCONTRADO
  │         │           │           │
  ▼         ▼           ▼           ▼
┌─────────────────────────────────────────┐
│ 4. Usar Totem Local                     │
│    - Dispatcher local                   │
│    - Cache local                        │
│    - Servidor HTTP local (porta 8080)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 5. Fallback: Servidor Central           │
│    - Dispatcher remoto                 │
│    - Cache próprio da TV                │
│    - URLs remotas                       │
└─────────────────────────────────────────┘
```

### Implementação da Lógica

```javascript
class TotemConnectionManager {
    constructor(config) {
        this.config = config;
        this.totemInfo = null;
        this.useLocalTotem = false;
    }
    
    /**
     * Determina se deve usar totem local ou servidor central
     */
    async determineConnectionStrategy() {
        // 1. Verificar configuração manual
        if (this.config.TOTEM_IP) {
            const available = await this.testTotemConnection(
                this.config.TOTEM_IP,
                this.config.TOTEM_PORT || 8080
            );
            
            if (available) {
                this.totemInfo = {
                    ip: this.config.TOTEM_IP,
                    port: this.config.TOTEM_PORT || 8080,
                    uin: this.config.TOTEM_UIN,
                    type: 'configured'
                };
                this.useLocalTotem = true;
                return { useLocalTotem: true, totemInfo: this.totemInfo };
            }
        }
        
        // 2. Tentar descoberta automática
        const discovery = new TotemDiscovery();
        const discoveredTotem = await discovery.discoverTotem();
        
        if (discoveredTotem) {
            const available = await this.testTotemConnection(
                discoveredTotem.ip,
                discoveredTotem.port
            );
            
            if (available) {
                this.totemInfo = discoveredTotem;
                this.useLocalTotem = true;
                return { useLocalTotem: true, totemInfo: this.totemInfo };
            }
        }
        
        // 3. Fallback: servidor central
        this.useLocalTotem = false;
        return { useLocalTotem: false, totemInfo: null };
    }
    
    /**
     * Testa conexão com totem local
     */
    async testTotemConnection(ip, port) {
        try {
            const url = `http://${ip}:${port}/health`;
            const response = await fetch(url, {
                method: 'GET',
                timeout: this.config.DISCOVERY_TIMEOUT || 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                // Verificar se é realmente um totem SmartSignage
                return data.status === 'ok' && data.totemUIN !== undefined;
            }
            
            return false;
        } catch (error) {
            console.warn('[TotemConnectionManager] Erro ao testar conexão com totem', error);
            return false;
        }
    }
    
    /**
     * Obtém URL base para requisições
     */
    getBaseURL() {
        if (this.useLocalTotem && this.totemInfo) {
            return `http://${this.totemInfo.ip}:${this.totemInfo.port}`;
        }
        return this.config.API_BASE_URL || 'http://localhost:3000';
    }
    
    /**
     * Obtém UIN do totem (local ou remoto)
     */
    getTotemUIN() {
        if (this.useLocalTotem && this.totemInfo) {
            return this.totemInfo.uin;
        }
        return this.config.TOTEM_UIN; // UIN da própria TV ou totem remoto
    }
}
```

---

## 🔄 Fluxo Completo: Totem Local

### Smart TV conectada ao Totem Local

```
┌─────────────────────────────────────────────────────────┐
│ Smart TV Inicializa                                     │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Descoberta do Totem Local                            │
│    - Configuração manual OU                             │
│    - Descoberta automática (mDNS/SSDP)                  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Teste de Conexão                                     │
│    GET http://{totem_ip}:8080/health                    │
│    Resposta: {"status":"ok","totemUIN":"TOTEM_001"}    │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Obter Token de Dispositivo                           │
│    GET /api/player/token?uin={totem_uin}&...            │
│    Via: Totem Local (proxy) OU Servidor Central        │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Obter DispatchPlan                                   │
│    GET /api/player/dispatch?uin={totem_uin}&...        │
│    Via: Totem Local (dispatcher local)                  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Totem Processa DispatchPlan Localmente              │
│    - Verifica campanhas ativas                         │
│    - Aplica regras de mixagem                          │
│    - Retorna plano de exibição                         │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Smart TV Baixa Mídias                                │
│    - Prioridade: Totem HTTP Local                       │
│      http://{totem_ip}:8080/media/123_abc123.mp4       │
│    - Fallback: Cache próprio da TV                     │
│    - Último recurso: URL remota                        │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Reprodução                                            │
│    - Mídias do totem local (baixa latência)            │
│    - Cache local da TV (resiliência)                   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Fluxo Completo: Servidor Central (Fallback)

### Smart TV sem Totem Local

```
┌─────────────────────────────────────────────────────────┐
│ Smart TV Inicializa                                     │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Tentativa de Descoberta do Totem                    │
│    - Timeout após 5 segundos                           │
│    - Totem não encontrado                              │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Fallback: Servidor Central                          │
│    API_BASE_URL: http://servidor-central:3000          │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Obter Token de Dispositivo                           │
│    GET http://servidor-central:3000/api/player/token   │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 4. Obter DispatchPlan                                   │
│    GET http://servidor-central:3000/api/player/dispatch│
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 5. Servidor Central Processa DispatchPlan               │
│    - Verifica campanhas ativas                         │
│    - Aplica regras de mixagem                          │
│    - Retorna plano de exibição                         │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 6. Smart TV Baixa Mídias                                │
│    - Cache próprio da TV                               │
│    - URLs remotas do servidor central                  │
└──────────────┬──────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────┐
│ 7. Reprodução                                            │
│    - Cache local (se disponível)                       │
│    - Streaming remoto                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 🏗️ Totem como Dispatcher Local

### Funcionalidades do Totem Local

O totem funciona como **dispatcher local** para suas Smart TVs associadas:

1. **Cache de DispatchPlan**
   - Armazena último DispatchPlan recebido do servidor central
   - Serve DispatchPlan para TVs mesmo se servidor central offline

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

### Implementação no Totem

```javascript
// Totem (Android Box / Linux / Windows)
class TotemLocalDispatcher {
    constructor() {
        this.localDispatchPlan = null;
        this.httpServer = null;
        this.cacheManager = null;
    }
    
    /**
     * Inicializa dispatcher local
     */
    async init() {
        // 1. Obter DispatchPlan do servidor central
        const dispatchPlan = await this.fetchFromCentral();
        this.localDispatchPlan = dispatchPlan;
        
        // 2. Processar cache de mídias
        await this.cacheManager.processDispatchPlan(dispatchPlan);
        
        // 3. Iniciar servidor HTTP local
        this.httpServer = new LocalHttpServer(this.cacheManager);
        this.httpServer.start();
        
        // 4. Registrar serviço de descoberta (mDNS/SSDP)
        await this.registerDiscoveryService();
    }
    
    /**
     * Processa requisição de DispatchPlan de uma Smart TV
     */
    async handleDispatchRequest(tvUIN, deviceId, timestamp, timezone) {
        // 1. Verificar se tem DispatchPlan local válido
        if (this.localDispatchPlan && this.isPlanValid(this.localDispatchPlan)) {
            // Aplicar regras locais
            const localPlan = this.applyLocalRules(this.localDispatchPlan, tvUIN);
            return localPlan;
        }
        
        // 2. Fallback: buscar do servidor central
        const centralPlan = await this.fetchFromCentral();
        this.localDispatchPlan = centralPlan;
        return centralPlan;
    }
    
    /**
     * Registra serviço de descoberta
     */
    async registerDiscoveryService() {
        // mDNS/Bonjour: _smartsignage-totem._tcp.local
        // SSDP: urn:smartsignage-totem:device:1
        
        // Anunciar:
        // - IP do totem
        // - Porta HTTP (8080)
        // - UIN do totem
        // - Versão do serviço
    }
}
```

---

## 📡 Endpoints do Totem Local

### Health Check
```
GET http://{totem_ip}:8080/health

Resposta:
{
  "status": "ok",
  "totemUIN": "TOTEM_001",
  "version": "2.1.0",
  "cacheSize": 1024000,
  "timestamp": 1705123456789
}
```

### DispatchPlan (via Totem)
```
GET http://{totem_ip}:8080/api/player/dispatch?uin={tv_uin}&token={token}&...

Resposta:
{
  "success": true,
  "fromCache": true,
  "plan": {
    "totemId": 1,
    "playlistId": 1,
    "mediaItems": [...]
  }
}
```

### Mídias do Cache
```
GET http://{totem_ip}:8080/media/{mediaId}_{checksum}.{ext}

Headers:
Range: bytes=0-1023  (opcional, para streaming)

Resposta:
[Arquivo binário da mídia]
```

---

## 🔧 Configuração Recomendada

### Smart TV (webOS/Tizen)

```javascript
const CONFIG = {
    // Descoberta
    TOTEM_IP: null,              // null = descoberta automática
    TOTEM_PORT: 8080,
    DISCOVERY_TIMEOUT: 5000,
    
    // Fallback
    API_BASE_URL: 'http://servidor-central:3000',
    USE_LOCAL_TOTEM: true,
    
    // Cache
    CACHE_ENABLED: true,
    CACHE_MAX_SIZE: 500 * 1024 * 1024  // 500MB
};
```

### Totem (Android Box / Linux / Windows)

```javascript
const CONFIG = {
    // Servidor HTTP Local
    HTTP_PORT: 8080,
    CACHE_DIR: './cache/media',
    
    // Descoberta
    DISCOVERY_ENABLED: true,
    DISCOVERY_SERVICE: 'mDNS',  // ou 'SSDP'
    
    // Servidor Central
    CENTRAL_API_URL: 'http://servidor-central:3000',
    SYNC_INTERVAL: 900000  // 15 minutos
};
```

---

## 🎯 Vantagens da Arquitetura

### Totem Local
- ✅ **Baixa Latência**: Mídias servidas localmente
- ✅ **Redução de Tráfego**: Menos uso de internet
- ✅ **Resiliência**: Funciona mesmo se servidor central offline
- ✅ **Descoberta Automática**: Não requer configuração manual

### Servidor Central (Fallback)
- ✅ **Centralização**: Gerenciamento único
- ✅ **Atualizações**: Sincronização automática
- ✅ **Escalabilidade**: Suporta muitos totens/TVs

---

## 📝 Resumo

**Smart TVs decidem usar Totem Local quando:**
1. Totem encontrado via configuração manual OU descoberta automática
2. Health check do totem responde com sucesso
3. Totem tem DispatchPlan válido

**Smart TVs usam Servidor Central quando:**
1. Totem local não encontrado
2. Totem local não responde
3. Totem local não tem DispatchPlan válido

**Totem Local funciona como:**
- Dispatcher local (processa DispatchPlan)
- Cache de mídias (serve via HTTP local)
- Proxy para servidor central (quando necessário)
