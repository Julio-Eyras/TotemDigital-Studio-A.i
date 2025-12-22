# Análise: Workflow de Aprovação e Atribuição de Campanhas

## 🎯 Contexto e Clarificações

### Regras de Negócio Identificadas

1. **CLIENT (Anunciante) cria e mantém:**
   - ✅ Playlists
   - ✅ Mídias
   - ✅ Campanhas

2. **Aprovação obrigatória:**
   - ✅ Mídias e Playlists **precisam ser aprovadas por admin/users do sistema SmartSignage**
   - ✅ CLIENT não pode publicar diretamente
   - ✅ Apenas ap
   ós aprovação é das midias e que podem ser usadas em playlist e campanhas

3. **Atribuição flexível de campanhas:**
   - ✅ CLIENT pode atrelar campanhas a **diversos hosts, locais e totens** sim 
   - ✅ Uma campanha pode ser exibida em múltiplos locais/totens simultaneamente sim 
---

## 📊 Análise do Modelo Atual

### 1. Workflow de Aprovação de Mídias

#### **Situação Atual:**

```sql
approval_workflows (
    id,
    media_id INTEGER UNIQUE NOT NULL,  -- ✅ FK → medias
    status TEXT DEFAULT 'draft',       -- draft, review, approved, rejected, published
    reviewed_by INTEGER,                -- ✅ FK → users (admin/user do sistema)
    reviewed_at TIMESTAMP,
    comment TEXT,
    ...
)
```

**Análise:**
- ✅ **CORRETO:** Aprovação existe para mídias
- ✅ **CORRETO:** `reviewed_by` referencia `users` (admin/user do sistema)  o correto este e o unico qque pode aprovar midias 
- ✅ **CORRETO:** Status permite rastrear workflow completo
- ⚠️ **INCOMPLETO:** Não há aprovação para playlists! playlist e campanhas nao necessitam de aprovacao do admin ou usar do sistema estes sao geridos pelo anunciante ao cadastrar o anunciante este tera um paramentro que permitira ou nao que ele mesmo mantenhas suas midias, playlist, campanhas. caso ele nao tenha esta opcao habilitada esta opcao ficara a cargo da administracao do noso sistema modulo a ser desenvolvido 



#### **Mídias - Status vs Approval Status:**

```sql
medias (
    media_id,
    client_id,              -- ✅ CLIENT cria
    created_by INTEGER,     -- ✅ Usuário que criou
    status TEXT DEFAULT 'draft',  -- draft, review, published, archived
    ...
)
```

**Análise:**
- ⚠️ **DUPLICAÇÃO/AMBIGUIDADE:**
  - `medias.status` = 'draft', 'review', 'published', 'archived'
  - `approval_workflows.status` = 'draft', 'review', 'approved', 'rejected', 'published' use esta aqui 
- ⚠️ **PROBLEMA:** Dois lugares para rastrear status
- ⚠️ **RISCO:** Inconsistência entre `medias.status` e `approval_workflows.status`

**Recomendação:**
- Opção A: Remover `medias.status` e usar apenas `approval_workflows.status` use esta aqui 
- Opção B: Sincronizar via trigger (medias.status = approval_workflows.status)
- Opção C: Clarificar: `medias.status` = status interno, `approval_workflows.status` = status de aprovação

---

### 2. Workflow de Aprovação de Playlists

#### **Situação Atual:**

```sql
playlists (
    playlist_id,
    totem_id INTEGER NOT NULL,      -- ⚠️ AMBÍGUO
    campaign_id INTEGER NOT NULL,   -- ⚠️ AMBÍGUO
    client_id INTEGER,              -- ✅ CLIENT cria
    status TEXT?,                   -- ❌ NÃO EXISTE!
    ...
)

-- ❌ NÃO EXISTE approval_workflows para playlists!
```

**Análise:**
- ❌ **PROBLEMA CRÍTICO:** Não existe workflow de aprovação para playlists
- ⚠️ **PROBLEMA:** CLIENT pode criar playlists, mas não há controle de aprovação
- ⚠️ **PROBLEMA:** Não há campo `created_by` em playlists (quem criou?)
- ⚠️ **PROBLEMA:** Não há campo `reviewed_by` ou similar

**Impacto:**
- CLIENT pode criar playlist, mas não há garantia de aprovação antes de usar
- Sistema não controla quais playlists estão aprovadas/prontas

---

### 3. Atribuição de Campanhas a Hosts/Locais/Totens

#### **Situação Atual:**

