# `publish-templates` — Templates de publicação

| Campo | Valor |
|-------|-------|
| **Slug** | `publish-templates` |
| **Modos** | Lite, Pro |
| **Atores** | owner_system, admin_sql, admin |
| **UI** | `/publish-templates-admin` |
| **API** | `/api/publish-templates` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Administração de templates/presets usados no quick-publish/board.

### Dentro do escopo
- CRUD templates

### Fora do escopo
- Conteúdo final do anunciante

### Vocabulário
| Termo | Significado |
|-------|-------------|
| template | definição reutilizável de publicação |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-PT-001 | Ubiquitous | Templates activos devem ser listáveis pelos editores autorizados. |

---

## 3. Regras de negócio

### RN-PT-001 — Inactivo oculto

```text
RN-PT-001 — Inactivo oculto
Quando: template is_active=false
Se: listar para criação
Então: omitir
Excepto: —
Motivo: Controlo editorial
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Admin --> Template --> QuickPublish
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| active | disponível | → inactive |

---

## 6. Critérios de aceite

### AC-PT-001 (P0)

```text
DADO template inactivo
QUANDO abrir criação
ENTÃO template não aparece
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`quick-publish`](../quick-publish/MODULO.md)
- [`publish-board`](../publish-board/MODULO.md)

### Referências
- —
