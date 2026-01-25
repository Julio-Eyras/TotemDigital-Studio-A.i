# 📊 Resumo Visual: Fluxo Player-Web-Cache (CORRIGIDO)

## 🔄 Fluxo Completo em 10 Passos

```
┌─────────────────────────────────────────────────────────────┐
│ PASSO 1: Totem PRÉ-CADASTRADO pelo Publisher               │
│                                                              │
│ - Publisher cria totem no sistema                           │
│ - Totem recebe UIN atribuído (ex: SSP-3a8f9b2c1d4e5f6)    │
│ - Status inicial: 'pending_activation'                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 2: Player Inicia (Primeira Vez)                      │
│ Arquivo: player-web-cache/index.html                        │
│                                                              │
│ - Verifica localStorage por 'totemUIN'                       │
│ - Tenta carregar de config.json.enc (se existir)            │
│ - Se não existe, inicia vinculação de hardware              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 3: Coleta Hardware                                    │
│ Função: collectHardware()                                  │
│                                                              │
│ 1. Chama GET /api/player/hardware-info                      │
│    └─ Servidor retorna:                                     │
│       • MAC Address (via ip link show)                      │
│       • Hostname (os.hostname())                            │
│       • Platform (os.platform())                            │
│       • Architecture (os.arch())                            │
│                                                              │
│ 2. Gera hardwareHash (SHA-256 dos dados)                   │
│                                                              │
│ Retorna: { macAddress, hostname, platform, arch,            │
│           hardwareHash }                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 4: Gera UIN (Baseado em Hardware)                    │
│ Função: generateUIN(hw)                                     │
│                                                              │
│ 1. Cria string:                                             │
│    { mac, hostname, platform, hash }                         │
│                                                              │
│ 2. Hash SHA-256:                                            │
│    crypto.subtle.digest('SHA-256', ...)                     │
│                                                              │
│ 3. Formato:                                                 │
│    'SSP-' + hex.substring(0, 16)                            │
│                                                              │
│ Exemplo: SSP-3a8f9b2c1d4e5f6                                │
│ ⚠️ Deve corresponder ao UIN pré-cadastrado!                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 5: Vincula Hardware ao Totem Pré-cadastrado         │
│ Função: autoRegister(uin)                                    │
│ Endpoint: POST /api/player/register                         │
│                                                              │
│ Payload:                                                    │
│ {                                                           │
│   "uin": "SSP-3a8f9b2c1d4e5f6",                            │
│   "hardware": { ... }                                       │
│ }                                                           │
│                                                              │
│ ⚠️ Servidor VALIDA que UIN existe (não cria totem)          │
│ - Se UIN não existe → Erro 404                              │
│ - Se existe → ATUALIZA totem vinculando hardware            │
│ - Gera token HMAC                                           │
│ - Status: 'pending_approval'                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 6: Player Armazena UIN Temporariamente                │
│                                                              │
│ localStorage.setItem('totemUIN', uin)                       │
│                                                              │
│ Player mostra:                                              │
│ "Aguardando aprovação do administrador"                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 7: Admin Aprova                                       │
│ Interface: /totems → Aba "Pendentes de Aprovação"          │
│                                                              │
│ 1. Admin clica "Aprovar"                                    │
│ 2. Frontend chama: PUT /api/totems/:id/approve              │
│ 3. Servidor atualiza:                                       │
│    • status: 'online'                                        │
│    • is_active: true                                        │
│ 4. Se solicitado, executa script:                           │
│    generate-player-config.sh                                │
│    • Obtém MAC do servidor                                  │
│    • Cria payload: {UIN}:{MAC}:{TIMESTAMP}                  │
│    • Encripta com AES-256-CBC                               │
│    • Salva: config.json.enc                                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 8: Player Reinicia                                   │
│                                                              │
│ - Player é reiniciado (manual ou automático)                │
│ - Na próxima inicialização, carrega config.json.enc         │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 9: Player Carrega UIN do Config Encriptado           │
│ Função: loadUinFromConfig()                                 │
│                                                              │
│ 1. Busca: GET /player/config.json.enc                      │
│ 2. Envia para: POST /api/player/decrypt-config              │
│ 3. Servidor:                                                │
│    • Desencripta payload                                    │
│    • Valida MAC address                                     │
│    • Verifica totem ativo                                   │
│    • Retorna UIN válido                                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 10: Player Inicia Loop Normal                        │
│                                                              │
│ 1. Valida totem:                                            │
│    GET /api/player/token?uin=...                           │
│    → Recebe token HMAC                                      │
│                                                              │
│ 2. Obtém DispatchPlan:                                      │
│    GET /api/player/dispatch?uin=...&token=...              │
│    → Recebe plano de exibição                               │
│    → A cada 15 minutos                                      │
│                                                              │
│ 3. Envia Heartbeat:                                         │
│    POST /api/player/heartbeat                              │
│    → A cada 30 segundos                                     │
│                                                              │
│ 4. Envia Eventos:                                           │
│    POST /api/player/event                                   │
│    → Playback, exibição, etc.                               │
│                                                              │
│ 5. Reproduz Mídias:                                          │
│    → Conforme plano recebido                               │
│    → Usa cache quando possível                              │
│    → Fallback para streaming                                │
│                                                              │
│ 6. Repete passos 2-5 continuamente                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 Links e Endpoints

### **Player → Servidor:**

| Endpoint | Método | Quando Usado |
|----------|--------|--------------|
| `/api/player/hardware-info` | GET | Ao iniciar (coleta hardware) |
| `/api/player/register` | POST | Primeira vez (vincular hardware) |
| `/api/player/decrypt-config` | POST | Após reinício (carregar config.json.enc) |
| `/api/player/token` | GET | Validação periódica |
| `/api/player/dispatch` | GET | A cada 15 min (obter plano) |
| `/api/player/heartbeat` | POST | A cada 30 seg (status) |
| `/api/player/event` | POST | Eventos (playback, etc.) |

### **Admin → Servidor:**

| Endpoint | Método | Quando Usado |
|----------|--------|--------------|
| `/api/totems/pending` | GET | Listar pendentes |
| `/api/totems/:id/approve` | PUT | Aprovar totem |

### **Interface Admin:**

| URL | Descrição |
|-----|-----------|
| `/totems` | Gerenciar totens |
| `/totems?tab=1` | Aba "Pendentes de Aprovação" |

---

## ⚠️ Pontos Críticos

### **1. Totem Deve Estar Pré-cadastrado**
- ⚠️ Totem **deve ser cadastrado pelo publisher** antes do player se conectar
- ⚠️ Se UIN não existe → Erro 404 "UIN não cadastrado"

### **2. Servidor Valida e Criptografa (Não Cria)**
- ⚠️ `/api/player/register` **valida** que UIN existe
- ⚠️ Servidor **atualiza** totem vinculando hardware
- ⚠️ Servidor **gera token HMAC** e retorna

### **3. Config.json.enc é Gerado Após Aprovação**
- ⚠️ Gerado pelo servidor via script `generate-player-config.sh`
- ⚠️ Player **reinicia** para carregar
- ⚠️ Player descriptografa via `/api/player/decrypt-config`

### **4. Loop Normal Após Reinício**
- ⚠️ Player carrega UIN de `config.json.enc`
- ⚠️ Inicia loop: token → dispatch → heartbeat → eventos → reprodução

---

## 📍 Localizações dos Arquivos

### **Player-Web-Cache:**

| Arquivo | Função |
|---------|--------|
| `player-web-cache/index.html` | HTML principal, funções de UIN e registro |
| `player-web-cache/js/app.js` | Classe SmartSignagePlayer, lógica de reprodução |
| `player-web-cache/js/api/client.js` | Cliente HTTP, comunicação com backend |
| `player-web-cache/js/cache/MediaCacheManager.js` | Gerenciamento de cache IndexedDB |

### **Backend:**

| Arquivo | Função |
|---------|--------|
| `backend/src/routes/player.ts` | Endpoints do player (register, dispatch, decrypt-config, etc.) |
| `backend/src/routes/totems.ts` | Endpoints de gerenciamento (approve, pending, etc.) |
| `backend/src/services/dispatcherTotemService.ts` | Motor de decisão do dispatcher |
| `backend/src/services/totemService.ts` | Serviço de gerenciamento de totens |

### **Scripts:**

| Arquivo | Função |
|---------|--------|
| `scripts/generate-player-config.sh` | Gera config.json.enc encriptado após aprovação |

### **Frontend:**

| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Totems/Totems.tsx` | Interface de gerenciamento e aprovação |
| `frontend/src/services/api/index.ts` | API client (totemApi, etc.) |

---

## ✅ Resumo Final

**Fluxo Correto:**

1. **Totem pré-cadastrado** pelo publisher (já tem UIN)
2. **Player gera UIN** baseado em hardware (deve corresponder)
3. **Player vincula hardware** ao totem pré-cadastrado
4. **Servidor valida, calcula e criptografa** UIN
5. **Admin aprova** via interface
6. **Servidor gera `config.json.enc`** (se solicitado)
7. **Player reinicia** e carrega UIN de `config.json.enc`
8. **Player inicia loop normal:** dispatch → heartbeat → eventos → reprodução

**Não existe link direto de aprovação** - tudo é feito via interface administrativa autenticada.
