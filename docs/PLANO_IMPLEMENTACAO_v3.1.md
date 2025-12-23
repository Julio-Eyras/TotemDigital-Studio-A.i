# 🚀 Plano de Implementação - SmartSignage Pro v3.1 "Inovações"

**Branch:** `versao-3.1-smartsignage-pro-inovacoes`  
**Data de Início:** 2025-01-XX  
**Status:** 🟡 Em Planejamento

---

## 📋 SUMÁRIO EXECUTIVO

Este documento detalha o plano de implementação das melhorias identificadas no relatório de avaliação, priorizadas conforme impacto e complexidade.

### Objetivos da v3.1
1. ✅ Completar funcionalidades críticas pendentes
2. ✅ Melhorar qualidade e performance do código
3. ✅ Implementar features importantes para produção
4. ✅ Adicionar melhorias de UX e funcionalidades avançadas

---

## 🎯 PRIORIZAÇÃO DAS TAREFAS

### 🔴 FASE 1: CRÍTICO (Semanas 1-4)

#### 1.1 Testes Automatizados - Cobertura > 70%
**Status:** ❌ Não iniciado  
**Prioridade:** 🔴 CRÍTICO  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 3-4 semanas

**Objetivos:**
- Aumentar cobertura de testes de 0% para > 70%
- Implementar testes unitários para serviços críticos
- Adicionar testes de integração para rotas principais
- Configurar CI/CD para execução automática

**Tarefas:**
- [ ] Configurar Jest e Supertest no backend
- [ ] Criar testes unitários para:
  - [ ] `authService.ts` (autenticação, JWT, 2FA)
  - [ ] `userService.ts` (CRUD, validações)
  - [ ] `mediaService.ts` (upload, validação)
  - [ ] `playlistService.ts` (criação, ordenação)
  - [ ] `totemService.ts` (heartbeat, status)
  - [ ] `billingService.ts` (Stripe, faturas)
- [ ] Criar testes de integração para:
  - [ ] Rotas de autenticação (`/api/auth/*`)
  - [ ] Rotas de usuários (`/api/users/*`)
  - [ ] Rotas de mídia (`/api/media/*`)
  - [ ] Rotas de playlists (`/api/playlists/*`)
- [ ] Configurar coverage reports
- [ ] Adicionar pre-commit hooks para testes
- [ ] Configurar CI/CD (GitHub Actions)

**Arquivos a criar/modificar:**
- `backend/jest.config.js` (já existe, revisar)
- `backend/src/__tests__/services/*.test.ts` (expandir)
- `backend/src/__tests__/routes/*.test.ts` (criar)
- `.github/workflows/test.yml` (criar)

**Métricas de sucesso:**
- ✅ Cobertura > 70%
- ✅ Todos os testes passando
- ✅ CI/CD configurado

---

#### 1.2 Campo Metadata JSONB na Tabela Tags
**Status:** ⚠️ TODO identificado  
**Prioridade:** 🔴 CRÍTICO  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 2-3 dias

**Objetivos:**
- Adicionar suporte completo a categorias de tags
- Melhorar filtros e organização de tags

**Tarefas:**
- [ ] Criar migração SQL para adicionar coluna `metadata JSONB`
- [ ] Atualizar `TagService` para usar metadata
- [ ] Atualizar queries em `fxOrchestratorService.ts`
- [ ] Adicionar validação de metadata
- [ ] Atualizar rotas de tags para suportar metadata
- [ ] Atualizar frontend para exibir/editar metadata

**Arquivos a criar/modificar:**
- `database/migrations/add-tags-metadata.sql` (criar)
- `backend/src/services/tagService.ts` (modificar)
- `backend/src/services/fxOrchestratorService.ts` (linha 666 - remover TODO)
- `backend/src/routes/tags.ts` (adicionar suporte metadata)
- `frontend/src/pages/Tags/Tags.tsx` (adicionar UI)

**Métricas de sucesso:**
- ✅ Coluna metadata adicionada
- ✅ Queries atualizadas
- ✅ Frontend funcional

