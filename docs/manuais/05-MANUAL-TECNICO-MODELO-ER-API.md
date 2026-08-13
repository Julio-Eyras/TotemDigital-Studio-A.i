# 05 — Manual técnico: modelo E.R., API e serviços

**Público:** desenvolvimento e suporte nível 2  
**Schema:** `database/smartchannel-db-v2-refactored-part*.sql`  
**Policy:** `backend/src/policy/installationModules.ts`

---

## 1. Modelo mental

```text
                    ┌──────────────┐
                    │  publishers  │  (organização)
                    └──────┬───────┘
                           │ 1:N
                    ┌──────▼───────┐
                    │    locals    │
                    └──────┬───────┘
                           │ 1:N
                    ┌──────▼───────┐
                    │    totems    │  ← inventário (não depende de plano)
                    └──────────────┘

┌──────────────┐     SPA / plano      ┌──────────────┐
│ subscribers  │ ───────────────────► │  publishers  │
│ (anunciante) │                      └──────────────┘
└──────┬───────┘
       │ 1:N (Pro)
┌──────▼───────────────┐
│ subscriber_contracts │── plan_id ──► plans
└──────────────────────┘                 │
                                         ▼
                              plan_publisher_access
                              plan_local_access
```

- **Inventário:** totem → local → publisher  
- **Comercial Pro:** contrato → plano → acessos  
- **Comercial Lite:** `subscriber_publisher_access` (`access_type=override`, `contract_id`/`plan_id` null)

---

## 2. Entidades principais (E.R. resumido)

| Tabela | Papel |
|--------|-------|
| `publishers` | Organização; `is_system_owner`, `portal_slug` |
| `locals` | Unidade; `publisher_id` NOT NULL |
| `totems` | Ecrã; `local_id` |
| `subscribers` | Anunciante |
| `medias` | Conteúdo; dono `subscriber_id` e/ou publisher |
| `playlists` / `playlist_items` | Sequência de mídias |
| `campaigns` | Campanha; `subscriber_id`, `contract_id` opcional |
| `campaign_totems` / `campaign_publishers` / `campaign_playlists` | Vínculos de entrega |
| `plans` | Catálogo comercial (Pro) |
| `plan_publisher_access` | Plano → publisher permitido |
| `plan_local_access` | Plano → local permitido (caminho compacto) |
| `subscriber_contracts` | Contrato anunciante ↔ plano |
| `subscriber_publisher_access` | SPA — anunciante → publisher |
| `subscriber_publisher_access_active` | **View** de SPA válidos |
| `system_settings` | `installation.modules`, `installation.profile`, `portal.*` |
| `users` / roles | Autenticação e autorização |

Partes do schema (ordem de apply): part2 base → part3 dependent → part5 relationships → … → part10 views → part13 dispatcher views → part14/15 contracts.

Diagramas adicionais: `docs/diagrams/*.dot`, docs históricos em `docs/_moved/`.

---

## 3. SPA — `subscriber_publisher_access`

```sql
-- Campos-chave
subscriber_id, publisher_id,
contract_id NULL,   -- Lite: null
plan_id NULL,       -- Lite: null
access_type IN ('plan','contract','override'),  -- Lite: 'override'
is_active, expires_at, revoked_at
```

View activa (`part10-views.sql`):

- `is_active` e `revoked_at IS NULL`  
- `expires_at` null ou futuro  
- subscriber e publisher activos  

Serviço: `backend/src/services/subscriberAccessService.ts`

| Método | Função |
|--------|--------|
| `grantAccess(sub, pub, contractId?, grantedBy, …)` | Com contrato → `contract`; sem → `override` (upsert/reactivate) |
| `revokeAccess(sub, pub, …)` | Desactiva SPA |
| `getAccessiblePublishers` / `getAccessibleSubscribers` | Listas via view activa |
| `hasAccess` / check SQL | Validação pontual |

Rota: `POST /api/subscriber-access/grant` — `contractId` **opcional**.

---

