# `analytics-ai` — Analytics / IA

| Campo | Valor |
|-------|-------|
| **Slug** | `analytics-ai` |
| **Modos** | Pro |
| **Atores** | admin, marketing, publisher/subscriber |
| **UI** | `/analytics, /ai, /ai-context` |
| **API** | `/api/analytics, /api/ai (+ facial-recognition)` |
| **Status** | active |
| **Profundidade** | L2 |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Analytics agregados de rede/campanhas e assistentes IA (process/chat/suggestions), com gate `requireModule('analytics')` no preset Pro.

### Dentro do escopo
- `/api/analytics` overview, campaigns, totems, revenue, trends, export, alerts
- `/api/ai` status, process, chat, suggestions, models, …
- UI Analytics, AI, AIContext
- Tabelas analytics_* / ai_models / ai_context_data

### Fora do escopo
- Controlo remoto
- Telemetria raw de heartbeat (consome agregados)

### Vocabulário
| Termo | Significado |
|-------|-------------|
| impression | exibição contabilizada |
| ai_context | sentimento/densidade/time_of_day |
| module analytics | flag instalação |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-ANL-001 | State-driven | Módulo analytics on no preset Pro; off em Lite/Direct tipicamente. |
| REQ-ANL-002 | Unwanted | Em mode lite, API analytics/ai ⇒ MODULE_DISABLED. |
| REQ-ANL-003 | Ubiquitous | Consultas filtram por tenant/role. |
| REQ-ANL-004 | Optional | AI process/chat devolvem sugestões sem publicar sozinhas. |
| REQ-ANL-005 | Event-driven | Export gera artefacto a pedido. |
| REQ-ANL-006 | Optional | AI context dashboard lê `ai_context_data`. |

---

## 3. Regras de negócio

### RN-ANL-001 — Privacidade de escopo

```text
RN-ANL-001 — Privacidade de escopo
Quando: consultar analytics
Se: role limitada
Então: filtrar por tenant
Excepto: —
Motivo: ACL
```


### RN-ANL-002 — Gate Pro

```text
RN-ANL-002 — Gate Pro
Quando: API /analytics|/ai
Se: módulo off
Então: 403
Excepto: —
Motivo: Preset
```


### RN-ANL-003 — IA ≠ publish

```text
RN-ANL-003 — IA ≠ publish
Quando: suggestion/process
Se: sempre
Então: não altera campanha sem acção humana
Excepto: —
Motivo: Controlo editorial
```


### RN-ANL-004 — Models lifecycle

```text
RN-ANL-004 — Models lifecycle
Quando: ai_models.status
Se: training/testing
Então: não servir como prod sem active
Excepto: —
Motivo: Qualidade
```


### RN-ANL-005 — Overview FE

```text
RN-ANL-005 — Overview FE
Quando: página Analytics
Se: sempre
Então: usa sobretudo /overview
Excepto: —
Motivo: UX actual
```


---

## 4. Fluxos

```mermaid
flowchart TD
  A[Eventos / logs] --> B[Agregação analytics]
  B --> C[GET /analytics/overview]
  C --> D[UI /analytics]
  E[UI /ai] --> F[POST /ai/process ou /chat]
  F --> G[Sugestão]
  H[/ai-context] --> I[ai_context_data]
```

---

## 5. Estados

| Campo | Valores |
|-------|---------|
| module analytics | on / off |
| ai_models.status | `active`, `inactive`, `training`, `testing` |
| sentiment | `positive`, `neutral`, `negative` |
| density | `low`, `medium`, `high` |

---

## 6. Critérios de aceite

### AC-ANL-001 (P0)

```text
DADO mode lite
QUANDO GET /api/analytics/overview
ENTÃO 403 MODULE_DISABLED
```


### AC-ANL-002 (P0)

```text
DADO publisher A
QUANDO consultar analytics
ENTÃO sem dados da org B
```


### AC-ANL-003 (P0)

```text
DADO sugestão IA gerada
QUANDO sem confirmação humana
ENTÃO campanha/dispatch inalterados
```


---

## 7. Dependências e referências

### Módulos
- [`telemetry-heartbeat`](../telemetry-heartbeat/MODULO.md), [`campaigns`](../campaigns/MODULO.md), [`smart-playlist`](../smart-playlist/MODULO.md), [`system-modules`](../system-modules/MODULO.md)

### Código de referência
- `backend/src/routes/analytics.ts`, `ai.ts`
- `backend/src/services/analyticsService.ts`, `aiService.ts`
- `frontend/src/pages/Analytics/Analytics.tsx`, `AI/AI.tsx`, `AIContext/`
- schema part6 analytics_*; part2 ai_models; part11 ai_context_data

### Lacunas conhecidas
- FE `aiApi.generate` → `POST /ai/generate` pode não existir (backend: `/process`, `/chat`).
- Serviço referencia `ai_requests` **sem DDL** no schema v2.
