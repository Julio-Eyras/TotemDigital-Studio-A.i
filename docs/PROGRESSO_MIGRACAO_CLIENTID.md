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
- [ ] `backend/src/services/reportsService.ts` - Atualizar referências
- [ ] `backend/src/services/analyticsService.ts` - Atualizar referências
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
- [ ] `backend/src/routes/analytics.ts` - Atualizar `/clients/:clientId` para `/subscribers/:subscriberId`
- [ ] `backend/src/routes/reports.ts` - Atualizar referências
- [ ] `backend/src/routes/subscriptions.ts` - Verificar referências
- [ ] `backend/src/routes/totems.ts` - Verificar referências
- [ ] `backend/src/routes/auth.ts` - Verificar referências
- [ ] `backend/src/routes/smart-playlist.ts` - Verificar referências
- [ ] `backend/src/routes/player.ts` - Verificar referências

### Backend - Middleware
- [ ] `backend/src/middleware/auth.middleware.ts` - Remover `clientId` do tipo (manter como deprecated temporariamente)

### Frontend
- [ ] `frontend/src/services/api/index.ts` - Atualizar interfaces e chamadas de API
- [ ] Componentes que usam `clientId` - Identificar e atualizar

### Database
- [ ] Verificar se há tabela `billing` antiga que precisa ser migrada
- [ ] Verificar se há tabela `clients` que precisa ser removida
- [ ] Criar script de migração se necessário

---

## 📊 Estatísticas

- **Arquivos Modificados**: 7
- **Referências Removidas**: ~15
- **Progresso Estimado**: ~30%

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