---

#### 1.3 Timeline Generation Completa (SmartDisplayFX)
**Status:** ⚠️ Placeholder implementado  
**Prioridade:** 🔴 CRÍTICO  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 1-2 semanas

**Objetivos:**
- Implementar lógica completa de geração de timeline
- Integrar com campanhas e analytics
- Adicionar sincronização NTP

**Tarefas:**
- [ ] Implementar `generateTimeline()` completo em `fxTimelineService.ts`
- [ ] Integrar com `campaignService` para campanhas ativas
- [ ] Integrar com `analyticsService` para dados históricos
- [ ] Adicionar sincronização NTP para timestamps precisos
- [ ] Implementar cache de timeline
- [ ] Adicionar validação de timeline
- [ ] Testes unitários para timeline generation

**Arquivos a criar/modificar:**
- `backend/src/services/fxTimelineService.ts` (completar método)
- `backend/src/services/fxOrchestratorService.ts` (integrar)
- `backend/src/config/ntp.ts` (criar - sincronização NTP)
- `backend/src/__tests__/services/fxTimelineService.test.ts` (criar)

**Métricas de sucesso:**
- ✅ Timeline gerada corretamente
- ✅ Integração com campanhas funcionando
- ✅ Sincronização NTP ativa

---

### 🟡 FASE 2: IMPORTANTE (Semanas 5-8)

#### 2.1 Dashboards Customizáveis
**Status:** ❌ Não iniciado  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 3-4 semanas

**Objetivos:**
- Permitir usuários criarem dashboards personalizados
- Sistema de widgets arrastáveis (drag & drop)
- Múltiplos dashboards por usuário

**Tarefas:**
- [ ] Criar sistema de widgets (drag & drop)
- [ ] Implementar biblioteca de widgets:
  - [ ] Gráfico de linha
  - [ ] Gráfico de barras
  - [ ] Gráfico de pizza
  - [ ] Tabela de dados
  - [ ] KPI cards
  - [ ] Lista de atividades
- [ ] Criar tabela `dashboard_layouts` no banco
- [ ] Implementar salvamento de layouts
- [ ] Adicionar redimensionamento de widgets
- [ ] Configuração por widget
- [ ] Compartilhamento de dashboards (opcional)

**Arquivos a criar/modificar:**
- `database/migrations/add-dashboard-layouts.sql` (criar)
- `backend/src/services/dashboardService.ts` (adicionar métodos)
- `backend/src/routes/dashboard.ts` (novas rotas)
- `frontend/src/components/Dashboard/Widget.tsx` (criar)
- `frontend/src/components/Dashboard/WidgetLibrary.tsx` (criar)
- `frontend/src/components/Dashboard/DashboardBuilder.tsx` (criar)
- `frontend/src/pages/Dashboard/Dashboard.tsx` (reescrever)

**Dependências:**
- `react-dnd` ou `@dnd-kit/core` (drag & drop)
- `recharts` (já existe - gráficos)

**Métricas de sucesso:**
- ✅ Widgets arrastáveis funcionando
- ✅ Salvamento de layouts
- ✅ Múltiplos dashboards por usuário

---

#### 2.2 Cache Redis para Analytics
**Status:** ⚠️ Sugerido mas não implementado  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 1 semana

**Objetivos:**
- Reduzir carga no banco de dados
- Melhorar performance de queries de analytics
- Implementar invalidação inteligente

**Tarefas:**
- [ ] Criar `analyticsCacheService.ts`
- [ ] Implementar cache para queries frequentes:
  - [ ] Overview de analytics
  - [ ] Estatísticas de totens
  - [ ] Estatísticas de mídia
  - [ ] Estatísticas de campanhas
- [ ] Configurar TTL por tipo de query
- [ ] Implementar invalidação automática:
  - [ ] Ao criar/atualizar campanha
  - [ ] Ao criar/atualizar mídia
  - [ ] Ao receber heartbeat
- [ ] Adicionar métricas de cache hit rate

