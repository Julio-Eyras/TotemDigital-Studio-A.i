# 🔄 Fluxo Completo: Player-Web-Cache - UIN, Hardware, Dispatcher e Aprovação

## 📋 Visão Geral

Este documento explica **todo o processo** do player-web-cache:
1. Como gera o UIN
2. Como coleta informações de hardware
3. Como envia para o dispatcher
4. Como funciona a aprovação

---

## 1. 🆔 Geração do UIN (Unique Identifier Number)

### **1.1 Coleta de Hardware**

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

## 2. 📤 Auto-Registro no Servidor

### **2.1 Envio de Registro**

**Localização:** `player-web-cache/index.html` (linha 145-174)

**Código:**
```javascript
async function autoRegister(uin) {
    try {
        // 1. Coleta hardware
        const hw = await collectHardware();
        
        // 2. Gera UIN se não fornecido
        const u = uin || await generateUIN(hw);
        
        // 3. Envia para servidor
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
            if (r.status === 409) {
                // UIN já existe - OK, totem já registrado
                return { success: true, uin: u, status: 'already_registered' };
            }
            return { success: false, error: err.error || 'Erro ao registrar' };
        }
        
        const data = await r.json();
        
        // 5. Armazena UIN localmente
        if (data.uin && typeof localStorage !== 'undefined') {
            localStorage.setItem('totemUIN', data.uin);
        }
        
        return { 
            success: true, 
            uin: data.uin || u, 
            status: data.status || 'pending_approval' 
        };
    } catch (e) {
        return { success: false, error: (e && e.message) || 'Erro ao registrar' };
    }
}
```

**Endpoint Backend:** `POST /api/player/register`

**Localização Backend:** `backend/src/routes/player.ts` (linha 892-1150)

**O que o servidor faz:**
1. Valida UIN e hardware
2. Cria totem no banco com `status: 'pending_approval'`
3. Armazena hardware info no campo `config` (JSONB)
4. Retorna UIN e status

---

## 3. 🔄 Comunicação com Dispatcher

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

Após auto-registro, o totem fica com:
- **Status:** `pending_approval`
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

### **4.4 Após Aprovação**

**O que acontece:**

1. **Status muda:**
   - `pending_approval` → `online`
   - `is_active: false` → `is_active: true`

2. **Player detecta mudança:**
   - Na próxima validação (`/api/player/token`), recebe `valid: true`
   - Player sai da tela "Aguardando aprovação"
   - Player inicia reprodução normal

3. **Player começa a receber DispatchPlans:**
   - Chama `/api/player/dispatch` periodicamente
   - Recebe planos de exibição
   - Reproduz mídias conforme plano

---

## 5. 🔍 Fluxo Completo Visual

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

## 6. 📝 Resumo das URLs e Endpoints

### **Player → Servidor:**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/player/hardware-info` | GET | Obtém MAC, hostname, platform, arch |
| `/api/player/register` | POST | Auto-registro do totem |
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

### **7.1 Não Existe Link Direto de Aprovação**

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

### **7.2 Hardware Info no Browser**

**Limitações:**
- Browser não pode acessar MAC address diretamente (segurança)
- Servidor precisa fornecer via `/api/player/hardware-info`
- Fallback usa apenas `navigator.userAgent` e `navigator.platform`

**Solução:**
- Servidor executa comandos do sistema (`ip link show`, `/sys/class/net/eth0/address`)
- Retorna MAC, hostname, platform, arch
- Player usa esses dados para gerar UIN

---

### **7.3 Dispatcher e Cache**

**Como funciona:**
1. Player chama `/api/player/dispatch` periodicamente
2. Dispatcher gera plano baseado em:
   - Campanhas ativas
   - Agendamentos
   - Regras de mixagem
   - Contexto de IA (se disponível)
3. Player recebe plano e:
   - Baixa mídias para cache (IndexedDB)
   - Reproduz mídias do cache quando possível
   - Fallback para streaming se não estiver em cache

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

1. **Player gera UIN** baseado em hardware
2. **Player registra** no servidor (status: `pending_approval`)
3. **Admin aprova** via interface (`/totems` → Aba "Pendentes")
4. **Player detecta aprovação** e inicia reprodução
5. **Player obtém DispatchPlan** periodicamente do dispatcher
6. **Player reproduz** mídias conforme plano

**Não existe link direto de aprovação** - tudo é feito via interface administrativa autenticada.
