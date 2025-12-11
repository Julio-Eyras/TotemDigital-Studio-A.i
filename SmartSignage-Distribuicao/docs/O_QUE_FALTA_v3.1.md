# 📋 O Que Falta Implementar - SmartSignage Pro v3.1

**Data:** 2025-01-XX  
**Status:** 🟡 Em Andamento

---

## ✅ JÁ IMPLEMENTADO

### 🔴 CRÍTICO
- ✅ Campo Metadata JSONB na Tabela Tags (v3.1-002)
- ✅ Timeline Generation Completa (v3.1-003) - Parcialmente completo

### 🟡 IMPORTANTE
- ✅ Cache Redis para Analytics (v3.1-005)
- ✅ Sistema de Alertas Completo (v3.1-006)
- ✅ Exportação de Relatórios no Dashboard FX (v3.1-007)
- ✅ Webhooks Configuráveis (v3.1-013)
- ✅ Sistema de Backup Automático (v3.1-016)
- ✅ Melhorar Tratamento de Erros e Logging (v3.1-017)

### 🟢 MELHORIAS
- ✅ Rate Limiting por Usuário (v3.1-018)
- ✅ Health Checks Avançados (v3.1-019)
- ✅ Sistema de Notificações em Tempo Real (v3.1-020)

---

## ❌ O QUE FALTA IMPLEMENTAR

### 🔴 CRÍTICO (Prioridade Alta)

#### 1. Testes Automatizados - Cobertura > 70% (v3.1-001)
**Status:** 🟡 EM ANDAMENTO (alguns testes existem, mas cobertura insuficiente)

**O que falta:**
- [ ] Expandir testes unitários para serviços críticos:
  - [ ] `authService.ts` - Testes mais completos
  - [ ] `mediaService.ts` - Testes de upload e validação
  - [ ] `playlistService.ts` - Testes de criação e ordenação
  - [ ] `totemService.ts` - Testes de heartbeat e status
  - [ ] `billingService.ts` - Testes de Stripe e faturas
- [ ] Criar testes de integração para rotas:
  - [ ] Rotas de autenticação (`/api/auth/*`)
  - [ ] Rotas de usuários (`/api/users/*`)
  - [ ] Rotas de mídia (`/api/media/*`)
  - [ ] Rotas de playlists (`/api/playlists/*`)
- [ ] Configurar coverage reports
- [ ] Adicionar pre-commit hooks para testes
- [ ] Configurar CI/CD (GitHub Actions)

**Arquivos a criar/modificar:**
- `backend/src/__tests__/routes/*.test.ts` (criar mais testes)
- `.github/workflows/test.yml` (criar)
- `backend/jest.config.js` (revisar configuração de coverage)

---

#### 2. Timeline Generation - Melhorias (v3.1-003)
**Status:** 🟡 PARCIAL (método básico implementado)

**O que falta:**
- [ ] Integração completa com analytics para otimização
- [ ] Sincronização NTP mais robusta
- [ ] Cache de timeline
- [ ] Validação de timeline
- [ ] Testes unitários para timeline generation

---

### 🟡 IMPORTANTE (Prioridade Média)

#### 3. Dashboards Customizáveis (v3.1-004)
**Status:** ❌ NÃO INICIADO

**O que falta:**
- [ ] Sistema de widgets arrastáveis (drag & drop)
- [ ] Biblioteca de widgets:
  - [ ] Gráfico de linha
  - [ ] Gráfico de barras
  - [ ] Gráfico de pizza
  - [ ] Tabela de dados
  - [ ] KPI cards
  - [ ] Lista de atividades
- [ ] Redimensionamento de widgets
- [ ] Configuração por widget
- [ ] Compartilhamento de dashboards (opcional)

**Nota:** Backend já tem `dashboard_layouts` table e `dashboardLayoutService.ts` criados!

**Arquivos a criar/modificar:**
- `frontend/src/components/Dashboard/Widget.tsx` (criar)
- `frontend/src/components/Dashboard/WidgetLibrary.tsx` (criar)
- `frontend/src/components/Dashboard/DashboardBuilder.tsx` (criar)
- `frontend/src/pages/Dashboard/Dashboard.tsx` (reescrever)

---

#### 4. Atualizar Dependências (v3.1-008)
**Status:** ❌ NÃO INICIADO