**Arquivos a criar/modificar:**
- `backend/src/services/analyticsCacheService.ts` (criar)
- `backend/src/services/analyticsService.ts` (integrar cache)
- `backend/src/config/redis.ts` (já existe, verificar)

**Métricas de sucesso:**
- ✅ Cache hit rate > 70%
- ✅ Redução de queries ao banco
- ✅ Performance melhorada

---

#### 2.3 Sistema de Alertas Completo
**Status:** ⚠️ Parcial (rotas existem, lógica incompleta)  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 2 semanas

**Objetivos:**
- Completar implementação de alertas
- Adicionar integrações (email, Slack, SMS)
- Configurar thresholds

**Tarefas:**
- [ ] Completar `alertService.ts`:
  - [ ] Envio de email (remover TODO linha 340)
  - [ ] Webhook do Slack (remover TODO linha 348)
  - [ ] Webhooks configuráveis (remover TODO linha 356)
  - [ ] Envio de SMS (remover TODO linha 364)
- [ ] Implementar tipos de alertas:
  - [ ] FPS baixo (< 15 FPS)
  - [ ] Totem offline (> 5 minutos)
  - [ ] Falhas críticas
  - [ ] Quota de armazenamento
- [ ] Configurar thresholds por cliente
- [ ] Adicionar interface de configuração no frontend
- [ ] Histórico de alertas

**Arquivos a criar/modificar:**
- `backend/src/services/alertService.ts` (completar TODOs)
- `backend/src/services/emailService.ts` (já existe, verificar)
- `backend/src/routes/alerts.ts` (adicionar rotas de configuração)
- `frontend/src/pages/Settings/Alerts.tsx` (criar)
- `frontend/src/components/AlertSettings/AlertSettings.tsx` (criar)

**Dependências:**
- `nodemailer` (já existe)
- `@slack/web-api` (adicionar)
- Twilio ou similar (SMS)

**Métricas de sucesso:**
- ✅ Todos os TODOs removidos
- ✅ Alertas funcionando
- ✅ Integrações ativas

---

#### 2.4 Exportação de Relatórios no Dashboard FX
**Status:** ❌ Não implementado no dashboard FX  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 1 semana

**Objetivos:**
- Adicionar exportação PDF/Excel no dashboard SmartDisplayFX
- Relatórios personalizados de analytics FX

**Tarefas:**
- [ ] Adicionar métodos de export em `fxAnalyticsService.ts`
- [ ] Criar rotas de export em `smartdisplayfx-analytics.ts`
- [ ] Adicionar botões de export no frontend
- [ ] Formatação específica para dados FX
- [ ] Incluir gráficos nos PDFs

**Arquivos a criar/modificar:**
- `backend/src/services/fxAnalyticsService.ts` (adicionar métodos export)
- `backend/src/routes/smartdisplayfx-analytics.ts` (adicionar rotas)
- `frontend/src/pages/SmartDisplayFx/SmartDisplayFx.tsx` (adicionar botões)
- `frontend/src/components/ExportButton/ExportButton.tsx` (já existe, reutilizar)

**Métricas de sucesso:**
- ✅ Export PDF funcionando
- ✅ Export Excel funcionando
- ✅ Gráficos incluídos

---

#### 2.5 Atualizar Dependências
**Status:** ⚠️ A verificar  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 3-5 dias

**Objetivos:**
- Atualizar dependências com vulnerabilidades
- Verificar compatibilidade
- Testar atualizações

**Tarefas:**
- [ ] Executar `npm outdated` em backend e frontend
- [ ] Executar `npm audit` para vulnerabilidades
- [ ] Criar plano de atualização:
  - [ ] Dependências críticas primeiro
  - [ ] Testar cada atualização
  - [ ] Documentar breaking changes
- [ ] Atualizar `package.json` files
- [ ] Testar build e execução
- [ ] Atualizar documentação

**Arquivos a modificar:**
- `backend/package.json`
- `frontend/package.json`
- `package.json` (root)

**Métricas de sucesso:**
- ✅ Zero vulnerabilidades críticas
- ✅ Todas as dependências atualizadas
- ✅ Build funcionando

