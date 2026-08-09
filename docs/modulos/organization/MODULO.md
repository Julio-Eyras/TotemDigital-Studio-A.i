# `organization` — Organização (publishers)

| Campo | Valor |
|-------|-------|
| **Slug** | `organization` |
| **Modos** | all |
| **Atores** | owner/admin, comercial, publisher_user |
| **UI** | `/publishers` |
| **API** | `/api/publishers` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Cadastro da organização dona dos ecrãs. No Direct: uma org; no multi: N orgs.

### Dentro do escopo
- CRUD publisher
- Dados cadastrais

### Fora do escopo
- Totens sem local

### Vocabulário
| Termo | Significado |
|-------|-------------|
| publisher | organização |
| single_publisher | modo Direct |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-ORG-001 | State-driven | No Direct a operação assume uma organização principal. |
| REQ-ORG-002 | Ubiquitous | Toda org multi deve poder possuir locais. |

---

## 3. Regras de negócio

### RN-ORG-001 — Inventário sob org

```text
RN-ORG-001 — Inventário sob org
Quando: Criar local/totem
Se: sempre
Então: local pertence a publisher
Excepto: —
Motivo: Cadeia publisher→locals→totems
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Publisher --> Locals --> Totems
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| active | operacional | → inactive |

---

## 6. Critérios de aceite

### AC-ORG-001 (P0)

```text
DADO Direct
QUANDO listar organizações na operação diária
ENTÃO fluxo cabe em Sua organização / publishers
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`locals`](../locals/MODULO.md)
- [`totems`](../totems/MODULO.md)

### Referências
- `docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md`