```sql
campaign_totems (
    id,
    totem_id INTEGER NOT NULL,      -- ✅ FK → totems
    campaign_id INTEGER NOT NULL,   -- ✅ FK → campaigns
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    status TEXT DEFAULT 'pending',  -- pending, active, completed, cancelled
    config TEXT,                    -- JSON
    is_active BOOLEAN DEFAULT true,
    ...
    UNIQUE(campaign_id, totem_id)   -- ✅ Uma campanha pode ter múltiplos totens
)
```

**Hierarquia de Atribuição:**
```
campaign → campaign_totems → totem → local → host
```

**Análise:**
- ✅ **CORRETO:** Uma campanha pode ser atribuída a múltiplos totens (via campaign_totems)
- ✅ **CORRETO:** Através do totem, chega-se ao local e ao host
- ⚠️ **LIMITAÇÃO:** Não há atribuição direta a HOST ou LOCAL
- ⚠️ **FLEXIBILIDADE:** Para atribuir a todos totens de um HOST ou LOCAL, precisa atribuir individualmente a cada totem

**Cenários:**

1. **Campanha em um totem específico:**
   - ✅ `campaign_totems` (campaign_id, totem_id)

2. **Campanha em todos totens de um local:**
   - ⚠️ Precisa criar múltiplos registros `campaign_totems` (um por totem)
   - ⚠️ Não há forma de atribuir "ao local X"

3. **Campanha em todos totens de um host:**
   - ⚠️ Precisa criar múltiplos registros `campaign_totems` (um por totem de cada local do host)
   - ⚠️ Não há forma de atribuir "ao host X"

**Recomendação:**
- Considerar adicionar `campaign_locals` e `campaign_hosts` para flexibilidade
- OU manter apenas `campaign_totems` e usar lógica no código para atribuir em massa

---

### 4. Relação Playlists vs Campanhas vs Totens

#### **Situação Atual:**

```sql
playlists (
    playlist_id,
    totem_id INTEGER NOT NULL,      -- ⚠️ Obrigatório
    campaign_id INTEGER NOT NULL,   -- ⚠️ Obrigatório
    client_id INTEGER,              -- Opcional
    ...
)
```

**Análise:**
- ⚠️ **AMBIGUIDADE:** Playlist tem `totem_id` E `campaign_id` obrigatórios
- ⚠️ **QUESTÃO:** Uma playlist é sempre específica de um totem E uma campanha?
- ⚠️ **REALIDADE:** Se CLIENT pode atrelar campanha a múltiplos totens, cada combinação precisa de playlist?

**Cenários:**

1. **Campanha X em Totem Y:**
   - Playlist específica (campaign_id=X, totem_id=Y)

2. **Campanha X em Totens Y, Z, W:**
   - Precisa de 3 playlists? (campaign_id=X, totem_id=Y), (campaign_id=X, totem_id=Z), (campaign_id=X, totem_id=W)
   - Ou playlist compartilhada?

3. **Múltiplas campanhas em mesmo totem:**
   - Cada campanha tem sua playlist? Como elas são combinadas?

**Recomendação:**
- Clarificar: Playlist é sempre 1:1 com (campaign, totem)?
- Ou playlist pode ser compartilhada entre múltiplos totens de uma campanha?

---

### 5. Relação campaign_playlists

#### **Situação Atual:**

```sql
campaign_playlists (
    id,
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    active BOOLEAN DEFAULT true,
    ...
    UNIQUE(campaign_id, playlist_id)
)

playlists (
    playlist_id,
    totem_id INTEGER NOT NULL,      -- ⚠️ Já tem totem_id
    campaign_id INTEGER NOT NULL,   -- ⚠️ Já tem campaign_id
    ...
)
```

**Análise:**
- ⚠️ **REDUNDÂNCIA:** `campaign_playlists` relaciona campaign ↔ playlist, mas `playlists` já tem `campaign_id`
- ⚠️ **CONFLITO:** Se playlist tem `campaign_id`, por que precisa de `campaign_playlists`?
- ⚠️ **QUESTÃO:** Uma playlist pode pertencer a múltiplas campanhas? (N:M)
  - Se SIM: `campaign_playlists` faz sentido, mas `playlists.campaign_id` deveria ser NULL
  - Se NÃO: `campaign_playlists` é redundante

---

## 🔍 Problemas Identificados

### **Problema 1: Ausência de Aprovação para Playlists**

**Impacto:**
- CLIENT pode criar playlists sem aprovação
- Não há controle de qualidade/conteúdo antes de usar em campanhas
- Risco de conteúdo inadequado ser exibido

**Recomendação:**
- Criar `playlist_approval_workflows` similar a `approval_workflows` (para mídias)
- OU usar tabela unificada `approval_workflows` com `entity_type` ('media' ou 'playlist')

