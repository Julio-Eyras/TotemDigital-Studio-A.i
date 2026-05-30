# Testes E2E — Smart Signage Studio

**Ferramenta:** [Playwright](https://playwright.dev/)

## Modos

| Comando | Stack | Uso |
|---------|--------|-----|
| `npm run test:e2e` | Frontend + API mockada | Desenvolvimento rápido, CI leve |
| `npm run test:e2e:full` | Docker Postgres + backend + frontend | Validação integrada |

## Primeira execução

```bash
# Na raiz do repositório
npm run test:e2e:install
npm run test:e2e
```

## Suites (`e2e/tests/`)

| Arquivo | Cobertura |
|---------|-----------|
| `auth.spec.ts` | Login, erro, logout, sessão |
| `public-routes.spec.ts` | `/login`, `/forgot-password`, redirect |
| `dashboard.spec.ts` | Dashboard comercial, ui-context (full) |
| `studio-navigation.spec.ts` | Rotas admin Studio (26 paths) |
| `ota-regression.spec.ts` | OTA Update (regressão permissão admin) |
| `content.spec.ts` | Mídia, campanhas, playlists, players |
| `billing.spec.ts` | Faturamento, contratos exibidor |
| `settings-admin.spec.ts` | Settings, users, contracts |

## Modo full

Requer **Docker Desktop**:

```bash
npm run test:e2e:full
```

Credenciais: `totemdigital.admin` / `admin123` (ajustadas por `e2e/scripts/prepare-db.mjs`).

## Relatório

Após falha: `e2e/playwright-report/index.html` (gerado localmente; não versionado).
