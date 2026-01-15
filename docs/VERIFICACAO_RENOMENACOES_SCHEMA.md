# Verificação: Renomeações no Schema - clients → subscribers, hosts → publishers

## ✅ Status das Renomeações no Schema v2 Refatorado

### 1. Tabelas Renomeadas

#### ✅ **clients → subscribers**
- **Arquivo:** `database/smartchannel-db-v2-refactored-part2-tables-base.sql`
- **Status:** ✅ RENOMEADO
- **Tabela criada:** `subscribers` (linha 10)
- **Coluna:** `subscriber_id SERIAL PRIMARY KEY`
- **Comentário:** "Anunciantes/Assinantes que compram espaço publicitário"

#### ✅ **hosts → publishers**
- **Arquivo:** `database/smartchannel-db-v2-refactored-part2-tables-base.sql`
- **Status:** ✅ RENOMEADO
- **Tabela criada:** `publishers` (linha 33)
- **Coluna:** `publisher_id SERIAL PRIMARY KEY`
- **Comentário:** "Publicadores - clientes que instalam totens e Smart TVs"

---

### 2. Foreign Keys Atualizadas

#### ✅ **Campaigns**
- **Arquivo:** `database/smartchannel-db-v2-refactored-part7-foreign-keys.sql`
- **FK:** `fk_campaigns_subscriber` → `subscribers(subscriber_id)` ✅
- **Coluna:** `campaigns.subscriber_id` ✅

#### ✅ **Medias**
- **FK:** `fk_medias_subscriber` → `subscribers(subscriber_id)` ✅
- **Coluna:** `medias.subscriber_id` ✅

#### ✅ **Playlists**
- **FK:** `fk_playlists_subscriber` → `subscribers(subscriber_id)` ✅
- **Coluna:** `playlists.subscriber_id` ✅
- ⚠️ **PROBLEMA:** Ainda tem FKs para `totem_id` e `campaign_id` que foram removidos!

#### ✅ **Users**
- **FK:** `fk_users_publisher` → `publishers(publisher_id)` ✅
- **Coluna:** `users.publisher_id` ✅

#### ✅ **Locals**
- **FK:** `fk_locals_publisher` → `publishers(publisher_id)` ✅
- **Coluna:** `locals.publisher_id` ✅

#### ✅ **Subscriptions**
- **FK:** `fk_subscriptions_publisher` → `publishers(publisher_id)` ✅
- **Coluna:** `subscriptions.publisher_id` ✅

---

## ⚠️ Problemas Identificados

### Problema 1: Playlists ainda tem FKs para totem_id e campaign_id

**Arquivo:** `database/smartchannel-db-v2-refactored-part7-foreign-keys.sql` (linhas 69-87)

```sql
-- ❌ PROBLEMA: Estas FKs não deveriam existir mais
ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;
```

**Mas no schema v2 refatorado (part3), a tabela playlists foi simplificada:**
- ❌ `totem_id` foi removido
- ❌ `campaign_id` foi removido
- ❌ `publisher_id` foi removido
- ✅ Apenas `subscriber_id` permanece

**Ação necessária:** Remover essas FKs do arquivo `part7-foreign-keys.sql`

---

### Problema 2: Arquivo antigo ainda existe

**Arquivo:** `database/smartchannel-db-v2-refactored-apply-all.sql` (schema antigo, descontinuado/removido) — usar `database/smartchannel-db-v2-refactored-apply-all.sql`
- ❌ Ainda contém `CREATE TABLE clients`
- ❌ Ainda contém `CREATE TABLE hosts`
- ❌ Ainda tem FKs para `clients` e `hosts`

**Status:** Este é o schema legado, não deve ser usado. O schema v2 refatorado é o correto.

---

### Problema 3: Arquivo de carga inicial (seeds) ainda usa nomenclatura antiga

**Arquivo:** `database/carga-inicial-db-smarsignage-v4.sql`
- ❌ `INSERT INTO clients` (linha 18)
- ❌ `INSERT INTO hosts` (linha 32)
- ❌ Referências a `client_id` em várias tabelas

**Ação necessária:** Atualizar `carga-inicial-db-smarsignage-v4.sql` para usar `subscribers` e `publishers` (quando aplicável)

---

## ✅ Verificação do Código Backend

### Serviços que ainda referenciam `clients` (tabela antiga)

**Arquivos encontrados:**
1. `backend/src/services/analyticsService.ts`
2. `backend/src/services/reportsService.ts`
3. `backend/src/services/clientService.ts` (legado - manter para compatibilidade)
4. `backend/src/services/authService.ts`
5. `backend/src/services/smartPlaylistService.ts`
6. `backend/src/services/billingService.ts`
7. `backend/src/services/userService.ts`
8. `backend/src/services/subscriptionService.ts`
9. `backend/src/services/invoiceService.ts`
10. `backend/src/services/qrcodeService.ts`
11. `backend/src/services/playerService.ts`

