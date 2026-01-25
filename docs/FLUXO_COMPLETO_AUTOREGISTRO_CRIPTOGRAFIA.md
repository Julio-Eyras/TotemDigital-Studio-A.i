# 🔐 Fluxo Completo: Auto-Registro, Aprovação e Criptografia de Totens

## 📋 Visão Geral

Este documento explica **todo o processo** desde quando o totem tenta se auto-registrar até como a chave criptográfica é gerada e enviada após a aprovação.

---

## 🔄 Fluxo Completo (Passo a Passo)

### **Fase 1: Auto-Registro do Totem**

#### 1.1 Player Inicia pela Primeira Vez

```
┌─────────────────────────────────────────┐
│ Player (Totem)                          │
│ - Não tem UIN configurado               │
│ - Não tem config.json.enc                │
└─────────────────────────────────────────┘
```

#### 1.2 Player Coleta Informações de Hardware

O player coleta automaticamente:
- **MAC Address** (da interface de rede)
- **Hostname**
- **Platform** (OS: linux, android, webos, tizen)
- **Architecture** (x64, arm64, etc.)
- **Hardware Hash** (SHA-256 de todas as características)

**Código (player-web-cache/index.html):**
```javascript
async function collectHardware() {
    // Tenta obter hardware info do servidor
    const h = await fetch('/api/player/hardware-info');
    // Retorna: { macAddress, hostname, platform, arch }
    
    // Gera hash SHA-256 do hardware
    const hash = await crypto.subtle.digest('SHA-256', JSON.stringify(h));
    return { ...h, hardwareHash: hex };
}
```

#### 1.3 Player Gera UIN Baseado no Hardware

