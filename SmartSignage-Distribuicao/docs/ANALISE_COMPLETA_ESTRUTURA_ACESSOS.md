# 🔐 Análise Completa - Estrutura de Acessos e Hierarquia de Permissões

**Data da Análise:** 2024-01-XX  
**Versão do Sistema:** v2.1

---

## 📊 RESUMO EXECUTIVO

### Estado Atual do Sistema de Acessos

| Componente | Status | Observações |
|------------|--------|-------------|
| **Tabela `users`** | ✅ Existe | Campo `role` (texto simples) |
| **Tabela `roles`** | ✅ Existe | Estrutura RBAC básica |
| **Tabela `permissions`** | ✅ Existe | Permissões granulares |
| **Tabela `user_roles`** | ✅ Existe | Relação usuário-role |
| **Tabela `role_permissions`** | ✅ Existe | Relação role-permissão |
| **Middleware de Auth** | ✅ Implementado | `authMiddleware`, `authorizeRole` |
| **Middleware de Permissões** | ✅ Implementado | `requirePermission` |
| **Roles Atuais** | ⚠️ Básico | `admin`, `manager`, `operator`, `viewer`, `client` |

### Problemas Identificados

1. **Hierarquia não definida claramente**
   - Não há distinção entre "Operator" (manutenção) e "Admin SQL" (dados)
   - Roles atuais são genéricas

2. **Proteção de dados do cliente**
   - Não há separação clara entre dados administrativos e dados do cliente
   - "Operator" pode acessar dados do cliente (problema de segurança)

3. **Falta estrutura hierárquica**
   - Não há definição clara de níveis de acesso
   - Não há restrições baseadas em hierarquia

---

## 🎯 PROPOSTA DE HIERARQUIA DE ACESSOS

### Níveis Hierárquicos (Do Mais Alto ao Mais Baixo)

