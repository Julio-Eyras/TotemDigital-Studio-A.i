# ✅ Correções Aplicadas - Erros 500 e 403

## 📋 Resumo

Corrigidos os erros 500 em `/api/subscriptions` e 403 em `/api/smart-tvs?active_only=true`.

## 🔧 Correções Aplicadas

### 1. Erro 500 em `/api/subscriptions` ✅

**Arquivo**: `backend/src/routes/subscriptions.ts`

**Problemas corrigidos**:
- ✅ Substituído `req.user.clientId` por `req.user.subscriberId`/`req.user.publisherId`
- ✅ Atualizado `GET /api/subscriptions` para usar `userType` e `publisherId`/`subscriberId`
- ✅ Atualizado `GET /api/subscriptions/my-subscription` para usar `getSubscriptionByPublisher`
- ✅ Atualizado `POST /api/subscriptions` para determinar `publisherId` baseado em `userType`
- ✅ Atualizado verificações de permissão em `GET /api/subscriptions/:id`, `POST /api/subscriptions/:id/cancel`, `POST /api/subscriptions/:id/resume`
- ✅ Corrigido `POST /api/subscriptions/checkout` para buscar publisher/subscriber corretamente

**Mudanças principais**:
```typescript
// ANTES
if (req.user.role === 'client') {
  filters.clientId = req.user.clientId;
}

// DEPOIS
const userType = req.user.userType;
const userPublisherId = req.user.publisherId;
const userSubscriberId = req.user.subscriberId;

if (userType === 'subscriber_user' && userSubscriberId) {
  filters.publisherId = userPublisherId || userSubscriberId;
} else if (userType === 'publisher_user' || userType === 'publisher_subscriber') {
  if (userPublisherId) {
    filters.publisherId = userPublisherId;
  }
}
```

### 2. Erro 403 em `/api/smart-tvs?active_only=true` ✅

**Arquivo**: `backend/src/routes/smart-tvs.ts`

**Problemas corrigidos**:
- ✅ Removida exigência obrigatória de `requireFlag('flag_smart_0')` para publishers/subscribers
- ✅ Adicionada lógica para permitir acesso de publishers/subscribers às suas próprias Smart TVs
- ✅ Mantida exigência de flag apenas para system users não-admin

**Mudanças principais**:
```typescript
// ANTES
router.get('/',
  requireFlag('flag_smart_0'), // Sempre exigia flag
  ...

// DEPOIS
router.get('/',
  // Sem requireFlag no middleware - verificação dentro da rota
  async (req: AuthenticatedRequest, res: Response) => {
    const userType = req.user?.userType;
    const isPublisher = userType === 'publisher_user' || userType === 'publisher_subscriber';
    const isSubscriber = userType === 'subscriber_user';
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'owner_system' || req.user?.role === 'admin_sql';
    
    // Se for admin/owner, requer flag_smart_0
    if (!isPublisher && !isSubscriber && !isAdmin) {
      if (!req.user?.flags?.flag_smart_0) {
        return res.status(403).json({
          error: 'Acesso negado: Requer flag_smart_0 para acesso técnico'
        });
      }
    }
    ...
```

## 🧪 Testes Necessários

### Testes de Subscriptions
- [ ] Listar assinaturas como publisher
- [ ] Listar assinaturas como subscriber
- [ ] Buscar assinatura própria (`/my-subscription`)
- [ ] Criar assinatura como publisher
- [ ] Cancelar assinatura própria
- [ ] Retomar assinatura cancelada
- [ ] Criar checkout session

### Testes de Smart TVs
- [ ] Listar Smart TVs como publisher (sem flag)
- [ ] Listar Smart TVs como subscriber (sem flag)
- [ ] Listar Smart TVs como admin (com flag)
- [ ] Listar Smart TVs como operador_tecnico (com flag)
- [ ] Verificar que publishers só veem suas próprias Smart TVs

## 📝 Próximos Passos

1. **Revisar CRUD de usuários** - Adicionar suporte para flags e novas roles
2. **Validar permissões** - Garantir que todas as rotas respeitam `userType` e flags
3. **Criar checklist completo** - Documentar todos os pontos de validação do sistema
4. **Testes automatizados** - Implementar testes para evitar regressões

## ⚠️ Notas Importantes

- As correções mantêm compatibilidade com `clientId` (deprecated) para não quebrar código existente
- Publishers e Subscribers agora podem acessar suas Smart TVs sem necessidade de `flag_smart_0`
- System users (exceto admins) ainda precisam de `flag_smart_0` para acessar Smart TVs
- Todas as rotas de subscriptions agora suportam `publisherId` e `subscriberId` além de `clientId`
