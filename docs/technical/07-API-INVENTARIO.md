# Inventário da API TotemDigital Studio

**Gerado:** 2026-08-23 · Backend **2.1.16** · branch `main`
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções

Fonte: routers em `backend/src/routes/` montados em `registerCompactRoutes.ts`, `registerExtendedApiRoutes.ts` e `index.ts`.

OpenAPI gerado: [`openapi.json`](./openapi.json) · regenerar: `python scripts/generate-openapi-from-routes.py`

Swagger UI (só desenvolvimento): `/api-docs`

## Resumo

| Métrica | Valor |
|---------|-------|
| Operações (método+path) | **578** |
| Paths OpenAPI | **444** |
| Tags | **40** |
| Já com detalhe (enhanced + P0) | 42 |
| Só stub gerado | 536 |

> Catálogo completo das rotas montadas. Schemas ricos: `swagger-enhanced.ts` (PlaylistMix/publishers) + `openapi-p0.json` (integração).

## Por domínio

### AI (13)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| POST | `/ai/analyze-audience` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/analyze-campaign` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/chat` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/generate` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/generate-report` | `analytics` | JWT (router) | `ai` |
| GET | `/ai/models` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/optimize-content` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/process` | `analytics` | JWT (router) | `ai` |
| GET | `/ai/requests` | `analytics` | JWT (router) | `ai` |
| GET | `/ai/stats` | `analytics` | JWT (router) | `ai` |
| GET | `/ai/status` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/suggestions` | `analytics` | JWT (router) | `ai` |
| POST | `/ai/test` | `analytics` | JWT (router) | `ai` |

### Alerts (4)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/alerts` | `—` | JWT (router) | `alerts` |
| POST | `/alerts/check` | `—` | JWT (router) | `alerts` |
| POST | `/alerts/process-contract-audits` | `—` | JWT (router) | `alerts` |
| POST | `/alerts/{id}/acknowledge` | `—` | JWT (router) | `alerts` |

### Analytics (11)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/analytics/alerts` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/campaigns/{campaignId}` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/clients/{clientId}` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/dashboard` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/export` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/overview` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/performance` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/report` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/revenue` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/totems/{totemId}` | `analytics` | JWT (router) | `analytics` |
| GET | `/analytics/trends` | `analytics` | JWT (router) | `analytics` |

### Auth (17)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| POST | `/auth/2fa/disable` | `—` | JWT (router) | `auth` |
| POST | `/auth/2fa/enable` | `—` | JWT (router) | `auth` |
| POST | `/auth/2fa/regenerate-backup-codes` | `—` | JWT (router) | `auth` |
| POST | `/auth/2fa/setup` | `—` | JWT (router) | `auth` |
| GET | `/auth/2fa/status` | `—` | JWT (router) | `auth` |
| POST | `/auth/2fa/verify` | `—` | JWT (router) | `auth` |
| POST | `/auth/change-password` | `—` | JWT (router) | `auth` |
| GET | `/auth/default-credentials` | `—` | JWT (router) | `auth` |
| POST | `/auth/forgot-password` | `—` | JWT (router) | `auth` |
| POST | `/auth/login` | `—` | público | `auth` |
| POST | `/auth/logout` | `—` | JWT (router) | `auth` |
| GET | `/auth/me` | `—` | JWT (router) | `auth` |
| POST | `/auth/refresh` | `—` | público | `auth` |
| POST | `/auth/register` | `—` | JWT (router) | `auth` |
| POST | `/auth/reset-password` | `—` | JWT (router) | `auth` |
| POST | `/auth/subscriber-login` | `—` | JWT (router) | `auth` |
| POST | `/auth/verify-abandon-pin` | `—` | JWT (router) | `auth` |

### Backups (3)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/backups` | `—` | JWT (router) | `backups` |
| POST | `/backups/create` | `—` | JWT (router) | `backups` |
| POST | `/backups/{id}/restore` | `—` | JWT (router) | `backups` |