```
┌─────────────────────────────────────────────────────────┐
│ 1. ADMIN_SQL (Top Hierarquia - Dados + Sistema)         │
│    - Acesso total ao sistema                            │
│    - Acesso a dados gerais da base de dados            │
│    - Acesso a dados de clientes (com restrições)        │
│    - Manutenção do sistema                              │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 2. OPERATOR (Top Hierarquia - Apenas Sistema)          │
│    - Acesso a funcionalidades administrativas           │
│    - Acesso a parâmetros do sistema                    │
│    - Acesso a logs do sistema                          │
│    - Manutenção do sistema                             │
│    - ❌ NÃO pode acessar dados privados do cliente      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 3. ADMIN (Administrador do Cliente)                    │
│    - Acesso total aos dados do próprio cliente          │
│    - Gerenciamento de usuários do cliente              │
│    - Configurações do cliente                           │
│    - ❌ NÃO pode acessar dados de outros clientes       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 4. MANAGER (Gerente do Cliente)                        │
│    - Acesso a dados do cliente (limitado)              │
│    - Gerenciamento de campanhas                         │
│    - Gerenciamento de mídia                             │
│    - ❌ NÃO pode gerenciar usuários                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 5. VIEWER (Visualizador)                               │
│    - Apenas leitura de dados do cliente                │
│    - Relatórios e dashboards                           │
│    - ❌ NÃO pode modificar nada                         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 6. CLIENT (Cliente Final - Player)                     │
│    - Acesso apenas via API do player                    │
│    - Autenticação de totem                             │
│    - ❌ NÃO tem acesso ao frontend admin                │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 DETALHAMENTO POR ROLE

### 1. ADMIN_SQL (Top Hierarquia - Dados + Sistema)

**Descrição:** Administrador SQL com acesso total ao sistema, incluindo dados gerais da base de dados e dados de clientes (com restrições de privacidade).

**Características:**
- ✅ Acesso total ao sistema
- ✅ Acesso a dados gerais da base de dados
- ✅ Acesso a dados de clientes (com restrições de privacidade)
- ✅ Manutenção do sistema
- ✅ Parâmetros do sistema
- ✅ Logs do sistema
- ✅ Gerenciamento de usuários (todos os níveis)
- ✅ Gerenciamento de roles e permissões
- ✅ Acesso a queries SQL diretas (com auditoria)
- ✅ Backup e restore
- ✅ Migrações de banco de dados

**Restrições:**
- ⚠️ Dados sensíveis de clientes devem ser mascarados/anonymizados
- ⚠️ Todas as ações devem ser auditadas
- ⚠️ Acesso a dados de clientes deve ser justificado

**Permissões:**
- `system.*` (todas as ações)
- `database.*` (todas as ações)
- `users.*` (todas as ações)
- `roles.*` (todas as ações)
- `permissions.*` (todas as ações)
- `clients.read` (leitura com restrições)
- `clients.update` (atualização com restrições)
- `audit.*` (todas as ações)
- `logs.*` (todas as ações)
- `settings.*` (todas as ações)

**Não pode:**
- ❌ Expor dados privados de clientes sem justificativa
- ❌ Modificar dados de clientes sem auditoria
- ❌ Acessar dados financeiros de clientes (billing) sem autorização

---

### 2. OPERATOR (Top Hierarquia - Apenas Sistema)

**Descrição:** Operador do sistema com acesso a funcionalidades administrativas, parâmetros e logs, mas SEM acesso a dados privados do cliente.

**Características:**
- ✅ Acesso a funcionalidades administrativas
- ✅ Acesso a parâmetros do sistema
- ✅ Acesso a logs do sistema
- ✅ Manutenção do sistema
- ✅ Gerenciamento de totens (status, configuração técnica)
- ✅ Gerenciamento de OTA updates
- ✅ Gerenciamento de SmartDisplayFX (configuração técnica)
- ✅ Monitoramento de sistema
- ✅ Gerenciamento de backups (técnico)
- ✅ Troubleshooting

**Restrições:**
- ❌ **NÃO pode acessar dados privados do cliente**
- ❌ **NÃO pode ver campanhas de clientes**
- ❌ **NÃO pode ver mídia de clientes**
- ❌ **NÃO pode ver relatórios de clientes**
- ❌ **NÃO pode ver dados de billing de clientes**
- ❌ **NÃO pode ver dados pessoais de usuários de clientes**
- ❌ **NÃO pode acessar dados de clientes na base de dados**

**Permissões:**
- `system.read` (leitura)
- `system.update` (atualização)
- `system.maintenance` (manutenção)
- `settings.read` (leitura)
- `settings.update` (atualização)
- `logs.read` (leitura)
- `logs.export` (exportação)
- `totems.read` (leitura técnica - status, versão)
- `totems.update` (atualização técnica - configuração)
- `totems.restart` (reinício)
- `totems.screenshot` (screenshot)
- `totems.logs` (logs remotos)
- `ota.*` (todas as ações)
- `smartdisplayfx.config` (configuração técnica)
- `smartdisplayfx.logs` (logs técnicos)
- `monitoring.*` (todas as ações)
- `backup.read` (leitura)
- `backup.create` (criação)

**Não pode:**
- ❌ `clients.*` (nenhuma ação)
- ❌ `campaigns.*` (nenhuma ação)
- ❌ `medias.*` (nenhuma ação)
- ❌ `playlists.*` (nenhuma ação)
- ❌ `reports.*` (nenhuma ação)
- ❌ `billing.*` (nenhuma ação)
- ❌ `users.read` (leitura de usuários de clientes)
- ❌ `users.update` (atualização de usuários de clientes)

**Exemplo de Dados Permitidos:**
- ✅ Status de totem (online/offline)
- ✅ Versão do firmware
- ✅ IP do totem
- ✅ Logs técnicos do sistema
- ✅ Configurações técnicas

**Exemplo de Dados Bloqueados:**
- ❌ Nome do cliente
- ❌ Campanhas do cliente
- ❌ Mídia do cliente
- ❌ Relatórios do cliente
- ❌ Dados de billing do cliente
- ❌ Usuários do cliente

---

### 3. ADMIN (Administrador do Cliente)

**Descrição:** Administrador do cliente com acesso total aos dados do próprio cliente.

**Características:**
- ✅ Acesso total aos dados do próprio cliente
- ✅ Gerenciamento de usuários do cliente
- ✅ Configurações do cliente
- ✅ Gerenciamento de campanhas
- ✅ Gerenciamento de mídia
- ✅ Gerenciamento de playlists
- ✅ Gerenciamento de totens do cliente
- ✅ Relatórios e analytics
- ✅ Billing do cliente

**Restrições:**
- ❌ NÃO pode acessar dados de outros clientes
- ❌ NÃO pode acessar configurações do sistema
- ❌ NÃO pode acessar logs do sistema
- ❌ NÃO pode criar/gerenciar roles

**Permissões:**
- `clients.read` (próprio cliente)
- `clients.update` (próprio cliente)
- `users.*` (usuários do próprio cliente)
- `campaigns.*` (campanhas do próprio cliente)
- `medias.*` (mídia do próprio cliente)
- `playlists.*` (playlists do próprio cliente)
- `totems.*` (totens do próprio cliente)
- `reports.*` (relatórios do próprio cliente)
- `analytics.*` (analytics do próprio cliente)
- `billing.*` (billing do próprio cliente)
- `smartdisplayfx.read` (FX do próprio cliente)
- `smartdisplayfx.update` (FX do próprio cliente)

**Não pode:**
- ❌ `system.*` (nenhuma ação)
- ❌ `settings.*` (configurações do sistema)
- ❌ `logs.*` (logs do sistema)
- ❌ `roles.*` (gerenciamento de roles)
- ❌ `permissions.*` (gerenciamento de permissões)
- ❌ `clients.*` (outros clientes)

---

### 4. MANAGER (Gerente do Cliente)

**Descrição:** Gerente do cliente com acesso limitado aos dados do cliente.

**Características:**
- ✅ Acesso a dados do cliente (limitado)
- ✅ Gerenciamento de campanhas
- ✅ Gerenciamento de mídia
- ✅ Gerenciamento de playlists
- ✅ Visualização de relatórios
- ✅ Visualização de analytics

**Restrições:**
- ❌ NÃO pode gerenciar usuários
- ❌ NÃO pode acessar billing
- ❌ NÃO pode modificar configurações do cliente
- ❌ NÃO pode acessar dados de outros clientes

**Permissões:**
- `campaigns.read`
- `campaigns.create`
- `campaigns.update`
- `campaigns.delete`
- `medias.read`
- `medias.create`
- `medias.update`
- `medias.delete`
- `playlists.read`
- `playlists.create`
- `playlists.update`
- `playlists.delete`
- `totems.read` (totens do cliente)
- `reports.read`
- `analytics.read`
- `smartdisplayfx.read`

**Não pode:**
- ❌ `users.*` (nenhuma ação)
- ❌ `billing.*` (nenhuma ação)
- ❌ `clients.update` (atualização do cliente)
- ❌ `settings.*` (configurações)

---

### 5. VIEWER (Visualizador)

**Descrição:** Visualizador com acesso apenas de leitura aos dados do cliente.

**Características:**
- ✅ Apenas leitura de dados do cliente
- ✅ Relatórios e dashboards
- ✅ Visualização de campanhas
- ✅ Visualização de mídia
- ✅ Visualização de playlists

**Restrições:**
- ❌ NÃO pode modificar nada
- ❌ NÃO pode criar nada
- ❌ NÃO pode deletar nada

**Permissões:**
- `campaigns.read`
- `medias.read`
- `playlists.read`
- `totems.read`
- `reports.read`
- `analytics.read`
- `smartdisplayfx.read`

**Não pode:**
- ❌ Qualquer ação de escrita (`create`, `update`, `delete`)

---

### 6. CLIENT (Cliente Final - Player)

**Descrição:** Cliente final (player/totem) com acesso apenas via API do player.

**Características:**
- ✅ Autenticação de totem
- ✅ Heartbeat
- ✅ Download de playlists
- ✅ Download de mídia
- ✅ Upload de logs
- ✅ Upload de screenshots

**Restrições:**
- ❌ NÃO tem acesso ao frontend admin
- ❌ NÃO pode acessar dados de outros totens
- ❌ NÃO pode modificar configurações

**Permissões:**
- `player.authenticate`
- `player.heartbeat`
- `player.playlist.download`
- `player.media.download`
- `player.logs.upload`
- `player.screenshot.upload`

---

## 🔒 MATRIZ DE PERMISSÕES

### Recursos do Sistema

| Recurso | ADMIN_SQL | OPERATOR | ADMIN | MANAGER | VIEWER | CLIENT |
|---------|-----------|----------|-------|---------|--------|--------|
| **system.*** | ✅ Todas | ✅ Leitura/Update | ❌ | ❌ | ❌ | ❌ |
| **database.*** | ✅ Todas | ❌ | ❌ | ❌ | ❌ | ❌ |
| **users.*** | ✅ Todas | ❌ | ✅ (próprio cliente) | ❌ | ❌ | ❌ |
| **roles.*** | ✅ Todas | ❌ | ❌ | ❌ | ❌ | ❌ |
| **permissions.*** | ✅ Todas | ❌ | ❌ | ❌ | ❌ | ❌ |
| **clients.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ❌ | ❌ | ❌ |
| **campaigns.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ✅ (próprio) | ✅ (read) | ❌ |
| **medias.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ✅ (próprio) | ✅ (read) | ✅ (download) |
| **playlists.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ✅ (próprio) | ✅ (read) | ✅ (download) |
| **totems.*** | ✅ (com restrições) | ✅ (técnico) | ✅ (próprio) | ✅ (read) | ✅ (read) | ✅ (próprio) |
| **reports.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ✅ (read) | ✅ (read) | ❌ |
| **billing.*** | ✅ (com restrições) | ❌ | ✅ (próprio) | ❌ | ❌ | ❌ |
| **settings.*** | ✅ Todas | ✅ (sistema) | ✅ (cliente) | ❌ | ❌ | ❌ |
| **logs.*** | ✅ Todas | ✅ (sistema) | ✅ (cliente) | ❌ | ❌ | ✅ (upload) |
| **ota.*** | ✅ Todas | ✅ Todas | ❌ | ❌ | ❌ | ✅ (download) |
| **smartdisplayfx.*** | ✅ Todas | ✅ (config/logs) | ✅ (próprio) | ✅ (read) | ✅ (read) | ✅ (events) |
| **audit.*** | ✅ Todas | ✅ (read) | ✅ (próprio) | ❌ | ❌ | ❌ |
| **backup.*** | ✅ Todas | ✅ (read/create) | ❌ | ❌ | ❌ | ❌ |
| **monitoring.*** | ✅ Todas | ✅ Todas | ❌ | ❌ | ❌ | ❌ |

---

## 🛡️ REGRAS DE SEGURANÇA

### 1. Proteção de Dados do Cliente

**Regra Principal:** OPERATOR não pode acessar dados privados do cliente.

**Implementação:**
```typescript
// Middleware para bloquear acesso a dados do cliente
export const blockClientDataAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role === 'operator') {
    // Bloquear acesso a recursos de clientes
    const blockedResources = ['campaigns', 'medias', 'playlists', 'reports', 'billing', 'clients'];
    const resource = req.path.split('/')[2]; // Ex: /api/campaigns -> campaigns
    
    if (blockedResources.includes(resource)) {
      res.status(403).json({
        error: 'Acesso negado. Operadores não podem acessar dados de clientes.',
        code: 'CLIENT_DATA_ACCESS_DENIED'
      });
      return;
    }
  }
  
  next();
};
```

### 2. Auditoria de Acesso

**Regra:** Todas as ações de ADMIN_SQL e OPERATOR devem ser auditadas.

**Implementação:**
- Log de todas as ações
- Log de acesso a dados de clientes
- Log de queries SQL diretas
- Alertas para acesso a dados sensíveis

### 3. Mascaramento de Dados

**Regra:** ADMIN_SQL deve ver dados de clientes mascarados/anonymizados quando não necessário.

**Implementação:**
- Mascarar emails: `user@example.com` → `u***@e***.com`
- Mascarar nomes: `João Silva` → `J*** S***`
- Mascarar dados financeiros: `R$ 1.234,56` → `R$ ***,**

