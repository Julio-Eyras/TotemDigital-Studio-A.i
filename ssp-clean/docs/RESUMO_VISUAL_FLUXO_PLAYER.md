# 📊 Resumo Visual: Fluxo Player-Web-Cache

## 🔄 Fluxo Completo em 10 Passos

```
┌─────────────────────────────────────────────────────────────┐
│ PASSO 1: Player Inicia                                      │
│ Arquivo: player-web-cache/index.html                        │
│                                                              │
│ - Verifica localStorage por 'totemUIN'                       │
│ - Se não existe, inicia auto-registro                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 2: Coleta Hardware                                    │
│ Função: collectHardware()                                  │
│                                                              │
│ 1. Chama GET /api/player/hardware-info                      │
│    └─ Servidor retorna:                                     │
│       • MAC Address (via ip link show)                      │
│       • Hostname (os.hostname())                            │
│       • Platform (os.platform())                            │
│       • Architecture (os.arch())                            │
│                                                              │
│ 2. Gera hardwareHash (SHA-256 dos dados)                    │
│                                                              │
│ Retorna: { macAddress, hostname, platform, arch,            │
│           hardwareHash }                                    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 3: Gera UIN                                           │
│ Função: generateUIN(hw)                                    │
│                                                              │
│ 1. Cria string:                                             │
│    { mac, hostname, platform, hash }                        │
│                                                              │
│ 2. Hash SHA-256:                                            │
│    crypto.subtle.digest('SHA-256', ...)                     │
│                                                              │
│ 3. Formato:                                                 │
│    'SSP-' + hex.substring(0, 16)                            │
│                                                              │
│ Exemplo: SSP-3a8f9b2c1d4e5f6                                │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 4: Auto-Registro                                      │
│ Função: autoRegister(uin)                                   │
│ Endpoint: POST /api/player/register                         │
│                                                              │
│ Payload:                                                    │
│ {                                                           │
│   "uin": "SSP-3a8f9b2c1d4e5f6",                            │
│   "hardware": {                                             │
│     "macAddress": "aa:bb:cc:dd:ee:ff",                     │
│     "hostname": "player-001",                               │
│     "platform": "linux",                                    │
│     "hardwareHash": "abc123...",                           │
│     "userAgent": "Mozilla/5.0..."                          │
│   }                                                         │
│ }                                                           │
│                                                              │
│ Servidor cria totem:                                        │
│ • status: 'pending_approval'                                │
│ • is_active: false                                          │
│ • config: { hardware: {...} } (JSONB)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 5: Player Armazena UIN                                 │
│                                                              │
│ localStorage.setItem('totemUIN', uin)                       │
│                                                              │
│ Player mostra:                                              │
│ "Aguardando aprovação do administrador"                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 6: Validação Periódica                                │
│ Função: validateTotem(uin)                                  │
│ Endpoint: GET /api/player/token?uin=...                     │
│                                                              │
│ Resposta enquanto pendente:                                 │
│ {                                                           │
│   "valid": false,                                           │
│   "pendingApproval": true,                                  │
│   "message": "Aguardando aprovação..."                      │
│ }                                                           │
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
│    • Opcional: gera config.json.enc                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 8: Player Detecta Aprovação                           │
│                                                              │
│ Na próxima validação:                                       │
│ GET /api/player/token?uin=...                              │
│                                                              │
│ Resposta:                                                   │
│ {                                                           │
│   "valid": true,                                            │
│   "token": "HMAC_TOKEN...",                                 │
│   "pendingApproval": false                                  │
│ }                                                           │
│                                                              │
│ Player inicia reprodução!                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 9: Obtém DispatchPlan                                 │
│ Função: loadDispatchPlan()                                  │
│ Endpoint: GET /api/player/dispatch?uin=...&token=...        │
│                                                              │
│ Frequência:                                                 │
│ • Inicial: ao iniciar                                       │
│ • Periódico: a cada 15 minutos                              │
│ • Quando necessário: se plano expirar                        │
│                                                              │
│ Resposta:                                                   │
│ {                                                           │
│   "success": true,                                          │
│   "fromCache": false,                                       │
│   "plan": {                                                 │
│     "playlistId": 456,                                      │
│     "playlistName": "Playlist Principal",                   │
│     "mediaItems": [...],                                    │
│     "validityStart": "...",                                 │
│     "validityEnd": "..."                                    │
│   }                                                         │
│ }                                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ PASSO 10: Reproduz Mídias                                    │
│                                                              │
│ 1. Processa cache (IndexedDB)                               │
│ 2. Baixa mídias não em cache                                │
│ 3. Reproduz mídias do cache quando possível                 │
│ 4. Fallback para streaming                                  │
│ 5. Envia eventos (playback_start, etc.)                     │
│ 6. Envia heartbeat periódico                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔗 Links e Endpoints

### **Player → Servidor:**

| Endpoint | Método | Quando Usado |
|----------|--------|--------------|
| `/api/player/hardware-info` | GET | Ao iniciar (coleta hardware) |
| `/api/player/register` | POST | Primeira vez (auto-registro) |
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
| `backend/src/routes/player.ts` | Endpoints do player (register, dispatch, token, etc.) |
| `backend/src/routes/totems.ts` | Endpoints de gerenciamento (approve, pending, etc.) |
| `backend/src/services/dispatcherTotemService.ts` | Motor de decisão do dispatcher |
| `backend/src/services/totemService.ts` | Serviço de gerenciamento de totens |

### **Frontend:**

| Arquivo | Função |
|---------|--------|
| `frontend/src/pages/Totems/Totems.tsx` | Interface de gerenciamento e aprovação |
| `frontend/src/services/api/index.ts` | API client (totemApi, etc.) |

---

## ⚠️ Importante: Não Existe Link Direto de Aprovação

**Por quê?**
- ✅ Segurança: Requer autenticação de admin
- ✅ Auditoria: Registra quem aprovou
- ✅ Controle: Admin precisa ver informações antes

**Como aprovar:**
1. Acessar `/totems` (requer login)
2. Aba "Pendentes de Aprovação"
3. Clicar "Aprovar" no totem desejado

**Se precisar de link direto (futuro):**
Poderia implementar token temporário:
```
/totems/approve?token={TOKEN}&totemId={ID}
```
Mas **não está implementado** atualmente.