### Billing (46)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/billing` | `billing` | JWT (mount) | `billing` |
| POST | `/billing` | `billing` | JWT (mount) | `billing` |
| GET | `/billing-control/dashboard` | `billing` | JWT (mount) | `billing-control` |
| GET | `/billing/client/{clientId}` | `billing` | JWT (mount) | `billing` |
| GET | `/billing/export` | `billing` | JWT (mount) | `billing` |
| POST | `/billing/mark-overdue` | `billing` | JWT (mount) | `billing` |
| GET | `/billing/overdue` | `billing` | JWT (mount) | `billing` |
| GET | `/billing/stats` | `billing` | JWT (mount) | `billing` |
| DELETE | `/billing/{id}` | `billing` | JWT (mount) | `billing` |
| GET | `/billing/{id}` | `billing` | JWT (mount) | `billing` |
| PUT | `/billing/{id}` | `billing` | JWT (mount) | `billing` |
| POST | `/billing/{id}/cancel` | `billing` | JWT (mount) | `billing` |
| POST | `/billing/{id}/payment` | `billing` | JWT (mount) | `billing` |
| GET | `/billing/{id}/payments` | `billing` | JWT (mount) | `billing` |
| POST | `/financial-admin/issue-invoices` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/issue-revenue-share-payouts` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/pix-webhook` | `—` | JWT (router) | `financial-pix-webhook` |
| GET | `/financial-admin/publisher-billing/{id}/payment-qr` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/publisher-billing/{id}/record-payment` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/publisher-billing/{id}/send-payment-email` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/publisher-billing/{id}/stripe-checkout` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/stripe/complete-session` | `billing` | JWT (mount) | `financial-admin` |
| GET | `/financial-admin/subscriber-billing/{id}/payment-qr` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/subscriber-billing/{id}/record-payment` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/subscriber-billing/{id}/send-payment-email` | `billing` | JWT (mount) | `financial-admin` |
| POST | `/financial-admin/subscriber-billing/{id}/stripe-checkout` | `billing` | JWT (mount) | `financial-admin` |
| GET | `/publisher-billing` | `billing` | JWT (mount) | `publisher-billing` |
| POST | `/publisher-billing` | `billing` | JWT (mount) | `publisher-billing` |
| GET | `/publisher-billing/stats` | `billing` | JWT (mount) | `publisher-billing` |
| GET | `/publisher-billing/{id}` | `billing` | JWT (mount) | `publisher-billing` |
| PUT | `/publisher-billing/{id}` | `billing` | JWT (mount) | `publisher-billing` |
| POST | `/publisher-billing/{id}/approve-payout` | `billing` | JWT (mount) | `publisher-billing` |
| GET | `/subscriber-billing` | `billing` | JWT (mount) | `subscriber-billing` |
| POST | `/subscriber-billing` | `billing` | JWT (mount) | `subscriber-billing` |
| GET | `/subscriber-billing/stats` | `billing` | JWT (mount) | `subscriber-billing` |
| GET | `/subscriber-billing/{id}` | `billing` | JWT (mount) | `subscriber-billing` |
| PUT | `/subscriber-billing/{id}` | `billing` | JWT (mount) | `subscriber-billing` |
| GET | `/subscriptions` | `billing` | JWT (router) | `subscriptions` |
| POST | `/subscriptions` | `billing` | JWT (router) | `subscriptions` |
| POST | `/subscriptions/checkout` | `billing` | JWT (router) | `subscriptions` |
| GET | `/subscriptions/my-subscription` | `billing` | JWT (router) | `subscriptions` |
| POST | `/subscriptions/webhook` | `billing` | JWT (router) | `subscriptions` |
| GET | `/subscriptions/{id}` | `billing` | JWT (router) | `subscriptions` |
| PUT | `/subscriptions/{id}` | `billing` | JWT (router) | `subscriptions` |
| POST | `/subscriptions/{id}/cancel` | `billing` | JWT (router) | `subscriptions` |
| POST | `/subscriptions/{id}/resume` | `billing` | JWT (router) | `subscriptions` |

### Campaigns (16)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/campaigns` | `campaigns` | JWT (router) | `campaigns` |
| POST | `/campaigns` | `campaigns` | JWT (router) | `campaigns` |
| GET | `/campaigns/client/{clientId}` | `campaigns` | JWT (router) | `campaigns` |
| GET | `/campaigns/stats` | `campaigns` | JWT (router) | `campaigns` |
| GET | `/campaigns/totem/{totemId}` | `campaigns` | JWT (router) | `campaigns` |
| DELETE | `/campaigns/{id}` | `campaigns` | JWT (router) | `campaigns` |
| GET | `/campaigns/{id}` | `campaigns` | JWT (router) | `campaigns` |
| PUT | `/campaigns/{id}` | `campaigns` | JWT (router) | `campaigns` |
| POST | `/campaigns/{id}/activate` | `campaigns` | JWT (router) | `campaigns` |
| POST | `/campaigns/{id}/finish` | `campaigns` | JWT (router) | `campaigns` |
| PUT | `/campaigns/{id}/medias/reorder` | `campaigns` | JWT (router) | `campaigns` |
| POST | `/campaigns/{id}/pause` | `campaigns` | JWT (router) | `campaigns` |
| PUT | `/campaigns/{id}/playlists/reorder` | `campaigns` | JWT (router) | `campaigns` |
| GET | `/campaigns/{id}/totems` | `campaigns` | JWT (router) | `campaigns` |
| POST | `/campaigns/{id}/totems` | `campaigns` | JWT (router) | `campaigns` |
| DELETE | `/campaigns/{id}/totems/{totemId}` | `campaigns` | JWT (router) | `campaigns` |

### Contracts (12)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/contracts` | `contracts` | JWT (router) | `contracts` |
| POST | `/contracts` | `contracts` | JWT (router) | `contracts` |
| GET | `/contracts/publisher-contracts` | `contracts` | JWT (router) | `contracts` |
| POST | `/contracts/publisher-contracts` | `contracts` | JWT (router) | `contracts` |
| DELETE | `/contracts/publisher-contracts/{id}` | `contracts` | JWT (router) | `contracts` |
| GET | `/contracts/publisher-contracts/{id}` | `contracts` | JWT (router) | `contracts` |
| PUT | `/contracts/publisher-contracts/{id}` | `contracts` | JWT (router) | `contracts` |
| GET | `/contracts/publishers/{id}/contracts` | `contracts` | JWT (router) | `contracts` |
| DELETE | `/contracts/{id}(\\d+)` | `contracts` | JWT (router) | `contracts` |
| GET | `/contracts/{id}(\\d+)` | `contracts` | JWT (router) | `contracts` |
| PUT | `/contracts/{id}(\\d+)` | `contracts` | JWT (router) | `contracts` |
| GET | `/contracts/{id}(\\d+)/publishers` | `contracts` | JWT (router) | `contracts` |

### Dashboard (11)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/dashboard-layouts` | `—` | JWT (router) | `dashboard-layouts` |
| POST | `/dashboard-layouts` | `—` | JWT (router) | `dashboard-layouts` |
| GET | `/dashboard-layouts/default` | `—` | JWT (router) | `dashboard-layouts` |
| DELETE | `/dashboard-layouts/{id}` | `—` | JWT (router) | `dashboard-layouts` |
| GET | `/dashboard-layouts/{id}` | `—` | JWT (router) | `dashboard-layouts` |
| PUT | `/dashboard-layouts/{id}` | `—` | JWT (router) | `dashboard-layouts` |
| GET | `/dashboard/activities` | `—` | JWT (router) | `dashboard` |
| GET | `/dashboard/charts` | `—` | JWT (router) | `dashboard` |
| GET | `/dashboard/client/{clientId}/stats` | `—` | JWT (router) | `dashboard` |
| GET | `/dashboard/stats` | `—` | JWT (router) | `dashboard` |
| GET | `/dashboard/ui-context` | `—` | público | `dashboard` |

