# Análise: Schema event_logs - Padrão vs V2 Refatorado

## 📋 Resumo

**Schema Padrão:** Usa `id SERIAL PRIMARY KEY`  
**Schema V2 Refatorado:** Usa `log_id BIGSERIAL PRIMARY KEY` ✅ (ATUAL)

---

## 🗂️ 1. DEFINIÇÕES DE SCHEMA

### Schema Padrão (id SERIAL) - **PARA ELIMINAR**

#### 1.1 ~~`database/schema.sql/smartchannel-db.sql`~~ (linha 1127-1144) - ✅ **REMOVIDO**
```sql
CREATE TABLE IF NOT EXISTS public.event_logs (
    id SERIAL PRIMARY KEY,  -- ❌ Schema antigo
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    totem_id INTEGER,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES public.totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES public.campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES public.playlists(playlist_id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES public.medias(media_id) ON DELETE SET NULL
);
```

#### 1.2 `docs/smartchannel-db.sql` (linha 2422-2437)
```sql
CREATE TABLE IF NOT EXISTS event_logs (
    id SERIAL PRIMARY KEY,  -- ❌ Schema antigo
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    totem_id INTEGER,
    campaign_id INTEGER,
    playlist_id INTEGER,
    media_id INTEGER,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE SET NULL,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE SET NULL,
    FOREIGN KEY (playlist_id) REFERENCES playlists(playlist_id) ON DELETE SET NULL,
    FOREIGN KEY (media_id) REFERENCES medias(media_id) ON DELETE SET NULL
);
```

### Schema V2 Refatorado (log_id BIGSERIAL) - **MANTER** ✅

#### 1.3 `database/smartchannel-db-v2-refactored-part6-tables-other.sql` (linha 76-94)
```sql
CREATE TABLE IF NOT EXISTS event_logs (
    log_id BIGSERIAL PRIMARY KEY,  -- ✅ Schema atual (V2)
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- campaign, media, totem, playlist, etc.
    entity_id INTEGER,
    
    totem_id INTEGER,
    campaign_id INTEGER,
    media_id INTEGER,
    publisher_id INTEGER,
    subscriber_id INTEGER,
    
    user_id INTEGER, -- FK para users (quem gerou o evento)
    
    metadata JSONB,
    severity TEXT DEFAULT 'info', -- debug, info, warning, error, critical
    
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Diferenças importantes:**
- ✅ `log_id BIGSERIAL` (vs `id SERIAL`)
- ✅ Campos adicionais: `publisher_id`, `subscriber_id`, `user_id`, `severity`
- ✅ `timestamp NOT NULL` (mais restritivo)

---

## 💻 2. USO NO CÓDIGO BACKEND

### ❌ Arquivos usando `id` (schema padrão) - **PRECISAM SER ATUALIZADOS**

#### 2.1 `backend/src/services/eventLogService.ts`

**Linha 14** - Interface:
```typescript
export interface EventLogEntry {
  id?: number;  // ❌ Deve ser log_id
  // ...
}
```

**Linha 96** - INSERT com RETURNING:
```typescript
RETURNING id  // ❌ Deve ser RETURNING log_id
```

**Linha 350** - SELECT:
```typescript
SELECT 
  id,  // ❌ Deve ser log_id
  event_type as "eventType",
  // ...
FROM event_logs
```

**Linha 367** - Mapeamento:
```typescript
return results.map((row: any) => ({
  id: row.id,  // ❌ Deve ser log_id: row.log_id
  // ...
}));
```

#### 2.2 `backend/src/routes/smartdisplayfx.ts`

**Linha 215** - SELECT:
```typescript
SELECT
  id,  // ❌ Deve ser log_id
  event_type,
  entity_type,
  media_id,
  metadata,
  created_at
FROM event_logs
```

**Nota:** Este arquivo também usa `created_at` que não existe no schema V2 (deve ser `timestamp`).

---

## 📊 3. RESUMO DE ALTERAÇÕES NECESSÁRIAS

### Arquivos para Modificar:

1. ✅ ~~**`database/schema.sql/smartchannel-db.sql`**~~ - **REMOVIDO**
   - Remover definição de `event_logs` com `id SERIAL`
   - Ou atualizar para usar `log_id BIGSERIAL` (se ainda for usado)

2. ✅ **`docs/smartchannel-db.sql`**
   - Remover definição de `event_logs` com `id SERIAL`
   - Ou atualizar para usar `log_id BIGSERIAL` (se ainda for usado)

3. ✅ **`backend/src/services/eventLogService.ts`**
   - Interface: `id?: number` → `logId?: number`
   - INSERT: `RETURNING id` → `RETURNING log_id`
   - SELECT: `id` → `log_id`
   - Mapeamento: `id: row.id` → `logId: row.log_id`

4. ✅ **`backend/src/routes/smartdisplayfx.ts`**
   - SELECT: `id` → `log_id`
   - SELECT: `created_at` → `timestamp` (corrigir nome da coluna)

### Arquivos para Manter:

- ✅ **`database/smartchannel-db-v2-refactored-part6-tables-other.sql`** (schema correto)
- ✅ **`database/fix-sequences-after-seed.sql`** (já suporta ambos)

---

## 🎯 4. PLANO DE AÇÃO

### Fase 1: Atualizar Código Backend
1. Atualizar `eventLogService.ts` para usar `log_id`
2. Atualizar `smartdisplayfx.ts` para usar `log_id` e `timestamp`

### Fase 2: Remover Schema Padrão
1. ✅ Removido `database/schema.sql/smartchannel-db.sql` (arquivo legado não utilizado)
2. Remover ou atualizar `docs/smartchannel-db.sql`

### Fase 3: Validação
1. Testar inserção de eventos
2. Testar consulta de eventos
3. Verificar que não há referências ao schema antigo

---

## ⚠️ AVISOS

1. **Backup:** Fazer backup antes de remover schemas antigos
2. **Migração:** Se houver dados no schema antigo, criar script de migração
3. **Testes:** Testar todas as funcionalidades que usam `event_logs`

---

**Última atualização:** 2026-01-21  
**Status:** Aguardando aprovação para eliminar schema padrão
