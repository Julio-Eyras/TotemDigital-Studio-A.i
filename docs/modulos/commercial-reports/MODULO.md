# `commercial-reports` — Relatórios comerciais

| Campo | Valor |
|-------|-------|
| **Slug** | `commercial-reports` |
| **Modos** | Pro |
| **Atores** | admin, comercial, faturamento |
| **UI** | `/reports` |
| **API** | `/api/reports` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Relatórios e visão comercial avançada da rede/anunciantes.

### Dentro do escopo
- Geração e download de relatórios

### Fora do escopo
- Telemetria técnica de player

### Vocabulário
| Termo | Significado |
|-------|-------------|
| report | artefacto gerado |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-REP-001 | State-driven | Disponível só com commercial_reports on (Pro). |

---

## 3. Regras de negócio

### RN-REP-001 — Escopo

```text
RN-REP-001 — Escopo
Quando: gerar relatório
Se: role limitado
Então: só dados autorizados
Excepto: —
Motivo: Privacidade/ACL
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Pedido --> Geracao --> Download
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| pending | fila | → generating/completed/failed |

---

## 6. Critérios de aceite

### AC-REP-001 (P0)

```text
DADO mode lite
QUANDO abrir /reports via API module gate
ENTÃO 403 ou item oculto
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`billing`](../billing/MODULO.md)
- [`campaigns`](../campaigns/MODULO.md)
- [`subscribers`](../subscribers/MODULO.md)

### Referências
- —