### Debug (4)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/debug/player-registration-logs` | `—` | JWT (router) | `debug` |
| GET | `/debug/system-info` | `—` | JWT (router) | `debug` |
| GET | `/debug/totem/{id}` | `—` | JWT (router) | `debug` |

### Deferred (3)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| POST | `/facial-recognition/match` | `—` | JWT (router) | `facial-recognition` |
| GET | `/facial-recognition/persons` | `—` | JWT (router) | `facial-recognition` |
| POST | `/facial-recognition/persons` | `—` | JWT (router) | `facial-recognition` |

### Devices (6)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/smart-tvs` | `devices` | JWT (router) | `smart-tvs` |
| POST | `/smart-tvs` | `devices` | JWT (router) | `smart-tvs` |
| GET | `/smart-tvs/totem/{totemId}` | `devices` | JWT (router) | `smart-tvs` |
| DELETE | `/smart-tvs/{id}` | `devices` | JWT (router) | `smart-tvs` |
| GET | `/smart-tvs/{id}` | `devices` | JWT (router) | `smart-tvs` |
| PUT | `/smart-tvs/{id}` | `devices` | JWT (router) | `smart-tvs` |

### Dispatcher (19)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/advanced-schedules` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| POST | `/advanced-schedules` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| DELETE | `/advanced-schedules/{id}` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| GET | `/advanced-schedules/{id}` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| PUT | `/advanced-schedules/{id}` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| POST | `/advanced-schedules/{id}/validate` | `dispatcher_admin` | JWT (router) | `advanced-schedules` |
| POST | `/dispatcher-debug/clear` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-debug/logs` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-debug/messages` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-debug/queries` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-debug/redis-status` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-debug/stats` | `dispatcher_admin` | JWT (router) | `dispatcher-debug` |
| GET | `/dispatcher-totem/cache/config` | `—` | JWT (router) | `dispatcher-totem` |
| POST | `/dispatcher-totem/cache/config` | `—` | JWT (router) | `dispatcher-totem` |
| GET | `/dispatcher-totem/{totemId}/candidates` | `—` | JWT (router) | `dispatcher-totem` |
| GET | `/dispatcher-totem/{totemId}/diagnostics` | `—` | JWT (router) | `dispatcher-totem` |
| GET | `/dispatcher-totem/{totemId}/dispatch` | `—` | JWT (router) | `dispatcher-totem` |
| POST | `/dispatcher-totem/{totemId}/dispatch-batch` | `—` | JWT (router) | `dispatcher-totem` |
| GET | `/dispatcher-totem/{totemId}/history` | `—` | JWT (router) | `dispatcher-totem` |

### Email (2)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/email/status` | `—` | JWT (router) | `email` |
| POST | `/email/test` | `—` | JWT (router) | `email` |

### Exports (17)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/export-executions` | `dispatcher_admin` | JWT (router) | `export-executions` |
| GET | `/export-executions/{id}` | `dispatcher_admin` | JWT (router) | `export-executions` |
| GET | `/export-executions/{id}/download` | `dispatcher_admin` | JWT (router) | `export-executions` |
| GET | `/export-queries` | `dispatcher_admin` | JWT (router) | `export-queries` |
| POST | `/export-queries` | `dispatcher_admin` | JWT (router) | `export-queries` |
| POST | `/export-queries/validate-sql` | `dispatcher_admin` | JWT (router) | `export-queries` |
| DELETE | `/export-queries/{id}` | `dispatcher_admin` | JWT (router) | `export-queries` |
| GET | `/export-queries/{id}` | `dispatcher_admin` | JWT (router) | `export-queries` |
| PUT | `/export-queries/{id}` | `dispatcher_admin` | JWT (router) | `export-queries` |
| POST | `/export-queries/{id}/test-connection` | `dispatcher_admin` | JWT (router) | `export-queries` |
| GET | `/export-schedules` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| POST | `/export-schedules` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| POST | `/export-schedules/validate-cron` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| DELETE | `/export-schedules/{id}` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| GET | `/export-schedules/{id}` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| PUT | `/export-schedules/{id}` | `dispatcher_admin` | JWT (router) | `export-schedules` |
| POST | `/export-schedules/{id}/execute-now` | `dispatcher_admin` | JWT (router) | `export-schedules` |

### Health (2)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/health/check` | `—` | público | `health` |
| GET | `/health/quick` | `—` | público | `health` |

### Installation (14)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| POST | `/installation/commercial-purge` | `—` | JWT (router) | `installationModules` |
| GET | `/installation/commercial-purge/last` | `—` | JWT (router) | `installationModules` |
| POST | `/installation/commercial-purge/preview` | `—` | JWT (router) | `installationModules` |
| GET | `/installation/commercial-purge/schedule` | `—` | JWT (router) | `installationModules` |
| PUT | `/installation/commercial-purge/schedule` | `—` | JWT (router) | `installationModules` |
| GET | `/installation/modules` | `—` | JWT (router) | `installationModules` |
| PUT | `/installation/modules` | `—` | JWT (router) | `installationModules` |
| PUT | `/installation/multi-agency` | `—` | JWT (router) | `installationModules` |
| GET | `/installation/portal` | `—` | JWT (router) | `installationModules` |
| PUT | `/installation/portal` | `—` | JWT (router) | `installationModules` |
| POST | `/installation/portal/dns/cloudflare` | `—` | JWT (router) | `installationModules` |
| POST | `/installation/portal/seed-second-agency` | `—` | JWT (router) | `installationModules` |
| POST | `/installation/portal/ssl/issue` | `—` | JWT (router) | `installationModules` |
| POST | `/installation/portal/sync` | `—` | JWT (router) | `installationModules` |

