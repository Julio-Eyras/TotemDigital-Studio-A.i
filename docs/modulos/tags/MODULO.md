# `tags` — Tags

| Campo | Valor |
|-------|-------|
| **Slug** | `tags` |
| **Modos** | all (menu típico Lite/Pro) |
| **Atores** | admin |
| **UI** | `/tags` |
| **API** | `/api/tags` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Etiquetas para organização de entidades/conteúdo.

### Dentro do escopo
- CRUD tags
- Associação

### Fora do escopo
- ACL

### Vocabulário
| Termo | Significado |
|-------|-------------|
| tag | rótulo |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-TAG-001 | Ubiquitous | Tags devem ser reutilizáveis entre entidades suportadas. |

---

## 3. Regras de negócio

### RN-TAG-001 — Opcional

```text
RN-TAG-001 — Opcional
Quando: publicar sem tags
Se: sempre
Então: permitido
Excepto: —
Motivo: Não bloquear operação
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Tag --> Entidade
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| active | usável | → archived |

---

## 6. Critérios de aceite

### AC-TAG-001 (P0)

```text
DADO criar tag
QUANDO associar a mídia
ENTÃO mídia lista a tag
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`media-library`](../media-library/MODULO.md)

### Referências
- —
