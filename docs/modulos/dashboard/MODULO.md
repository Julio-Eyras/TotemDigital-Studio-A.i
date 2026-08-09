# `dashboard` — Dashboard

| Campo | Valor |
|-------|-------|
| **Slug** | `dashboard` |
| **Modos** | Lite, Pro (Direct usa Publicar como home) |
| **Atores** | todos com painel |
| **UI** | `/dashboard` |
| **API** | `/api/dashboard, /api/dashboard-layouts, /api/alerts` |
| **Status** | active |
| **Profundidade** | L2 |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Visão operacional/comercial agregada (stats, activities, charts, layouts) e alertas; no Direct a home é Publicar em Totem.

### Dentro do escopo
- `GET /ui-context`, `/stats`, `/activities`, `/charts`, client stats
- CRUD dashboard-layouts
- Alerts check/acknowledge (API)

### Fora do escopo
- Substituir Publicar em Totem no Direct
- Analytics avançado Pro (`analytics-ai`)

### Vocabulário
| Termo | Significado |
|-------|-------------|
| ui-context | capacidade/widgets conforme mode/role |
| alert severity | `info` \| `warning` \| `error` \| `critical` |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-DSH-001 | State-driven | No Direct a home operacional é Publicar em Totem. |
| REQ-DSH-002 | Ubiquitous | Stats devem respeitar escopo publisher/subscriber. |
| REQ-DSH-003 | Event-driven | Quando totem fica offline, indicadores reflectem ausência de heartbeat. |
| REQ-DSH-004 | Optional | Layouts personalizados por utilizador/role. |
| REQ-DSH-005 | Unwanted | Publisher A não vê KPIs da org B. |
| REQ-DSH-006 | Optional | Alerts API pode processar contract audits. |

---

## 3. Regras de negócio

### RN-DSH-001 — Escopo ACL

```text
RN-DSH-001 — Escopo ACL
Quando: dashboard stats
Se: publisher_user
Então: só org
Excepto: —
Motivo: ACL
```


### RN-DSH-002 — Direct redirect

```text
RN-DSH-002 — Direct redirect
Quando: mode=off home
Se: sempre
Então: UI aponta publish-totem
Excepto: —
Motivo: Produto Direct
```


### RN-DSH-003 — Layouts activos

```text
RN-DSH-003 — Layouts activos
Quando: GET layouts
Se: is_active/is_default
Então: aplicar default se nenhum
Excepto: —
Motivo: UX
```


### RN-DSH-004 — Alert severity

```text
RN-DSH-004 — Alert severity
Quando: criar alerta
Se: severity inválida
Então: rejeitar
Excepto: —
Motivo: Taxonomia
```


### RN-DSH-005 — Subscriber dashboard

```text
RN-DSH-005 — Subscriber dashboard
Quando: portal
Se: subscriber_user
Então: KPI do anunciante
Excepto: —
Motivo: Portal subset
```


---

## 4. Fluxos

```mermaid
flowchart TD
  A[UI /dashboard] --> B[GET ui-context]
  B --> C[GET stats/activities/charts]
  C --> D[Widgets]
  E[alerts API] --> F[acknowledge]
  G[Direct] --> H[/publish-totem]
```

---

## 5. Estados

| Conceito | Valores |
|----------|---------|
| ecrã / totem (widget) | online / offline |
| alert | não ack → acknowledged |
| layout | `is_default`, `is_active` |

---

## 6. Critérios de aceite

### AC-DSH-001 (P0)

```text
DADO totem offline (sem heartbeat)
QUANDO abrir dashboard
ENTÃO indicador reflecte offline
```


### AC-DSH-002 (P0)

```text
DADO publisher A
QUANDO GET /api/dashboard/stats
ENTÃO sem métricas da org B
```


### AC-DSH-003 (P0)

```text
DADO mode Direct
QUANDO entrar na home
ENTÃO fluxo operacional é publish-totem
```


---

## 7. Dependências e referências

### Módulos
- [`totems`](../totems/MODULO.md), [`telemetry-heartbeat`](../telemetry-heartbeat/MODULO.md), [`direct-totem-mode`](../direct-totem-mode/MODULO.md), [`subscriber-portal`](../subscriber-portal/MODULO.md)

### Código de referência
- `backend/src/routes/dashboard.ts`, `dashboard-layouts.ts`, `alerts.ts`
- `backend/src/services/dashboardService.ts`, `alertService.ts`
- `frontend/src/pages/Dashboard/Dashboard.tsx`
- schema part6 `dashboard_layouts`; part2 `alert_rules`

### Lacunas conhecidas
- Página Dashboard usa sobretudo dashboardApi; alerts pouco wired na UI principal.
