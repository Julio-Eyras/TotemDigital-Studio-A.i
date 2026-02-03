# 🔄 Fluxo Completo: Player-Web-Cache - UIN, Hardware, Dispatcher e Aprovação

## 📋 Visão Geral

Este documento explica **todo o processo** do player-web-cache:
1. Como gera o UIN
2. Como coleta informações de hardware
3. Como envia para o dispatcher
4. Como funciona a aprovação

---

## 1. 🆔 Fluxo Inicial do Player

### **1.1 Player Procura Config.json.enc**

**Localização:** `player-web-cache/index.html` (linha 98-115)

**Código:**
```javascript
async function loadUinFromConfig() {
    try {
        // 1. Buscar arquivo config.json.enc (servido pelo Nginx como arquivo estático)
        const r = await fetch('/player/config.json.enc');
        if (!r.ok) return null;
        
        const cfg = await r.json();
        if (!cfg.encrypted || !cfg.data) return null;
        
        // 2. Enviar para servidor desencriptar e validar
        const dec = await fetch(API_BASE + '/api/player/decrypt-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                encryptedConfig: cfg, 
                currentMac: null 
            })
        });
        
        if (!dec.ok) return null;
        const d = await dec.json();
        
        // 3. Retorna UIN se válido
        return (d.valid && d.uin) ? d.uin : null;
    } catch (e) {
        return null;
    }
}
```

**Se config.json.enc não existir:**
- Player não encontra arquivo
- Player precisa solicitar aprovação via heartbeat

### **1.2 Coleta de Hardware**

**Localização:** `player-web-cache/index.html` (linha 117-130)

**Código:**
```javascript
async function collectHardware() {
    try {
        // 1. Tenta obter hardware info do servidor
        const r = await fetch(API_BASE + '/api/player/hardware-info');
        let h = r.ok ? await r.json() : {};
        
        // 2. Se servidor não retornou, usa dados do navegador
        if (!h.userAgent) {
            h = { 
                userAgent: navigator.userAgent, 
                platform: navigator.platform, 
                timestamp: Date.now() 
            };
        }
        
        // 3. Gera hash SHA-256 dos dados coletados
        const str = JSON.stringify(h);
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        const hex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        
        // 4. Retorna dados + hash
        return { ...h, hardwareHash: hex };
    } catch (e) {
        // Fallback: apenas dados do navegador
        return { 
            userAgent: navigator.userAgent, 
            platform: navigator.platform, 
            timestamp: Date.now() 
        };
    }
}
```

**O que o servidor retorna (`/api/player/hardware-info`):**
- **MAC Address** (via comando `ip link show` ou `/sys/class/net/eth0/address`)
- **Hostname** (via `os.hostname()`)
- **Platform** (via `os.platform()` - linux, win32, darwin, etc.)
- **Architecture** (via `os.arch()` - x64, arm64, etc.)

**Localização Backend:** `backend/src/routes/player.ts` (linha 857-885)

---

### **1.2 Geração do UIN**

**Localização:** `player-web-cache/index.html` (linha 132-143)

**Código:**
```javascript
async function generateUIN(hw) {
    // 1. Cria objeto com dados de hardware
    const s = JSON.stringify({
        mac: hw.macAddress || hw.mac || 'unknown',
        hostname: hw.hostname || 'unknown',
        platform: hw.platform || 'unknown',
        hash: hw.hardwareHash || 'unknown'
    });
    
    // 2. Gera hash SHA-256
    const buf = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    const hex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // 3. Formato: SSP-{primeiros 16 caracteres do hash}
    return 'SSP-' + hex.substring(0, 16);
}
```

**Exemplo de UIN gerado:** `SSP-3a8f9b2c1d4e5f6`

**Características:**
- ✅ **Único:** Baseado em hardware específico
- ✅ **Determinístico:** Mesmo hardware = mesmo UIN
- ✅ **Não reversível:** Hash SHA-256 não pode ser revertido
- ✅ **Formato:** `SSP-` + 16 caracteres hexadecimais

