## Visão Geral do Domínio – Smart Signage Pro v2.1

Documento de referência conceitual para estados, eventos e permissões principais do backend.

---

## 1. Estados de Domínio

### 1.1. Campaign (`campaigns`)

- **Campos principais**
  - `status`: `draft | active | paused | finished | deleted`
  - `is_active`: `BOOLEAN` (compatibilidade/legado)

- **Significado dos estados**
  - `draft`  
    - Em configuração.  
    - Não deve ser exibida em players.  
    - Pode ser editada livremente.
  - `active`  
    - Campanha em veiculação normal.  
    - Considerada por players, analytics e billing.  
    - Transições típicas: `draft → active`, `paused → active`.
  - `paused`  
    - Campanha temporariamente suspensa.  
    - Players devem deixar de exibi‑la enquanto estiver pausada.  
    - Não deve gerar novos eventos/execuções.
  - `finished`  
    - Campanha encerrada (fim de vigência).  
    - Não deve ser exibida, mas permanece para histórico/relatórios.
  - `deleted`  
    - Remoção lógica.  
    - Não deve ser retornada em listagens normais; usada apenas para auditoria ou limpeza.

- **Convenção recomendada**  
  - `status` é a **fonte da verdade** para fluxo de vida.  
  - `is_active` deve ser mantido em sincronia, mas será descontinuado no futuro (usar apenas para compatibilidade).

---

### 1.2. Totem (`totems`)

- **Campos principais**
  - `status`: `online | offline | error | maintenance | pending_approval`
  - `active`: `BOOLEAN` (indica se o totem está ativo no negócio)
  - `is_active`: `BOOLEAN` (compatibilidade/legado)

- **Significado dos estados**
  - `online`  
    - Heartbeat recente dentro da janela esperada.  
    - Deve ser considerado em distribuição de conteúdo.
  - `offline`  
    - Heartbeat ausente ou muito antigo.  
    - Não deve ser considerado disponível para veiculação imediata.
  - `error`  
    - Totem reportou erro ou status crítico.  
    - Pode continuar online, mas requer atenção (ex.: falha de mídia, hardware, player).
  - `maintenance`  
    - Totem deliberadamente em manutenção.  
    - Não deve receber novos conteúdos/atividades enquanto mantido nesse estado.
  - `pending_approval`  
    - Totem recém‑registrado ainda não aprovado para produção.

- **Sinalizadores de atividade**
  - `active = true`  
    - Totem faz parte do ambiente produtivo (pode ser ligado/desligado por `status`).  
  - `is_active`  
    - Mantido para compatibilidade; deve refletir o mesmo sentido de `active`.

---

### 1.3. Playlists (`playlists`) e Smart Playlists (`smart_playlists`)

#### Playlists (`playlists`)

- **Campos principais**
  - `is_active`: `BOOLEAN`
  - `totem_id`, `campaign_id`

- **Conceito**
  - Representam a **lista concreta de itens de mídia** associada a um totem/campanha.  
  - `is_active = true` → playlist elegível para exibição.  
  - Transições típicas: criar → `is_active = true/false` → soft‑delete via `is_active = false`.

#### Smart Playlists (`smart_playlists`)

- **Campos principais**
  - `status`: `inactive | active | generating | error`
  - `ai_enabled`: `BOOLEAN`
  - `rules`: `JSONB` (regras de negócio)

- **Significado dos estados**
  - `inactive`  
    - Configurada, mas não gerando playlists automaticamente.
  - `generating`  
    - Em processo de geração (via worker de agendamento ou ação manual).
  - `active`  
    - Geração concluída com sucesso; possui resultado utilizável.  
  - `error`  
    - Falha na geração; requer revisão de regras, dados ou IA.

- **Papel no domínio**
  - Smart playlists definem **como gerar** uma playlist; o resultado final é aplicado em `playlists`/`playlist_items`.  
  - Métricas de geração: `generated_items`, `total_duration`, `effectiveness`.

---

## 2. Modelo de Eventos (`event_logs`)

### 2.1. Estrutura da tabela

- `id`: `SERIAL PRIMARY KEY`
- `event_type`: `TEXT NOT NULL` (enum lógico `EventType`)
- `entity_type`: `TEXT NOT NULL` (tipo de entidade de negócio)
- `entity_id`: `INTEGER`
- `totem_id`: `INTEGER`
- `campaign_id`: `INTEGER`
- `playlist_id`: `INTEGER`
- `media_id`: `INTEGER`
- `metadata`: `JSONB`
- `timestamp`: `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`

