# `users-access` — Usuários e acessos

| Campo | Valor |
|-------|-------|
| **Slug** | `users-access` |
| **Modos** | all |
| **Atores** | owner_system, admin_sql, admin |
| **UI** | `/users` |
| **API** | `/api/users, /api/roles, /api/permissions` |
| **Status** | active |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
CRUD de utilizadores, roles e flags de menu (flag_smart_*).

### Dentro do escopo
- Criar/editar users
- Roles
- Flags

### Fora do escopo
- Módulos de instalação

### Vocabulário
| Termo | Significado |
|-------|-------------|
| role | papel global |
| flag_smart_* | atalhos/permissões finas |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-USR-001 | Ubiquitous | Todo acesso autenticado deve ter role válida. |

---

## 3. Regras de negócio

### RN-USR-001 — Owner soberano

```text
RN-USR-001 — Owner soberano
Quando: acções de mode/purge
Se: role owner/admin_sql
Então: permitido; demais negado
Excepto: —
Motivo: Governança
```

### RN-USR-002 — Flags ≠ módulos

```text
RN-USR-002 — Flags ≠ módulos
Quando: esconder item de menu
Se: flag off
Então: não desliga API module se módulo on
Excepto: —
Motivo: Separação de conceitos
```

---

## 4. Fluxos

```mermaid
flowchart LR
  Admin --> User --> Role --> Flags --> Menu
```

---

## 5. Estados

| Estado | Significado | Transições típicas |
|--------|-------------|--------------------|
| active | pode autenticar | → disabled |

---

## 6. Critérios de aceite

### AC-USR-001 (P0)

```text
DADO utilizador sem flag técnica
QUANDO menu dispatcher em alguns perfis
ENTÃO item oculto embora módulo on
```

---

## 7. Dependências e referências

### Módulos relacionados
- [`auth-security`](../auth-security/MODULO.md)
- [`system-modules`](../system-modules/MODULO.md)

### Referências
- `docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md`