---

## 2. 📤 Solicitação de Aprovação via Heartbeat

### **2.1 Player Envia Heartbeat Solicitando Aprovação**

**Quando:** Player não encontra `config.json.enc` e precisa solicitar aprovação

**Fluxo:**
1. Player tenta carregar `config.json.enc` → Não encontra
2. Player coleta hardware (MAC, hostname, platform, etc.)
3. Player gera UIN baseado em hardware
4. Player envia **heartbeat solicitando aprovação** com todas as informações coletadas

**Endpoint:** `POST /api/player/heartbeat`

**Payload:**
```json
{
  "uin": "SSP-3a8f9b2c1d4e5f6",
  "token": "TEMPORARY_TOKEN_OU_VAZIO",
  "requestApproval": true,
  "hardware": {
    "macAddress": "aa:bb:cc:dd:ee:ff",
    "hostname": "player-001",
    "platform": "linux",
    "arch": "x64",
    "hardwareHash": "abc123...",
    "userAgent": "Mozilla/5.0..."
  },
  "status": "pending_approval"
}
```

### **2.2 Dispatcher Detecta Heartbeat de Solicitação de Aprovação**

**O que o dispatcher faz:**
1. **Detecta** que é um heartbeat de solicitação de aprovação (`requestApproval: true`)
2. **Coleta todas as informações** do heartbeat:
   - Hardware info (MAC, hostname, platform, etc.)
   - UIN gerado pelo player
   - IP address
   - User agent
   - Métricas (se disponíveis)
3. **Toma decisão necessária:**
   - Valida se totem está pré-cadastrado
   - Confere informações recebidas com o cadastro
   - Se válido, vincula hardware ao totem
   - Gera `config.json.enc` se necessário
   - Atualiza status do totem

## 3. 📤 Vinculação de Hardware ao Totem Pré-cadastrado

### **3.1 ⚠️ IMPORTANTE: Totem Já Deve Estar Cadastrado**

**O totem NÃO é criado neste momento!** Ele já deve estar **pré-cadastrado** pelo publisher no sistema.

### **3.2 Envio de Vinculação (Alternativa ao Heartbeat)**

**Localização:** `player-web-cache/index.html` (linha 145-174)

**Nota:** Este é um método alternativo. O método principal é via heartbeat solicitando aprovação.

**Código:**
```javascript
async function autoRegister(uin) {
    try {
        // 1. Coleta hardware
        const hw = await collectHardware();
        
        // 2. Gera UIN se não fornecido
        const u = uin || await generateUIN(hw);
        
        // 3. Envia para servidor VINCULAR hardware ao totem
        const r = await fetch(API_BASE + '/api/player/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uin: u,
                hardware: {
                    macAddress: hw.macAddress || null,
                    hostname: hw.hostname || null,
                    platform: hw.platform || null,
                    hardwareHash: hw.hardwareHash || null,
                    userAgent: hw.userAgent || navigator.userAgent
                }
            })
        });
        
        // 4. Processa resposta
        if (!r.ok) {
            const err = await r.json().catch(() => ({}));
            if (r.status === 404) {
                // UIN não cadastrado - totem deve ser pré-cadastrado
                return { success: false, error: 'UIN não cadastrado. Totem deve ser pré-cadastrado pelo publisher.' };
            }
            if (r.status === 409) {
                // Hardware já vinculado a outro totem
                return { success: false, error: 'Hardware já vinculado a outro totem' };
            }
            return { success: false, error: err.error || 'Erro ao vincular hardware' };
        }
        
        const data = await r.json();
        
        // 5. Armazena UIN localmente (temporário, até aprovação)
        if (data.uin && typeof localStorage !== 'undefined') {
            localStorage.setItem('totemUIN', data.uin);
        }
        
        return { 
            success: true, 
            uin: data.uin || u, 
            token: data.token,  // Token HMAC gerado pelo servidor
            status: data.status || 'pending_approval' 
        };
    } catch (e) {
        return { success: false, error: (e && e.message) || 'Erro ao vincular hardware' };
    }
}
```