### Lab (4)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/lab/ace/audit/{totemId}` | `—` | JWT (router) | `lab-ace` |
| POST | `/lab/ace/context` | `—` | JWT (router) | `lab-ace` |
| GET | `/lab/ace/hint/{totemId}` | `—` | JWT (router) | `lab-ace` |
| POST | `/lab/ace/interaction` | `—` | JWT (router) | `lab-ace` |

### Locals (7)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/locals` | `—` | JWT (mount) | `locals` |
| POST | `/locals` | `—` | JWT (mount) | `locals` |
| GET | `/locals/stats` | `—` | JWT (mount) | `locals` |
| DELETE | `/locals/{id}` | `—` | JWT (mount) | `locals` |
| GET | `/locals/{id}` | `—` | JWT (mount) | `locals` |
| PUT | `/locals/{id}` | `—` | JWT (mount) | `locals` |
| GET | `/locals/{id}/totems` | `—` | JWT (mount) | `locals` |

### Logs (7)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/logs/config` | `—` | JWT (router) | `logs` |
| GET | `/logs/disk-space` | `—` | JWT (router) | `logs` |
| GET | `/logs/files` | `—` | JWT (router) | `logs` |
| POST | `/logs/frontend-error` | `—` | JWT (router) | `logs` |
| POST | `/logs/reload` | `—` | JWT (router) | `logs` |
| POST | `/logs/rotate` | `—` | JWT (router) | `logs` |
| GET | `/logs/rotation-status` | `—` | JWT (router) | `logs` |

### Media (14)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/media` | `—` | JWT (router) | `media` |
| GET | `/media/quota/{subscriberId}` | `—` | JWT (router) | `media` |
| GET | `/media/stats/overview` | `—` | JWT (router) | `media` |
| GET | `/media/stats/storage` | `—` | JWT (router) | `media` |
| POST | `/media/upload` | `—` | JWT (router) | `media` |
| POST | `/media/upload-multiple` | `—` | JWT (router) | `media` |
| DELETE | `/media/{id}` | `—` | JWT (router) | `media` |
| GET | `/media/{id}` | `—` | JWT (router) | `media` |
| PUT | `/media/{id}` | `—` | JWT (router) | `media` |
| GET | `/media/{id}/download` | `—` | JWT (router) | `media` |
| POST | `/media/{id}/process` | `—` | JWT (router) | `media` |
| POST | `/media/{id}/reprocess-delivery` | `—` | JWT (router) | `media` |
| GET | `/media/{id}/thumbnail` | `—` | JWT (router) | `media` |
| POST | `/media/{id}/transform` | `—` | JWT (router) | `media` |

### Network (5)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/network/graph` | `—` | JWT (router) | `network` |
| POST | `/network/interactions` | `—` | JWT (router) | `network` |
| GET | `/network/nearby-totems/{totemId}` | `—` | JWT (router) | `network` |
| POST | `/network/related-content` | `—` | JWT (router) | `network` |
| GET | `/network/topology` | `—` | JWT (router) | `network` |

### Notifications (2)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/notifications` | `—` | JWT (router) | `notifications` |
| PUT | `/notifications/{id}/read` | `—` | JWT (router) | `notifications` |

### OTA (8)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/ota-updates` | `ota` | JWT (router) | `ota-updates` |
| POST | `/ota-updates` | `ota` | JWT (router) | `ota-updates` |
| GET | `/ota-updates/stats` | `ota` | JWT (router) | `ota-updates` |
| GET | `/ota-updates/totems` | `ota` | JWT (router) | `ota-updates` |
| POST | `/ota-updates/{id}/activate` | `ota` | JWT (router) | `ota-updates` |
| POST | `/ota-updates/{id}/cancel` | `ota` | JWT (router) | `ota-updates` |
| GET | `/ota-updates/{id}/download` | `ota` | JWT (router) | `ota-updates` |
| POST | `/ota-updates/{id}/pause` | `ota` | JWT (router) | `ota-updates` |

### Plans (8)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/plans` | `plans` | JWT (router) | `plans` |
| POST | `/plans` | `plans` | JWT (router) | `plans` |
| GET | `/plans/all` | `plans` | JWT (router) | `plans` |
| GET | `/plans/slug/{slug}` | `plans` | JWT (router) | `plans` |
| DELETE | `/plans/{id}` | `plans` | JWT (router) | `plans` |
| GET | `/plans/{id}` | `plans` | JWT (router) | `plans` |
| PUT | `/plans/{id}` | `plans` | JWT (router) | `plans` |
| GET | `/plans/{id}/network-topology` | `plans` | JWT (router) | `plans` |

