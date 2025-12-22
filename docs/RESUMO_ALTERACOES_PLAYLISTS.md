# Resumo das Alterações no Modelo de Playlists

## ✅ Alterações Aplicadas

### 1. **Schema Simplificado**

**ANTES:**
```sql
CREATE TABLE playlists (
    playlist_id SERIAL PRIMARY KEY,
    totem_id INTEGER, -- ❌ Removido
    campaign_id INTEGER, -- ❌ Removido
    publisher_id INTEGER, -- ❌ Removido
    subscriber_id INTEGER, -- Opcional
    ...
);
```

**DEPOIS:**
```sql
CREATE TABLE playlists (
    playlist_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- ✅ Obrigatório
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    ...
);
```

### 2. **Tabela `playlist_approvals` Removida**

- ❌ Tabela `playlist_approvals` removida completamente
- ❌ Triggers relacionados removidos
- ❌ Functions de validação removidas
- ❌ VIEW `pending_playlist_approvals` removida
- ❌ Foreign keys removidas

**Justificativa:** Playlists não requerem aprovação se mídias já foram aprovadas.

### 3. **Relacionamentos Mantidos**

✅ **`campaign_playlists`** (N:M) - Mantido
- Uma playlist pode estar em múltiplas campanhas
- Uma campanha pode ter múltiplas playlists

✅ **`campaign_publishers`** (N:M) - Mantido
- Uma campanha pode estar em múltiplos publishers
- Revenue share configurável por publisher

✅ **`campaign_totems`** (N:M) - Mantido
- Uma campanha pode estar em múltiplos totens
- Agendamento específico por totem

---

## 📋 Arquivos Modificados

### Schema SQL
1. ✅ `database/smartchannel-db-v2-refactored-part3-tables-dependent.sql`
   - Simplificada tabela `playlists`
   - Removidos campos `totem_id`, `campaign_id`, `publisher_id`
   - `subscriber_id` agora é NOT NULL

2. ✅ `database/smartchannel-db-v2-refactored-part5-tables-relationships.sql`
   - Removida criação de `playlist_approvals`
   - Adicionado comentário explicativo

3. ✅ `database/smartchannel-db-v2-refactored-part7-foreign-keys.sql`
   - Removidas FKs de `playlist_approvals`

4. ✅ `database/smartchannel-db-v2-refactored-part9-triggers-functions.sql`
   - Removidos triggers de `playlist_approvals`
   - Removida function `validate_playlist_approval()`

5. ✅ `database/smartchannel-db-v2-refactored-part10-views.sql`
   - Removida VIEW `pending_playlist_approvals`

### Migração
6. ✅ `database/migrations/001-simplify-playlists-model.sql`
   - Script de migração criado
   - Remove campos desnecessários
   - Remove tabela `playlist_approvals`
   - Garante integridade dos dados

### Documentação
7. ✅ `docs/ANALISE_MODELO_PLAYLISTS_CAMPANHAS.md`
   - Análise completa do modelo
   - Justificativas das mudanças
   - Diagramas de relacionamento

---

## 🔄 Próximos Passos

### Backend (A Fazer)
- [ ] Atualizar `playlistService.ts`:
  - Remover lógica de `totem_id` e `campaign_id`
  - Remover busca de totem/campanha padrão
  - Garantir que apenas mídias aprovadas podem ser adicionadas
  - Validar `subscriber_id` obrigatório

- [ ] Remover `playlistApprovalService.ts` (se existir)
- [ ] Atualizar rotas de playlists
- [ ] Remover endpoints de aprovação de playlists

### Frontend (A Fazer)
- [ ] Remover UI de aprovação de playlists
- [ ] Remover UI de aprovação de campanhas
- [ ] Atualizar formulários de criação
- [ ] Atualizar listagens

---

## ✅ Benefícios

1. **Modelo mais simples** - Menos campos, menos confusão
2. **Agiliza processos** - Assinantes podem criar campanhas rapidamente
3. **Remove redundâncias** - Não há `campaign_id` duplicado
4. **Mantém segurança** - Mídias ainda requerem aprovação
5. **Flexibilidade** - Playlist pode estar em múltiplas campanhas sem conflito

---

## ⚠️ Validações Importantes

### Backend deve garantir:
1. ✅ Apenas mídias com `status = 'approved'` podem ser adicionadas a playlists
2. ✅ `subscriber_id` é obrigatório ao criar playlist
3. ✅ Playlist pode estar em múltiplas campanhas via `campaign_playlists`
4. ✅ Campanha pode estar em múltiplos publishers via `campaign_publishers`

### Exemplo de validação:
```typescript
// Ao adicionar mídia à playlist
async addMediaToPlaylist(playlistId: number, mediaId: number) {
    // Verificar se mídia está aprovada
    const media = await this.getMediaById(mediaId);
    if (media.status !== 'approved') {
        throw new Error('Apenas mídias aprovadas podem ser adicionadas a playlists');
    }
    
    // Adicionar à playlist
    // ...
}
```