**Endpoint Backend:** `POST /api/player/register` (alternativo)

**Endpoint Principal:** `POST /api/player/heartbeat` com `requestApproval: true`

**Localização Backend:** 
- Heartbeat: `backend/src/routes/player.ts` (linha 462-577)
- Register: `backend/src/routes/player.ts` (linha 888-1211)

**O que o servidor faz:**

1. **Valida que UIN Existe (Pré-cadastrado):**
   ```typescript
   const existingTotem = await totemService.getTotemByUin(uin);
   if (!existingTotem) {
       return res.status(404).json({ 
           error: 'UIN não cadastrado',
           message: 'Este UIN não está cadastrado no sistema. O totem deve ser cadastrado pelo publisher antes de se conectar.'
       });
   }
   ```
   - Se UIN não existe → **Erro 404** (totem deve ser pré-cadastrado)
   - Se existe → Continua

2. **Verifica Hardware Duplicado:**
   - Previne clonagem: verifica se hardware já está vinculado a outro totem
   - Se sim → Erro 409

3. **ATUALIZA Totem Existente (NÃO CRIA):**
   ```sql
   UPDATE totems SET
       config = ?::jsonb,  -- Adiciona hardware info ao config existente
       ip_address = ?,
       last_heartbeat = CURRENT_TIMESTAMP,
       status = ?,  -- Se estava 'pending_activation' → 'pending_approval'
       updated_at = CURRENT_TIMESTAMP
   WHERE uin = ?
   ```

4. **Armazena Hardware Info no Campo `config`:**
   ```json
   {
       "hardware": {
           "mac": "aa:bb:cc:dd:ee:ff",
           "hostname": "player-001",
           "platform": "linux",
           "arch": "x64",
           "hardwareHash": "abc123...",
           "linkedAt": "2025-01-23T18:51:00Z"  // Quando hardware foi vinculado
       }
   }
   ```

5. **Gera Token HMAC:**
   ```typescript
   const token = generateTotemToken(uin);
   ```

6. **Retorna:**
   ```json
   {
       "success": true,
       "uin": "SSP-3a8f9b2c1d4e5f6",
       "token": "HMAC_TOKEN...",
       "status": "pending_approval",
       "message": "Hardware vinculado ao totem pré-cadastrado com sucesso"
   }
   ```

---

## 4. 🔄 Comunicação com Dispatcher

### **3.1 Obtenção do DispatchPlan**

**Localização:** `player-web-cache/js/api/client.js` (linha 98-114)

**Código:**
```javascript
async getDispatchPlan(uin, token, deviceId, timestamp, timezone) {
    // 1. Monta query params
    const params = new URLSearchParams({
        uin: uin || this.totemUIN,
        token: token || this.token
    });
    if (deviceId || this.deviceId) params.append('deviceId', deviceId || this.deviceId);
    if (timestamp) params.append('timestamp', timestamp);
    if (timezone) params.append('timezone', timezone);

    // 2. Faz requisição
    const response = await this.request(`/api/player/dispatch?${params}`);

    // 3. Valida resposta
    if (!response || typeof response.success !== 'boolean') {
        throw new Error(response?.error || 'Não foi possível obter DispatchPlan');
    }

    return response;
}
```

**Endpoint:** `GET /api/player/dispatch?uin={UIN}&token={TOKEN}&deviceId={DEVICE_ID}&timestamp={TIMESTAMP}&timezone={TIMEZONE}`

**Localização Backend:** `backend/src/routes/player.ts` (linha 579-700)

**O que o servidor faz:**
1. Valida token HMAC ou device_token
2. Busca totem por UIN
3. Chama `dispatcherTotemService.dispatch()` para gerar plano
4. Retorna `DispatchPlan` com lista de mídias

**Frequência:**
- **Inicial:** Quando player inicia
- **Periódico:** A cada 15 minutos (`dispatchSyncInterval: 900000`)
- **Quando necessário:** Se plano expirar ou mudar