**Código (player-web-cache/index.html):**
```javascript
async function generateUIN(hw) {
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

#### 1.4 Player Envia Auto-Registro para o Servidor

**Endpoint:** `POST /api/player/register`

**Payload:**
```json
{
    "uin": "SSP-3a8f9b2c1d4e5f6",
    "hardware": {
        "macAddress": "aa:bb:cc:dd:ee:ff",
        "hostname": "player-001",
        "platform": "linux",
        "arch": "x64",
        "hardwareHash": "abc123def456..."
    }
}
```

**Código (player-web-cache/index.html):**
```javascript
async function autoRegister(uin) {
    const hw = await collectHardware();
    const u = uin || await generateUIN(hw);
    const r = await fetch('/api/player/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uin: u,
            hardware: { ...hw }
        })
    });
    return await r.json();
}
```

#### 1.5 Servidor Processa Auto-Registro

**Localização:** `backend/src/routes/player.ts` (linha 858-1150)

**O que o servidor faz:**

1. **Valida UIN:**
   - Verifica se UIN já existe (erro 409 se duplicado)
   - Verifica se hardware já está registrado (prevenção de clonagem)

2. **Cria Totem no Banco:**
   ```sql
   INSERT INTO totems (
       totem_id,
       identifier,
       uin,
       device_id,
       config,  -- JSONB com hardware info
       status,  -- 'pending_approval' ✅
       is_active,  -- false
       ...
   ) VALUES (...)
   ```

3. **Armazena Hardware Info no Campo `config`:**
   ```json
   {
       "hardware": {
           "mac": "aa:bb:cc:dd:ee:ff",
           "hostname": "player-001",
           "platform": "linux",
           "arch": "x64",
           "hardwareHash": "abc123...",
           "registeredAt": "2025-01-23T18:51:00Z"
       }
   }
   ```

4. **Define Status como `pending_approval`:**
   ```typescript
   status: 'pending_approval'  // ✅ Totem aguardando aprovação
   is_active: false
   ```

5. **Resposta ao Player:**
   ```json
   {
       "success": true,
       "uin": "SSP-3a8f9b2c1d4e5f6",
       "status": "pending_approval",
       "message": "Aguardando aprovação do administrador"
   }
   ```

#### 1.6 Player Armazena UIN Localmente

**Código (player-web-cache/index.html):**
```javascript
if (reg.success && reg.uin) {
    uin = reg.uin;
    localStorage.setItem('totemUIN', uin);
}
```

**Player mostra mensagem:** "Aguardando aprovação do administrador"

---

### **Fase 2: Aprovação pelo Administrador**

#### 2.1 Administrador Acessa Painel

- Vai em **"Exibidores" → "Totens" → Aba "Pendentes de Aprovação"**
- Vê lista de totens com status `pending_approval`

#### 2.2 Administrador Clica em "Aprovar"

**Frontend:** `frontend/src/pages/Totems/Totems.tsx` (linha 148-166)

**Código:**
```typescript
const handleApprove = async () => {
    const result = await totemApi.approve(
        selectedTotem.totem_id, 
        generateConfig  // true/false - gerar config encriptado
    );
    // ...
};
```

#### 2.3 Frontend Chama API de Aprovação

**Endpoint:** `PUT /api/totems/:id/approve`

**Payload:**
```json
{
    "generateEncryptedConfig": true  // Opcional: gerar arquivo encriptado
}
```

#### 2.4 Backend Processa Aprovação

**Localização:** `backend/src/routes/totems.ts` (linha 523-626)

**O que o servidor faz:**

1. **Busca Totem:**
   ```typescript
   const totem = await getTotemService().getTotemById(totemId);
   ```

2. **Verifica se Pode Aprovar:**
   - Se já está `online`, retorna erro 400
   - Se não existe, retorna erro 404

3. **Atualiza Status:**
   ```sql
   UPDATE totems
   SET status = 'online',  -- ✅ Muda de 'pending_approval' para 'online'
       updated_at = CURRENT_TIMESTAMP
   WHERE totem_id = ?
   ```

4. **Se `generateEncryptedConfig = true`, Gera Arquivo Encriptado:**
   ```typescript
   if (generateEncryptedConfig && totemFull.uin) {
       // Executa script de geração
       await execAsync(`bash "${scriptPath}" "${uin}" "${playerDir}" "${secretKey}"`);
   }
   ```

---

### **Fase 3: Geração da Configuração Encriptada**

#### 3.1 Script de Geração é Executado

**Script:** `scripts/generate-player-config.sh`

**Parâmetros:**
- `UIN`: UIN do totem (ex: `SSP-3a8f9b2c1d4e5f6`)
- `PLAYER_DIR`: Diretório do player (ex: `/opt/smart-signage/player-web`)
- `SECRET_KEY`: Chave secreta (variável `TOTEM_SECRET_KEY` do .env)

#### 3.2 Script Detecta MAC Address do Servidor

**Código (generate-player-config.sh):**
```bash
# Obter MAC address da primeira interface de rede ativa
MAC_ADDRESS=$(ip link show | grep -A1 "state UP" | grep -oE "([0-9a-f]{2}:){5}[0-9a-f]{2}" | head -1)
```

**Exemplo:** `aa:bb:cc:dd:ee:ff`

#### 3.3 Script Cria Payload

**Código:**
```bash
TIMESTAMP=$(date +%s)
PAYLOAD="${UIN}:${MAC_ADDRESS}:${TIMESTAMP}"
```

**Exemplo de Payload:**
```
SSP-3a8f9b2c1d4e5f6:aa:bb:cc:dd:ee:ff:1737653460
```

**Formato:** `{UIN}:{MAC}:{TIMESTAMP}`

#### 3.4 Script Encripta Payload

**Código:**
```bash
ENCRYPTED=$(echo -n "$PAYLOAD" | openssl enc -aes-256-cbc -base64 -salt -pbkdf2 -iter 10000 -k "$SECRET_KEY")
```

**Algoritmo:** AES-256-CBC
- **Chave:** `TOTEM_SECRET_KEY` (do .env)
- **Derivação:** PBKDF2 com 10.000 iterações
- **Encoding:** Base64

**Exemplo de resultado encriptado:**
```
U2FsdGVkX1+abc123def456...xyz789
```

#### 3.5 Script Cria Arquivo JSON

**Arquivo:** `{PLAYER_DIR}/config.json.enc`

**Conteúdo:**
```json
{
    "encrypted": true,
    "version": "1.0",
    "data": "U2FsdGVkX1+abc123def456...xyz789",
    "mac": "aa:bb:cc:dd:ee:ff",
    "created": "1737653460"
}
```

**Código:**
```bash
CONFIG_FILE="${PLAYER_DIR}/config.json.enc"
cat > "$CONFIG_FILE" << EOF
{
  "encrypted": true,
  "version": "1.0",
  "data": "$ENCRYPTED",
  "mac": "$MAC_ADDRESS",
  "created": "$TIMESTAMP"
}
EOF