### Player (27)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/player-apk/candidates` | `—` | público | `player-apk` |
| POST | `/player-apk/designate` | `—` | público | `player-apk` |
| GET | `/player-apk/designated` | `—` | público | `player-apk` |
| GET | `/player-apk/documents` | `—` | público | `player-apk` |
| GET | `/player-apk/documents/{slug}` | `—` | público | `player-apk` |
| GET | `/player-apk/download` | `—` | público | `player-apk` |
| POST | `/player-apk/upload` | `—` | público | `player-apk` |
| POST | `/player/command-result` | `—` | público | `player` |
| GET | `/player/config` | `—` | público | `player` |
| POST | `/player/debug/cleanup` | `—` | JWT (mount) | `player-debug` |
| GET | `/player/debug/transactions` | `—` | JWT (mount) | `player-debug` |
| GET | `/player/debug/transactions/{transactionId}` | `—` | JWT (mount) | `player-debug` |
| POST | `/player/decrypt-config` | `—` | público | `player` |
| GET | `/player/dispatch` | `—` | público | `player` |
| POST | `/player/event` | `—` | público | `player` |
| POST | `/player/events/batch` | `—` | público | `player` |
| POST | `/player/exit-kiosk` | `—` | público | `player` |
| GET | `/player/fallback-manifest` | `—` | público | `player` |
| GET | `/player/hardware-info` | `—` | público | `player` |
| POST | `/player/heartbeat` | `—` | público | `player` |
| GET | `/player/ota-download/{id}` | `—` | público | `player` |
| POST | `/player/ota-status` | `—` | público | `player` |
| POST | `/player/register` | `—` | público | `player` |
| POST | `/player/sync` | `—` | público | `player` |
| GET | `/player/token` | `—` | público | `player` |
| GET | `/player/validate` | `—` | público | `player` |

### Players (7)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/players` | `devices` | público | `players` |
| POST | `/players` | `devices` | público | `players` |
| DELETE | `/players/{id}` | `devices` | público | `players` |
| GET | `/players/{id}` | `devices` | público | `players` |
| PUT | `/players/{id}` | `devices` | público | `players` |
| POST | `/players/{id}/playlist` | `devices` | público | `players` |
| GET | `/players/{id}/status` | `devices` | público | `players` |

### PlaylistMix (11)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/playlist-mix/analytics` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| GET | `/playlist-mix/context/{totemId}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| POST | `/playlist-mix/context/{totemId}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| PUT | `/playlist-mix/context/{totemId}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| GET | `/playlist-mix/history` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| GET | `/playlist-mix/overview` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| GET | `/playlist-mix/rules` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| POST | `/playlist-mix/rules` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| DELETE | `/playlist-mix/rules/{id}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| GET | `/playlist-mix/rules/{id}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |
| PUT | `/playlist-mix/rules/{id}` | `dispatcher_admin` | JWT (mount) | `playlist-mix` |

### Playlists (33)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| POST | `/playlist-engine/campaign/{campaignId}/regenerate` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| POST | `/playlist-engine/publisher/{publisherId}/regenerate` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| GET | `/playlist-engine/stats` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| GET | `/playlist-engine/totem-playlists` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| GET | `/playlist-engine/totem/{totemId}` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| POST | `/playlist-engine/totem/{totemId}/regenerate` | `playlists_advanced` | JWT (router) | `playlist-engine` |
| GET | `/playlists` | `playlists_advanced` | JWT (router) | `playlists` |
| POST | `/playlists` | `playlists_advanced` | JWT (router) | `playlists` |
| DELETE | `/playlists/{id}` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/playlists/{id}` | `playlists_advanced` | JWT (router) | `playlists` |
| PUT | `/playlists/{id}` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/playlists/{id}/campaigns` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/playlists/{id}/exposure` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/playlists/{id}/media` | `playlists_advanced` | JWT (router) | `playlists` |
| POST | `/playlists/{id}/media` | `playlists_advanced` | JWT (router) | `playlists` |
| DELETE | `/playlists/{id}/media/{itemId}` | `playlists_advanced` | JWT (router) | `playlists` |
| PATCH | `/playlists/{id}/media/{itemId}` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/playlists/{id}/preview` | `playlists_advanced` | JWT (router) | `playlists` |
| PUT | `/playlists/{id}/reorder` | `playlists_advanced` | JWT (router) | `playlists` |
| GET | `/smart-playlist` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist/bulk-generate` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| GET | `/smart-playlist/campaign/{campaignId}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| GET | `/smart-playlist/client/{clientId}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| GET | `/smart-playlist/stats` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| GET | `/smart-playlist/totem/{totemId}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| DELETE | `/smart-playlist/{id}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| GET | `/smart-playlist/{id}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| PUT | `/smart-playlist/{id}` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist/{id}/activate` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist/{id}/deactivate` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist/{id}/generate` | `playlists_advanced` | JWT (router) | `smart-playlist` |
| POST | `/smart-playlist/{id}/test` | `playlists_advanced` | JWT (router) | `smart-playlist` |

### Publish (9)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/publish-board/public-menu/{subscriberId}` | `—` | JWT (router) | `publish-board-public` |
| GET | `/publish-templates` | `quick_publish` | JWT (mount) | `publish-templates` |
| POST | `/publish-templates` | `quick_publish` | JWT (mount) | `publish-templates` |
| GET | `/publish-templates/featured` | `quick_publish` | JWT (mount) | `publish-templates` |
| GET | `/publish-templates/{templateId}` | `quick_publish` | JWT (mount) | `publish-templates` |
| PATCH | `/publish-templates/{templateId}` | `quick_publish` | JWT (mount) | `publish-templates` |
| POST | `/publish-templates/{templateId}/duplicate` | `quick_publish` | JWT (mount) | `publish-templates` |
| POST | `/quick-publish` | `quick_publish` | JWT (router) | `quick-publish` |
| POST | `/simple-publish` | `—` | JWT (router) | `simple-publish` |

### Publishers (11)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/publishers` | `—` | JWT (mount) | `publishers` |
| POST | `/publishers` | `—` | JWT (mount) | `publishers` |
| DELETE | `/publishers/{id}` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}` | `—` | JWT (mount) | `publishers` |
| PUT | `/publishers/{id}` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/campaigns/mixed` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/locals` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/smart-tvs` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/stats` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/totems` | `—` | JWT (mount) | `publishers` |
| GET | `/publishers/{id}/totems/{totemId}/campaigns/mixed` | `—` | JWT (mount) | `publishers` |