**Localização no Player:** `player-web-cache/js/app.js` (linha 174-259)

---

### **3.2 Estrutura do DispatchPlan**

**O que o player recebe:**
```json
{
    "success": true,
    "fromCache": false,
    "executionTimeMs": 45,
    "plan": {
        "totemId": 123,
        "timestamp": "2025-01-25T10:30:00Z",
        "playlistId": 456,
        "playlistName": "Playlist Principal",
        "mediaItems": [
            {
                "mediaId": 789,
                "order": 1,
                "duration": 30,
                "url": "https://...",
                "mediaType": "video",
                "metadata": { ... }
            }
        ],
        "totalDuration": 300,
        "priority": 10,
        "source": "campaign",
        "sourceId": 101,
        "validityStart": "2025-01-25T10:00:00Z",
        "validityEnd": "2025-01-25T11:00:00Z",
        "metadata": { ... }
    }
}
```

---

## 4. ✅ Processo de Aprovação

### **4.1 Status do Totem**

Após vinculação de hardware, o totem fica com:
- **Status:** `pending_approval` (se estava `pending_activation`)
- **is_active:** `false`
- **Player mostra:** "Aguardando aprovação do administrador"

---

### **4.2 Como Aprovar (Interface Administrativa)**

**NÃO existe link direto de aprovação.** A aprovação é feita através da interface administrativa:

**Passo a Passo:**

1. **Acessar Painel:**
   - URL: `http://seu-servidor:8080/admin` (ou porta configurada)
   - Login como administrador

2. **Navegar para Totens:**
   - Menu: **"Exibidores" → "Totens"**
   - Ou URL direta: `http://seu-servidor:8080/totems`

3. **Aba "Pendentes de Aprovação":**
   - Clicar na aba **"Pendentes de Aprovação"**
   - Ver lista de totens com status `pending_approval`

4. **Visualizar Totem:**
   - Cada card mostra:
     - Nome/Identifier
     - UIN
     - Localização
     - Hardware (MAC, Hostname, Platform)

5. **Clicar em "Aprovar":**
   - Abre diálogo de aprovação
   - Mostra informações completas
   - Opção: "Gerar arquivo de configuração encriptado"
   - Clicar em "Aprovar Totem"

**Localização Frontend:** `frontend/src/pages/Totems/Totems.tsx` (linha 148-173)

---

### **4.3 API de Aprovação**

**Endpoint:** `PUT /api/totems/:id/approve`

**Payload:**
```json
{
    "generateEncryptedConfig": true  // Opcional
}
```

**O que o servidor faz:**
1. Busca totem por ID
2. Verifica se pode aprovar (não pode estar já `online`)
3. Atualiza status para `'online'`
4. Opcionalmente gera arquivo `config.json.enc` encriptado
5. Registra log de auditoria

**Localização Backend:** `backend/src/routes/totems.ts` (linha 523-626)

**Resposta:**
```json
{
    "success": true,
    "message": "Totem aprovado com sucesso",
    "totem": { ... },
    "encryptedConfigPath": "/opt/smart-signage/config.json.enc"  // Se gerado
}
```

---

### **4.4 Após Aprovação - Geração do Config Encriptado**

**O que acontece:**

1. **Status muda:**
   - `pending_approval` → `online`
   - `is_active: false` → `is_active: true`

2. **Se `generateEncryptedConfig = true`, servidor gera `config.json.enc`:**
   - Executa script: `scripts/generate-player-config.sh`
   - Script obtém MAC address do servidor
   - Cria payload: `{UIN}:{MAC}:{TIMESTAMP}`
   - Encripta com AES-256-CBC usando `TOTEM_SECRET_KEY`
   - Salva em: `{PLAYER_DIR}/config.json.enc`
   
   **Arquivo gerado:**
   ```json
   {
       "encrypted": true,
       "version": "1.0",
       "data": "U2FsdGVkX1+abc123...",  // UIN:MAC:TIMESTAMP encriptado
       "mac": "aa:bb:cc:dd:ee:ff",
       "created": "1737653460"
   }
   ```