## 4. Elegibilidade de totens e campanhas

### 4.1 Totens por anunciante

| Método (`subscriberService`) | Quando |
|------------------------------|--------|
| `getTotemsBySubscriber(id)` | Via SPA (Lite / fallback) |
| `getTotemsBySubscriberContract(id, contractId)` | Via plano + `plan_*_access` (Pro / compacto) |

API: `GET /api/subscribers/:id/totems?contractId=` (opcional).

### 4.2 Quick-publish

Serviço: `quickPublishService.publish`

| Input | Comportamento |
|-------|----------------|
| `contractId` presente | Valida contrato + totens por plano |
| `contractId` ausente | Totens por SPA; campanha com `contract_id` null |

Rotas: `POST /api/quick-publish`, auto-publish board com `contractId` opcional.

### 4.3 Dispatcher

`dispatcherTotemService` — CTE `totem_campaigns` com UNION:

1. Direct + plano  
2. Publisher + plano  
3. Fallbacks plano  
4. **Direct + SPA**  
5. **Publisher + SPA**  

`validateCommercialRules`: Studio+contrato → plano; senão → SPA.

### 4.4 Playlist engine

`getAccessibleSubscribers(publisherId)` = UNION planos **e** SPA.

### 4.5 Campaign eligibility

`campaignEligibilityService` — já baseado em SPA + `campaign_publishers` / totens.

---

## 5. Módulos de instalação (código)

Ficheiro: `backend/src/policy/installationModules.ts`

| Função | Função |
|--------|--------|
| `buildCoreOperationPreset()` | Direct / off |
| `buildMultiAgencyLitePreset()` | Lite (anunciantes on; plans/contracts/billing off) |
| `buildMultiAgencyOperationPreset()` | Pro |
| `applyMultiAgencyMode(mode, current)` | Aplica preset preservando portal/FX |
| `resolveMultiAgencyMode(modules)` | Infere off/lite/full |
| `mergeInstallationModules` + `healStaleMultiAgencyLiteModules` | Merge + corrige lite antigo sem `subscribers` |
| `usesDirectSubscriberOrgAccess(modules)` | `multi_agency && !plans` |
| `validateInstallationModuleDependencies` | Ex.: billing exige plans |

Serviço: `installationModulesService.ts`

| Função | Função |
|--------|--------|
| `getInstallationModulesAdminView` | Catálogo + flags + heal persistente |
| `setMultiAgencyMode` | Master switch + bootstrap/seed |
| `saveInstallationModules` | Flags individuais + hot-reload workers |
| `ensureSystemOwnerPublisherIfEmpty` | Org owner |
| `ensureDemoSecondAgencyIfNeeded` | 2ª agência + SPA demo |

Middleware: `requireModule('plans')` etc. (`moduleAuth.middleware.ts`).

Capabilities UI: `GET` dashboard ui-context → `InstallationCapabilitiesContext` no FE.

---

Catálogo completo (todas as rotas montadas): [`../technical/07-API-INVENTARIO.md`](../technical/07-API-INVENTARIO.md) · OpenAPI [`../technical/openapi.json`](../technical/openapi.json) · runtime `GET /api/openapi.json`. Regenerar: `python scripts/generate-openapi-from-routes.py`.

## 6. API — mapa por domínio

Base: `https://<domínio>/api`  
Auth: `Authorization: Bearer <accessToken>` (`POST /api/auth/login`)

### 6.1 Instalação / modo

| Método | Path | Notas |
|--------|------|-------|
| GET | `/api/installation/modules` | Vista admin |
| PUT | `/api/installation/modules` | Flags parciais |
| PUT | `/api/installation/multi-agency` | `{ mode }` |
| * | `/api/installation/commercial-purge/*` | Purge |

### 6.2 Núcleo

| Área | Prefixos típicos |
|------|------------------|
| Orgs | `/api/publishers` |
| Locais | `/api/locals` |
| Totens | `/api/totems`, players |
| Mídias | `/api/media` |
| Utilizadores | `/api/users` |

