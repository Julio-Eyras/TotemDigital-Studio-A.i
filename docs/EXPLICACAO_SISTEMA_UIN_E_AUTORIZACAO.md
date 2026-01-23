# 🔐 Sistema de UIN e Autorização - Explicação Completa

## 📋 Visão Geral

O sistema Smart Signage Pro utiliza um **UIN (Unique Identification Number)** que encapsula características únicas do hardware do dispositivo. Este sistema garante que cada totem tenha uma identidade única, rastreável e vinculada ao hardware físico, prevenindo clonagem e garantindo segurança.

---

## 🎯 Como o UIN é Gerado

### 1. **Coleta de Informações de Hardware**

Cada plataforma coleta informações específicas do hardware:

#### **Player Web (Browser)**
```javascript
// player-web-cache/index.html
async function collectHardware() {
    // Tenta obter hardware info do servidor
    const h = await fetch('/api/player/hardware-info');
    // Retorna: { macAddress, hostname, platform, arch }
    
    // Gera hash SHA-256 do hardware
    const hash = await crypto.subtle.digest('SHA-256', JSON.stringify(h));
    return { ...h, hardwareHash: hex };
}

async function generateUIN(hw) {
    // Combina características do hardware
    const data = JSON.stringify({
        mac: hw.macAddress || 'unknown',
        hostname: hw.hostname || 'unknown',
        platform: hw.platform || 'unknown',
        hash: hw.hardwareHash || 'unknown'
    });
    
    // Gera hash SHA-256
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Formato: SSP-{primeiros 16 caracteres do hash}
    return 'SSP-' + hex.substring(0, 16);
}
```

**Exemplo de UIN gerado:** `SSP-3a8f9b2c1d4e5f6`

#### **WebOS (LG TV)**
```javascript
// Formato: LG_{MAC}_{DEVICEID}
generateUIN(hardwareInfo) {
    const parts = ['LG'];
    
    // MAC Address (sem dois pontos)
    if (hardwareInfo.macAddress) {
        const mac = hardwareInfo.macAddress.replace(/[:-]/g, '').toUpperCase();
        parts.push(mac);
    }
    
    // Device ID (primeiros 8 caracteres)
    if (hardwareInfo.deviceId) {
        const deviceId = hardwareInfo.deviceId.substring(0, 8).toUpperCase();
        parts.push(deviceId);
    }
    
    return parts.join('_');
}
```

**Exemplo de UIN gerado:** `LG_AABBCCDDEEFF_12345678`

#### **Tizen (Samsung TV)**
```javascript
// Formato: TIZEN_{MAC}_{DEVICEID}
generateUIN(hardwareInfo) {
    const parts = ['TIZEN'];
    // Mesma lógica do WebOS
    return parts.join('_');
}
```

**Exemplo de UIN gerado:** `TIZEN_AABBCCDDEEFF_12345678`

#### **Android TV**
```kotlin
// Formato: ANDROID_{MAC}_{DEVICEID}
fun generateUIN(hardwareInfo: HardwareInfo): String {
    val parts = mutableListOf("ANDROID")
    
    if (hardwareInfo.macAddress != "unknown") {
        val mac = hardwareInfo.macAddress.replace(":", "").uppercase()
        parts.add(mac)
    }
    
    if (hardwareInfo.deviceId != "unknown") {
        val deviceId = hardwareInfo.deviceId.take(8).uppercase()
        parts.add(deviceId)
    }
    
    return parts.joinToString("_")
}
```

**Exemplo de UIN gerado:** `ANDROID_AABBCCDDEEFF_12345678`

---

## 🔄 Fluxo Completo de Auto-Registro e Autorização