3. **Player deve ser reiniciado:**
   - Player reinicia (manual ou automático)
   - Na próxima inicialização, carrega UIN de `config.json.enc`

### **4.5 Player Reinicia e Carrega Config Encriptado**

**Código (player-web-cache/index.html linha 98-115):**
```javascript
async function loadUinFromConfig() {
    try {
        // 1. Buscar arquivo config.json.enc (servido pelo Nginx como arquivo estático)
        const r = await fetch('/player/config.json.enc');
        if (!r.ok) return null;
        
        const cfg = await r.json();
        if (!cfg.encrypted || !cfg.data) return null;
        
        // 2. Enviar para servidor desencriptar e validar
        const dec = await fetch(API_BASE + '/api/player/decrypt-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                encryptedConfig: cfg, 
                currentMac: null 
            })
        });
        
        if (!dec.ok) return null;
        const d = await dec.json();
        
        // 3. Retorna UIN se válido
        return (d.valid && d.uin) ? d.uin : null;
    } catch (e) {
        return null;
    }
}
```

**Endpoint Backend:** `POST /api/player/decrypt-config`

**O que o servidor faz:**
1. Desencripta payload usando `TOTEM_SECRET_KEY`
2. Extrai: `{UIN}:{MAC}:{TIMESTAMP}`
3. Valida MAC address (deve corresponder ao hardware atual)
4. Verifica se totem existe e está ativo
5. Retorna UIN se válido

**Localização Backend:** `backend/src/routes/player.ts` (linha 738-850)

### **4.6 Player Inicia Loop Normal**

Após carregar UIN do `config.json.enc`:

1. **Valida totem:**
   - `GET /api/player/token?uin=...`
   - Recebe token HMAC

2. **Obtém DispatchPlan:**
   - `GET /api/player/dispatch?uin=...&token=...`
   - Recebe plano de exibição
   - A cada 15 minutos

3. **Envia Heartbeat:**
   - `POST /api/player/heartbeat`
   - A cada 30 segundos

4. **Envia Eventos:**
   - `POST /api/player/event`
   - Eventos de playback, exibição, etc.

5. **Reproduz mídias:**
   - Conforme plano recebido
   - Usa cache quando possível
   - Fallback para streaming

---

## 6. 🔍 Fluxo Completo Visual

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Player Inicia (Primeira Vez)                            │
│    - Não tem UIN                                            │
│    - Não tem config.json.enc                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Coleta Hardware                                          │
│    - Chama /api/player/hardware-info                       │
│    - Obtém: MAC, hostname, platform, arch                   │
│    - Gera hardwareHash (SHA-256)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Gera UIN                                                 │
│    - Hash SHA-256 de (mac + hostname + platform + hash)     │
│    - Formato: SSP-{16 caracteres hex}                        │
│    - Exemplo: SSP-3a8f9b2c1d4e5f6                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Auto-Registro                                            │
│    POST /api/player/register                                │
│    { uin, hardware: {...} }                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Servidor Cria Totem                                      │
│    - status: 'pending_approval'                             │
│    - is_active: false                                       │
│    - Armazena hardware em config (JSONB)                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Player Mostra                                            │
│    "Aguardando aprovação do administrador"                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Administrador Aprova                                     │
│    - Acessa: /totems                                        │
│    - Aba "Pendentes de Aprovação"                          │
│    - Clica "Aprovar"                                        │
│    PUT /api/totems/:id/approve                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Servidor Atualiza                                        │
│    - status: 'online'                                        │
│    - is_active: true                                         │
│    - Opcional: gera config.json.enc                         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Player Detecta Aprovação                                 │
│    - Valida: GET /api/player/token?uin=...                 │
│    - Recebe: { valid: true }                                │
│    - Inicia reprodução                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. Player Obtém DispatchPlan                               │
│     GET /api/player/dispatch?uin=...&token=...              │
│     - Recebe plano de exibição                              │
│     - Reproduz mídias                                        │
│     - Sincroniza a cada 15 minutos                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 📝 Resumo das URLs e Endpoints