### QRCodes (26)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/qr-codes` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qr-codes` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/client/{clientId}` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/stats` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/totem/{totemId}` | `—` | JWT (mount) | `qrcodes` |
| DELETE | `/qr-codes/{id}` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/{id}` | `—` | JWT (mount) | `qrcodes` |
| PUT | `/qr-codes/{id}` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qr-codes/{id}/activate` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qr-codes/{id}/deactivate` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/{id}/image` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qr-codes/{id}/scan` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qr-codes/{id}/scans` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qrcodes` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/client/{clientId}` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/stats` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/totem/{totemId}` | `—` | JWT (mount) | `qrcodes` |
| DELETE | `/qrcodes/{id}` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/{id}` | `—` | JWT (mount) | `qrcodes` |
| PUT | `/qrcodes/{id}` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qrcodes/{id}/activate` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qrcodes/{id}/deactivate` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/{id}/image` | `—` | JWT (mount) | `qrcodes` |
| POST | `/qrcodes/{id}/scan` | `—` | JWT (mount) | `qrcodes` |
| GET | `/qrcodes/{id}/scans` | `—` | JWT (mount) | `qrcodes` |

### Reports (15)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/reports` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/bulk-generate` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/download/{id}` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/export/csv` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/export/excel` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/export/pdf` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/formats` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/stats` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/templates` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/templates` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/types` | `commercial_reports` | JWT (router) | `reports` |
| DELETE | `/reports/{id}` | `commercial_reports` | JWT (router) | `reports` |
| GET | `/reports/{id}` | `commercial_reports` | JWT (router) | `reports` |
| POST | `/reports/{id}/regenerate` | `commercial_reports` | JWT (router) | `reports` |

### Settings (15)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/settings` | `—` | JWT (router) | `settings` |
| POST | `/settings` | `—` | JWT (router) | `settings` |
| PUT | `/settings` | `—` | JWT (router) | `settings` |
| GET | `/settings/categories` | `—` | JWT (router) | `settings` |
| GET | `/settings/category/{category}` | `—` | JWT (router) | `settings` |
| PUT | `/settings/category/{category}` | `—` | JWT (router) | `settings` |
| GET | `/settings/export` | `—` | JWT (router) | `settings` |
| POST | `/settings/import` | `—` | JWT (router) | `settings` |
| POST | `/settings/media/apply` | `—` | JWT (router) | `settings` |
| GET | `/settings/public` | `—` | JWT (router) | `settings` |
| POST | `/settings/reset-all` | `—` | JWT (router) | `settings` |
| POST | `/settings/validate` | `—` | JWT (router) | `settings` |
| DELETE | `/settings/{key}` | `—` | JWT (router) | `settings` |
| GET | `/settings/{key}` | `—` | JWT (router) | `settings` |
| POST | `/settings/{key}/reset` | `—` | JWT (router) | `settings` |

### SmartDisplayFX (44)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/smartdisplayfx/analytics/compare` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| GET | `/smartdisplayfx/analytics/export/excel` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| GET | `/smartdisplayfx/analytics/export/pdf` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| GET | `/smartdisplayfx/analytics/overview` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| GET | `/smartdisplayfx/analytics/performance` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| GET | `/smartdisplayfx/analytics/sites` | `smart_display_fx` | JWT (router) | `smartdisplayfx-analytics` |
| POST | `/smartdisplayfx/debug/trigger-effect` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| GET | `/smartdisplayfx/effects` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| POST | `/smartdisplayfx/effects` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| GET | `/smartdisplayfx/effects/types` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| DELETE | `/smartdisplayfx/effects/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| GET | `/smartdisplayfx/effects/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| PUT | `/smartdisplayfx/effects/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-effects` |
| POST | `/smartdisplayfx/events/ai` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| POST | `/smartdisplayfx/events/interaction` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| GET | `/smartdisplayfx/logs` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| GET | `/smartdisplayfx/rules` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| POST | `/smartdisplayfx/rules` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| GET | `/smartdisplayfx/rules/site/{siteId}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| DELETE | `/smartdisplayfx/rules/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| GET | `/smartdisplayfx/rules/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| PUT | `/smartdisplayfx/rules/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-rules` |
| GET | `/smartdisplayfx/sites` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| POST | `/smartdisplayfx/sites` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| DELETE | `/smartdisplayfx/sites/{siteId}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| GET | `/smartdisplayfx/sites/{siteId}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| PUT | `/smartdisplayfx/sites/{siteId}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| GET | `/smartdisplayfx/sites/{siteId}/config` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| GET | `/smartdisplayfx/sites/{siteId}/totems` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| POST | `/smartdisplayfx/sites/{siteId}/totems` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| DELETE | `/smartdisplayfx/sites/{siteId}/totems/{totemId}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-sites` |
| POST | `/smartdisplayfx/sync-time` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| GET | `/smartdisplayfx/telemetry` | `smart_display_fx` | JWT (router) | `smartdisplayfx-telemetry` |
| POST | `/smartdisplayfx/telemetry` | `smart_display_fx` | JWT (router) | `smartdisplayfx-telemetry` |
| POST | `/smartdisplayfx/telemetry/batch` | `smart_display_fx` | JWT (router) | `smartdisplayfx-telemetry` |
| GET | `/smartdisplayfx/telemetry/stats` | `smart_display_fx` | JWT (router) | `smartdisplayfx-telemetry` |
| GET | `/smartdisplayfx/telemetry/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-telemetry` |
| GET | `/smartdisplayfx/timelines` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |
| POST | `/smartdisplayfx/timelines` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |
| POST | `/smartdisplayfx/timelines/generate` | `smart_display_fx` | JWT (router) | `smartdisplayfx` |
| GET | `/smartdisplayfx/timelines/site/{siteId}/active` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |
| DELETE | `/smartdisplayfx/timelines/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |
| GET | `/smartdisplayfx/timelines/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |
| PUT | `/smartdisplayfx/timelines/{id}` | `smart_display_fx` | JWT (router) | `smartdisplayfx-timelines` |

