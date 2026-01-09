# 📋 Progresso da Migração: clientId → subscriberId

**Data:** 2026-01-08  
**Status:** 🔄 Em Progresso  
**Prioridade:** 🔴 ALTA

---

## ✅ Concluído

### Backend - Rotas
- [x] `backend/src/routes/subscriber-billing.ts` - Removido `clientId` fallback
- [x] `backend/src/routes/media.ts` - Removido `clientId` fallback
- [x] `backend/src/routes/playlists.ts` - Removido `clientId` fallback
- [x] `backend/src/routes/campaigns.ts` - Atualizado para usar `subscriberId`

### Backend - Middleware
- [x] `backend/src/middleware/subscriberIsolation.middleware.ts` - Removido `clientId` fallback

### Backend - Services
- [x] `backend/src/services/playlistService.ts` - Removido `clientId` (3 ocorrências)
- [x] `backend/src/services/mediaService.ts` - `clientId` → `subscriberId` em `getMediaByTags`
- [x] `backend/src/services/campaignService.ts` - Atualizado:
  - `CreateCampaignRequest`: Removido `clientId`, mantido apenas `subscriberId`
  - `CampaignResponse`: `clientId` → `subscriberId`
  - `filters.clientId` → `filters.subscriberId`
  - `byClient` → `bySubscriber` em estatísticas

---

## ⏳ Pendente

### Backend - Services
- [ ] `backend/src/services/billingService.ts` - Verificar se ainda é usado (parece legado)
- [x] `backend/src/services/reportsService.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/services/analyticsService.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/services/authService.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/services/subscriptionService.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/services/storageService.ts` - Atualizado: `getClientStorageUsage` -> `getSubscriberStorageUsage`, `checkClientQuota` -> `checkSubscriberQuota`
- [x] `backend/src/services/smartPlaylistService.ts` - Atualizado: `clientId` -> `subscriberId`
- [x] `backend/src/services/analyticsCacheService.ts` - Atualizado: `getOverviewKey` e `getTotemsStatsKey` usam `subscriberId`
- [ ] `backend/src/services/clientService.ts` - Verificar se ainda é usado (parece deprecated)
- [ ] `backend/src/services/totemService.ts` - Verificar referências
- [ ] `backend/src/services/userService.ts` - Verificar referências
- [ ] `backend/src/services/authService.ts` - Verificar referências
- [ ] `backend/src/services/analyticsCacheService.ts` - Verificar referências
- [ ] `backend/src/services/subscriberAccessNotificationService.ts` - Verificar referências
- [ ] `backend/src/services/storageService.ts` - Verificar referências
- [ ] `backend/src/services/smartPlaylistService.ts` - Verificar referências

### Backend - Rotas
- [ ] `backend/src/routes/billing.ts` - Verificar se ainda é usado (parece legado)
- [x] `backend/src/routes/analytics.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/routes/reports.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/routes/auth.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/routes/subscriptions.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/routes/smart-playlist.ts` - Atualizado para usar `subscriberId`
- [x] `backend/src/routes/player.ts` - Atualizado: retorno usa `subscriberId`/`subscriberName`
- [x] `backend/src/routes/media.ts` - Atualizado: usa `getSubscriberStorageUsage`
- [ ] `backend/src/routes/subscriptions.ts` - Verificar referências
- [ ] `backend/src/routes/totems.ts` - Verificar referências
- [ ] `backend/src/routes/auth.ts` - Verificar referências
- [ ] `backend/src/routes/smart-playlist.ts` - Verificar referências
- [ ] `backend/src/routes/player.ts` - Verificar referências

### Backend - Middleware
- [ ] `backend/src/middleware/auth.middleware.ts` - Remover `clientId` do tipo (manter como deprecated temporariamente)

### Frontend
- [x] `frontend/src/services/api/index.ts` - Atualizado: interfaces usam `subscriberId`/`subscriber_id`
- [x] `frontend/src/pages/Campaigns/Campaigns.tsx` - Atualizado: remover fallback `clientId`
- [x] `frontend/src/components/MediaUploadDialog/MediaUploadDialog.tsx` - Atualizado: usar `subscriber_id`
- [x] `frontend/src/store/slices/authSlice.ts` - Atualizado: remover `clientId`
- [x] `frontend/src/pages/Players/Players.tsx` - Atualizado: `clientId` -> `subscriberId`
- [x] `frontend/src/pages/Playlists/Playlists.tsx` - Atualizado: remover fallback `clientId`
- [x] `frontend/src/pages/Media/Media.tsx` - Atualizado: remover fallback `clientId`

### Database
- [ ] Verificar se há tabela `billing` antiga que precisa ser migrada
- [ ] Verificar se há tabela `clients` que precisa ser removida
- [ ] Criar script de migração se necessário

---

## 📊 Estatísticas

- **Arquivos Modificados**: 34
- **Referências Removidas**: ~70
- **Progresso Estimado**: ~90%

---

## 🎯 Próximos Passos

1. **Verificar serviços legados** (`billingService.ts`, `clientService.ts`)
   - Se não são mais usados, marcar como deprecated ou remover
   - Se ainda são usados, atualizar para usar `subscriberId`

2. **Atualizar rotas restantes**
   - `analytics.ts`: Mudar `/clients/:clientId` para `/subscribers/:subscriberId`
   - `reports.ts`: Atualizar referências

3. **Atualizar frontend**
   - Identificar todas as referências a `clientId`
   - Atualizar interfaces TypeScript
   - Atualizar chamadas de API

4. **Limpeza final**
   - Remover código deprecated
   - Atualizar documentação
   - Testes completos

---

**Última Atualização:** 2026-01-08