---

## 📝 PRÓXIMOS PASSOS

### 1. Atualizar Banco de Dados

- [ ] Adicionar role `admin_sql` na tabela `roles`
- [ ] Adicionar role `operator` na tabela `roles` (se não existir)
- [ ] Atualizar permissões na tabela `permissions`
- [ ] Criar relação role-permissão na tabela `role_permissions`

### 2. Atualizar Middleware

- [ ] Criar middleware `blockClientDataAccess` para OPERATOR
- [ ] Criar middleware `requireAdminSql` para ADMIN_SQL
- [ ] Atualizar `authorizeRole` para suportar hierarquia
- [ ] Criar middleware de auditoria para ADMIN_SQL e OPERATOR

### 3. Atualizar Rotas

- [ ] Adicionar proteção `blockClientDataAccess` nas rotas de clientes
- [ ] Adicionar proteção `requireAdminSql` nas rotas de banco de dados
- [ ] Atualizar todas as rotas para usar nova hierarquia

### 4. Atualizar Frontend

- [ ] Criar interface de gerenciamento de roles
- [ ] Adicionar restrições de UI baseadas em role
- [ ] Criar dashboard específico para OPERATOR
- [ ] Criar dashboard específico para ADMIN_SQL

### 5. Testes

- [ ] Testes unitários de permissões
- [ ] Testes de integração de hierarquia
- [ ] Testes de segurança (tentativas de acesso não autorizado)

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Banco de Dados
- [ ] Criar migration para adicionar roles
- [ ] Criar migration para adicionar permissões
- [ ] Criar migration para relacionar roles-permissões
- [ ] Validar estrutura

### Fase 2: Backend
- [ ] Atualizar middleware de autenticação
- [ ] Criar middleware de bloqueio de dados do cliente
- [ ] Atualizar todas as rotas
- [ ] Implementar auditoria

### Fase 3: Frontend
- [ ] Atualizar interface de roles
- [ ] Adicionar restrições de UI
- [ ] Criar dashboards específicos

### Fase 4: Testes
- [ ] Testes unitários
- [ ] Testes de integração
- [ ] Testes de segurança

---

**Última atualização:** 2024-01-XX