### 6.3 Comercial

| Área | Prefixos | Módulo |
|------|----------|--------|
| Anunciantes | `/api/subscribers` | `subscribers` |
| SPA | `/api/subscriber-access` | `subscribers` |
| Quick publish | `/api/quick-publish` | `quick_publish` |
| Campanhas | `/api/campaigns` | `campaigns` |
| Planos | `/api/plans` | `plans` |
| Contratos | `/api/contracts`, subscriber-contracts | `contracts` |
| Billing | `/api/…billing…` | `billing` |

### 6.4 Player

| Método | Path |
|--------|------|
| GET | `/api/player/dispatch?uin=&token=&…` |

Ver também [../technical/01-api.md](../technical/01-api.md).

### 6.5 Exemplos Lite

**Conceder SPA sem contrato:**

```http
POST /api/subscriber-access/grant
Content-Type: application/json

{
  "subscriberId": 2,
  "publisherId": 1,
  "notes": "Lite — acesso directo"
}
```

**Quick-publish sem contrato:**

```http
POST /api/quick-publish
Content-Type: application/json

{
  "subscriberId": 2,
  "totemIds": [10, 11],
  "mediaIds": [100],
  "preset": "ad",
  "title": "Promo Agosto",
  "publishNow": true
}
```

---

## 7. Frontend — pontos de integração

| Área | Ficheiros |
|------|-----------|
| Gates de path | `utils/installationModuleAccess.ts` |
| Menu | `utils/menuHierarchy.tsx` |
| Caps context | `contexts/InstallationCapabilitiesContext.tsx` |
| Complementos UI | `pages/Settings/SystemModules.tsx` |
| SPA UI | `pages/SubscriberPublisherAccess/` |
| Quick publish | `pages/QuickPublish/QuickPublish.tsx` (`contractsRequired` / `spaAccessMode`) |
| API client | `services/api/index.ts` (`subscriberAccessApi`, `quickPublishApi`, …) |

---

## 8. Settings chave

| Key | Uso |
|-----|-----|
| `installation.modules` | JSON flags |
| `installation.profile` | `single_publisher` \| `multi_agency` |
| `portal.*` | DNS / Nginx / seed flags |
| `portal.seed_second_agency` | `false` desliga seed 2ª agência |

---

## 9. Testes e validação

| Tipo | Onde |
|------|------|
| Unit policy | `backend/src/__tests__/unit/policy/installationModules.test.ts` |
| Harness L0 | `scripts/sim-vps-dev-pipeline.mjs` |
| Plano L1/L2 | [../PLANO-TESTES-MULTI-AGENCIA-DEV.md](../PLANO-TESTES-MULTI-AGENCIA-DEV.md) |
| Validate schema v6 | `database/validate-v6.js` |

---

## 10. Regras de evolução (obrigatórias)

1. Alterar schema **só** nos `part*.sql` definitivos + seeds + instalador.  
2. Não workarounds runtime que contradigam o schema.  
3. Não misturar menus Direct + Pro.  
4. Não ligar purge ao OFF.  
5. Lite deve permanecer utilizável **sem** `plans`/`contracts` (caminho SPA).

---

## 11. Índice rápido de ficheiros

| Tema | Path |
|------|------|
| Presets / heal | `backend/src/policy/installationModules.ts` |
| Service modo | `backend/src/services/installationModulesService.ts` |
| SPA | `backend/src/services/subscriberAccessService.ts` |
| Quick publish | `backend/src/services/quickPublishService.ts` |
| Dispatcher | `backend/src/services/dispatcherTotemService.ts` |
| Playlist engine | `backend/src/services/playlistEngineService.ts` |
| Compact routes | `backend/src/startup/registerCompactRoutes.ts` |
| Warm + heal boot | `backend/src/config/installationRuntime.ts` |
| SPA table | `database/...-part5-tables-relationships.sql` |
| SPA view | `database/...-part10-views.sql` |