**Status:** Estes serviços ainda precisam ser atualizados para usar `subscribers` em vez de `clients`.

---

## 📋 Checklist de Correções Necessárias

### Schema SQL
- [x] ✅ Tabela `subscribers` criada (substitui `clients`)
- [x] ✅ Tabela `publishers` criada (substitui `hosts`)
- [x] ✅ FKs de `campaigns`, `medias`, `playlists` atualizadas para `subscribers`
- [x] ✅ FKs de `users`, `locals`, `subscriptions` atualizadas para `publishers`
- [ ] ⚠️ **REMOVER** FKs de `playlists` para `totem_id`, `campaign_id`, `publisher_id`
- [ ] ⚠️ **ATUALIZAR** `carga-inicial-db-smarsignage-v4.sql` para usar `subscribers` e `publishers` (se necessário)

### Backend - Serviços Atualizados
- [x] ✅ `campaignService.ts` - Usa `subscribers`
- [x] ✅ `mediaService.ts` - Usa `subscribers`
- [x] ✅ `playlistService.ts` - Usa `subscribers`
- [x] ✅ `totemService.ts` - Removido `client_id`
- [x] ✅ `subscriberService.ts` - Novo serviço criado
- [x] ✅ `publisherService.ts` - Novo serviço criado
- [ ] ⚠️ **ATUALIZAR** `analyticsService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `reportsService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `billingService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `userService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `subscriptionService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `authService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `qrcodeService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `smartPlaylistService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `invoiceService.ts` - Ainda usa `clients`
- [ ] ⚠️ **ATUALIZAR** `playerService.ts` - Ainda usa `clients`

### Backend - Rotas
- [x] ✅ `routes/subscribers.ts` - Novo arquivo criado
- [x] ✅ `routes/publishers.ts` - Novo arquivo criado
- [x] ✅ `routes/campaigns.ts` - Atualizado para usar `subscribers`
- [x] ✅ `routes/media.ts` - Atualizado para usar `subscribers`
- [x] ✅ `routes/playlists.ts` - Atualizado para usar `subscribers`
- [x] ✅ `routes/totems.ts` - Removido `clientId`
- [ ] ⚠️ **MANTER** `routes/clients.ts` - Para compatibilidade temporária (marcado como TODO: Deprecar)

---

## 🔧 Correções Imediatas Necessárias

### 1. Remover FKs inválidas de playlists

**Arquivo:** `database/smartchannel-db-v2-refactored-part7-foreign-keys.sql`

**Remover:**
```sql
-- REMOVER estas linhas (69-87)
ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_totem 
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) 
    ON DELETE CASCADE;

ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_campaign 
    FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) 
    ON DELETE CASCADE;

ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_publisher 
    FOREIGN KEY (publisher_id) REFERENCES publishers(publisher_id) 
    ON DELETE SET NULL;
```

**Manter apenas:**
```sql
ALTER TABLE playlists
    ADD CONSTRAINT fk_playlists_subscriber 
    FOREIGN KEY (subscriber_id) REFERENCES subscribers(subscriber_id) 
    ON DELETE CASCADE;
```

### 2. Atualizar carga-inicial-db-smarsignage-v4.sql

**Arquivo:** `database/carga-inicial-db-smarsignage-v4.sql`

**Alterar:**
- `INSERT INTO clients` → `INSERT INTO subscribers`
- `INSERT INTO hosts` → `INSERT INTO publishers`
- `client_id` → `subscriber_id` (onde aplicável)
- `host_id` → `publisher_id` (onde aplicável)

---

## 📊 Resumo

### ✅ O que está correto:
1. Schema v2 refatorado usa `subscribers` e `publishers` ✅
2. FKs principais atualizadas ✅
3. Serviços principais atualizados (campaigns, media, playlists, totems) ✅
4. Novos serviços criados (subscriberService, publisherService) ✅

### ⚠️ O que precisa ser corrigido:
1. **URGENTE:** Remover FKs inválidas de `playlists` (totem_id, campaign_id, publisher_id)
2. **IMPORTANTE:** Atualizar `carga-inicial-db-smarsignage-v4.sql` para usar nova nomenclatura
3. **IMPORTANTE:** Atualizar serviços restantes que ainda usam `clients`

---

## 🎯 Próximos Passos

1. ✅ Corrigir FKs de playlists no schema
2. ✅ Atualizar carga-inicial-db-smarsignage-v4.sql
3. ✅ Atualizar serviços restantes gradualmente
4. ✅ Manter compatibilidade temporária com `routes/clients.ts`