### **Fase 1: Primeira Execução do Player**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Player inicia pela primeira vez                          │
│    - Não tem UIN configurado                                │
│    - Não tem config.json.enc                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Coleta Hardware Info                                     │
│    - MAC Address (primeira interface de rede ativa)         │
│    - Hostname                                                │
│    - Platform (OS)                                          │
│    - Architecture                                            │
│    - Device ID (se disponível)                               │
│    - Serial Number (se disponível)                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Gera Hardware Hash                                       │
│    hardwareHash = SHA-256(JSON.stringify(hardwareInfo))     │
│    - Hash único baseado em todas as características         │
│    - Usado para detectar mudanças de hardware                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Gera UIN                                                 │
│    UIN = generateUIN(hardwareInfo)                           │
│    - Formato depende da plataforma                          │
│    - Encapsula características do hardware                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Auto-Registro no Servidor                                │
│    POST /api/player/register                                │
│    Body: {                                                  │
│      uin: "SSP-3a8f9b2c1d4e5f6",                           │
│      hardware: {                                           │
│        macAddress: "aa:bb:cc:dd:ee:ff",                    │
│        hostname: "player-001",                               │
│        platform: "linux",                                   │
│        arch: "x64",                                         │
│        hardwareHash: "abc123..."                            │
│      }                                                      │
│    }                                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Servidor Valida e Processa                               │
│    ✅ Verifica se UIN já existe                             │
│    ✅ Verifica se hardware já está registrado               │
│    ✅ Previne clonagem (hardware duplicado)                 │
│    ✅ Cria totem com status: "pending_approval"             │
│    ✅ Armazena hardware info no campo config                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Resposta do Servidor                                     │
│    {                                                        │
│      success: true,                                         │
│      uin: "SSP-3a8f9b2c1d4e5f6",                           │
│      status: "pending_approval",                            │
│      message: "Aguardando aprovação do administrador"       │
│    }                                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Player Armazena UIN                                      │
│    - localStorage.setItem('totemUIN', uin)                  │
│    - Player fica em modo "Aguardando Aprovação"             │
└─────────────────────────────────────────────────────────────┘
```

### **Fase 2: Validação Periódica**

Após o registro, o player valida periodicamente:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Player envia validação                                   │
│    GET /api/player/validate?uin=SSP-...&token=...          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Servidor Valida                                           │
│    ✅ UIN existe no banco?                                  │
│    ✅ Token é válido?                                        │
│    ✅ Totem está ativo?                                      │
│    ✅ Status não é "pending_approval"?                      │
│    ✅ Hardware corresponde? (opcional)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Resposta                                                  │
│    - Se pending_approval: retorna erro 403                  │
│    - Se bloqueado: retorna erro 403                          │
│    - Se válido: retorna playlist e comandos                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Prevenção de Clonagem de Hardware

### **Como Funciona**

O sistema previne clonagem verificando se o mesmo hardware (MAC address ou hardwareHash) já está registrado:

```typescript
// backend/src/routes/player.ts (linha 935-969)

// Verificar se hardware já está registrado
const hardwareHash = hardware.hardwareHash || 
                     (hardware.macAddress || '').toLowerCase();

if (hardwareHash && hardwareHash !== 'unknown') {
    const existingHardware = await db.findFirst(`
        SELECT totem_id, uin, identifier 
        FROM totems 
        WHERE config::text ILIKE '%"${hardwareHash}"%' 
           OR config::text ILIKE '%"${hardware.macAddress || ''}"%'
        LIMIT 1
    `);
    
    if (existingHardware) {
        return res.status(409).json({ 
            error: 'Hardware já registrado',
            message: 'Este hardware já está cadastrado com outro totem',
            existingTotem: {
                id: existingHardware.totem_id,
                uin: existingHardware.uin,
                identifier: existingHardware.identifier
            }
        });
    }
}
```

### **Armazenamento no Banco de Dados**

As informações de hardware são armazenadas no campo `config` (JSONB) da tabela `totems`:

```json
{
    "hardware": {
        "mac": "aa:bb:cc:dd:ee:ff",
        "hostname": "player-001",
        "platform": "linux",
        "arch": "x64",
        "serial": "SERIAL-789",
        "hardwareHash": "abc123def456...",
        "registeredAt": "2025-01-23T18:51:00Z",
        "userAgent": "Mozilla/5.0..."
    },
    "resolution": "1920x1080",
    "orientation": "portrait",
    "brightness": 80
}
```

---

## ✅ Processo de Autorização (Aprovação)

### **Status do Totem**

1. **`pending_approval`** (Padrão após auto-registro)
   - Totem foi auto-registrado
   - Aguardando aprovação do administrador
   - Player mostra mensagem "Aguardando aprovação"
   - Não recebe playlists

2. **`active`** (Após aprovação)
   - Totem foi aprovado pelo administrador
   - Recebe playlists normalmente
   - Pode enviar eventos e heartbeats

3. **`blocked`** (Bloqueado)
   - Totem foi bloqueado pelo administrador
   - Player mostra mensagem de bloqueio
   - Não recebe playlists

### **Como Aprovar um Totem**

O administrador precisa alterar o status do totem no painel administrativo:

```sql
-- Aprovar totem
UPDATE totems 
SET status = 'active', 
    is_active = true,
    updated_at = NOW()
