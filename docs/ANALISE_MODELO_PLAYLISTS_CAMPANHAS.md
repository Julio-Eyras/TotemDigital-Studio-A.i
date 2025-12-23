# Análise e Correção do Modelo: Playlists, Campanhas e Publishers

## 📋 Clarificações do Usuário

### 1. **Autorização**
- ✅ **Mídias** → Requerem aprovação (mantém workflow atual)
- ❌ **Playlists** → NÃO requerem aprovação (se mídias já foram aprovadas)
- ❌ **Campanhas** → NÃO requerem aprovação (se mídias já foram aprovadas)

**Justificativa:** Agiliza processos para assinantes gerenciarem suas campanhas.

### 2. **Modelo de Relacionamento**
- Uma **playlist** é composta por **mídias** (1:N via `playlist_items`)
- Uma **playlist** pode fazer parte de **uma ou mais campanhas** (N:M via `campaign_playlists`)
- Uma **campanha** pode estar atribuída a **uma ou mais publishers** (N:M via `campaign_publishers` e `campaign_totems`)

---

## 🔍 Análise do Modelo Atual (Schema v2)

### ❌ Problemas Identificados

#### 1. **Tabela `playlists` está confusa**

```sql
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    
    -- ❌ PROBLEMA: Campos polimórficos confusos
    totem_id INTEGER, -- FK para totems (opcional)
    campaign_id INTEGER, -- FK para campaigns (opcional)
    
    -- ✅ OK: Mantido para performance
    subscriber_id INTEGER, -- FK para subscribers (quem criou)
    publisher_id INTEGER, -- FK para publishers (derivado)
    
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    ...
);
```

**Problemas:**
- `campaign_id` em `playlists` é **redundante** - já existe `campaign_playlists` (N:M)
- `totem_id` em `playlists` não faz sentido - playlist não pertence a totem específico
- Se playlist pode estar em múltiplas campanhas, não pode ter `campaign_id` direto

#### 2. **Tabela `playlist_approvals` não é mais necessária**

```sql
CREATE TABLE IF NOT EXISTS playlist_approvals (
    approval_id SERIAL PRIMARY KEY,
    playlist_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    ...
);
```

**Problema:** Se playlists não requerem aprovação, esta tabela não é necessária.

#### 3. **Campanhas → Publishers já está correto**

```sql
-- ✅ CORRETO: Relacionamento N:M campaigns ↔ publishers
CREATE TABLE IF NOT EXISTS campaign_publishers (
    campaign_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    revenue_share_percentage NUMERIC(5, 2),
    ...
);

-- ✅ CORRETO: Relacionamento N:M campaigns ↔ totems
CREATE TABLE IF NOT EXISTS campaign_totems (
    campaign_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    ...
);
```

**Status:** Já está implementado corretamente.

---

## ✅ Solução Proposta

### 1. **Simplificar `playlists`**

**ANTES:**
```sql
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    totem_id INTEGER, -- ❌ REMOVER
    campaign_id INTEGER, -- ❌ REMOVER
    subscriber_id INTEGER, -- ✅ MANTER
    publisher_id INTEGER, -- ⚠️ REMOVER (derivado via campaign_playlists → campaigns → campaign_publishers)
    ...
);
```

**DEPOIS:**
```sql
CREATE TABLE IF NOT EXISTS playlists (
    playlist_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- ✅ Quem criou a playlist (anunciante)
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    schedule_config JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_playlist_subscriber 
        FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) ON DELETE CASCADE
);
```

**Justificativa:**
- Playlist pertence apenas ao **subscriber** (anunciante) que a criou
- Playlist pode estar em múltiplas campanhas via `campaign_playlists`
- Não precisa de `totem_id` ou `campaign_id` direto
- `publisher_id` pode ser derivado quando necessário via JOIN

### 2. **Remover `playlist_approvals`**

**Ação:** Remover tabela completamente do schema.

**Justificativa:** Playlists não requerem aprovação se mídias já foram aprovadas.

### 3. **Manter `campaign_playlists` (N:M)**

```sql
CREATE TABLE IF NOT EXISTS campaign_playlists (
    campaign_id INTEGER NOT NULL,
    playlist_id INTEGER NOT NULL,
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (campaign_id, playlist_id),
    CONSTRAINT fk_campaign_playlist_campaign 
        FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    CONSTRAINT fk_campaign_playlist_playlist 
        FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE CASCADE
);
```

**Status:** ✅ Já está correto, apenas garantir que não há `campaign_id` em `playlists`.

### 4. **Manter `campaign_publishers` (N:M)**

```sql
CREATE TABLE IF NOT EXISTS campaign_publishers (
    campaign_id INTEGER NOT NULL,
    publisher_id INTEGER NOT NULL,
    revenue_share_percentage NUMERIC(5, 2),
    is_active BOOLEAN DEFAULT true,
    ...
);
```

**Status:** ✅ Já está correto.

### 5. **Manter `campaign_totems` (N:M)**