### Subscribers (50)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/clients` | `subscribers` | JWT (mount) | `clients` |
| POST | `/clients` | `subscribers` | JWT (mount) | `clients` |
| DELETE | `/clients/{id}` | `subscribers` | JWT (mount) | `clients` |
| GET | `/clients/{id}` | `subscribers` | JWT (mount) | `clients` |
| PUT | `/clients/{id}` | `subscribers` | JWT (mount) | `clients` |
| GET | `/subscriber-access` | `subscribers` | JWT (router) | `subscriber-access` |
| GET | `/subscriber-access/expiring` | `subscribers` | JWT (router) | `subscriber-access` |
| POST | `/subscriber-access/grant` | `subscribers` | JWT (router) | `subscriber-access` |
| GET | `/subscriber-access/plan-publisher` | `subscribers` | JWT (router) | `subscriber-access` |
| POST | `/subscriber-access/plan-publisher` | `subscribers` | JWT (router) | `subscriber-access` |
| POST | `/subscriber-access/plan-publisher/reconcile` | `subscribers` | JWT (router) | `subscriber-access` |
| DELETE | `/subscriber-access/plan-publisher/{planId}/{publisherId}` | `subscribers` | JWT (router) | `subscriber-access` |
| POST | `/subscriber-access/reconcile` | `subscribers` | JWT (router) | `subscriber-access` |
| GET | `/subscriber-access/{subscriberId}/publishers` | `subscribers` | JWT (router) | `subscriber-access` |
| GET | `/subscriber-access/{subscriberId}/publishers/{publisherId}/check` | `subscribers` | JWT (router) | `subscriber-access` |
| POST | `/subscriber-access/{subscriberId}/publishers/{publisherId}/revoke` | `subscribers` | JWT (router) | `subscriber-access` |
| GET | `/subscribers` | `subscribers` | JWT (mount) | `subscribers` |
| POST | `/subscribers` | `subscribers` | JWT (mount) | `subscribers` |
| DELETE | `/subscribers/{id}` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}` | `subscribers` | JWT (mount) | `subscribers` |
| PUT | `/subscribers/{id}` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/contracts` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/locals` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/smart-tvs` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/stats` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/totems` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/validate/plan-limits` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/validate/storage` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{id}/validate/totem-access` | `subscribers` | JWT (mount) | `subscribers` |
| GET | `/subscribers/{subscriberId}/menu-catalog/board-layout` | `quick_publish` | JWT (mount) | `menu-catalog` |
| PUT | `/subscribers/{subscriberId}/menu-catalog/board-layout` | `quick_publish` | JWT (mount) | `menu-catalog` |
| GET | `/subscribers/{subscriberId}/menu-catalog/categories` | `quick_publish` | JWT (mount) | `menu-catalog` |
| POST | `/subscribers/{subscriberId}/menu-catalog/categories` | `quick_publish` | JWT (mount) | `menu-catalog` |
| DELETE | `/subscribers/{subscriberId}/menu-catalog/categories/{categoryId}` | `quick_publish` | JWT (mount) | `menu-catalog` |
| PATCH | `/subscribers/{subscriberId}/menu-catalog/categories/{categoryId}` | `quick_publish` | JWT (mount) | `menu-catalog` |
| GET | `/subscribers/{subscriberId}/menu-catalog/products` | `quick_publish` | JWT (mount) | `menu-catalog` |
| POST | `/subscribers/{subscriberId}/menu-catalog/products` | `quick_publish` | JWT (mount) | `menu-catalog` |
| DELETE | `/subscribers/{subscriberId}/menu-catalog/products/{productId}` | `quick_publish` | JWT (mount) | `menu-catalog` |
| PATCH | `/subscribers/{subscriberId}/menu-catalog/products/{productId}` | `quick_publish` | JWT (mount) | `menu-catalog` |
| POST | `/subscribers/{subscriberId}/menu-catalog/render-board` | `quick_publish` | JWT (mount) | `menu-catalog` |
| GET | `/subscribers/{subscriberId}/publish-board/ai-assist-status` | `quick_publish` | JWT (mount) | `publish-board` |
| GET | `/subscribers/{subscriberId}/publish-board/video-ai-jobs/{jobId}` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/auto-publish` | `quick_publish` | JWT (mount) | `publish-board` |
| GET | `/subscribers/{subscriberId}/publish-board/{preset}/layout` | `quick_publish` | JWT (mount) | `publish-board` |
| PUT | `/subscribers/{subscriberId}/publish-board/{preset}/layout` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/preview-html` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/queue-video-ai` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/render` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/render-html` | `quick_publish` | JWT (mount) | `publish-board` |
| POST | `/subscribers/{subscriberId}/publish-board/{preset}/suggest-copy` | `quick_publish` | JWT (mount) | `publish-board` |

### Tags (4)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/tags` | `—` | JWT (router) | `tags` |
| POST | `/tags` | `—` | JWT (router) | `tags` |
| DELETE | `/tags/{tagId}` | `—` | JWT (router) | `tags` |
| GET | `/tags/{tagId}/content` | `—` | JWT (router) | `tags` |

