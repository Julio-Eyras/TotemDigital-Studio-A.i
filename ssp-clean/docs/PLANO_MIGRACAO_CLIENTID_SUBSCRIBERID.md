# 📋 Plano de Migração: clientId → subscriberId

**Data:** 2026-01-08  
**Status:** ⏳ Planejamento  
**Prioridade:** 🔴 ALTA

---

## 🎯 Objetivo

Migrar todas as referências de `clientId` para `subscriberId` no sistema, mantendo compatibilidade durante a transição.

---

## 📊 Análise Atual

### Arquivos que usam `clientId`:

1. **Backend Services:**
   - `backend/src/services/billingService.ts` - Usa `client_id` em queries
   - `backend/src/services/clientService.ts` - Service completo baseado em `clientId`
   - `backend/src/services/reportsService.ts` - Usa `clientId` em relatórios
   - `backend/src/services/analyticsService.ts` - Usa `clientId` em análises

2. **Backend Routes:**
   - `backend/src/routes/billing.ts` - Filtro por `clientId`
   - `backend/src/routes/analytics.ts` - Rota `/clients/:clientId`
   - `backend/src/routes/reports.ts` - Relatórios por `clientId`

3. **Backend Middleware:**
   - `backend/src/middleware/auth.middleware.ts` - Define `clientId` como fallback

4. **Database:**
   - Tabela `billing` - Campo `client_id`
   - Tabela `clients` - Tabela antiga (deprecated)
   - Tabela `subscribers` - Tabela nova (deve ser usada)

---

## 🔄 Estratégia de Migração

### Fase 1: Análise e Preparação (2-3 horas)
1. ✅ Identificar todos os arquivos que usam `clientId`
2. ✅ Verificar estrutura do banco de dados
3. ✅ Criar mapeamento de `client_id` → `subscriber_id`
4. ✅ Documentar dependências

### Fase 2: Migração do Banco de Dados (1-2 horas)
1. Adicionar coluna `subscriber_id` na tabela `billing` (se não existir)
2. Migrar dados: `UPDATE billing SET subscriber_id = (SELECT subscriber_id FROM subscribers WHERE subscriber_id = billing.client_id)`
3. Criar índice em `billing.subscriber_id`
4. Adicionar constraint NOT NULL após migração completa

### Fase 3: Migração do Backend (4-6 horas)
1. Atualizar `billingService.ts`:
   - Substituir `client_id` por `subscriber_id` em queries
   - Manter `clientId` como alias para compatibilidade
   - Adicionar warnings de deprecação

2. Atualizar `reportsService.ts`:
   - Substituir `clientId` por `subscriberId`
   - Manter compatibilidade com `clientId` via fallback

3. Atualizar `analyticsService.ts`:
   - Substituir `clientId` por `subscriberId`
   - Atualizar rotas para usar `subscriberId`

4. Atualizar rotas:
   - `backend/src/routes/billing.ts` - Usar `subscriberId`
   - `backend/src/routes/analytics.ts` - Mudar `/clients/:clientId` para `/subscribers/:subscriberId`
   - `backend/src/routes/reports.ts` - Usar `subscriberId`

5. Atualizar middleware:
   - `backend/src/middleware/auth.middleware.ts` - Manter `clientId` como fallback temporário

### Fase 4: Migração do Frontend (2-3 horas)
1. Atualizar APIs:
   - `frontend/src/services/api/index.ts` - Substituir `clientId` por `subscriberId`
   - Atualizar interfaces TypeScript

2. Atualizar componentes:
   - Substituir referências a `clientId` por `subscriberId`
   - Atualizar chamadas de API

### Fase 5: Limpeza e Validação (1-2 horas)
1. Remover código deprecated
2. Remover tabela `clients` (após validação)
3. Atualizar documentação
4. Testes completos

---

## ⚠️ Pontos de Atenção

1. **Compatibilidade:** Manter suporte a `clientId` durante transição (warnings)
2. **Dados Existentes:** Garantir que todos os dados sejam migrados corretamente
3. **APIs Externas:** Verificar se há integrações que usam `clientId`
4. **Testes:** Testar todas as funcionalidades após migração

---

## 📝 Checklist de Migração

### Banco de Dados
- [ ] Verificar se `billing.subscriber_id` existe
- [ ] Criar script de migração de dados
- [ ] Executar migração em ambiente de teste
- [ ] Validar integridade dos dados
- [ ] Criar índices necessários
- [ ] Adicionar constraints

### Backend
- [ ] Atualizar `billingService.ts`
- [ ] Atualizar `reportsService.ts`
- [ ] Atualizar `analyticsService.ts`
- [ ] Atualizar rotas
- [ ] Atualizar middleware
- [ ] Adicionar warnings de deprecação
- [ ] Testes unitários

### Frontend
- [ ] Atualizar APIs
- [ ] Atualizar interfaces
- [ ] Atualizar componentes
- [ ] Testes de integração

### Validação
- [ ] Testar criação de billing
- [ ] Testar relatórios
- [ ] Testar análises
- [ ] Validar performance
- [ ] Verificar logs de warnings

---

## 🚀 Próximos Passos

1. **Criar script de migração do banco de dados**
2. **Atualizar serviços um por um**
3. **Testar cada atualização**
4. **Documentar mudanças**

---

**Última Atualização:** 2026-01-08