---

#### 2.6 Melhorar Tipagem TypeScript
**Status:** ⚠️ Parcial  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 2 semanas

**Objetivos:**
- Remover todos os `any`
- Habilitar strict mode
- Melhorar tipos compartilhados

**Tarefas:**
- [ ] Revisar `tsconfig.json` (habilitar strict)
- [ ] Criar tipos compartilhados:
  - [ ] `shared/types/api.ts`
  - [ ] `shared/types/entities.ts`
- [ ] Substituir `any` por tipos específicos:
  - [ ] Revisar todos os serviços
  - [ ] Revisar todas as rotas
  - [ ] Revisar middlewares
- [ ] Adicionar tipos para eventos e callbacks
- [ ] Implementar tipos genéricos onde apropriado
- [ ] Corrigir erros de compilação

**Arquivos a criar/modificar:**
- `backend/tsconfig.json` (habilitar strict)
- `frontend/tsconfig.json` (habilitar strict)
- `shared/types/` (criar diretório)
- Todos os arquivos `.ts` e `.tsx` (revisar)

**Métricas de sucesso:**
- ✅ Zero `any` no código
- ✅ Strict mode habilitado
- ✅ Sem erros de compilação

---

#### 2.7 Otimizar Queries SQL
**Status:** ⚠️ A revisar  
**Prioridade:** 🟡 IMPORTANTE  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 2 semanas

**Objetivos:**
- Eliminar queries N+1
- Adicionar índices faltantes
- Otimizar connection pooling

**Tarefas:**
- [ ] Analisar queries SQL:
  - [ ] Identificar N+1 queries
  - [ ] Identificar joins desnecessários
  - [ ] Identificar queries lentas
- [ ] Adicionar índices:
  - [ ] Tabela `users` (username, email)
  - [ ] Tabela `totems` (client_id, status)
  - [ ] Tabela `media` (client_id, type)
  - [ ] Tabela `playlists` (client_id, is_active)
  - [ ] Tabela `campaigns` (client_id, start_date, end_date)
- [ ] Otimizar connection pooling
- [ ] Implementar query caching onde apropriado
- [ ] Revisar transações e locks

**Arquivos a criar/modificar:**
- `database/migrations/add-performance-indexes.sql` (criar)
- `backend/src/config/database-pg.ts` (otimizar pooling)
- Todos os serviços (otimizar queries)

**Métricas de sucesso:**
- ✅ Zero queries N+1
- ✅ Índices adicionados
- ✅ Performance melhorada (> 50%)

---

### 🟢 FASE 3: MELHORIAS (Semanas 9-12)

#### 3.1 Multi-idioma (i18n)
**Status:** ❌ Não iniciado  
**Prioridade:** 🟢 MELHORIAS  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 2-3 semanas

**Tarefas:**
- [ ] Setup `react-i18next`
- [ ] Criar arquivos de tradução:
  - [ ] `pt-BR.json`
  - [ ] `en-US.json`
  - [ ] `es-ES.json` (opcional)
- [ ] Traduzir interface completa
- [ ] Adicionar seletor de idioma
- [ ] Traduzir conteúdo (campanhas, mídia)

**Arquivos a criar/modificar:**
- `frontend/src/i18n/config.ts` (criar)
- `frontend/src/locales/pt-BR/` (criar)
- `frontend/src/locales/en-US/` (criar)
- Todos os componentes (adicionar traduções)

---

#### 3.2 Documentação Swagger Completa
**Status:** ⚠️ Parcial  
**Prioridade:** 🟢 MELHORIAS  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 1-2 semanas

**Tarefas:**
- [ ] Documentar todos os endpoints FX
- [ ] Adicionar exemplos de requisições/respostas
- [ ] Completar schemas
- [ ] Adicionar tags e descrições

**Arquivos a modificar:**
- `backend/src/config/swagger.ts` (completar)
- Todas as rotas (adicionar JSDoc)

---

