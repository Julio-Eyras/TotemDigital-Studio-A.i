# `contracts` — Contratos

| Campo | Valor |
|-------|-------|
| **Slug** | `contracts` |
| **Modos** | Pro |
| **Atores** | admin, faturamento, comercial |
| **UI** | `/subscriber-contracts, /publisher-contracts, /contracts/*` |
| **API** | `/api/contracts` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Contratos de anunciantes/organizações; no Pro amarram campanhas ao plan_id.

### Dentro do escopo
- CRUD contrato
- Vínculo plan_id
- Vigência

### Fora do escopo
- Obrigatório no Lite

### Vocabulário
| Termo | Significado |
|-------|-------------|
| contrato activo | dentro da vigência e status válido |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-CTR-001 | State-driven | Campanhas Pro executáveis devem estar ligadas a contrato activo com plano. |

---

## 3. Regras de negócio

### RN-CTR-001 — Sem contrato

```text
RN-CTR-001 — Sem contrato
Quando: campanha Pro
Se: contrato ausente/expirado
Então: não despacha
Excepto: —
Motivo: Modelo Pro
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Subscriber --> Contrato --> Plano --> Rede
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| draft | rascunho | → active |
| active | vigente | → expired/cancelled |

---

## 6. Critérios de aceite

### AC-CTR-001 (P0)

```text
DADO contrato expirado
QUANDO dispatch de campanha Pro
ENTÃO itens não entram
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`plans`](../plans/MODULO.md)
- [`subscribers`](../subscribers/MODULO.md)
- [`campaigns`](../campaigns/MODULO.md)
- [`billing`](../billing/MODULO.md)

### Referências
- —