### **Problema 2: Duplicação de Status (Mídias)**

**Impacto:**
- `medias.status` e `approval_workflows.status` podem ficar inconsistentes
- Confusão sobre qual é a fonte da verdade

**Recomendação:**
- Remover `medias.status` OU sincronizar via trigger
- OU usar apenas `approval_workflows.status` como fonte da verdade

### **Problema 3: Ambiguidade Playlist vs Campaign vs Totem**

**Impacto:**
- Não está claro se playlist é 1:1 com (campaign, totem)
- Não está claro se playlist pode ser compartilhada
- `campaign_playlists` parece redundante

**Recomendação:**
- Clarificar modelo conceitual:
  - Opção A: Playlist é 1:1 com (campaign, totem) → Remover `campaign_playlists`
  - Opção B: Playlist pode ser N:M com campanhas → Remover `playlists.campaign_id`
  - Opção C: Playlist pode ser compartilhada entre totens → Remover `playlists.totem_id` obrigatório

### **Problema 4: Limitação na Atribuição de Campanhas**

**Impacto:**
- Para atribuir campanha a todos totens de um HOST ou LOCAL, precisa criar múltiplos registros
- Operação trabalhosa e propensa a erros

**Recomendação:**
- Adicionar `campaign_locals` e `campaign_hosts` para atribuição em massa
- OU criar lógica no código para atribuir em massa via `campaign_totems`

### **Problema 5: Ausência de Campos de Auditoria em Playlists**

**Impacto:**
- Não há `created_by` (quem criou?)
- Não há `reviewed_by` (quem aprovou?)
- Não há `created_at` / `updated_at` (quando foi criada/modificada?) - **CORRIGIDO:** já existe

**Recomendação:**
- Adicionar `created_by INTEGER REFERENCES users(id)`
- Adicionar workflow de aprovação com `reviewed_by`

---

## 💡 Propostas de Melhoria

### **Proposta 1: Workflow de Aprovação Unificado**

**Opção A: Tabela Unificada com Entity Type**

```sql
approval_workflows (
    id,
    entity_type TEXT NOT NULL,  -- 'media' ou 'playlist'
    entity_id INTEGER NOT NULL, -- media_id ou playlist_id
    status TEXT DEFAULT 'draft', -- draft, review, approved, rejected, published
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    comment TEXT,
    ...
    CONSTRAINT chk_approval_entity 
        CHECK (
            (entity_type = 'media' AND entity_id IN (SELECT media_id FROM medias)) OR
            (entity_type = 'playlist' AND entity_id IN (SELECT playlist_id FROM playlists))
        )
);
```

**Opção B: Tabelas Separadas (Recomendado)**

```sql
-- Manter approval_workflows para mídias
approval_workflows (
    id,
    media_id INTEGER UNIQUE NOT NULL,
    ...
);

-- Criar nova tabela para playlists
playlist_approval_workflows (
    id,
    playlist_id INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft', -- draft, review, approved, rejected, published
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    comment TEXT,
    ...
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
```

**Justificativa Opção B:**
- Mais explícito e claro
- FKs diretas garantem integridade
- Queries mais simples
- Facilita evolução independente

### **Proposta 2: Clarificar Modelo de Playlists**

**Opção A: Playlist 1:1 com (Campaign, Totem)**

```sql
playlists (
    playlist_id,
    totem_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    client_id INTEGER,              -- CLIENT que criou
    created_by INTEGER,             -- Usuário que criou
    ...
    UNIQUE(totem_id, campaign_id)   -- Uma playlist por (totem, campaign)
);

-- Remover campaign_playlists (redundante)
```

**Justificativa:**
- Cada totem em uma campanha tem sua própria playlist
- Mais simples e direto
- Elimina ambiguidade

**Opção B: Playlist N:M com Campanhas (Compartilhada)**

```sql
playlists (
    playlist_id,
    client_id INTEGER NOT NULL,     -- CLIENT que criou
    created_by INTEGER,             -- Usuário que criou
    name TEXT,
    ...
    -- Remover totem_id e campaign_id
);

-- Usar campaign_playlists para associar
campaign_playlists (
    campaign_id,
    playlist_id,
    totem_id INTEGER,               -- Opcional: playlist específica de totem
    priority INTEGER,
    ...
);
```

**Justificativa:**
- Playlist pode ser reutilizada em múltiplas campanhas
- Mais flexível
- Reduz duplicação

### **Proposta 3: Atribuição Flexível de Campanhas**

**Opção A: Adicionar Tabelas para Hosts e Locais**

