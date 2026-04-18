# Política de rotas — TotemDigital compacto

Objetivo: a variante **monousuária** expõe apenas o necessário para operar totens, mídias, playlists, campanhas e dispatcher, sem superfície Pro (multi-agência, smart TV dedicada, gestão de utilizadores via API, QR codes, notificações servidor).

## Backend (`registerCompactRoutes`)

**Montado:**

| Prefixo | Uso |
|---------|-----|
| `/api/auth` | Autenticação |
| `/api/locals` | Locais (filtros e vínculo na UI de totens) |
| `/api/totems` | Totens |
| `/api/dispatcher-totem` | Dispatcher |
| `/api/dispatcher-debug` | Diagnóstico |
| `/api/players` | Players (ex.: campanhas) |
| `/api/media`, `/api/playlists`, `/api/campaigns` | Conteúdo e regras |
| `/api/settings`, `/api/dashboard`, `/api/health` | Sistema |

**Não montado no compacto:** `/api/users`, `/api/smart-tvs`, `/api/qrcodes`, `/api/notifications`, e toda a API Pro (subscribers, publishers, billing, etc.).

## Frontend (rotas React)

Com `REACT_APP_TOTEMDIGITAL_COMPACT=true`, as rotas autenticadas limitam-se ao mesmo conjunto do menu: dashboard, totens, playlists por totem, mídias, playlists, campanhas, monitor dispatcher, configurações. Não há rotas dedicadas a Locais, Smart TVs, Utilizadores ou QR codes (a gestão de locais continua **dentro do fluxo de totens** via API `/api/locals`).

A página **Campanhas** foi adaptada: sem cliente/subscriber/publishers na criação; edição usa abas Principal → Totens → Mídias → Playlists → Agendamento; totens carregam-se via `/api/totems`; detalhes da campanha não chamam `publisherApi` no compacto. Roteiro de validação manual: secção **4) Campanhas** em [07-teste-modo-compacto.md](./07-teste-modo-compacto.md).

**Mídia:** não chama `/api/subscribers`; filtro por subscriber oculto; listagem admin sem escopo quando aplicável; upload (`MediaUploadDialog`) não usa `validateStorage` / `validatePlanLimits` do subscriber; opcional inferir `subscriberId` a partir de mídias já listadas.

**Playlists:** não chama `subscriberApi`; filtro multi-subscriber oculto; `subscriberId` para criar/guardar inferido das playlists existentes (ou utilizador) quando necessário.

**Playlists por totem:** não chama `publisherApi`; filtro por publisher oculto; aba “Validações” (contratos) desativada no compacto.

## Command Palette (Ctrl+K)

No compacto, a lista de destinos coincide com o menu acima (sem subscribers, publishers, etc.).

## Instalação servidor sem players cliente

```bash
./scripts/install-smartsignage.sh --skip-menu --mode single-server --skip-players
```

(`--totemdigital-install` é alias de `--skip-players`.) O perfil compacto vs Pro é escolhível no **menu interativo** do instalador ou, com `--skip-menu`, via `INSTALL_TOTEMDIGITAL_COMPACT` no ambiente ou `--totemdigital-compact` / `--smartsignage-pro` (detalhes em [03-configuracao.md](./03-configuracao.md#modo-totemdigital-compacto-recomendado)). Opcional: DNS dinâmico com `./scripts/install_duckdns.sh`.

## CI

O workflow `.github/workflows/test.yml` inclui build do frontend com `REACT_APP_TOTEMDIGITAL_COMPACT=true` para detetar regressões de compilação no perfil compacto.

## Itens opcionais (não implementados aqui)

- **Monorepo / pastas opcionais:** documentar no repositório o que é “só servidor” vs `player-client` e apps móveis; eventual separação em repositórios é decisão de empacotamento, não de runtime.
- **Um único role na base:** simplificação de modelo e seeds para instalação nova — trabalho de dados separado da política de rotas acima.