### 2.2. Convenções gerais

- **Sempre preencher**:
  - `event_type`: valor do enum `EventType` correspondente ao evento de negócio.  
  - `entity_type`: string que identifica o agregado principal (`'totem'`, `'campaign'`, `'media'`, `'playlist'`, `'qr_code'`, `'system'`, etc.).  
  - `entity_id`: id da entidade principal quando aplicável.

- **Sempre que existir**:
  - `totem_id`: id do totem relacionado.  
  - `campaign_id`: id da campanha relacionada.  
  - `playlist_id`: id da playlist relacionada (playlist ou smart_playlist).  
  - `media_id`: id da mídia exibida/referenciada.

- **`metadata`**: objeto JSON com detalhes específicos do evento.  
  - Deve ser **estável e previsível** por tipo de evento.  
  - Nunca incluir dados sensíveis (tokens, senhas, emails, dados pessoais em claro) – usar `sanitizeForLogging` no backend quando necessário.

### 2.3. Principais tipos de evento (enum `EventType`)

#### Totem / Player

- `TOTEM_HEARTBEAT`
  - `entity_type = 'totem'`
  - Campos recomendados em `metadata`:
    - `status`: status atual (`online | offline | error | maintenance | ...`)  
    - `previousStatus`: status anterior (se conhecido)  
    - `ipAddress`  
    - `version` (software do player)  
    - `firmwareVersion`  
    - `metrics`: objeto com métricas (`cpu`, `memory`, `disk`, `temperature`, etc.)  
    - `source`: `'processHeartbeat' | 'registerHeartbeat' | outro'`

- `TOTEM_ONLINE`, `TOTEM_OFFLINE`, `TOTEM_ERROR`
  - Disparados quando há **mudança de status** relevante.  
  - `entity_type = 'totem'`  
  - `metadata` sugerido:
    - `previousStatus`  
    - `newStatus`  
    - `ipAddress`  
    - `version`  
    - `firmwareVersion`  
    - `source`

#### Playback de mídia / campanhas

- `VIDEO_PLAYBACK_START`, `VIDEO_PLAYBACK_END`, `VIDEO_PLAYBACK_ERROR`
  - `entity_type = 'media'`
  - Preencher sempre que possível:
    - `totem_id`, `campaign_id`, `playlist_id`, `media_id`  
  - `metadata` sugerido:
    - `playId` ou `executionId` (id da execução em `execution_logs`/`export_executions`, se houver)  
    - `durationSeconds` (para `_END`)  
    - `position` (ordem na playlist)  
    - `result` (`'success' | 'timeout' | 'network_error' | ...`)  
    - `errorCode` / `errorMessage` (em caso de erro)

- `AD_DISPLAY_START`, `AD_DISPLAY_END`, `AD_DISPLAY_SKIP`
  - `entity_type = 'campaign'` ou `'media'` conforme o modelo de anúncio.  
  - `metadata` sugerido:
    - `slot` (posição de exibição)  
    - `price` / `currency` (se houver bilhetagem)  
    - `durationSeconds`  
    - `result`

#### QR Code / Interações

- `QR_CODE_SCAN`
  - `entity_type = 'qr_code'`
  - Sempre que possível:
    - `entity_id` = `qr_code_id`  
    - `totem_id` relacionado  
    - `campaign_id` se o QR estiver vinculado a uma campanha
  - `metadata` sugerido:
    - `userAgent`  
    - `ipAddress`  
    - `location` (texto simples ou referência)  
    - `scanTimestamp`  
    - `redirectUrl` / `deeplinkUrl` (se aplicável)

#### BI / Ações do usuário

- `USER_ACTION`, `INTERACTION`, `VIEW_TIME`, `ENGAGEMENT`
  - `entity_type` variável (`'user'`, `'totem'`, `'campaign'`, `'media'` etc.).  
  - Uso típico para métricas de funil, engajamento, heatmaps de uso, etc.  
  - `metadata` deve conter IDs de contexto e dimensões relevantes (ex.: `action`, `screen`, `duration`, `success`).

---

## 3. Modelo de Permissões e RBAC

### 3.1. Estrutura de Roles e Permissões