#### 3.3 Webhooks Configuráveis
**Status:** ❌ Não iniciado  
**Prioridade:** 🟢 MELHORIAS  
**Complexidade:** 🟡 MÉDIA  
**Tempo estimado:** 1-2 semanas

**Tarefas:**
- [ ] Criar tabela `webhooks`
- [ ] Implementar `webhookService.ts`
- [ ] Adicionar rotas de configuração
- [ ] Implementar retry logic
- [ ] Adicionar assinaturas e segurança

**Arquivos a criar:**
- `database/migrations/add-webhooks-table.sql`
- `backend/src/services/webhookService.ts`
- `backend/src/routes/webhooks.ts`

---

#### 3.4 Drill-down em Gráficos
**Status:** ❌ Não iniciado  
**Prioridade:** 🟢 MELHORIAS  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 1 semana

**Tarefas:**
- [ ] Adicionar handlers de click em gráficos
- [ ] Implementar navegação hierárquica
- [ ] Adicionar filtros contextuais
- [ ] Criar modal de detalhes

**Arquivos a modificar:**
- `frontend/src/pages/Analytics/Analytics.tsx`
- `frontend/src/pages/Dashboard/Dashboard.tsx`

---

#### 3.5 Comparações de Períodos
**Status:** ❌ Não iniciado  
**Prioridade:** 🟢 MELHORIAS  
**Complexidade:** 🟢 BAIXA  
**Tempo estimado:** 1 semana

**Tarefas:**
- [ ] Adicionar seletor de períodos
- [ ] Implementar comparação lado a lado
- [ ] Criar gráficos de comparação
- [ ] Adicionar métricas de diferença

**Arquivos a modificar:**
- `backend/src/services/analyticsService.ts`
- `frontend/src/pages/Analytics/Analytics.tsx`

---

## 📊 CRONOGRAMA CONSOLIDADO

### Semana 1-2
- ✅ Criar branch v3.1
- 🔴 Testes automatizados (início)
- 🔴 Metadata JSONB em tags
- 🔴 Timeline generation (início)

### Semana 3-4
- 🔴 Testes automatizados (completar)
- 🔴 Timeline generation (completar)
- 🟡 Atualizar dependências

### Semana 5-6
- 🟡 Dashboards customizáveis (início)
- 🟡 Cache Redis para analytics
- 🟡 Melhorar tipagem TypeScript (início)

### Semana 7-8
- 🟡 Dashboards customizáveis (completar)
- 🟡 Sistema de alertas completo
- 🟡 Otimizar queries SQL (início)
- 🟡 Exportação FX (início)

### Semana 9-10
- 🟡 Otimizar queries SQL (completar)
- 🟡 Exportação FX (completar)
- 🟢 Multi-idioma (início)
- 🟢 Documentação Swagger (início)

### Semana 11-12
- 🟢 Multi-idioma (completar)
- 🟢 Documentação Swagger (completar)
- 🟢 Webhooks configuráveis
- 🟢 Drill-down e comparações

---

## 📈 MÉTRICAS DE SUCESSO

### Código
- ✅ Cobertura de testes > 70%
- ✅ Zero vulnerabilidades críticas
- ✅ TypeScript strict mode habilitado
- ✅ Zero `any` no código
- ✅ Linter sem erros

### Performance
- ✅ Tempo de resposta API < 200ms (p95)
- ✅ Cache hit rate > 70%
- ✅ Zero queries N+1
- ✅ Índices adicionados

### Funcionalidades
- ✅ Todos os TODOs críticos resolvidos
- ✅ Dashboards customizáveis funcionando
- ✅ Sistema de alertas completo
- ✅ Multi-idioma implementado

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

1. **Revisar e aprovar este plano**
2. **Iniciar Fase 1 (Crítico)**
3. **Configurar ambiente de desenvolvimento**
4. **Criar issues no GitHub para cada tarefa**
5. **Iniciar implementação**

---

**Última atualização:** 2025-01-XX  
**Versão do Plano:** 1.0  
**Status:** 🟡 Aguardando Aprovação