### Totems (36)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/totems` | `—` | JWT (router) | `totems` |
| POST | `/totems` | `—` | JWT (router) | `totems` |
| GET | `/totems/pending` | `—` | JWT (router) | `totems` |
| GET | `/totems/stats/offline` | `—` | JWT (router) | `totems` |
| GET | `/totems/stats/overview` | `—` | JWT (router) | `totems` |
| GET | `/totems/uin/{uin}` | `—` | JWT (router) | `totems` |
| DELETE | `/totems/{id}` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/activate` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/analytics` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/approve` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/commands` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/commands` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/force-online` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/heartbeat` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/heartbeat` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/logs` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/logs/download` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/medias` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/medias` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/medias/reorder` | `—` | JWT (router) | `totems` |
| DELETE | `/totems/{id}/medias/{mediaId}` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/medias/{mediaId}/active` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/playback-state` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/playlist` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/playlist/mix` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/playlist/mix/generate` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/restart` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/screenshot` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/screenshots` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/screenshots/{screenshotId}/download` | `—` | JWT (router) | `totems` |
| GET | `/totems/{id}/smart-tvs` | `—` | JWT (router) | `totems` |
| PUT | `/totems/{id}/telemetry-observation/renew` | `—` | JWT (router) | `totems` |
| POST | `/totems/{id}/telemetry-observation/start` | `—` | JWT (router) | `totems` |
| DELETE | `/totems/{id}/telemetry-observation/stop` | `—` | JWT (router) | `totems` |

### Users (29)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/permissions` | `—` | JWT (router) | `permissions` |
| POST | `/permissions` | `—` | JWT (router) | `permissions` |
| GET | `/permissions/actions` | `—` | JWT (router) | `permissions` |
| GET | `/permissions/resources` | `—` | JWT (router) | `permissions` |
| DELETE | `/permissions/{id}` | `—` | JWT (router) | `permissions` |
| GET | `/permissions/{id}` | `—` | JWT (router) | `permissions` |
| PUT | `/permissions/{id}` | `—` | JWT (router) | `permissions` |
| GET | `/roles` | `—` | JWT (router) | `roles` |
| POST | `/roles` | `—` | JWT (router) | `roles` |
| DELETE | `/roles/{id}` | `—` | JWT (router) | `roles` |
| GET | `/roles/{id}` | `—` | JWT (router) | `roles` |
| PUT | `/roles/{id}` | `—` | JWT (router) | `roles` |
| GET | `/roles/{id}/permissions` | `—` | JWT (router) | `roles` |
| POST | `/roles/{id}/permissions` | `—` | JWT (router) | `roles` |
| DELETE | `/roles/{id}/permissions/{permissionId}` | `—` | JWT (router) | `roles` |
| POST | `/roles/{id}/permissions/{permissionId}` | `—` | JWT (router) | `roles` |
| GET | `/users` | `—` | JWT (router) | `users` |
| POST | `/users` | `—` | JWT (router) | `users` |
| DELETE | `/users/{id}` | `—` | JWT (router) | `users` |
| GET | `/users/{id}` | `—` | JWT (router) | `users` |
| PUT | `/users/{id}` | `—` | JWT (router) | `users` |
| GET | `/users/{id}/flags` | `—` | JWT (router) | `users` |
| PUT | `/users/{id}/flags` | `—` | JWT (router) | `users` |
| DELETE | `/users/{id}/flags/{flagName}` | `—` | JWT (router) | `users` |
| POST | `/users/{id}/flags/{flagName}` | `—` | JWT (router) | `users` |
| GET | `/users/{id}/roles` | `—` | JWT (router) | `users` |
| POST | `/users/{id}/roles` | `—` | JWT (router) | `users` |
| DELETE | `/users/{id}/roles/{roleId}` | `—` | JWT (router) | `users` |
| POST | `/users/{id}/roles/{roleId}` | `—` | JWT (router) | `users` |

### Webhooks (6)

| Método | Path `/api`… | Módulo | Auth | Ficheiro |
|--------|--------------|--------|------|----------|
| GET | `/webhooks` | `—` | JWT (router) | `webhooks` |
| POST | `/webhooks` | `—` | JWT (router) | `webhooks` |
| DELETE | `/webhooks/{id}` | `—` | JWT (router) | `webhooks` |
| GET | `/webhooks/{id}` | `—` | JWT (router) | `webhooks` |
| PUT | `/webhooks/{id}` | `—` | JWT (router) | `webhooks` |
| POST | `/webhooks/{id}/test` | `—` | JWT (router) | `webhooks` |

## Detalhe OpenAPI

- Stubs: `backend/src/config/openapi-generated.json` (todas as rotas).
- Overlay P0 (integração fechada): `backend/src/config/openapi-p0.json` — login, player dispatch/sync/heartbeat, installation modules + multi-agency, quick-publish + subscriber-access/grant, dispatcher-totem + dispatcher-debug.
- swagger-enhanced: PlaylistMix / publishers / subscribers (legado).
- Runtime: `GET /api/openapi.json` = gerado + enhanced + P0.
- Estático: [`openapi.json`](./openapi.json) = gerado + P0.

**536** operações ainda só têm stub (200/401/403 genéricos).

Próximos candidatos a schemas manuais: billing, OTA, campaigns, portal.

## Convenções

- Paths OpenAPI são relativos a `/api` (ex.: `/auth/login` = `POST /api/auth/login`).
- `:id` Express → `{id}` OpenAPI.
- `requireModule('x')` aparece na coluna Módulo (Direct Totem pode devolver 403).
- Auth “JWT (mount)” = `authMiddleware` no `app.use`; “JWT (router)” = auth dentro do ficheiro de rotas.