### **Player → Servidor:**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/player/hardware-info` | GET | Obtém MAC, hostname, platform, arch |
| `/api/player/register` | POST | Vincular hardware ao totem pré-cadastrado |
| `/api/player/decrypt-config` | POST | Desencriptar e validar config.json.enc |
| `/api/player/token` | GET | Valida totem e obtém token |
| `/api/player/dispatch` | GET | Obtém plano de exibição do dispatcher |
| `/api/player/heartbeat` | POST | Envia heartbeat e métricas |
| `/api/player/event` | POST | Envia eventos (playback, exibição) |

### **Admin → Servidor:**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/totems/pending` | GET | Lista totens pendentes |
| `/api/totems/:id/approve` | PUT | Aprova totem pendente |

### **Interface Administrativa:**

| URL | Descrição |
|-----|-----------|
| `/totems` | Página de gerenciamento de totens |
| `/totems?tab=1` | Aba "Pendentes de Aprovação" |

---

## 7. ⚠️ Observações Importantes

### **7.1 Totem Deve Estar Pré-cadastrado**

**⚠️ CRÍTICO:** O endpoint `/api/player/register` **NÃO cria** totem. Ele apenas **vincula hardware** a um totem que **já deve estar cadastrado** pelo publisher.

**Fluxo correto:**
1. Publisher cadastra totem no sistema (via interface admin)
2. Totem recebe UIN atribuído
3. Player gera UIN baseado em hardware
4. Player chama `/api/player/register` com UIN e hardware
5. Servidor **valida** que UIN existe e **atualiza** totem vinculando hardware

**Se UIN não existe:**
- Servidor retorna erro 404: "UIN não cadastrado"
- Player mostra erro
- Totem deve ser cadastrado primeiro pelo publisher

### **7.2 Não Existe Link Direto de Aprovação**

**Por que?**
- Segurança: Aprovação requer autenticação de administrador
- Auditoria: Todas as aprovações são registradas com ID do usuário
- Controle: Administrador precisa ver informações antes de aprovar

**Alternativa (se necessário):**
Poderia ser implementado um link com token temporário:
```
/totems/approve?token={TOKEN_TEMPORARIO}&totemId={ID}
```

Mas **não está implementado** atualmente.

---

### **7.3 Hardware Info no Browser**

**Limitações:**
- Browser não pode acessar MAC address diretamente (segurança)
- Servidor precisa fornecer via `/api/player/hardware-info`
- Fallback usa apenas `navigator.userAgent` e `navigator.platform`

**Solução:**
- Servidor executa comandos do sistema (`ip link show`, `/sys/class/net/eth0/address`)
- Retorna MAC, hostname, platform, arch
- Player usa esses dados para gerar UIN

### **7.4 Config.json.enc - Quando é Gerado**

**Geração:**
- **Quando:** Durante a aprovação, se `generateEncryptedConfig = true`
- **Onde:** Servidor executa `scripts/generate-player-config.sh`
- **Localização:** `{PLAYER_DIR}/config.json.enc` (ex: `/opt/smart-signage/player-web/config.json.enc`)
- **Conteúdo:** UIN + MAC + TIMESTAMP encriptado com AES-256-CBC

**Uso:**
- Player busca `/player/config.json.enc` (arquivo estático servido pelo Nginx)
- Player envia para `/api/player/decrypt-config` para desencriptar
- Servidor valida MAC e retorna UIN
- Player usa UIN para todas as requisições subsequentes

---

### **7.5 Dispatcher e Cache**

**Como funciona:**
1. Player chama `/api/player/dispatch` periodicamente (a cada 15 minutos)
2. Dispatcher gera plano baseado em:
   - Campanhas ativas
   - Agendamentos
   - Regras de mixagem
   - Contexto de IA (se disponível)
