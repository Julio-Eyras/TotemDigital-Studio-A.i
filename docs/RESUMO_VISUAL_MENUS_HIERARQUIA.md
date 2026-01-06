# Resumo Visual - Estrutura Hierárquica de Menus

## 🎯 CORREÇÃO PRINCIPAL: Hierarquia Totens → Smart TVs

### ❌ ANTES (Incorreto)
```
Publishers
├─ Locais
├─ Totens
└─ Smart TVs  ← Separado, sem relação clara
```

### ✅ DEPOIS (Correto)
```
Publishers
├─ Locais
│  └─ Totens (do local)
│     └─ Smart TVs (do totem)  ← Hierárquico e lógico
```

---

## 📋 MENUS POR ROLE - ESTRUTURA COMPLETA

### 👑 OWNER_SYSTEM
```
📊 Dashboard Sistema
├─ 👥 Usuários Sistema
├─ ⚙️ Configurações Globais
├─ 📝 Auditoria
├─ 🗄️ SQL Tools
├─ 🏢 Publishers
│  ├─ Listar/Criar/Editar
│  ├─ Locais
│  │  └─ Totens
│  │     └─ Smart TVs  ← CORRIGIDO
│  └─ ...
├─ 📢 Subscribers
└─ 💰 Faturamento Global
```

### 🔧 ADMIN_SQL
```
📊 Dashboard
├─ 👥 Usuários Sistema
├─ ⚙️ Configurações
├─ 🗄️ SQL Tools
├─ 🏢 Publishers
│  ├─ Locais
│  │  └─ Totens
│  │     └─ Smart TVs  ← CORRIGIDO
│  └─ ...
└─ 📢 Subscribers
```

### 👨‍💼 ADMIN
```
📊 Dashboard
├─ 🏢 Publishers
│  ├─ Locais
│  │  └─ Totens
│  │     └─ Smart TVs  ← CORRIGIDO
│  └─ ...
├─ 📢 Subscribers
├─ 📋 Contratos & Planos
└─ 💰 Faturamento
```

### 🔧 OPERADOR_TECNICO
```
📊 Dashboard Técnico
├─ 🖥️ Totens
│  ├─ Listar Totens
│  └─ Smart TVs por Totem  ← NOVO: visualização hierárquica
│     └─ Lista de Smart TVs
├─ 📺 Smart TVs (visão geral)
├─ 💻 Players
├─ 🔄 OTA Updates
└─ 📋 Logs Técnicos
```

### 💰 OPERADOR_FATURAMENTO
```
📊 Dashboard Faturamento
├─ 💰 Faturamento
├─ 📋 Contratos
├─ 📦 Planos
└─ 📊 Relatórios Financeiros
```

### 📊 OPERADOR_COMERCIAL
```
📊 Dashboard Comercial
├─ 🏢 Publishers (Visualização)
├─ 📢 Subscribers (Visualização)
├─ 📢 Campanhas (Visualização)
└─ 📊 Relatórios Comerciais
```

### 🏢 PUBLISHER (publisher.sistema.com)
```
📊 Dashboard Publisher
├─ 📍 Meus Locais
│  └─ 🖥️ Totens do Local
│     └─ 📺 Smart TVs do Totem  ← NOVO: hierárquico
├─ 🖥️ Meus Totens (visão geral)
├─ 📺 Minhas Smart TVs (visão geral)
├─ 📊 Analytics
└─ ⚙️ Configurações
```

### 📢 SUBSCRIBER (subscriber.sistema.com)
```
📊 Dashboard Subscriber
├─ 📢 Minhas Campanhas
├─ 🎬 Minhas Mídias
├─ 📋 Minhas Playlists
├─ 📊 Analytics
└─ 💰 Faturamento
```

---

## 🔐 SISTEMA DE FLAGS

### Flags Disponíveis (Flag_smart_0 a Flag_smart_9)

```
Flag_smart_0 → FLAG_TECHNICAL_ACCESS
Flag_smart_1 → FLAG_OTA_UPDATES
Flag_smart_2 → FLAG_SYSTEM_LOGS
Flag_smart_3 → FLAG_BILLING_VIEW
Flag_smart_4 → FLAG_BILLING_MANAGE
Flag_smart_5 → FLAG_CONTRACTS
Flag_smart_6 → FLAG_COMMERCIAL_VIEW
Flag_smart_7 → FLAG_REPORTS_COMMERCIAL
Flag_smart_8 → FLAG_PUBLISHER_FULL
Flag_smart_9 → FLAG_SUBSCRIBER_FULL
```

### Mapeamento Role → Flags Padrão

| Role | Flags Ativas |
|------|--------------|
| `owner_system` | Todas (0-9) |
| `admin_sql` | 0, 1, 2, 3, 4, 5, 6, 7 (configurável) |
| `admin` | 3, 4, 5, 6, 7 (configurável) |
| `operador_tecnico` | 0, 1, 2 |
| `operador_faturamento` | 3, 4, 5 |
| `operador_comercial` | 6, 7 |
| `publisher_user` | 8 |
| `subscriber_user` | 9 |

---

## 🌐 SUBDOMÍNIOS

```
┌─────────────────────────────────────┐
│ sistema.com                         │
│ (Interface Principal)               │
│ • Admin, Operadores                 │
└─────────────────────────────────────┘
           │
           ├─── publisher.sistema.com
           │    (Interface Publisher)
           │    • Apenas publishers
           │
           └─── subscriber.sistema.com
                (Interface Subscriber)
                • Apenas subscribers
```

---

## 🔄 MUDANÇAS NO MODELO DE DADOS

### Totem → Smart TV

**ANTES:**
- Relação 1:1 (um totem = uma TV)
- Comentário: "Totem que controla esta TV (1:1)"

**DEPOIS:**
- Relação 1:N (um totem = múltiplas TVs)
- Comentário: "Totem que controla estas TVs (1:N)"
- Schema já permite (apenas atualizar comentários e lógica)

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Atualizar comentário `smart_tvs.totem_id` (1:N)
- [ ] Criar tabela `user_flags`
- [ ] Criar tabela `role_flags_default`
- [ ] Adicionar role `owner_system`
- [ ] Adicionar roles: `operador_tecnico`, `operador_faturamento`, `operador_comercial`

### Fase 2: Backend
- [ ] Criar `subdomain.middleware.ts`
- [ ] Criar `flagChecker.ts`
- [ ] Atualizar `auth.middleware.ts`
- [ ] Atualizar `smart-tvs.ts` (suporte 1:N)
- [ ] Criar `publisher-routes.ts`
- [ ] Criar `subscriber-routes.ts`

### Fase 3: Frontend
- [ ] Criar `PublisherLayout.tsx`
- [ ] Criar `SubscriberLayout.tsx`
- [ ] Atualizar `rolePermissions.ts`
- [ ] Corrigir duplicatas em `Layout.tsx`
- [ ] Criar `TotemSmartTvs.tsx`
- [ ] Atualizar `App.tsx` (roteamento por subdomínio)

### Fase 4: Infraestrutura
- [ ] Configurar Nginx (subdomínios)
- [ ] Configurar DNS
- [ ] Atualizar `.env`

### Fase 5: Testes
- [ ] Testar modelo 1:N (Totem → Smart TVs)
- [ ] Testar flags e permissões
- [ ] Testar subdomínios
- [ ] Testar isolamento de dados
- [ ] Testar menus por role

---

**Documento de Referência:** `ESTRUTURA_HIERARQUICA_MENUS_E_ACESSOS.md`
