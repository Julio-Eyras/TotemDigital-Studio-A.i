# Estrutura Hierárquica de Menus e Níveis de Acesso
## SmartSignage Pro - Documentação Completa

---

## 📋 ÍNDICE

1. [Modelo de Dados - Ajuste Totem → Smart TV](#1-modelo-de-dados)
2. [Hierarquia de Roles e Permissões](#2-hierarquia-de-roles)
3. [Sistema de Flags/Permissões](#3-sistema-de-flags)
4. [Estrutura de Menus por Nível](#4-estrutura-de-menus)
5. [Subdomínios e Portas de Acesso](#5-subdomínios)
6. [Plano de Implementação](#6-plano-de-implementação)

---

## 1. MODELO DE DADOS

### 1.1. Ajuste Necessário: Totem → Smart TV (1:N)

**Situação Atual:**
- `smart_tvs.totem_id` → Relação 1:1 (um totem controla uma TV)
- Comentário no schema: "Totem que controla esta TV (1:1)"

**Ajuste Necessário:**
- Um totem pode controlar **múltiplas Smart TVs** (1:N)
- Manter `smart_tvs.totem_id` como FK (já permite múltiplas TVs por totem)
- Atualizar comentários e validações no schema
- Atualizar lógica de negócio que assume 1:1

**Modelo ER Corrigido:**
```
PUBLISHER (1) ──→ (N) LOCALS
                    │
                    └──→ (N) TOTEMS
                              │
                              └──→ (N) SMART_TVS  ← AJUSTE: 1:N
```

**Arquivos a Modificar:**
- `database/smartchannel-db-v2-refactored-part3-tables-dependent.sql` (linha 109)
- `backend/src/routes/smart-tvs.ts` (validações que assumem 1:1)
- `frontend/src/pages/SmartTvs/SmartTvs.tsx` (UI que assume 1:1)
- `frontend/src/pages/Totems/Totems.tsx` (visualização de TVs por totem)

---

## 2. HIERARQUIA DE ROLES

### 2.1. Estrutura Completa de Roles

```
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 0: OWNER_SYSTEM                                    │
│ ─────────────────────────────────────────────────────── │
│ Role: owner_system                                       │
│ Descrição: Proprietário do sistema - acesso total      │
│ Permissões: TODAS (incluindo admin_sql + extras)        │
│ Flags: Todas ativas                                      │
│ ─────────────────────────────────────────────────────── │
│ • Acesso SQL direto                                      │
│ • Configurações críticas do sistema                     │
│ • Auditoria completa                                     │
│ • Gerenciamento de owners                                │
│ • Backup/restore completo                                │
│ • Modificação de schema                                  │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 1: ADMIN_SQL                                       │
│ ─────────────────────────────────────────────────────── │
│ Role: admin_sql                                           │
│ Descrição: Administrador SQL - acesso técnico total     │
│ Permissões: Quase todas (exceto owner_system)            │
│ Flags: Flag_smart_0 a Flag_smart_9 (configuráveis)      │
│ ─────────────────────────────────────────────────────── │
│ • Acesso SQL direto                                      │
│ • Configurações do sistema                               │
│ • Gerenciamento de usuários                              │
│ • Auditoria                                              │
│ • Logs do sistema                                        │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 2: ADMINISTRADORES (Tenant)                        │
│ ─────────────────────────────────────────────────────── │
│ Role: admin                                               │
│ Descrição: Administrador do tenant - gestão completa     │
│ Permissões: Gestão de publishers, subscribers, contratos│
│ Flags: Flag_smart_0 a Flag_smart_9 (configuráveis)       │
│ ─────────────────────────────────────────────────────── │
│ • Gerenciar publishers                                   │
│ • Gerenciar subscribers                                  │
│ • Gerenciar contratos e planos                          │
│ • Faturamento global                                     │
│ • Usuários do sistema                                    │
│ • Configurações globais                                 │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 3: OPERADORES DO SISTEMA                           │
│ ─────────────────────────────────────────────────────── │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ OPERADOR_TECNICO                                     │ │
│ │ Role: operador_tecnico                               │ │
│ │ Descrição: Operador técnico - gestão de hardware     │ │
│ │ Flags: Flag_smart_0, Flag_smart_1, Flag_smart_2      │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ • Totens (visão técnica)                            │ │
│ │ • Smart TVs (visão técnica)                         │ │
│ │ • Players                                            │ │
│ │ • OTA Updates                                        │ │
│ │ • Logs técnicos                                      │ │
│ │ • Monitoramento                                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ OPERADOR_FATURAMENTO                                 │ │
│ │ Role: operador_faturamento                           │ │
│ │ Descrição: Operador de faturamento                   │ │
│ │ Flags: Flag_smart_3, Flag_smart_4, Flag_smart_5     │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ • Faturamento                                        │ │
│ │ • Contratos                                          │ │
│ │ • Planos                                             │ │
│ │ • Relatórios financeiros                            │ │
│ │ • Histórico de pagamentos                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ OPERADOR_COMERCIAL                                   │ │
│ │ Role: operador_comercial                             │ │
│ │ Descrição: Operador comercial - visualização        │ │
│ │ Flags: Flag_smart_6, Flag_smart_7                   │ │
│ │ ──────────────────────────────────────────────────── │ │
│ │ • Publishers (visualização)                         │ │
│ │ • Subscribers (visualização)                        │ │
│ │ • Campanhas (visualização)                         │ │
│ │ • Relatórios comerciais                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                           │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 4: PUBLISHERS (Interface Própria)                  │
│ ─────────────────────────────────────────────────────── │
│ Role: publisher_user (user_type = 'publisher_user')      │
│ Descrição: Usuário de publisher - gestão própria         │
│ Permissões: Apenas dados do próprio publisher            │
│ Flags: Flag_smart_8 (configurável)                       │
│ Subdomínio: publisher.sistema.com                        │
│ ─────────────────────────────────────────────────────── │
│ • Dashboard Publisher                                    │
│ • Meus Locais                                            │
│ • Meus Totens                                            │
│ • Minhas Smart TVs (atreladas aos totens)                │
│ • Analytics próprios                                     │
│ • Configurações                                          │
└─────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│ NÍVEL 5: SUBSCRIBERS (Interface Própria)                 │
│ ─────────────────────────────────────────────────────── │
│ Role: subscriber_user (user_type = 'subscriber_user')   │
│ Descrição: Usuário de subscriber - gestão própria        │
│ Permissões: Apenas dados do próprio subscriber           │
│ Flags: Flag_smart_9 (configurável)                       │
│ Subdomínio: subscriber.sistema.com                       │
│ ─────────────────────────────────────────────────────── │
│ • Dashboard Subscriber                                   │
│ • Minhas Campanhas                                       │
│ • Minhas Mídias                                          │
│ • Minhas Playlists                                       │
│ • Analytics próprios                                     │
│ • Faturamento                                            │
└─────────────────────────────────────────────────────────┘
```

---

## 3. SISTEMA DE FLAGS/PERMISSÕES

### 3.1. Estrutura de Flags

**Nomenclatura:** `Flag_smart_0` a `Flag_smart_9`

**Tabela de Flags:**

| Flag | Nome | Descrição | Roles Padrão |
|------|------|-----------|--------------|
| `Flag_smart_0` | `FLAG_TECHNICAL_ACCESS` | Acesso técnico (totens, TVs, players) | `operador_tecnico`, `admin_sql`, `owner_system` |
| `Flag_smart_1` | `FLAG_OTA_UPDATES` | Gerenciar atualizações OTA | `operador_tecnico`, `admin_sql`, `owner_system` |
| `Flag_smart_2` | `FLAG_SYSTEM_LOGS` | Acessar logs do sistema | `operador_tecnico`, `admin_sql`, `owner_system` |
| `Flag_smart_3` | `FLAG_BILLING_VIEW` | Visualizar faturamento | `operador_faturamento`, `admin`, `admin_sql`, `owner_system` |
| `Flag_smart_4` | `FLAG_BILLING_MANAGE` | Gerenciar faturamento | `operador_faturamento`, `admin`, `admin_sql`, `owner_system` |
| `Flag_smart_5` | `FLAG_CONTRACTS` | Gerenciar contratos | `operador_faturamento`, `admin`, `admin_sql`, `owner_system` |
| `Flag_smart_6` | `FLAG_COMMERCIAL_VIEW` | Visualizar dados comerciais | `operador_comercial`, `admin`, `admin_sql`, `owner_system` |
| `Flag_smart_7` | `FLAG_REPORTS_COMMERCIAL` | Relatórios comerciais | `operador_comercial`, `admin`, `admin_sql`, `owner_system` |
| `Flag_smart_8` | `FLAG_PUBLISHER_FULL` | Acesso completo de publisher | `publisher_user` (com publisher_id) |
| `Flag_smart_9` | `FLAG_SUBSCRIBER_FULL` | Acesso completo de subscriber | `subscriber_user` (com subscriber_id) |

### 3.2. Implementação das Flags

**Estrutura no Banco de Dados:**

```sql
-- Tabela de Flags (nova)
CREATE TABLE IF NOT EXISTS user_flags (
    user_id INTEGER NOT NULL,
    flag_smart_0 BOOLEAN DEFAULT false,
    flag_smart_1 BOOLEAN DEFAULT false,
    flag_smart_2 BOOLEAN DEFAULT false,
    flag_smart_3 BOOLEAN DEFAULT false,
    flag_smart_4 BOOLEAN DEFAULT false,
    flag_smart_5 BOOLEAN DEFAULT false,
    flag_smart_6 BOOLEAN DEFAULT false,
    flag_smart_7 BOOLEAN DEFAULT false,
    flag_smart_8 BOOLEAN DEFAULT false,
    flag_smart_9 BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Mapeamento Role → Flags (padrões)
CREATE TABLE IF NOT EXISTS role_flags_default (
    role TEXT NOT NULL,
    flag_smart_0 BOOLEAN DEFAULT false,
    flag_smart_1 BOOLEAN DEFAULT false,
    flag_smart_2 BOOLEAN DEFAULT false,
    flag_smart_3 BOOLEAN DEFAULT false,
    flag_smart_4 BOOLEAN DEFAULT false,
    flag_smart_5 BOOLEAN DEFAULT false,
    flag_smart_6 BOOLEAN DEFAULT false,
    flag_smart_7 BOOLEAN DEFAULT false,
    flag_smart_8 BOOLEAN DEFAULT false,
    flag_smart_9 BOOLEAN DEFAULT false,
    PRIMARY KEY (role)
);
```

**Lógica de Verificação:**

```typescript
// Verificar flag específica
function hasFlag(user: User, flag: string): boolean {
  // 1. Verificar flag personalizada do usuário
  if (user.flags && user.flags[flag]) return true;
  
  // 2. Verificar flags padrão da role
  const roleFlags = getRoleFlagsDefault(user.role);
  if (roleFlags && roleFlags[flag]) return true;
  
  // 3. Verificar role especial (owner_system tem todas)
  if (user.role === 'owner_system') return true;
  
  return false;
}
```

---

## 4. ESTRUTURA DE MENUS

### 4.1. Menu: OWNER_SYSTEM

```
📊 Dashboard Sistema
├─ 📈 Analytics Global
├─ 👥 Usuários Sistema
│  ├─ Listar/Criar/Editar
│  ├─ Gerenciar Roles
│  └─ Gerenciar Flags
├─ ⚙️ Configurações Globais
│  ├─ Sistema
│  ├─ Segurança
│  └─ Integrações
├─ 📝 Auditoria
│  ├─ Logs de Acesso
│  ├─ Logs de Ações
│  └─ Relatórios de Auditoria
├─ 🗄️ SQL Tools
│  ├─ Query Executor
│  ├─ Schema Manager
│  └─ Backup/Restore
├─ 🏢 Publishers
│  ├─ Listar/Criar/Editar
│  ├─ Locais (de publishers)
│  ├─ Totens (de publishers)
│  └─ Smart TVs (de publishers)
├─ 📢 Subscribers
│  ├─ Listar/Criar/Editar
│  ├─ Campanhas (de subscribers)
│  └─ Mídias (de subscribers)
├─ 💰 Faturamento Global
├─ 📊 Relatórios Globais
└─ 🔧 Admin Tools
```

### 4.2. Menu: ADMIN_SQL

```
📊 Dashboard
├─ 👥 Usuários Sistema
├─ ⚙️ Configurações
├─ 📝 Auditoria
├─ 🗄️ SQL Tools
├─ 🏢 Publishers
│  ├─ Listar/Criar/Editar
│  ├─ Locais (de publishers)
│  ├─ Totens (de publishers)
│  └─ Smart TVs (de publishers)  ← CORRIGIDO: abaixo de Totens
├─ 📢 Subscribers
│  ├─ Listar/Criar/Editar
│  ├─ Campanhas (de subscribers)
│  └─ Mídias (de subscribers)
├─ 💰 Faturamento
└─ 📊 Relatórios
```

### 4.3. Menu: ADMIN

```
📊 Dashboard
├─ 🏢 Publishers
│  ├─ Listar/Criar/Editar
│  ├─ Locais (de publishers)
│  ├─ Totens (de publishers)
│  └─ Smart TVs (de publishers)  ← CORRIGIDO: abaixo de Totens
├─ 📢 Subscribers
│  ├─ Listar/Criar/Editar
│  ├─ Campanhas (de subscribers)
│  └─ Mídias (de subscribers)
├─ 📋 Contratos & Planos
│  ├─ Planos
│  ├─ Contratos
│  └─ Acessos (Subscriber → Publisher)
├─ 💰 Faturamento
├─ 👥 Usuários
└─ 📊 Relatórios
```

### 4.4. Menu: OPERADOR_TECNICO

```
📊 Dashboard Técnico
├─ 🖥️ Totens
│  ├─ Listar Totens
│  ├─ Status Técnico
│  └─ Configurações
├─ 📺 Smart TVs
│  ├─ Listar Smart TVs
│  ├─ Status por Totem
│  └─ Configurações
├─ 💻 Players
│  ├─ Listar Players
│  └─ Status
├─ 🔄 OTA Updates
│  ├─ Gerenciar Atualizações
│  └─ Histórico
├─ 📋 Logs Técnicos
└─ 📊 Monitoramento
```

### 4.5. Menu: OPERADOR_FATURAMENTO

```
📊 Dashboard Faturamento
├─ 💰 Faturamento
│  ├─ Faturas
│  ├─ Pagamentos
│  └─ Histórico
├─ 📋 Contratos
│  ├─ Listar Contratos
│  ├─ Criar/Editar
│  └─ Renovações
├─ 📦 Planos
│  ├─ Listar Planos
│  └─ Configurações
└─ 📊 Relatórios Financeiros
```

### 4.6. Menu: OPERADOR_COMERCIAL

```
📊 Dashboard Comercial
├─ 🏢 Publishers (Visualização)
│  ├─ Listar Publishers
│  └─ Detalhes
├─ 📢 Subscribers (Visualização)
│  ├─ Listar Subscribers
│  └─ Detalhes
├─ 📢 Campanhas (Visualização)
│  ├─ Listar Campanhas
│  └─ Estatísticas
└─ 📊 Relatórios Comerciais
```

### 4.7. Menu: PUBLISHER (Subdomínio: publisher.sistema.com)

```
📊 Dashboard Publisher
├─ 📍 Meus Locais
│  ├─ Listar Locais
│  ├─ Criar/Editar Local
│  └─ Detalhes
├─ 🖥️ Meus Totens
│  ├─ Listar Totens
│  ├─ Status
│  └─ Configurações
├─ 📺 Minhas Smart TVs
│  ├─ Listar Smart TVs
│  ├─ Smart TVs por Totem  ← NOVO: visualização hierárquica
│  └─ Status
├─ 📊 Analytics
│  ├─ Visão Geral
│  └─ Relatórios
└─ ⚙️ Configurações
```

### 4.8. Menu: SUBSCRIBER (Subdomínio: subscriber.sistema.com)

```
📊 Dashboard Subscriber
├─ 📢 Minhas Campanhas
│  ├─ Listar Campanhas
│  ├─ Criar/Editar
│  └─ Estatísticas
├─ 🎬 Minhas Mídias
│  ├─ Listar Mídias
│  ├─ Upload
│  └─ Biblioteca
├─ 📋 Minhas Playlists
│  ├─ Listar Playlists
│  ├─ Criar/Editar
│  └─ Itens
├─ 📊 Analytics
│  ├─ Visão Geral
│  └─ Relatórios
└─ 💰 Faturamento
```

---

## 5. SUBDOMÍNIOS E PORTAS DE ACESSO

### 5.1. Estrutura de Subdomínios

```
┌─────────────────────────────────────────────────────────┐
│ DOMÍNIO PRINCIPAL                                        │
│ sistema.com (ou smartsignage.com)                        │
│ ─────────────────────────────────────────────────────── │
│ • Interface principal (admin, operadores)               │
│ • Porta: 80/443                                         │
│ • Rotas: /dashboard, /publishers, /subscribers, etc.   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SUBDOMÍNIO: PUBLISHER                                    │
│ publisher.sistema.com                                   │
│ ─────────────────────────────────────────────────────── │
│ • Interface exclusiva para publishers                   │
│ • Porta: 80/443                                         │
│ • Autenticação: user_type = 'publisher_user'            │
│ • Isolamento: apenas dados do publisher_id do usuário   │
│ • Rotas: /dashboard, /locals, /totems, /smart-tvs      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SUBDOMÍNIO: SUBSCRIBER                                   │
│ subscriber.sistema.com                                  │
│ ─────────────────────────────────────────────────────── │
│ • Interface exclusiva para subscribers                   │
│ • Porta: 80/443                                         │
│ • Autenticação: user_type = 'subscriber_user'           │
│ • Isolamento: apenas dados do subscriber_id do usuário   │
│ • Rotas: /dashboard, /campaigns, /media, /playlists    │
└─────────────────────────────────────────────────────────┘
```

### 5.2. Configuração Nginx (Exemplo)

```nginx
# Domínio principal
server {
    listen 80;
    server_name sistema.com www.sistema.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# Subdomínio Publisher
server {
    listen 80;
    server_name publisher.sistema.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Subdomain-Type publisher;
    }
}

# Subdomínio Subscriber
server {
    listen 80;
    server_name subscriber.sistema.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Subdomain-Type subscriber;
    }
}
```

### 5.3. Middleware de Detecção de Subdomínio

```typescript
// backend/src/middleware/subdomain.middleware.ts
export const detectSubdomain = (req: Request, res: Response, next: NextFunction) => {
  const host = req.get('host') || '';
  const subdomain = host.split('.')[0];
  
  if (subdomain === 'publisher') {
    req.subdomainType = 'publisher';
  } else if (subdomain === 'subscriber') {
    req.subdomainType = 'subscriber';
  } else {
    req.subdomainType = 'main';
  }
  
  next();
};
```

---

## 6. PLANO DE IMPLEMENTAÇÃO

### 6.1. Fase 1: Ajustes no Modelo de Dados

**Tarefas:**
1. ✅ Atualizar schema: Totem → Smart TV (1:N)
   - Arquivo: `database/smartchannel-db-v2-refactored-part3-tables-dependent.sql`
   - Alterar comentário linha 109
   - Remover constraint que limita a 1 TV por totem (se existir)

2. ✅ Criar tabelas de Flags
   - `user_flags` (flags por usuário)
   - `role_flags_default` (flags padrão por role)

3. ✅ Adicionar role `owner_system`
   - Atualizar enum de roles
   - Criar usuário inicial owner_system

4. ✅ Adicionar novas roles de operadores
   - `operador_tecnico`
   - `operador_faturamento`
   - `operador_comercial`

**Arquivos a Modificar:**
- `database/smartchannel-db-v2-refactored-part2-tables-base.sql` (roles)
- `database/smartchannel-db-v2-refactored-part3-tables-dependent.sql` (smart_tvs)
- Criar: `database/migrations/add-user-flags.sql`
- Criar: `database/migrations/add-operator-roles.sql`

---

### 6.2. Fase 2: Backend - Middleware e Rotas

**Tarefas:**
1. ✅ Criar middleware de subdomínio
   - `backend/src/middleware/subdomain.middleware.ts`

2. ✅ Atualizar middleware de autenticação
   - Detectar subdomínio
   - Validar user_type conforme subdomínio
   - Bloquear acesso cruzado (publisher acessando subscriber, etc.)

3. ✅ Criar sistema de verificação de flags
   - `backend/src/utils/flagChecker.ts`
   - Função `hasFlag(user, flag)`
   - Função `getUserFlags(user)`

4. ✅ Atualizar rotas de Smart TVs
   - Permitir múltiplas TVs por totem
   - Endpoint: `GET /api/totems/:totemId/smart-tvs` (listar TVs do totem)

5. ✅ Criar rotas específicas por subdomínio
   - `backend/src/routes/publisher-routes.ts` (rotas para publisher.sistema.com)
   - `backend/src/routes/subscriber-routes.ts` (rotas para subscriber.sistema.com)

**Arquivos a Criar/Modificar:**
- `backend/src/middleware/subdomain.middleware.ts` (NOVO)
- `backend/src/utils/flagChecker.ts` (NOVO)
- `backend/src/middleware/auth.middleware.ts` (ATUALIZAR)
- `backend/src/routes/smart-tvs.ts` (ATUALIZAR)
- `backend/src/routes/publisher-routes.ts` (NOVO)
- `backend/src/routes/subscriber-routes.ts` (NOVO)

---

### 6.3. Fase 3: Frontend - Layouts e Menus

**Tarefas:**
1. ✅ Criar Layout específico para Publishers
   - `frontend/src/components/Layout/PublisherLayout.tsx`
   - Menu hierárquico: Locais → Totens → Smart TVs

2. ✅ Criar Layout específico para Subscribers
   - `frontend/src/components/Layout/SubscriberLayout.tsx`
   - Menu: Campanhas, Mídias, Playlists

3. ✅ Atualizar sistema de permissões de menu
   - `frontend/src/utils/rolePermissions.ts`
   - Adicionar novas roles
   - Adicionar verificação de flags

4. ✅ Corrigir menus duplicados
   - `frontend/src/components/Layout/Layout.tsx`
   - Remover duplicatas (ex: "Mix por Grupos" linha 101 e 105)

5. ✅ Criar página hierárquica: Totens → Smart TVs
   - `frontend/src/pages/Totems/TotemSmartTvs.tsx`
   - Visualização: Totem → Lista de Smart TVs

6. ✅ Atualizar roteamento por subdomínio
   - `frontend/src/App.tsx`
   - Detectar subdomínio
   - Carregar layout apropriado

**Arquivos a Criar/Modificar:**
- `frontend/src/components/Layout/PublisherLayout.tsx` (NOVO)
- `frontend/src/components/Layout/SubscriberLayout.tsx` (NOVO)
- `frontend/src/utils/rolePermissions.ts` (ATUALIZAR)
- `frontend/src/components/Layout/Layout.tsx` (ATUALIZAR - remover duplicatas)
- `frontend/src/pages/Totems/TotemSmartTvs.tsx` (NOVO)
- `frontend/src/App.tsx` (ATUALIZAR)

---

### 6.4. Fase 4: Configuração de Infraestrutura

**Tarefas:**
1. ✅ Configurar Nginx para subdomínios
   - Adicionar server blocks para publisher.sistema.com
   - Adicionar server blocks para subscriber.sistema.com
   - Configurar SSL/HTTPS para cada subdomínio

2. ✅ Configurar DNS
   - Registrar subdomínios no DNS
   - Configurar wildcard se necessário

3. ✅ Atualizar variáveis de ambiente
   - `PUBLISHER_SUBDOMAIN=publisher.sistema.com`
   - `SUBSCRIBER_SUBDOMAIN=subscriber.sistema.com`
   - `MAIN_DOMAIN=sistema.com`

**Arquivos a Modificar:**
- `nginx.conf` ou configuração do servidor web
- `.env` (adicionar variáveis de subdomínio)

---

### 6.5. Fase 5: Testes e Validação

**Checklist de Testes:**

1. ✅ **Modelo de Dados**
   - [ ] Um totem pode ter múltiplas Smart TVs
   - [ ] Flags são criadas corretamente
   - [ ] Roles são criadas corretamente

2. ✅ **Autenticação e Autorização**
   - [ ] Owner_system tem acesso total
   - [ ] Admin_sql tem acesso quase total
   - [ ] Operadores têm acesso restrito conforme flags
   - [ ] Publishers só acessam dados próprios
   - [ ] Subscribers só acessam dados próprios

3. ✅ **Subdomínios**
   - [ ] publisher.sistema.com carrega layout de publisher
   - [ ] subscriber.sistema.com carrega layout de subscriber
   - [ ] Domínio principal carrega layout padrão
   - [ ] Acesso cruzado é bloqueado

4. ✅ **Menus**
   - [ ] Menus são filtrados por role
   - [ ] Menus são filtrados por flags
   - [ ] Não há duplicatas
   - [ ] Hierarquia está correta (Totens → Smart TVs)

5. ✅ **Interface**
   - [ ] Layout de Publisher funciona
   - [ ] Layout de Subscriber funciona
   - [ ] Visualização hierárquica Totem → Smart TVs funciona

---

## 7. RESUMO DAS MUDANÇAS

### 7.1. Banco de Dados

- ✅ Ajuste: `smart_tvs.totem_id` → Relação 1:N (já permite, apenas atualizar comentários)
- ✅ Nova tabela: `user_flags`
- ✅ Nova tabela: `role_flags_default`
- ✅ Nova role: `owner_system`
- ✅ Novas roles: `operador_tecnico`, `operador_faturamento`, `operador_comercial`

### 7.2. Backend

- ✅ Novo middleware: `subdomain.middleware.ts`
- ✅ Novo utilitário: `flagChecker.ts`
- ✅ Atualizar: `auth.middleware.ts` (detecção de subdomínio)
- ✅ Atualizar: `smart-tvs.ts` (suporte 1:N)
- ✅ Novas rotas: `publisher-routes.ts`, `subscriber-routes.ts`

### 7.3. Frontend

- ✅ Novo layout: `PublisherLayout.tsx`
- ✅ Novo layout: `SubscriberLayout.tsx`
- ✅ Atualizar: `rolePermissions.ts` (novas roles e flags)
- ✅ Atualizar: `Layout.tsx` (remover duplicatas)
- ✅ Nova página: `TotemSmartTvs.tsx`
- ✅ Atualizar: `App.tsx` (roteamento por subdomínio)

### 7.4. Infraestrutura

- ✅ Configurar Nginx para subdomínios
- ✅ Configurar DNS
- ✅ Atualizar variáveis de ambiente

---

## 8. PRÓXIMOS PASSOS IMEDIATOS

1. **Revisar este documento** e validar todas as decisões
2. **Criar issues/tasks** para cada fase
3. **Priorizar implementação** (sugestão: Fase 1 → Fase 2 → Fase 3 → Fase 4 → Fase 5)
4. **Iniciar Fase 1** (ajustes no modelo de dados)

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
**Status:** Proposta - Aguardando Aprovação
