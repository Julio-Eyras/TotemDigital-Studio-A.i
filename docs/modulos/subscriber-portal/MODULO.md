# `subscriber-portal` — Portal do anunciante

| Campo | Valor |
|-------|-------|
| **Slug** | `subscriber-portal` |
| **Modos** | Lite/Pro (opcional) |
| **Atores** | owner/admin_sql; publisher_user; subscriber_user |
| **UI** | `Complementos → Portal; /subscriber-login; /subscriber/*` |
| **API** | `/api/installation/portal*; auth /subscriber-login` |
| **Status** | active |
| **Profundidade** | L2 |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Self-service multi-tenant por slug/subdomínio: activação DNS/SSL, seed de agência e subset de UI para anunciante (`/subscriber/*`).

### Dentro do escopo
- GET/PUT `/api/installation/portal`, sync, cloudflare DNS, SSL
- Login portal + dashboard/media do subscriber
- Settings `portal.*` em `system_settings`

### Fora do escopo
- Mudar mode da instalação
- App comercial completa (campanhas/billing) no portal

### Vocabulário
| Termo | Significado |
|-------|-------------|
| portal host | hostname/slug do tenant |
| dnsMode | `off` \| `public_wildcard` \| `local_dnsmasq` |
| dnsProvider | `off` \| `manual` \| `cloudflare` |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-POR-001 | Optional | Portal pode activar-se sem ser o master-switch multi-agency. |
| REQ-POR-002 | Ubiquitous | subscriber_user só acede ao seu tenant. |
| REQ-POR-003 | Unwanted | Portal off ⇒ rotas `/subscriber/*` gated pela capability. |
| REQ-POR-004 | Event-driven | Sync/DNS/SSL actualizam inventário de hosts. |
| REQ-POR-005 | Ubiquitous | Autenticação portal distinta do login admin quando aplicável. |
| REQ-POR-006 | Optional | Seed second agency só para owner/admin_sql. |

---

## 3. Regras de negócio

### RN-POR-001 — Isolamento portal

```text
RN-POR-001 — Isolamento portal
Quando: subscriber_user autentica
Se: sempre
Então: vê só o seu tenant
Excepto: —
Motivo: SaaS multi-tenant
```


### RN-POR-002 — Capability gate

```text
RN-POR-002 — Capability gate
Quando: App.tsx /subscriber/*
Se: caps.subscriberPortal false
Então: rotas inacessíveis
Excepto: —
Motivo: Módulo opcional
```


### RN-POR-003 — DNS/SSL admin

```text
RN-POR-003 — DNS/SSL admin
Quando: cloudflare/ssl endpoints
Se: role insuficiente
Então: negado
Excepto: —
Motivo: Ops infra
```


### RN-POR-004 — Settings portal.*

```text
RN-POR-004 — Settings portal.*
Quando: PUT portal
Se: sempre
Então: persistir em system_settings
Excepto: —
Motivo: Sem tabela portal_*
```


### RN-POR-005 — Subset funcional

```text
RN-POR-005 — Subset funcional
Quando: portal UI
Se: sempre
Então: dashboard/media — não ERP completo
Excepto: —
Motivo: Produto
```


---

## 4. Fluxos

```mermaid
flowchart TD
  A[SystemModules Portal] --> B[PUT /installation/portal]
  B --> C[DNS / SSL / sync]
  C --> D[Host detect]
  D --> E[/subscriber-login]
  E --> F[Dashboard / Media]
```

---

## 5. Estados

| Campo | Valores |
|-------|---------|
| module `subscriber_portal` | on / off |
| dnsMode | `off`, `public_wildcard`, `local_dnsmasq` |
| dnsProvider | `off`, `manual`, `cloudflare` |

---

## 6. Critérios de aceite

### AC-POR-001 (P0)

```text
DADO portal on
QUANDO login subscriber A
ENTÃO não acede dados de B
```


### AC-POR-002 (P0)

```text
DADO subscriber_portal off
QUANDO navegar /subscriber/dashboard
ENTÃO bloqueado/oculto
```


### AC-POR-003 (P0)

```text
DADO operator sem privilégio
QUANDO PUT portal DNS cloudflare
ENTÃO negado
```


---

## 7. Dependências e referências

### Módulos
- [`subscribers`](../subscribers/MODULO.md), [`organization`](../organization/MODULO.md), [`system-modules`](../system-modules/MODULO.md), [`auth-security`](../auth-security/MODULO.md)

### Código de referência
- `backend/src/routes/installationModules.ts` (portal*)
- `backend/src/services/portalHostService.ts`, `portalDnsCloudflareService.ts`, `portalSslService.ts`
- `frontend/src/pages/Settings/SystemModules.tsx`
- `frontend/src/pages/SubscriberLogin/`, `SubscriberDashboard/`

### Lacunas conhecidas
- Sem `CREATE TABLE portal_*`; hosts derivados + settings.
- Portal FE é subset (dashboard/media), não app completa.