**O que falta:**
- [ ] Executar `npm outdated` em backend e frontend
- [ ] Executar `npm audit` para vulnerabilidades
- [ ] Criar plano de atualização
- [ ] Atualizar `package.json` files
- [ ] Testar build e execução
- [ ] Atualizar documentação

---

#### 5. Melhorar Tipagem TypeScript (v3.1-009)
**Status:** 🟡 PARCIAL (strict mode habilitado)

**O que falta:**
- [ ] Remover todos os `any` do código
- [ ] Criar tipos compartilhados:
  - [ ] `shared/types/api.ts`
  - [ ] `shared/types/entities.ts`
- [ ] Substituir `any` por tipos específicos em:
  - [ ] Todos os serviços
  - [ ] Todas as rotas
  - [ ] Middlewares
- [ ] Adicionar tipos para eventos e callbacks
- [ ] Corrigir erros de compilação

---

#### 6. Otimizar Queries SQL (v3.1-010)
**Status:** 🟡 PARCIAL (alguns índices adicionados)

**O que falta:**
- [ ] Analisar queries SQL:
  - [ ] Identificar queries N+1
  - [ ] Identificar joins desnecessários
  - [ ] Identificar queries lentas
- [ ] Otimizar connection pooling
- [ ] Implementar query caching onde apropriado
- [ ] Revisar transações e locks

**Nota:** Índices de performance já foram adicionados ao schema!

---

### 🟢 MELHORIAS (Prioridade Baixa)

#### 7. Multi-idioma (i18n) (v3.1-011)
**Status:** 🟡 PARCIAL (configuração básica existe)

**O que falta:**
- [ ] Completar tradução da interface
- [ ] Adicionar seletor de idioma no frontend
- [ ] Traduzir conteúdo (campanhas, mídia)
- [ ] Validar todas as traduções

**Nota:** Arquivos de tradução (`pt-BR.json`, `en-US.json`, `es-ES.json`) já existem!

---

#### 8. Documentação Swagger Completa (v3.1-012)
**Status:** 🟡 PARCIAL (swagger-enhanced.ts criado)

**O que falta:**
- [ ] Documentar todos os endpoints FX
- [ ] Adicionar exemplos de requisições/respostas
- [ ] Completar schemas
- [ ] Adicionar tags e descrições em todas as rotas

---

#### 9. Drill-down em Gráficos (v3.1-014)
**Status:** ❌ NÃO INICIADO

**O que falta:**
- [ ] Adicionar handlers de click em gráficos
- [ ] Implementar navegação hierárquica
- [ ] Adicionar filtros contextuais
- [ ] Criar modal de detalhes

**Nota:** Componente `DrillDownChart.tsx` já foi criado!

---

#### 10. Comparações de Períodos (v3.1-015)
**Status:** 🟡 PARCIAL (lógica básica implementada)

**O que falta:**
- [ ] Adicionar seletor de períodos no frontend
- [ ] Implementar comparação lado a lado
- [ ] Criar gráficos de comparação
- [ ] Adicionar métricas de diferença

---

## 📊 RESUMO ESTATÍSTICO

### Por Prioridade
- **🔴 CRÍTICO:** 1 tarefa em andamento, 1 parcial
- **🟡 IMPORTANTE:** 4 tarefas pendentes, 1 parcial
- **🟢 MELHORIAS:** 4 tarefas pendentes/parciais

### Por Status
- **✅ Completo:** 10 tarefas
- **🟡 Em Andamento/Parcial:** 6 tarefas
- **❌ Não Iniciado:** 4 tarefas

### Total
- **Implementado:** ~67% (10/15 tarefas principais)
- **Pendente:** ~33% (5 tarefas principais + melhorias)

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### Prioridade 1 (Crítico)
1. **Expandir testes automatizados** - Aumentar cobertura para > 70%
2. **Completar timeline generation** - Adicionar cache e validação

### Prioridade 2 (Importante)
3. **Dashboards customizáveis** - Implementar frontend (backend já pronto)
4. **Atualizar dependências** - Verificar e atualizar pacotes
5. **Melhorar tipagem TypeScript** - Remover todos os `any`

### Prioridade 3 (Melhorias)
6. **Completar i18n** - Traduzir interface completa
7. **Documentação Swagger** - Completar documentação de todos endpoints
8. **Drill-down e comparações** - Finalizar funcionalidades de analytics

---

**Última atualização:** 2025-01-XX

