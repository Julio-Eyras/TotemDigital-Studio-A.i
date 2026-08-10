# Lacunas — plano aplicado (TotemDigital-Lacunas-MA)

**Data:** 2026-08-09  
**Branch:** `TotemDigital-Lacunas-MA`  
**Repo:** `Julio-Eyras/TotemDigital-Studio`

## Corrigido (P0/P1)

| Item | Mudança |
|------|---------|
| Direct dual-source | `isDirectTotemMode()` segue capabilities; warm no boot |
| HB `executed` | passa a `completed` via `markCommandAsCompleted` |
| Media GET Direct | `getMediaScopeIds` aceita só `publisher_id` |
| Status `published` | removido dos filtros (schema só tem `approved`…) |
| Menus órfãos | removidos `/totems/status|config`, `/campaigns/stats`, etc. |
| `/plans` | redirect → `/plan-publisher-access` |
| AI generate | FE → `/ai/process`; BE alias `/generate` |

## Adiado (FEATURE_DEFERRED → versão futura)

| Feature | Comportamento |
|---------|----------------|
| `tags_crud` | API 501; menu oculto |
| `notifications` | API 501 |
| `facial_recognition` | API 501 |
| `qr_code_scans` | histórico vazio + metadados deferred |
| `ai_request_history` | GET `/ai/requests` e `/ai/stats` → 501 |
| PublishBoardStudio | `@deprecated`; canónico = quick-publish create |
| Tags UI | `/tags` redirect home; menu oculto |

Código: `backend/src/policy/deferredFeatures.ts`, `frontend/src/config/deferredFeatures.ts`.  
Índice vivo: `docs/modulos/00-INDICE.md` § candidatos.
