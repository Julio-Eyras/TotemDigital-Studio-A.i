# 🔍 Análise de Erros 500 e 403

## 📋 Resumo dos Problemas

### 1. Erro 500 em `/api/subscriptions`
**Localização**: `backend/src/routes/subscriptions.ts`

**Problemas identificados**:
- ❌ Uso de `req.user.clientId` (deprecated) em vez de `req.user.subscriberId` ou `req.user.publisherId`
- ❌ Linha 42-43: Filtro usa `clientId` que pode não existir mais
- ❌ Linha 82: `getSubscriptionByClient(req.user.clientId)` - campo pode ser `undefined`
- ❌ Linha 167: `publisherId: finalClientId` - está usando `clientId` mas deveria usar `subscriberId` ou `publisherId`
- ❌ Linha 355-357: Query SQL usa `subscriber_id` mas busca por `clientId`

**Impacto**: 
- Usuários não conseguem listar assinaturas
- Erro ao buscar faturas
- Erro ao carregar assinaturas

### 2. Erro 403 em `/api/smart-tvs?active_only=true`
**Localização**: `backend/src/routes/smart-tvs.ts`

**Problemas identificados**:
- ❌ Rota requer `requireFlag('flag_smart_0')` (linha 69)
- ❌ Publishers e Subscribers podem não ter essa flag habilitada
- ❌ A rota não verifica se o usuário é publisher/subscriber antes de exigir a flag

**Impacto**:
- Publishers/Subscribers não conseguem ver suas Smart TVs
- Dashboard não carrega lista de Smart TVs

## 🔧 Correções Necessárias

### Correção 1: Atualizar `/api/subscriptions` para usar `subscriberId`/`publisherId`

**Arquivo**: `backend/src/routes/subscriptions.ts`

**Mudanças**:
1. Substituir `req.user.clientId` por `req.user.subscriberId || req.user.publisherId`
2. Atualizar `getSubscriptionByClient` para `getSubscriptionBySubscriber`
3. Corrigir query SQL para usar `subscriber_id` corretamente
4. Adicionar suporte para `publisher_subscriber` user type

### Correção 2: Ajustar permissões de `/api/smart-tvs`

**Arquivo**: `backend/src/routes/smart-tvs.ts`

**Mudanças**:
1. Permitir acesso para publishers/subscribers sem exigir `flag_smart_0` obrigatoriamente
2. Verificar `userType` antes de aplicar restrição de flag
3. Adicionar lógica para publishers verem apenas suas Smart TVs

## 📝 Checklist de Validação

- [ ] Corrigir `subscriptions.ts` para usar `subscriberId`/`publisherId`
- [ ] Testar listagem de assinaturas
- [ ] Testar busca de faturas
- [ ] Ajustar permissões de Smart TVs para publishers/subscribers
- [ ] Testar acesso de publishers às Smart TVs
- [ ] Validar que admins ainda têm acesso completo
- [ ] Verificar logs de erro para mais detalhes

## 🎯 Próximos Passos

1. **Imediato**: Corrigir erros 500 e 403
2. **Curto prazo**: Revisar CRUD de usuários (flags e roles)
3. **Médio prazo**: Criar checklist completo de validação do sistema
4. **Longo prazo**: Implementar testes automatizados para evitar regressões
