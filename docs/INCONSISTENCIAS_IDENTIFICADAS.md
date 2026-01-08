# 🔍 Inconsistências Identificadas no Sistema

**Data:** 2026-01-08  
**Versão do Sistema:** 2.1.0

---

## 📋 Resumo Executivo

Este documento lista todas as inconsistências identificadas entre o modelo E.R., interfaces backend/frontend, e implementação do código.

---

## ✅ Inconsistências Corrigidas

### 1. Tipo `contract_type` em `UpdateContractRequest`

**Status:** ✅ CORRIGIDO

**Problema:**
- `UpdateContractRequest` não incluía `'hybrid'` e `'revenue_share'` no tipo `contract_type`
- Causava erro de compilação TypeScript ao atualizar contratos

**Correção Aplicada:**
```typescript
// ANTES
contract_type?: 'advertising' | 'subscription' | 'partnership';

// DEPOIS
contract_type?: 'advertising' | 'subscription' | 'partnership' | 'revenue_share' | 'hybrid';
```

**Arquivos Afetados:**
- `frontend/src/services/api/index.ts`

---

### 2. Parâmetro `publisherId` em `contractApi.getAll`

**Status:** ✅ CORRIGIDO

**Problema:**
- `contractApi.getAll` não aceita `publisherId` como parâmetro
- Código tentava usar `publisherId` em `loadAvailableContracts` e `loadPublisherContracts`

**Correção Aplicada:**
- Removido `publisherId` das chamadas em `Publishers.tsx`
- Para contratos de publisher, usar `publisherContractApi.getAll({ publisherId })`

**Arquivos Afetados:**
- `frontend/src/pages/Publishers/Publishers.tsx`

---

### 3. Propriedade `mediaType` vs `media_type`

**Status:** ✅ CORRIGIDO

**Problema:**
- Frontend usava `option.mediaType` (camelCase) mas backend retorna `media_type` (snake_case)
- Causava erro de compilação TypeScript

**Correção Aplicada:**
```typescript
// ANTES
{option.mediaType === 'image' && <ImageIcon />}

// DEPOIS
{((option as any).mediaType || option.media_type) === 'image' && <ImageIcon />}
```

**Arquivos Afetados:**
- `frontend/src/pages/Subscribers/Subscribers.tsx`

---

### 4. Métodos ausentes em `SubscriberService`

**Status:** ✅ CORRIGIDO

**Problema:**
- `getCurrentResourceCount` e `getCurrentStorage` não existiam como métodos públicos
- Rotas tentavam chamar esses métodos

**Correção Aplicada:**
- Adicionados métodos públicos:
  - `getCurrentResourceCount(subscriberId, resourceType)`
  - `getCurrentStorage(subscriberId)`

**Arquivos Afetados:**
- `backend/src/services/subscriberService.ts`
- `backend/src/routes/subscribers.ts`

---

### 5. Tipo de retorno `null` vs `undefined` em `getMaxLimits`

**Status:** ✅ CORRIGIDO

**Problema:**
- `getMaxLimits` retornava `null` mas tipo esperava `number | undefined`

**Correção Aplicada:**
- Alterado retorno de `null` para `undefined` para consistência com TypeScript

**Arquivos Afetados:**
- `backend/src/services/subscriberService.ts`
- `backend/src/routes/subscribers.ts`

---

### 6. `contract_id` obrigatório vs opcional em interfaces

**Status:** ✅ CORRIGIDO

**Problema:**
- Backend exige `contract_id` como obrigatório, mas frontend permitia `undefined` no estado inicial
- Causava erro de compilação TypeScript

**Correção Aplicada:**
- Tornado `contract_id` opcional nas interfaces (`CreateSubscriberRequest`, `CreatePublisherRequest`)
- Validação no frontend garante que seja fornecido antes de enviar

**Arquivos Afetados:**
- `frontend/src/services/api/index.ts`
- `frontend/src/pages/Subscribers/Subscribers.tsx`
- `frontend/src/pages/Publishers/Publishers.tsx`

---

### 7. Verificação de `undefined` em `remainingGB` e `remaining`

**Status:** ✅ CORRIGIDO

**Problema:**
- TypeScript reclamava que `remainingGB` e `remaining` poderiam ser `undefined`
- Código verificava apenas `!== null`

**Correção Aplicada:**
```typescript
// ANTES
{validationInfo.storage.remainingGB !== null && ...}

// DEPOIS
{validationInfo.storage.remainingGB !== null && validationInfo.storage.remainingGB !== undefined && ...}
```

**Arquivos Afetados:**
- `frontend/src/components/MediaUploadDialog/MediaUploadDialog.tsx`

---

### 8. Declaração duplicada de `loadingContracts`

**Status:** ✅ CORRIGIDO

**Problema:**
- `loadingContracts` estava declarado duas vezes em `Subscribers.tsx`
- Causava erro de compilação TypeScript

**Correção Aplicada:**
- Removida declaração duplicada

**Arquivos Afetados:**
- `frontend/src/pages/Subscribers/Subscribers.tsx`

---

## ⚠️ Inconsistências Potenciais (Requerem Verificação)

### 1. Uso extensivo de `clientId` (Deprecated)

**Status:** ⚠️ REQUER ATENÇÃO

**Problema:**
- Muitos lugares ainda usam `clientId` (deprecated) em vez de `subscriberId`
- Pode causar confusão e bugs