```sql
campaign_hosts (
    id,
    campaign_id INTEGER NOT NULL,
    host_id INTEGER NOT NULL,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    status TEXT,
    ...
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
    FOREIGN KEY (host_id) REFERENCES hosts(host_id),
    UNIQUE(campaign_id, host_id)
);

campaign_locals (
    id,
    campaign_id INTEGER NOT NULL,
    local_id TEXT NOT NULL,
    scheduled_start TIMESTAMP,
    scheduled_end TIMESTAMP,
    status TEXT,
    ...
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
    FOREIGN KEY (local_id) REFERENCES locals(local_id),
    UNIQUE(campaign_id, local_id)
);
```

**Justificativa:**
- Permite atribuir campanha a HOST/LOCAL inteiro
- Sistema pode automaticamente expandir para totens
- Mais flexível para operações em massa

**Opção B: Manter apenas campaign_totems + Lógica no Código**

```sql
-- Manter apenas campaign_totems
-- Criar funções/vistas para atribuir em massa

-- Exemplo: Função para atribuir a todos totens de um host
CREATE FUNCTION assign_campaign_to_host(
    p_campaign_id INTEGER,
    p_host_id INTEGER,
    p_start TIMESTAMP,
    p_end TIMESTAMP
) RETURNS INTEGER AS $$
-- Lógica para criar campaign_totems para todos totens do host
$$;
```

**Justificativa:**
- Mantém modelo mais simples
- Lógica de negócio no código
- Mais controle sobre expansão

### **Proposta 4: Remover Duplicação de Status (Mídias)**

**Opção A: Remover medias.status**

```sql
medias (
    media_id,
    client_id,
    -- status removido
    ...
);

-- Usar apenas approval_workflows.status
-- Criar VIEW se precisar:
CREATE VIEW medias_with_status AS
SELECT 
    m.*,
    aw.status,
    aw.reviewed_by,
    aw.reviewed_at
FROM medias m
LEFT JOIN approval_workflows aw ON m.media_id = aw.media_id;
```

**Opção B: Sincronizar via Trigger**

```sql
-- Trigger para manter medias.status = approval_workflows.status
CREATE TRIGGER sync_media_status
AFTER INSERT OR UPDATE ON approval_workflows
FOR EACH ROW
WHEN (NEW.entity_type = 'media')
EXECUTE FUNCTION sync_media_status_function();
```

---

## 🎯 Recomendações Prioritárias

### **🔴 Prioridade CRÍTICA:**

1. **Criar workflow de aprovação para playlists**
   - Playlists precisam ser aprovadas antes de usar
   - Criar `playlist_approval_workflows` (Opção B da Proposta 1)

2. **Adicionar campos de auditoria em playlists**
   - `created_by` (quem criou)
   - Workflow de aprovação com `reviewed_by`

3. **Clarificar modelo de playlists**
   - Decidir: 1:1 com (campaign, totem) OU compartilhada?
   - Remover redundância `campaign_playlists` OU `playlists.campaign_id`

### **🟡 Prioridade ALTA:**

4. **Resolver duplicação de status (mídias)**
   - Remover `medias.status` OU sincronizar via trigger
   - Usar `approval_workflows.status` como fonte da verdade

5. **Melhorar atribuição de campanhas**
   - Adicionar `campaign_hosts` e `campaign_locals` (Opção A da Proposta 3)
   - OU criar funções para atribuição em massa

### **🟢 Prioridade MÉDIA:**

6. **Documentar workflow completo**
   - Criar diagrama de fluxo: Criação → Aprovação → Publicação → Uso
   - Documentar regras de negócio

---

## 📋 Resumo Executivo

### **O que está CORRETO:**
- ✅ Workflow de aprovação existe para mídias
- ✅ `reviewed_by` referencia users do sistema (correto)
- ✅ `campaign_totems` permite atribuir campanha a múltiplos totens
- ✅ CLIENT pode criar mídias e playlists

### **O que precisa CORRIGIR:**
- ❌ Não existe workflow de aprovação para playlists
- ❌ Duplicação de status em mídias (medias.status vs approval_workflows.status)
- ❌ Ambiguidade no modelo de playlists (campaign_playlists redundante?)
- ❌ Limitação na atribuição (não há atribuição direta a HOST/LOCAL)
- ❌ Faltam campos de auditoria em playlists (created_by, reviewed_by)

### **Próximos Passos:**
1. **Debater modelo de playlists** (1:1 ou compartilhada?)
2. **Validar necessidade de campaign_hosts/campaign_locals**
3. **Decidir sobre duplicação de status**
4. **Implementar workflow de aprovação para playlists**

---

**Aguardando feedback e decisões antes de prosseguir com implementação!**