WHERE uin = 'SSP-3a8f9b2c1d4e5f6';
```

Ou via API/Interface:
- Acessar painel administrativo
- Ir para "Totens" ou "Players"
- Localizar totem com status "Pendente"
- Clicar em "Aprovar" ou "Ativar"

---

## 🔍 Validação de Hardware em Cada Conexão

### **Endpoint: `/api/player/validate`**

Quando o player valida, o servidor:

1. **Busca totem por UIN:**
   ```typescript
   const totem = await totemService.getTotemByUin(uin);
   ```

2. **Verifica status:**
   ```typescript
   if (totem.status === 'pending_approval') {
       return res.status(403).json({ 
           pendingApproval: true,
           message: 'Aguardando aprovação do administrador'
       });
   }
   
   if (!totem.active) {
       return res.status(403).json({ 
           blocked: true,
           reason: 'Totem desativado no sistema'
       });
   }
   ```

3. **Retorna playlist e comandos:**
   - Busca campanhas ativas para o totem
   - Retorna playlist com mídias
   - Retorna comandos remotos pendentes

---

## 📊 Estrutura de Dados no Banco

### **Tabela `totems`**

```sql
CREATE TABLE totems (
    totem_id SERIAL PRIMARY KEY,
    identifier VARCHAR(255),           -- Nome/identificador
    uin VARCHAR(255) UNIQUE,            -- UIN único (ex: SSP-3a8f9b2c1d4e5f6)
    device_id VARCHAR(255),            -- Device ID interno
    config JSONB,                      -- Configuração (inclui hardware info)
    status VARCHAR(50),                -- 'pending_approval', 'active', 'blocked'
    is_active BOOLEAN,                 -- Ativo/inativo
    ip_address INET,                   -- Último IP conhecido
    last_seen TIMESTAMP,               -- Última vez visto
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### **Exemplo de Registro Completo**

```json
{
    "totem_id": 1,
    "identifier": "TOTEM-001",
    "uin": "SSP-3a8f9b2c1d4e5f6",
    "device_id": "DEVICE-001",
    "status": "pending_approval",
    "is_active": false,
    "config": {
        "hardware": {
            "mac": "aa:bb:cc:dd:ee:ff",
            "hostname": "player-001",
            "platform": "linux",
            "arch": "x64",
            "hardwareHash": "abc123def456789...",
            "registeredAt": "2025-01-23T18:51:00Z"
        },
        "resolution": "1920x1080",
        "orientation": "portrait"
    },
    "ip_address": "192.168.1.110",
    "last_seen": "2025-01-23T18:51:00Z"
}
```

---

## 🔐 Segurança e Validação

### **1. Token de Validação**

O servidor gera um token HMAC-SHA256 baseado no UIN:

```typescript
function generateTotemToken(uin: string): string {
    const timestamp = Date.now();
    const data = `${uin}:${timestamp}`;
    const token = crypto
        .createHmac('sha256', TOTEM_SECRET_KEY)
        .update(data)
        .digest('hex');
    return `${timestamp}:${token}`;
}
```

**Formato:** `{timestamp}:{hash}`

**Validade:** 1 hora (3600000ms)

### **2. Validação de Token**

```typescript
function validateTotemToken(uin: string, token: string): boolean {
    const [timestamp, receivedToken] = token.split(':');
    const age = Date.now() - parseInt(timestamp);
    
    if (age > 3600000 || age < 0) return false; // Expirado
    
    const expectedToken = crypto
        .createHmac('sha256', TOTEM_SECRET_KEY)
        .update(`${uin}:${timestamp}`)
        .digest('hex');
    
    return crypto.timingSafeEqual(
        Buffer.from(receivedToken),
        Buffer.from(expectedToken)
    );
}
```

### **3. Prevenção de Clonagem**

- **Verificação de MAC Address:** Se o mesmo MAC já está registrado, bloqueia
- **Verificação de Hardware Hash:** Se o mesmo hardwareHash já existe, bloqueia
- **Armazenamento no Config:** Hardware info fica vinculado ao totem no campo `config`

---

## 🎯 Resumo do Fluxo Completo

### **Cenário 1: Primeira Instalação**

1. Player inicia → Não tem UIN
2. Coleta hardware → MAC, hostname, platform, etc.
3. Gera UIN → Baseado em hardware (ex: `SSP-3a8f9b2c1d4e5f6`)
4. Auto-registro → `POST /api/player/register` com hardware info
5. Servidor cria totem → Status: `pending_approval`
6. Player aguarda → Mostra "Aguardando aprovação"
7. Admin aprova → Altera status para `active`
8. Player funciona → Recebe playlists e comandos

### **Cenário 2: Validação Periódica**

1. Player valida → `GET /api/player/validate?uin=...&token=...`
2. Servidor verifica → UIN existe? Status ativo? Token válido?
3. Se válido → Retorna playlist e comandos
4. Se pending → Retorna erro 403 "Aguardando aprovação"
5. Se bloqueado → Retorna erro 403 "Totem bloqueado"

### **Cenário 3: Detecção de Clonagem**

1. Tentativa de registro → Com hardware já registrado
2. Servidor detecta → MAC ou hardwareHash duplicado
3. Retorna erro 409 → "Hardware já registrado"
4. Informa totem existente → ID, UIN, identifier

---

## 📝 Características Encapsuladas no UIN

### **Player Web (Browser)**
- ✅ MAC Address (do servidor via `/api/player/hardware-info`)
- ✅ Hostname
- ✅ Platform (OS)
- ✅ Hardware Hash (SHA-256 de todas as características)

### **WebOS/Tizen**
- ✅ MAC Address (da TV)
- ✅ Device ID (ID único da TV)
- ✅ Platform (webOS/Tizen)

### **Android TV**
- ✅ MAC Address
- ✅ Android ID (Device ID)
- ✅ Serial Number (se disponível)
- ✅ Model (Build.MODEL)

---

## 🔧 Endpoints da API

### **1. Obter Hardware Info do Servidor**
```
GET /api/player/hardware-info
Response: {
    macAddress: "aa:bb:cc:dd:ee:ff",
    hostname: "server-001",
    platform: "linux",
    arch: "x64"
}
```

### **2. Auto-Registro**
```
POST /api/player/register
Body: {
    uin: "SSP-3a8f9b2c1d4e5f6",
    hardware: {
        macAddress: "aa:bb:cc:dd:ee:ff",
        hostname: "player-001",
        platform: "linux",
        arch: "x64",
        hardwareHash: "abc123..."
    }
}
Response: {
    success: true,
    uin: "SSP-3a8f9b2c1d4e5f6",
    status: "pending_approval",
    message: "Aguardando aprovação"
}
```

### **3. Validação**
```
GET /api/player/validate?uin=SSP-...&token=...
Response: {
    valid: true,
    totem: { ... },
    playlist: { ... },
    commands: [ ... ]
}
```

### **4. Obter Token**
```
GET /api/player/token?uin=SSP-...
Response: {
    token: "1769206316942:abc123..."
}
```

---

## 🎓 Conclusão

O sistema de UIN e autorização funciona da seguinte forma:

1. **UIN encapsula hardware:** Cada UIN é gerado baseado em características únicas do hardware
2. **Auto-registro:** Player se registra automaticamente na primeira execução
3. **Aprovação necessária:** Totem fica em `pending_approval` até admin aprovar
4. **Validação periódica:** Player valida periodicamente para receber playlists
5. **Prevenção de clonagem:** Sistema detecta hardware duplicado e bloqueia
6. **Segurança:** Tokens HMAC-SHA256 garantem autenticidade

O UIN **não é apenas um número aleatório** - ele é uma **impressão digital do hardware** que garante unicidade e rastreabilidade.