**Arquivos Afetados:**
- `backend/src/services/billingService.ts` - usa `clientId` em `CreateBillingRequest`
- `backend/src/services/clientService.ts` - mantém interface `Client` com `client_id`
- `frontend/src/services/api/index.ts` - múltiplas interfaces ainda têm `clientId`
- 26 arquivos no backend ainda referenciam `clientId`

**Recomendação:**
1. Criar script de migração para remover todas as referências a `clientId`
2. Atualizar interfaces e serviços para usar apenas `subscriberId`
3. Adicionar warnings no código durante período de transição

**Prioridade:** MÉDIA (não bloqueia funcionalidade, mas pode causar confusão)

---

### 2. Validação inconsistente de `contract_id` em recursos

**Status:** ⚠️ REQUER VERIFICAÇÃO

**Problema:**
- Recursos (locals, totens, smart_tvs) têm `created_via_contract_id` mas validação pode não estar completa em todas as rotas

**Arquivos Afetados:**
- `backend/src/routes/locals.ts`
- `backend/src/routes/totems.ts`
- `backend/src/routes/smart-tvs.ts`

**Recomendação:**
- Verificar se todas as rotas de criação validam:
  - ✅ Contrato existe
  - ✅ Contrato está ativo
  - ✅ Contrato não está expirado

**Prioridade:** ALTA (afeta segurança e rastreabilidade)

---

### 3. Proteção de valores contratuais pode estar incompleta

**Status:** ⚠️ REQUER AUDITORIA

**Problema:**
- `contractValuesProtectionMiddleware` pode não estar aplicado em todas as rotas necessárias

**Rotas que DEVEM ter proteção:**
- ✅ `GET /api/contracts` - PROTEGIDO
- ✅ `GET /api/contracts/:id` - PROTEGIDO
- ✅ `GET /api/publisher-contracts` - PROTEGIDO
- ✅ `GET /api/publisher-contracts/:id` - PROTEGIDO
- ✅ `GET /api/publishers/:id/contracts` - PROTEGIDO

**Recomendação:**
- Auditar todas as rotas que retornam contratos
- Garantir que middleware está aplicado
- Testar com diferentes roles

**Prioridade:** ALTA (afeta segurança de dados sensíveis)

---

### 4. Interface `Client` ainda existe no frontend

**Status:** ⚠️ REQUER REMOÇÃO

**Problema:**
- Interface `Client` ainda existe em `frontend/src/services/api/index.ts`
- Pode causar confusão com `Subscriber`

**Recomendação:**
- Remover interface `Client` após migração completa
- Atualizar todos os lugares que usam `Client` para usar `Subscriber`

**Prioridade:** BAIXA (não afeta funcionalidade, apenas organização)

---

### 5. Validação de limites de plano pode não estar em todos os lugares

**Status:** ⚠️ REQUER VERIFICAÇÃO

**Problema:**
- Validação de limites de plano está implementada para:
  - ✅ Criação de mídias (`/api/media/upload`)
  - ✅ Criação de playlists (`/api/playlists`)
  - ✅ Criação de campanhas (`/api/campaigns`)

**Recomendação:**
- Verificar se não há outros lugares onde recursos são criados sem validação
- Adicionar validação em rotas de importação em massa, se existirem

**Prioridade:** MÉDIA (afeta limites de plano)

---

### 6. Isolamento de dados pode não estar em todas as rotas

**Status:** ⚠️ REQUER AUDITORIA

**Problema:**
- `subscriberIsolationMiddleware` está aplicado em:
  - ✅ `/api/media`
  - ✅ `/api/playlists`
  - ✅ `/api/campaigns`
  - ✅ `/api/subscriber-billing`

**Recomendação:**
- Verificar se todas as rotas que retornam dados de subscriber têm isolamento
- Adicionar isolamento em rotas de analytics, reports, etc., se necessário

**Prioridade:** ALTA (afeta segurança e isolamento de dados)

---

## 🔧 Recomendações de Correção

### Prioridade ALTA

1. **Auditar proteção de valores contratuais**
   - Verificar todas as rotas GET de contratos
   - Testar com diferentes roles
   - Garantir que middleware está aplicado

2. **Verificar validação de `contract_id` em recursos**
   - Auditar rotas de criação de locals, totens, smart_tvs
   - Garantir validação completa de contrato

3. **Auditar isolamento de dados**
   - Verificar todas as rotas que retornam dados de subscriber
   - Adicionar isolamento onde necessário

### Prioridade MÉDIA

4. **Migrar `clientId` para `subscriberId`**
   - Criar script de migração
   - Atualizar interfaces e serviços
   - Adicionar warnings durante transição

5. **Verificar validação de limites de plano**
   - Auditar todas as rotas de criação de recursos
   - Adicionar validação onde faltar

### Prioridade BAIXA

6. **Remover interface `Client`**
   - Após migração completa de `clientId`
   - Atualizar referências

---

## 📊 Estatísticas

- **Inconsistências Corrigidas:** 8
- **Inconsistências Potenciais:** 6
- **Arquivos Afetados:** ~30
- **Prioridade ALTA:** 3
- **Prioridade MÉDIA:** 2
- **Prioridade BAIXA:** 1

---

## 📝 Notas

- Todas as inconsistências corrigidas foram testadas e commitadas
- Inconsistências potenciais requerem verificação manual
- Recomenda-se criar testes automatizados para prevenir regressões

---

**Documento gerado em:** 2026-01-08  
**Última atualização:** 2026-01-08
