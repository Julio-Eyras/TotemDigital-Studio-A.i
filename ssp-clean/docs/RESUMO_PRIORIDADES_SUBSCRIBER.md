# Resumo de Prioridades - Subscriber

## ✅ O QUE JÁ ESTÁ IMPLEMENTADO

### Funcionalidades Completas:
- ✅ CRUD completo de Informações, Mídias, Playlists e Campanhas
- ✅ Upload de mídias com preview
- ✅ Vinculação de campanhas a contratos
- ✅ Validação básica de propriedade (mídias, playlists, campanhas pertencem ao subscriber)
- ✅ Middleware de isolamento de dados por subscriber
- ✅ Validação de acesso a publishers (parcial)

---

## 🚨 PRIORIDADE CRÍTICA (Implementar Primeiro)

### 1. **Adicionar Mídias à Playlist** ⚠️
**Impacto:** Alto - Funcionalidade essencial que está faltando

**O que fazer:**
- Interface na aba Playlists para selecionar mídias
- Endpoint: `POST /api/playlists/:id/media`
- Validação: Mídia pertence ao mesmo subscriber

**Tempo estimado:** 2-3 horas

---

### 2. **Validações de Limites do Plano** ⚠️
**Impacto:** Crítico - Previne uso excessivo de recursos

**O que fazer:**
- Validar limites ao criar mídias, playlists, campanhas
- Verificar `limits.medias`, `limits.playlists`, `limits.campaigns` do plano
- Exibir alertas no frontend quando próximo do limite
- Bloquear criação se limite atingido

**Tempo estimado:** 4-5 horas

---

### 3. **Validação de Armazenamento (Storage)** ⚠️
**Impacto:** Crítico - Previne uploads que excedem o plano

**O que fazer:**
- Calcular storage total do subscriber (soma de todas as mídias)
- Validar antes de cada upload: `newTotal <= limits.storage_gb`
- Exibir barra de progresso no frontend
- Bloquear upload se limite atingido

**Tempo estimado:** 3-4 horas

---

### 4. **Validação de Execução de Campanhas** ⚠️
**Impacto:** Crítico - Garante que apenas campanhas válidas sejam executadas

**O que fazer:**
- Validar ao adicionar campanha à fila de totens:
  - Contrato ativo e válido
  - Status da campanha ('active' ou 'approved')
  - Campanha tem conteúdo (mídias ou playlists)
  - Totens pertencem a publishers acessíveis
- Endpoint: `POST /api/campaigns/:id/execute` ou similar

**Tempo estimado:** 3-4 horas

---

### 5. **Validação de Acesso a Totens** ⚠️
**Impacto:** Crítico - Previne acesso não autorizado a totens

**O que fazer:**
- Validar se totem pertence a publisher acessível via `subscriber_publisher_access`
- Validar ao associar campanha a totens
- Validar ao buscar totens disponíveis para subscriber

**Tempo estimado:** 2-3 horas

---

## ⚡ PRIORIDADE IMPORTANTE (Implementar Depois)

### 6. **Drag & Drop para Reordenar Playlist** 
**Impacto:** Médio - Melhora UX significativamente

**O que fazer:**
- Instalar biblioteca: `@dnd-kit/core` ou `react-beautiful-dnd`
- Implementar componente draggable
- Endpoint: `PUT /api/playlists/:id/reorder`

**Tempo estimado:** 3-4 horas

---

### 7. **Configurar Duração por Item da Playlist**
**Impacto:** Médio - Funcionalidade importante para controle de exibição

**O que fazer:**
- Campo numérico na lista de itens
- Validação de duração mínima/máxima
- Endpoint: `PATCH /api/playlists/:id/items/:itemId`

**Tempo estimado:** 2-3 horas

---

### 8. **Dashboard com Estatísticas e Limites**
**Impacto:** Médio - Melhora visibilidade do uso

**O que fazer:**
- Nova aba "Estatísticas" no dialog de edição
- Exibir:
  - Contadores: mídias, playlists, campanhas
  - Storage utilizado vs. limite
  - Gráficos de uso
- Endpoint: Expandir `GET /api/subscribers/:id/stats`

**Tempo estimado:** 4-5 horas

---

### 9. **Filtros e Busca**
**Impacto:** Baixo-Médio - Melhora navegação

**O que fazer:**
- Filtros por tipo, status, tags
- Busca por nome
- Ordenação

**Tempo estimado:** 2-3 horas

---

### 10. **Paginação**
**Impacto:** Baixo-Médio - Necessário para grandes volumes

**O que fazer:**
- Implementar paginação real (não apenas limit 1000)
- Componente de paginação no frontend
- Endpoints com `page` e `limit`

**Tempo estimado:** 3-4 horas

---

## 📊 PLANO DE IMPLEMENTAÇÃO SUGERIDO

### Fase 1 (Crítico - 1-2 semanas):
1. ✅ Adicionar mídias à playlist
2. ✅ Validações de limites do plano
3. ✅ Validação de armazenamento
4. ✅ Validação de execução de campanhas
5. ✅ Validação de acesso a totens

### Fase 2 (Importante - 1 semana):
6. ✅ Drag & drop
7. ✅ Configurar duração
8. ✅ Dashboard com estatísticas

### Fase 3 (Melhorias - 1 semana):
9. ✅ Filtros e busca
10. ✅ Paginação

---

## 🔍 VALIDAÇÕES JÁ IMPLEMENTADAS

✅ Middleware de isolamento (`subscriberIsolation.middleware.ts`)
✅ Validação básica de propriedade
✅ Validação de acesso a publishers (parcial em `campaignService`)
✅ Validação de contrato ativo ao criar campanha

---

## 📝 NOTAS IMPORTANTES

1. **Validações de limites** devem ser feitas no backend, mas também podem ter validação no frontend para melhor UX
2. **Isolamento de dados** já existe, mas pode ser melhorado com validações mais rigorosas
3. **Playlists** são a funcionalidade mais incompleta - precisa de atenção prioritária
4. **Execução de campanhas** precisa de validação completa antes de permitir adicionar às filas de totens

---

## 🎯 PRÓXIMO PASSO RECOMENDADO

**Começar pela Fase 1, item 1: Adicionar Mídias à Playlist**

Esta é a funcionalidade mais visível que está faltando e é essencial para o uso do sistema.