3. Player recebe plano e:
   - Baixa mídias para cache (IndexedDB)
   - Reproduz mídias do cache quando possível
   - Fallback para streaming se não estiver em cache

### **7.6 Loop Normal do Player (Após Aprovação e Reinício)**

**Sequência:**
1. Player carrega UIN de `config.json.enc`
2. Player valida: `GET /api/player/token?uin=...`
3. Player obtém plano: `GET /api/player/dispatch?uin=...&token=...`
4. Player reproduz mídias
5. Player envia heartbeat: `POST /api/player/heartbeat` (a cada 30s)
6. Player envia eventos: `POST /api/player/event` (playback, etc.)
7. Repete passos 3-6 continuamente

---

## 8. 🔧 Troubleshooting

### **Problema: UIN não está sendo gerado**

**Verificar:**
1. `/api/player/hardware-info` está retornando dados?
2. `crypto.subtle.digest` está disponível? (requer HTTPS ou localhost)
3. Console do browser mostra erros?

**Solução:**
- Verificar se servidor está acessível
- Verificar se HTTPS está configurado (ou usar localhost)
- Verificar logs do backend

---

### **Problema: Totem não aparece em "Pendentes"**

**Verificar:**
1. Backend está filtrando corretamente por `status: 'pending_approval'`?
2. Totem foi criado com status correto?
3. Frontend está chamando `/api/totems/pending`?

**Solução:**
- Verificar `backend/src/routes/totems.ts` linha 88 (deve ser `'pending_approval'`)
- Verificar logs do backend ao registrar totem
- Verificar resposta da API no Network tab do browser

---

### **Problema: Player não recebe DispatchPlan**

**Verificar:**
1. Totem está aprovado? (`status: 'online'`)
2. Token está válido?
3. Dispatcher está gerando planos?
4. Há campanhas ativas para o totem?

**Solução:**
- Verificar status do totem no banco
- Verificar logs do dispatcher
- Usar Debug Online (`/dispatcher-debug`) para ver queries e mensagens

---

## ✅ Conclusão

O fluxo completo funciona assim:

1. **Totem é pré-cadastrado** pelo publisher (já tem UIN atribuído)
2. **Player procura config.json.enc** → Se não encontrar, envia heartbeat solicitando aprovação
3. **Player coleta hardware** (MAC, hostname, platform, etc.) e gera UIN baseado em hardware
4. **Player envia heartbeat** com `requestApproval: true` e todas as informações coletadas
5. **Dispatcher detecta heartbeat** de solicitação de aprovação e coleta todas as informações
6. **Servidor valida e vincula hardware** ao totem pré-cadastrado:
   - Confere informações recebidas com o cadastro
   - Se válido, vincula hardware ao totem
   - Gera `config.json.enc` (se necessário)
   - Status: `pending_approval`
7. **Admin aprova** via interface (`/totems` → Aba "Pendentes")
8. **Servidor gera `config.json.enc`** (se solicitado) com UIN encriptado
9. **Player recebe e reinicia** para carregar `config.json.enc`
10. **Player inicia loop normal:**
    - Carrega UIN de `config.json.enc`
    - Valida totem → Obtém token
    - Obtém DispatchPlan → Recebe plano de exibição
    - Envia heartbeat → Mantém conexão
    - Envia eventos → Registra playback
    - Reproduz mídias → Conforme plano

**Pontos importantes:**
- ⚠️ **Player procura config.json.enc** conforme definido. Se não tiver, envia heartbeat solicitando aprovação
- ⚠️ **Dispatcher detecta heartbeat** e toma decisão necessária. Se for heartbeat de solicitação de aprovação, coleta todas as informações antes
- ⚠️ **Totem estará pré-cadastrado** antes do player se conectar
- ⚠️ **Servidor valida e vincula hardware** (não cria totem), confere as informações recebidas com o cadastro e, caso válido, gera `config.json.enc`
- ⚠️ **Player recebe e reinicia** para carregar `config.json.enc`
- ⚠️ **Não existe link direto de aprovação** - apenas via interface admin
