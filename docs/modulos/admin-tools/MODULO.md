# `admin-tools` — Admin Tools

| Campo | Valor |
|-------|-------|
| **Slug** | `admin-tools` |
| **Modos** | all (menu típico Lite/Pro/técnico) |
| **Atores** | owner/admin/técnico |
| **UI** | `/admin-tools` |
| **API** | `/api/export-*, /api/advanced-schedules` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Ferramentas administrativas: exports, schedules e utilitários de ops.

### Dentro do escopo
- Exports
- Agendamentos avançados

### Fora do escopo
- Purge comercial (Complementos)

### Vocabulário
| Termo | Significado |
|-------|-------------|
| export | extracção de dados |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-ADM-001 | Ubiquitous | Ferramentas destrutivas exigem role elevada. |

---

## 3. Regras de negócio

### RN-ADM-001 — Auditoria

```text
RN-ADM-001 — Auditoria
Quando: export sensível
Se: sempre
Então: registar quem executou quando possível
Excepto: —
Motivo: Compliance
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Admin --> Tool --> Resultado
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| idle | — | → running/completed/failed |

---

## 6. Critérios de aceite

### AC-ADM-001 (P0)

```text
DADO role insuficiente
QUANDO abrir tool sensível
ENTÃO negado
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`users-access`](../users-access/MODULO.md)
- [`dispatcher`](../dispatcher/MODULO.md)

### Referências
- —