# Proteger arquivo (apenas leitura para owner)
chmod 600 "$CONFIG_FILE"
```

#### 3.6 Arquivo é Salvo no Diretório do Player

**Localização:** `/opt/smart-signage/player-web/config.json.enc`

**Permissões:** `600` (apenas owner pode ler/escrever)

---

### **Fase 4: Player Obtém e Usa a Configuração Encriptada**

#### 4.1 Player Tenta Carregar Config Encriptado

**Código (player-web-cache/index.html):**
```javascript
async function loadUinFromConfig() {
    try {
        // 1. Buscar arquivo config.json.enc
        const r = await fetch('/player/config.json.enc');
        if (!r.ok) return null;
        
        const cfg = await r.json();
        if (!cfg.encrypted || !cfg.data) return null;
        
        // 2. Enviar para servidor desencriptar
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
        
        // 3. Retornar UIN se válido
        return (d.valid && d.uin) ? d.uin : null;
    } catch (e) {
        return null;
    }
}
```

#### 4.2 Servidor Desencripta Configuração

**Endpoint:** `POST /api/player/decrypt-config`

**Localização:** `backend/src/routes/player.ts` (linha 708-816)

**O que o servidor faz:**

1. **Recebe Configuração Encriptada:**
   ```json
   {
       "encryptedConfig": {
           "encrypted": true,
           "data": "U2FsdGVkX1+abc123...",
           "mac": "aa:bb:cc:dd:ee:ff"
       },
       "currentMac": null
   }
   ```

2. **Desencripta usando OpenSSL:**
   ```typescript
   const stdout = await execAsync(
       `echo -n "${encryptedConfig.data}" | openssl enc -aes-256-cbc -d -base64 -salt -pbkdf2 -iter 10000 -k "${TOTEM_SECRET_KEY}"`
   );
   ```

3. **Extrai Dados do Payload:**
   ```typescript
   const decrypted = stdout.trim();
   const [uin, configMac, timestamp] = decrypted.split(':');
   // uin = "SSP-3a8f9b2c1d4e5f6"
   // configMac = "aa:bb:cc:dd:ee:ff"
   // timestamp = "1737653460"
   ```

4. **Valida MAC Address:**
   ```typescript
   // Compara MAC do config com MAC atual do servidor
   if (configMac !== serverMacAddress) {
       return res.status(403).json({ 
           error: 'Configuração vinculada a outro hardware' 
       });
   }
   ```

5. **Valida Totem:**
   ```typescript
   const totem = await totemService.getTotemByUin(uin);
   if (!totem || !totem.active) {
       return res.status(404).json({ 
           error: 'Totem não encontrado ou inativo' 
       });
   }
   ```

6. **Retorna UIN Válido:**
   ```json
   {
       "valid": true,
       "uin": "SSP-3a8f9b2c1d4e5f6",
       "mac": "aa:bb:cc:dd:ee:ff",
       "timestamp": 1737653460
   }
   ```

#### 4.3 Player Usa UIN do Config

**Código (player-web-cache/index.html):**
```javascript
async function main() {
    var uin = getUin();  // Tenta obter da URL (?uin=...)
    
    // Se não tiver na URL, tenta carregar do config encriptado
    if (!uin) uin = await loadUinFromConfig();
    
    // Se não tiver config, tenta auto-registro
    if (!uin) {
        var reg = await autoRegister();
        if (reg.success && reg.uin) uin = reg.uin;
    }
    
    // Se não conseguir, entra em modo demo
    if (!uin || !uin.trim()) {
        startDemo();
        return;
    }
    
    // Salva UIN no localStorage
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('totemUIN', uin);
    }
    
    // Continua com validação normal...
}
```

---

## 🔑 Chave Secreta (TOTEM_SECRET_KEY)

### **Onde Está Definida:**

**Variável de Ambiente:**
```bash
TOTEM_SECRET_KEY=smart-signage-totem-secret-key-2025-change-in-production
```

**Localização no Código:**
- `backend/src/routes/player.ts` (linha 22)
- `backend/src/routes/totems.ts` (linha 582)
- `backend/src/utils/totemEncryption.ts` (linha 5)

### **Como Funciona:**

1. **Geração de Config:**
   - Script usa `TOTEM_SECRET_KEY` para encriptar payload
   - Chave é passada como parâmetro para o script

2. **Desencriptação:**
   - Servidor usa mesma `TOTEM_SECRET_KEY` para desencriptar
   - Chave deve ser **idêntica** em ambos os processos

3. **Segurança:**
   - ⚠️ **IMPORTANTE:** Em produção, altere a chave padrão!
   - Use: `openssl rand -base64 32` para gerar chave segura
   - Armazene em variável de ambiente (`.env`)

---

## 📊 Resumo do Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PLAYER INICIA                                            │
│    - Coleta hardware (MAC, hostname, platform, etc.)       │
│    - Gera UIN baseado em hardware                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AUTO-REGISTRO                                            │
│    POST /api/player/register                               │
│    - Envia UIN + hardware info                             │
│    - Servidor cria totem com status: pending_approval       │
│    - Hardware info salvo em config.hardware               │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PLAYER AGUARDA                                           │
│    - Mostra mensagem "Aguardando aprovação"                │
│    - Valida periodicamente com /api/player/validate        │
│    - Recebe erro 403 "pending_approval"                    │
└───────────────────────┬────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ADMIN APROVA                                             │
│    PUT /api/totems/:id/approve                              │
│    - Admin clica "Aprovar" no painel                        │
│    - Servidor muda status: pending_approval → online        │
│    - Se solicitado, gera config.json.enc                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. GERAÇÃO DE CONFIG ENCRIPTADO                             │
│    Script: generate-player-config.sh                       │
│    - Detecta MAC do servidor                                │
│    - Cria payload: UIN:MAC:TIMESTAMP                        │
│    - Encripta com AES-256-CBC usando TOTEM_SECRET_KEY      │
│    - Salva em /opt/smart-signage/player-web/config.json.enc │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PLAYER OBTÉM CONFIG                                      │
│    - Player busca /player/config.json.enc                   │
│    - Envia para /api/player/decrypt-config                  │
│    - Servidor desencripta usando TOTEM_SECRET_KEY          │
│    - Valida MAC address e totem                             │
│    - Retorna UIN válido                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. PLAYER USA UIN                                           │
│    - Player salva UIN no localStorage                       │
│    - Usa UIN para validações futuras                        │
│    - Recebe playlists e comandos normalmente                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Detalhes de Segurança

### **1. Vinculação ao Hardware**

- **MAC Address** é incluído no payload encriptado
- Servidor valida que MAC do config corresponde ao MAC atual
- Previne uso do config em outro hardware

### **2. Algoritmo de Criptografia**

- **AES-256-CBC:** Algoritmo simétrico robusto
- **PBKDF2:** Derivação de chave com 10.000 iterações
- **Salt:** Adiciona aleatoriedade à encriptação

### **3. Validação de Totem**

- Totem deve existir no banco
- Totem deve estar `active = true`
- Totem deve ter status `online` (aprovado)

### **4. Chave Secreta**

- ⚠️ **CRÍTICO:** Chave deve ser mantida em segredo
- Use variável de ambiente (não commitar no código)
- Gere chave forte: `openssl rand -base64 32`
- Mesma chave para encriptar e desencriptar

---

## 📝 Respostas às Perguntas

### **1. Quando o totem tenta se auto-registrar, ele envia seu UIN?**

✅ **SIM** - O totem gera o UIN baseado no hardware e envia no auto-registro:
- Endpoint: `POST /api/player/register`
- Payload inclui: `{ uin: "SSP-...", hardware: {...} }`

### **2. Entra como pendente de aprovação?**

✅ **SIM** - Servidor cria totem com:
- `status: 'pending_approval'`
- `is_active: false`

### **3. Após aprovado, onde e como é gerada a criptografia?**

✅ **Geração:**
- **Onde:** Script `scripts/generate-player-config.sh` é executado no servidor
- **Quando:** Durante a aprovação, se `generateEncryptedConfig = true`
- **Como:** 
  1. Detecta MAC do servidor
  2. Cria payload: `UIN:MAC:TIMESTAMP`
  3. Encripta com AES-256-CBC usando `TOTEM_SECRET_KEY`
  4. Salva em `/opt/smart-signage/player-web/config.json.enc`

### **4. Como a chave é enviada ao player?**

❌ **A chave NÃO é enviada ao player!**

**Como funciona:**
- A **chave secreta (`TOTEM_SECRET_KEY`)** fica **apenas no servidor**
- O player recebe apenas o **arquivo encriptado** (`config.json.enc`)
- O player envia o arquivo encriptado para o servidor desencriptar
- O servidor usa a chave secreta para desencriptar e retornar o UIN

**Fluxo:**
1. Player busca `/player/config.json.enc` (arquivo estático)
2. Player envia arquivo para `/api/player/decrypt-config`
3. Servidor desencripta usando `TOTEM_SECRET_KEY`
4. Servidor retorna UIN válido ao player

**Segurança:**
- Chave secreta nunca sai do servidor
- Player não precisa conhecer a chave
- Apenas o servidor pode desencriptar

---

## ✅ Conclusão

O sistema funciona da seguinte forma:

1. **Auto-registro:** Totem envia UIN gerado + hardware info → Status: `pending_approval`
2. **Aprovação:** Admin aprova → Status: `online` + (opcional) gera `config.json.enc`
3. **Criptografia:** Script encripta `UIN:MAC:TIMESTAMP` usando `TOTEM_SECRET_KEY`
4. **Uso:** Player busca `config.json.enc` → Servidor desencripta → Retorna UIN

**A chave secreta nunca é enviada ao player** - ela fica apenas no servidor e é usada para desencriptar quando o player solicita.
