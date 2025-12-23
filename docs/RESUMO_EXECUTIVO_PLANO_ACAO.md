# Resumo Executivo - Plano de Ação de Renomeações

## 📋 Visão Geral

Plano de ação meticuloso criado para refatoração completa do modelo E.R., baseado em todas as respostas e decisões confirmadas.

---

## ✅ Decisões Confirmadas

| Decisão | Resposta |
|---------|----------|
| **Subscriptions** | Modelo híbrido - Publishers E Subscribers podem ter |
| **Users** | 3 tipos: `is_tenant_user` + `publisher_id` |
| **Publisher = Subscriber** | Sim, flag `client_type = 'both'` com billing separado |
| **Playlists** | Polimórfica - `subscriber_id` OU `publisher_id` |
| **Execution Logs** | Polimórfica - ambos `subscriber_id` E `publisher_id` |
| **Revenue Share** | Variável por publisher (via contrato) |
| **Modelo Híbrido** | Billing separado (contas independentes) |
| **Documentos** | Sistema de arquivos (path configurável) |
| **Preservar Dados** | **NÃO** - recriar do zero |

---

## 🎯 Objetivo Principal

**Recriar todo o banco de dados do zero** com:
- ✅ Renomeações: `clients` → `subscribers`, `hosts` → `publishers`
- ✅ Novas estruturas de billing separadas
- ✅ Novas estruturas de contratos
- ✅ Estruturas polimórficas (playlists, execution_logs)
- ✅ Remoção de `totems.client_id`
- ✅ Todos os FKs, índices e views atualizados

---

## 📊 Estrutura do Plano

### **FASE 0: PREPARAÇÃO** (2-4h)
- Backup completo
- Inventário de tabelas, FKs, índices e views afetados

### **FASE 1: CRIAR NOVO SCHEMA SQL** (8-12h)
- Criar arquivo SQL completo com ordem correta de dependências
- Criar todas as tabelas, FKs, índices, views
- Validação de integridade

### **FASE 2: APLICAR SCHEMA** (2-4h)
- Testar em ambiente isolado
- Aplicar em produção (com backup)

### **FASE 3: ATUALIZAR BACKEND** (16-24h)
- Models, services, routes, queries
- Middleware e validações

### **FASE 4: ATUALIZAR FRONTEND** (12-16h)
- API clients, components, types
- Estado (Redux/Context)

### **FASE 5: TESTES** (8-12h)
- Integridade, funcionais, integração, performance

### **FASE 6: DOCUMENTAÇÃO** (4-6h)
- Changelog, guia de migração, API docs

**TOTAL ESTIMADO: 52-78 horas**

---

## 🔑 Pontos Críticos

### ⚠️ **PRECAUÇÕES OBRIGATÓRIAS**
1. ✅ Backup completo antes de qualquer alteração
2. ✅ Ambiente de teste primeiro
3. ✅ Ordem correta de criação (respeitar dependências)
4. ✅ Verificação de integridade após cada fase
5. ✅ Código backend/frontend atualizado DEPOIS do banco

### 🎯 **MUDANÇAS PRINCIPAIS**

#### Tabelas a Renomear
- `clients` → `subscribers`
- `hosts` → `publishers`

#### Colunas a Renomear
- `client_id` → `subscriber_id` (em campaigns, medias, etc.)
- `host_id` → `publisher_id` (em locals)
- `users.client_id` → `users.publisher_id` (**mudança de conceito!**)
- `subscriptions.client_id` → `subscriptions.publisher_id` + `subscriber_id` (polimórfico)

#### Colunas a Remover
- `totems.client_id` → **REMOVER completamente**

#### Tabelas Novas
- `subscriber_billing`
- `publisher_billing`
- `publisher_contracts`
- `subscriber_contracts`

#### Estruturas Polimórficas
- `playlists`: `subscriber_id` OU `publisher_id` (CHECK constraint)
- `execution_logs`: `subscriber_id` E `publisher_id` (ambos)
- `subscriptions`: `publisher_id` OU `subscriber_id` (CHECK constraint)

---

## 🚀 Melhorias Sugeridas (Priorizadas)

### 🔴 **Alta Prioridade** (Implementar Agora)
1. ✅ Constraints de negócio adicionais
2. ✅ Indexação parcial para performance
3. ✅ Triggers para `updated_at` automático
4. ✅ Documentação SQL completa (COMMENTs)
5. ✅ Scripts de validação automatizados

### 🟡 **Média Prioridade** (Implementar Depois)
6. ⚠️ Versionamento de schema
7. ⚠️ Funções úteis para derivação de dados
8. ⚠️ Configuração de path de documentos
9. ⚠️ Validação de JSONB

### 🟢 **Baixa Prioridade** (Otimizações Futuras)
10. 📝 Materialized views para analytics
11. 📝 Row Level Security
12. 📝 Particionamento de tabelas grandes

---

## 📁 Documentos Criados

1. **`PLANO_ACAO_RENOMENACOES_METICULOSO.md`**
   - Plano completo com todas as fases
   - Scripts SQL detalhados
   - Checklists e validações
   - **52-78 horas** estimadas

2. **`SUGESTOES_MELHORIAS_PLANO.md`**
   - 15 sugestões de melhorias
   - Priorização (Alta/Média/Baixa)
   - Scripts SQL de exemplo
   - Recomendações de implementação gradual

3. **`RESUMO_EXECUTIVO_PLANO_ACAO.md`** (este documento)
   - Visão geral rápida
   - Decisões confirmadas
   - Estrutura do plano
   - Próximos passos

---

## 🎯 Próximos Passos Imediatos

### 1. **Revisar e Aprovar Plano**
- [ ] Revisar `PLANO_ACAO_RENOMENACOES_METICULOSO.md`
- [ ] Revisar `SUGESTOES_MELHORIAS_PLANO.md`
- [ ] Validar decisões e abordagem

### 2. **Preparar Ambiente**
- [ ] Criar ambiente de teste isolado
- [ ] Configurar backup automático
- [ ] Preparar scripts de rollback

### 3. **Iniciar Execução**
- [ ] Executar FASE 0 (Preparação)
- [ ] Criar arquivo SQL completo (FASE 1)
- [ ] Testar em ambiente isolado
- [ ] Validar integridade
- [ ] Aplicar em produção (após aprovação)

---

## ⚠️ Alertas Importantes

### 🔴 **Não Fazer:**
- ❌ Aplicar em produção sem testar primeiro
- ❌ Pular verificações de integridade
- ❌ Atualizar código antes do banco estar pronto
- ❌ Fazer mudanças sem backup

### ✅ **Sempre Fazer:**
- ✅ Backup completo antes de qualquer alteração
- ✅ Testar em ambiente isolado primeiro
- ✅ Verificar integridade após cada fase
- ✅ Documentar todas as mudanças
- ✅ Validar com stakeholders antes de produção

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Consultar documentação detalhada nos documentos criados
2. Revisar checklists em cada fase
3. Executar scripts de validação
4. Verificar logs e mensagens de erro

---

**Status:** ✅ Plano criado e pronto para execução após aprovação.

**Próxima ação:** Revisar planos detalhados e aprovar início da execução.