```sql
CREATE TABLE IF NOT EXISTS campaign_totems (
    campaign_id INTEGER NOT NULL,
    totem_id INTEGER NOT NULL,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    ...
);
```

**Status:** ✅ Já está correto.

---

## 📊 Modelo Final Correto

### Diagrama de Relacionamentos

```
┌──────────────┐
│ Subscribers  │ (Anunciantes)
│ (subscriber) │
└──────┬───────┘
       │
       │ 1:N
       │
┌──────▼───────┐         ┌──────────────┐
│  Playlists   │         │    Medias    │
│              │◄───1:N──┤              │
│ subscriber_id│         │ subscriber_id│
└──────┬───────┘         └──────────────┘
       │                        │
       │                        │ ✅ Requer aprovação
       │                        │
       │ N:M                    │
       │                        │
┌──────▼───────────────────────▼───────┐
│      campaign_playlists               │
│  (campaign_id, playlist_id)          │
└──────┬───────────────────────────────┘
       │
       │ N:M
       │
┌──────▼───────┐
│  Campaigns   │
│              │
│ subscriber_id│
└──────┬───────┘
       │
       │ N:M (via campaign_publishers)
       │
┌──────▼───────┐
│  Publishers  │
│              │
└──────────────┘
```

### Fluxo de Dados

1. **Subscriber** cria **mídias** → Requer aprovação (tenant)
2. **Subscriber** cria **playlist** → Composta por mídias aprovadas → **NÃO requer aprovação**
3. **Subscriber** cria **campanha** → Pode usar múltiplas playlists → **NÃO requer aprovação**
4. **Campanha** é atribuída a **publishers** → Via `campaign_publishers`
5. **Campanha** é atribuída a **totens** → Via `campaign_totems`

---

## 🔧 Alterações Necessárias no Schema

### 1. **Alterar `playlists`**

```sql
-- Remover campos desnecessários
ALTER TABLE playlists 
    DROP COLUMN IF EXISTS totem_id,
    DROP COLUMN IF EXISTS campaign_id,
    DROP COLUMN IF EXISTS publisher_id;

-- Garantir que subscriber_id é NOT NULL
ALTER TABLE playlists 
    ALTER COLUMN subscriber_id SET NOT NULL;
```

### 2. **Remover `playlist_approvals`**

```sql
DROP TABLE IF EXISTS playlist_approvals CASCADE;
```

### 3. **Atualizar VIEWs (se existirem)**

Qualquer VIEW que use `playlists.totem_id`, `playlists.campaign_id` ou `playlists.publisher_id` precisa ser atualizada.

### 4. **Atualizar Triggers/Functions**

Verificar se há triggers ou functions que dependem dos campos removidos.

---

## 📝 Alterações no Código Backend

### 1. **`playlistService.ts`**

**Remover:**
- Lógica de `totem_id` e `campaign_id` em `createPlaylist()`
- Busca de totem/campanha padrão

**Manter:**
- `subscriber_id` obrigatório
- Validação de mídias aprovadas antes de criar playlist

### 2. **`campaignService.ts`**

**Manter:**
- Relacionamento via `campaign_playlists`
- Relacionamento via `campaign_publishers`
- Relacionamento via `campaign_totems`

### 3. **Remover `playlistApprovalService.ts`** (se existir)

Não é mais necessário.

---

## ✅ Checklist de Implementação

### Schema
- [ ] Remover `totem_id` de `playlists`
- [ ] Remover `campaign_id` de `playlists`
- [ ] Remover `publisher_id` de `playlists`
- [ ] Garantir `subscriber_id NOT NULL` em `playlists`
- [ ] Remover tabela `playlist_approvals`
- [ ] Atualizar VIEWs relacionadas
- [ ] Atualizar triggers/functions

### Backend
- [ ] Atualizar `playlistService.ts`
- [ ] Atualizar `campaignService.ts`
- [ ] Remover `playlistApprovalService.ts` (se existir)
- [ ] Atualizar rotas de playlists
- [ ] Atualizar validações

### Frontend
- [ ] Remover UI de aprovação de playlists
- [ ] Remover UI de aprovação de campanhas
- [ ] Atualizar formulários de criação
- [ ] Atualizar listagens

---

## 🎯 Benefícios da Mudança

1. ✅ **Modelo mais simples e claro**
2. ✅ **Agiliza processos** - assinantes podem criar campanhas rapidamente
3. ✅ **Remove redundâncias** - não há `campaign_id` duplicado
4. ✅ **Mantém segurança** - mídias ainda requerem aprovação
5. ✅ **Flexibilidade** - playlist pode estar em múltiplas campanhas sem conflito

---

## ⚠️ Observações Importantes

1. **Mídias devem estar aprovadas** antes de serem adicionadas a playlists
2. **Validação no backend** deve garantir que apenas mídias aprovadas podem ser adicionadas
3. **Campanhas podem ser criadas imediatamente** após criar playlists
4. **Publishers recebem campanhas** via `campaign_publishers` e `campaign_totems`

