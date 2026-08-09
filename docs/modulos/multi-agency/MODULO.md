# `multi-agency` — Multi-agência

| Campo | Valor |
|-------|-------|
| **Slug** | `multi-agency` |
| **Modos** | Lite, Pro |
| **Atores** | owner/admin, comercial, publisher_user |
| **UI** | `/publishers (N orgs)` |
| **API** | `/api/publishers, perfil multi_agency` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Capacidade de várias organizações na mesma instalação; base do Lite/Pro.

### Dentro do escopo
- N publishers
- Isolamento por org

### Fora do escopo
- Direct single_publisher UX

### Vocabulário
| Termo | Significado |
|-------|-------------|
| multi_agency | módulo/perfil |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-MA-001 | State-driven | Enquanto mode lite|full, multi_agency deve estar on. |

---

## 3. Regras de negócio

### RN-MA-001 — Isolamento

```text
RN-MA-001 — Isolamento
Quando: listagens
Se: utilizador de org A
Então: não vê dados de org B sem ACL
Excepto: —
Motivo: Multi-tenant
```

---

## 4. Fluxos

```mermaid
flowchart LR
  ModeLitePro --> MultiAgency --> Orgs
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| on | activo | → off com mode=off |

---

## 6. Critérios de aceite

### AC-MA-001 (P0)

```text
DADO duas orgs
QUANDO admin lista publishers
ENTÃO ambas visíveis; publisher_user só a sua
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`product-modes`](../product-modes/MODULO.md)
- [`organization`](../organization/MODULO.md)

### Referências
- `docs/HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md`
