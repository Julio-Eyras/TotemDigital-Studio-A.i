# `settings` — Configurações

| Campo | Valor |
|-------|-------|
| **Slug** | `settings` |
| **Modos** | all |
| **Atores** | owner/admin/operator; subset publisher/subscriber |
| **UI** | `/settings` |
| **API** | `/api/settings, /api/logs, /api/player-apk` |
| **Status** | active |
| **Profundidade** | L2 |
| **Última revisão** | 2026-08-09 |

---

## 1. Visão e escopo

### Propósito
Definições gerais da instalação (CRUD `system_settings`), logs, aba APK, segurança (2FA/senha) e Financeiro só fora do Direct.

### Dentro do escopo
- `/api/settings` (public, reset, validate, export/import, categories, media/apply)
- Logs rotation/disk
- Abas UI: Geral, APK, Financeiro*, Logs, Mídias, Dispatcher, 2FA, Senha
- Complementos em página própria (`system-modules`)

### Fora do escopo
- Master-switch multi-agency (system-modules)
- Compilar APK

### Vocabulário
| Termo | Significado |
|-------|-------------|
| system_settings | KV tipado (`string`/`number`/`boolean`/`json`/`array`) |
| is_public / is_editable | exposição e mutabilidade |

---

## 2. Requisitos (EARS)

| ID | Tipo | Requisito |
|----|------|-----------|
| REQ-SET-001 | Ubiquitous | Settings deve expor aba APK após Geral. |
| REQ-SET-002 | State-driven | Aba Financeiro oculta em Direct. |
| REQ-SET-003 | Unwanted | Settings não editáveis (`is_editable=false`) não devem ser alterados via UI comum. |
| REQ-SET-004 | Event-driven | Reset de key restaura default seed quando aplicável. |
| REQ-SET-005 | Ubiquitous | Export/import preserva categorias válidas. |
| REQ-SET-006 | Optional | media/apply propaga config de mídia. |

---

## 3. Regras de negócio

### RN-SET-001 — APK por papel

```text
RN-SET-001 — APK por papel
Quando: download APK
Se: role não autorizada
Então: bloqueado
Excepto: —
Motivo: Distribuição
```


### RN-SET-002 — Financeiro Pro

```text
RN-SET-002 — Financeiro Pro
Quando: mode off
Se: Settings
Então: sem Financeiro
Excepto: —
Motivo: Preset
```


### RN-SET-003 — Public subset

```text
RN-SET-003 — Public subset
Quando: GET /settings/public
Se: sempre
Então: só is_public
Excepto: —
Motivo: Não vazar secrets
```


### RN-SET-004 — Validate

```text
RN-SET-004 — Validate
Quando: PUT inválido
Se: tipo/valor fora da regra
Então: rejeitar
Excepto: —
Motivo: Integridade
```


### RN-SET-005 — Logs ops

```text
RN-SET-005 — Logs ops
Quando: rotate/reload
Se: role elevada
Então: permitido
Excepto: —
Motivo: Ops
```


---

## 4. Fluxos

```mermaid
flowchart TD
  A[/settings] --> B[Geral]
  A --> C[APK]
  A --> D[Logs]
  A --> E[2FA / Senha]
  A --> F{Direct?}
  F -->|Não| G[Financeiro]
  F -->|Sim| H[oculto]
```

---

## 5. Estados

| Campo | Valores |
|-------|---------|
| setting_type | string, number, boolean, json, array |
| flags | `is_public`, `is_editable`, `is_active` |

---

## 6. Critérios de aceite

### AC-SET-001 (P0)

```text
DADO mode off
QUANDO abrir Settings
ENTÃO há APK; não há Financeiro
```


### AC-SET-002 (P0)

```text
DADO setting is_editable=false
QUANDO tentar PUT via UI comum
ENTÃO bloqueado
```


### AC-SET-003 (P0)

```text
DADO anónimo
QUANDO GET settings sensível
ENTÃO 401 ou só /public
```


---

## 7. Dependências e referências

### Módulos
- [`player-apk-settings`](../player-apk-settings/MODULO.md), [`auth-security`](../auth-security/MODULO.md), [`billing`](../billing/MODULO.md), [`system-modules`](../system-modules/MODULO.md)

### Código de referência
- `backend/src/routes/settings.ts`, `logs.ts`
- `backend/src/services/settingsService.ts`
- `frontend/src/pages/Settings/Settings.tsx`
- `database/seeds-default-settings.sql`; schema part2 `system_settings`

### Lacunas conhecidas
- Complementos (portal/purge/mode) vivem em `/settings/system-modules`, não nesta página.