O sistema utiliza um modelo **híbrido** de autorização:
- **Role-based (RBAC)**: Roles definem grupos de usuários com permissões similares.
- **Permission-based**: Permissões granulares por recurso e ação.
- **Client-based**: Isolamento de dados por cliente (multi-tenancy).

### 3.2. Roles Principais

#### 3.2.1. `admin`
- **Descrição**: Administrador do sistema com acesso total.
- **Características**:
  - Acesso a todos os recursos e ações.
  - Pode acessar dados de qualquer cliente (bypassa `requireClientAccess`).
  - Pode gerenciar usuários, roles e permissões.
  - Pode modificar configurações globais do sistema.
- **Uso típico**: Administradores da plataforma, superusuários.

#### 3.2.2. `manager`
- **Descrição**: Gerente de cliente ou unidade de negócio.
- **Características**:
  - Acesso amplo aos recursos do próprio cliente (`client_id`).
  - Pode criar, editar e gerenciar campanhas, totens, playlists, mídia.
  - Pode visualizar analytics e relatórios do cliente.
  - Pode gerenciar usuários do próprio cliente (roles inferiores).
  - **Não pode**: Modificar configurações globais, acessar dados de outros clientes.
- **Uso típico**: Gerentes de marketing, coordenadores de campanhas.

#### 3.2.3. `operator`
- **Descrição**: Operador que executa tarefas do dia a dia.
- **Características**:
  - Acesso limitado aos recursos do próprio cliente.
  - Pode visualizar campanhas, totens, playlists, mídia.
  - Pode executar ações operacionais (ex: pausar/retomar campanhas, verificar status de totens).
  - **Não pode**: Criar ou deletar recursos principais, modificar configurações, gerenciar usuários.
- **Uso típico**: Operadores de campo, técnicos de suporte.

#### 3.2.4. `user` / `client`
- **Descrição**: Usuário básico com acesso apenas leitura ou ações muito limitadas.
- **Características**:
  - Acesso somente leitura à maioria dos recursos.
  - Pode visualizar dashboards e relatórios do próprio cliente.
  - **Não pode**: Modificar dados, criar recursos, executar ações administrativas.
- **Uso típico**: Visualizadores, stakeholders que precisam apenas consultar informações.

### 3.3. Estrutura de Permissões (Tabelas)

#### 3.3.1. `roles`
- `role_id`: ID único da role.
- `name`: Nome da role (`admin`, `manager`, `operator`, `user`).
- `description`: Descrição da role.
- `is_active`: Se a role está ativa.

#### 3.3.2. `permissions`
- `permission_id`: ID único da permissão.
- `name`: Nome único da permissão (ex: `campaign.create`, `media.delete`).
- `resource`: Recurso afetado (`campaign`, `media`, `totem`, `playlist`, `analytics`, `user`, `settings`, etc.).
- `action`: Ação permitida (`create`, `read`, `update`, `delete`, `approve`, `publish`, `export`, etc.).
- `description`: Descrição da permissão.

#### 3.3.3. `user_roles`
- Relaciona usuários com roles (many-to-many).
- `user_id`: ID do usuário.
- `role_id`: ID da role.
- `granted_by`: ID do usuário que concedeu a role (auditoria).

#### 3.3.4. `role_permissions`
- Relaciona roles com permissões (many-to-many).
- `role_id`: ID da role.
- `permission_id`: ID da permissão.

### 3.4. Middlewares de Autorização

#### 3.4.1. `authMiddleware` / `authenticateToken`
- **Função**: Verifica se o usuário está autenticado (JWT válido).
- **Uso**: Aplicado em rotas que requerem autenticação.
- **Resultado**: Adiciona `req.user` com dados do usuário (`id`, `username`, `email`, `role`, `clientId`).

#### 3.4.2. `requireRole(roles: string | string[])`
- **Função**: Verifica se o usuário possui uma das roles especificadas.
- **Uso**: `router.get('/admin-only', requireRole('admin'), handler)`.
- **Exemplo**: `requireRole(['admin', 'manager'])` permite admin ou manager.

#### 3.4.3. `requirePermission(resource: string, action: string)`
- **Função**: Verifica se o usuário possui a permissão específica (via `role_permissions`).
- **Uso**: `router.post('/campaigns', requirePermission('campaign', 'create'), handler)`.
- **Vantagem**: Mais granular que roles, permite controle fino por recurso/ação.

