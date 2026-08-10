# Lacunas — plano aplicado (TotemDigital-Lacunas-MA)

**Data:** 2026-08-10  
**Branch:** `TotemDigital-Lacunas-MA`  
**Repo:** `Julio-Eyras/TotemDigital-Studio`  
**PR:** https://github.com/Julio-Eyras/TotemDigital-Studio/pull/1

## Corrigido (P0/P1) — onda 1

| Item | Mudança |
|------|---------|
| Direct dual-source | `isDirectTotemMode()` segue capabilities; warm no boot |
| HB `executed` | passa a `completed` via `markCommandAsCompleted` |
| Media GET Direct | `getMediaScopeIds` aceita só `publisher_id` |
| Status `published` | removido dos filtros (schema só tem `approved`…) |
| Menus órfãos (1ª) | `/campaigns/stats`, `/totems/status|config`, etc. |
| `/plans` | redirect → `/plan-publisher-access` |
| AI generate | FE → `/ai/process`; BE alias `/generate` |

## Corrigido — onda 2 (2026-08-10)

| Item | Mudança |
|------|---------|
| Menus órfãos (2ª) | removidos smart-tvs/config|by-totem, players/status, plan…/new|expired, path `/admin` |
| Dual mount API | publish-board/templates/menu-catalog só em `registerCompactRoutes` |
| Smart playlist | dual-read `subscriberId \|\| clientId`; FE envia ambos |
| Joi legado | ficheiros `validation/*.ts` marcados `@deprecated` |
| users.role vs user_roles | RN documental (coluna JWT vs N:M) |

## Adiado (FEATURE_DEFERRED → versão futura)

| Feature | Comportamento |
|---------|----------------|
| `tags_crud` | API 501; menu oculto; `/tags` → home |
| `notifications` | API 501 |
| `facial_recognition` | API 501 |
| `qr_code_scans` | histórico vazio + metadados deferred |
| `ai_request_history` | GET `/ai/requests` e `/ai/stats` → 501 |
| `system_backups` | API `/api/backups` → 501 até UI ops |
| PublishBoardStudio | `@deprecated`; canónico = quick-publish create |

Código: `backend/src/policy/deferredFeatures.ts`, `frontend/src/config/deferredFeatures.ts`.  
Índice: `docs/modulos/00-INDICE.md` · Deploy TESTE: `docs/DEPLOY-LACUNAS-TESTE.md`.
