# 🔍 Inconsistências de Nomenclatura Identificadas

**Data:** 2026-01-08  
**Versão do Sistema:** 2.1.0

---

## 📋 Resumo

Documento identificando inconsistências na nomenclatura entre `clientId`/`client_id` e `subscriberId`/`subscriber_id` no código.

---

## ⚠️ Inconsistências Identificadas

### 1. Rotas de Campaigns (`backend/src/routes/campaigns.ts`)

**Problema:**
- Ainda usa `clientId` em vários lugares para compatibilidade
- Comentários indicam que internamente usa `subscriber_id`
- Mistura de `clientId` e `subscriberId` no mesmo código

**Locais:**
- Linha 46: `clientId, // mantém nome por compatibilidade; internamente usa subscriber_id`
- Linha 58: `finalClientId = req.subscriberId || req.user.clientId || req.user.subscriberId;`
- Linha 68: `finalClientId = clientId ? parseInt(clientId as string) : undefined;`
- Linha 72: `clientId: finalClientId,`
- Linha 131-136: Rota `/client/:clientId` ainda usa `clientId`

**Recomendação:**
- Manter `clientId` apenas na interface pública (query params, body) para compatibilidade com frontend
- Internamente sempre usar `subscriberId` ou `subscriber_id`
- Adicionar comentários explicativos
- Considerar deprecar `clientId` em versão futura

### 2. Services que Ainda Usam `clientId`

**Arquivos Identificados:**
- `backend/src/services/campaignService.ts` - Interface usa `clientId` mas mapeia para `subscriber_id`
- `backend/src/services/playlistService.ts` - Pode ter referências a `clientId`
- `backend/src/services/mediaService.ts` - Pode ter referências a `clientId`
- `backend/src/services/analyticsCacheService.ts` - Usa `clientId`
- `backend/src/services/qrcodeService.ts` - Usa `clientId`

**Recomendação:**
- Criar funções de mapeamento centralizadas
- Documentar onde `clientId` é aceito apenas para compatibilidade
- Planejar migração gradual

### 3. Frontend

**Problema:**
- Frontend ainda pode estar usando `clientId` em alguns lugares
- Interfaces TypeScript podem ter ambos `clientId` e `subscriberId`

**Recomendação:**
- Auditar frontend para uso de `clientId`
- Atualizar interfaces para usar `subscriberId` como padrão
- Manter `clientId` apenas onde necessário para compatibilidade

---

## ✅ Padrão Recomendado

### Backend (Interno)
- **Sempre usar:** `subscriberId` ou `subscriber_id`
- **Banco de dados:** `subscriber_id` (snake_case)
- **TypeScript:** `subscriberId` (camelCase)

### API (Pública)
- **Aceitar ambos:** `clientId` (deprecated) e `subscriberId` (preferido)
- **Mapear:** `clientId` → `subscriberId` internamente
- **Documentar:** `clientId` está deprecated, usar `subscriberId`

### Frontend
- **Usar:** `subscriberId` (preferido)
- **Suportar:** `clientId` apenas onde necessário para compatibilidade

---

## 🔄 Plano de Migração

### Fase 1: Documentação (Atual)
- ✅ Identificar todas as inconsistências
- ✅ Documentar padrão recomendado
- ✅ Criar funções de mapeamento

### Fase 2: Compatibilidade (Próxima)
- Criar funções helper para mapear `clientId` → `subscriberId`
- Adicionar warnings quando `clientId` for usado
- Atualizar documentação da API

### Fase 3: Migração Gradual (Futuro)
- Atualizar frontend para usar apenas `subscriberId`
- Remover suporte a `clientId` em versão futura
- Atualizar testes

---

## 📝 Ações Imediatas

1. ✅ Criar funções de mapeamento centralizadas
2. ⏳ Adicionar comentários explicativos onde `clientId` é usado
3. ⏳ Atualizar documentação da API
4. ⏳ Criar testes para mapeamento

---

**Status:** 🔍 Em Análise  
**Prioridade:** MÉDIA  
**Impacto:** Compatibilidade e Manutenibilidade