#### 3.4.4. `requireClientAccess`
- **Função**: Garante que usuários não-admin só acessem dados do próprio cliente.
- **Comportamento**:
  - `admin`: Bypass automático (acessa qualquer cliente).
  - Outros roles: Verifica se `req.user.clientId` corresponde ao `clientId` na requisição.
- **Uso**: Aplicado em rotas que acessam recursos por cliente.

### 3.5. Padrões de Uso Recomendados

#### 3.5.1. Rotas Administrativas
```typescript
router.put('/settings', 
  authenticateToken, 
  requireRole('admin'), 
  handler
);
```

#### 3.5.2. Rotas com Permissão Granular
```typescript
router.post('/campaigns',
  authenticateToken,
  requirePermission('campaign', 'create'),
  requireClientAccess, // Se aplicável
  handler
);
```

#### 3.5.3. Rotas com Múltiplas Roles
```typescript
router.get('/analytics',
  authenticateToken,
  requireRole(['admin', 'manager', 'operator']),
  requireClientAccess,
  handler
);
```

### 3.6. Isolamento Multi-Tenancy

- **Por padrão**: Usuários não-admin só veem/gerenciam recursos do próprio `client_id`.
- **Verificação**: Middleware `requireClientAccess` ou verificação manual em serviços.
- **Admin**: Pode acessar todos os clientes (útil para suporte e administração).

### 3.7. Auditoria de Permissões

- Todas as ações críticas devem ser registradas via `AuditService`.
- Campos relevantes:
  - `user_id`: Quem executou a ação.
  - `resource`: Recurso afetado.
  - `action`: Ação executada.
  - `metadata`: Detalhes adicionais (IDs, valores anteriores/novos, etc.).

---

## 4. Logging Operacional x Eventos de Negócio

- **Logging operacional** (`loggerHelper` → arquivos locais)
  - Uso para:
    - Erros técnicos (`logError` / `logErrorSync`)  
    - Diagnósticos (`logDebug`, `logInfo`)  
    - Auditoria técnica (ex.: “queue inicializada”, “erro no Redis”, “erro em worker de exportação”)
  - Dados sensíveis devem ser sanitizados com `sanitizeForLogging`.

- **Eventos de negócio** (`EventLogService` → `event_logs`)
  - Uso para:
    - Fatos de domínio que interessam a BI, relatórios, auditoria de negócio.  
    - Ex.: `TOTEM_HEARTBEAT`, `TOTEM_ONLINE`, `VIDEO_PLAYBACK_*`, `QR_CODE_SCAN`, `CAMPAIGN_START/END`, `SYSTEM_EVENT`.
  - Nunca substituir o log técnico – são complementares.

---

## 5. Diretrizes de Evolução

1. **Novas features** devem escolher claramente:
   - Se o dado é puramente técnico → usar apenas `loggerHelper`.  
   - Se é relevante para negócio/BI → registrar também em `event_logs` via `EventLogService`.

2. **Estados e transições** de `campaign`, `totem`, `playlist` e `smart_playlist` devem:
   - Ser centralizados em seus respectivos services (`campaignService`, `totemService`, `playlistService`, `smartPlaylistService`).  
   - Evitar lógica de status em rotas – usar services como única fonte de verdade.

3. **Permissões e RBAC**:
   - Usar `requireRole` para controle simples por role.
   - Usar `requirePermission` para controle granular por recurso/ação.
   - Sempre aplicar `requireClientAccess` em rotas que acessam recursos por cliente (exceto admin).
   - Documentar permissões necessárias em comentários JSDoc das rotas.

---

## 6. Resumo Executivo

Este documento consolida os conceitos chave do domínio Smart Signage Pro v2.1:

- **Estados de Entidades**: Definições oficiais de estados para `campaign`, `totem`, `playlist`, `smart_playlist`.
- **Modelo de Eventos**: Contrato canônico para `event_logs` com metadata padronizado por tipo de evento.
- **Permissões e RBAC**: Roles (`admin`, `manager`, `operator`, `user`), estrutura de permissões e middlewares de autorização.
- **Logging**: Separação entre logs operacionais (`loggerHelper`) e eventos de negócio (`EventLogService`).

**Este documento é a referência de alto nível**; detalhes de implementação ficam nos serviços e no schema (`smartchannel-db.sql`).  
**Mudanças conceituais devem atualizar primeiro aqui**, para manter o projeto coeso.

**Última atualização**: 2024-12-19  
**Versão do documento**: 1.0


