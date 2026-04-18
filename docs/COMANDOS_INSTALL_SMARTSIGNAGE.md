# Referência — `scripts/install-smartsignage.sh`

Uso geral:

```bash
./scripts/install-smartsignage.sh [OPÇÕES]
```

Equivalente com `bash`:

```bash
bash scripts/install-smartsignage.sh [OPÇÕES]
```

Ajuda integrada:

```bash
./scripts/install-smartsignage.sh --help
```

---

## Parâmetros (linha de comando)

| Parâmetro | Alias | Descrição |
|-----------|--------|-----------|
| `--fresh` | — | Instalação completa do zero (apaga tudo). Ativa rebuild forçado, `--skip-menu` e modo `docker` por defeito neste fluxo. |
| `--rebuild` | — | Rebuild preservando dados. |
| `--rebuild-cache` | — | Rebuild sem cache Docker. |
| `--rebuild-only` | — | Só rebuild; não inicia serviços no fim. |
| `--force` | — | Força rebuild sempre. |
| `--check-only` | — | Apenas verifica se é necessário rebuild (não instala). |
| `--skip-menu` | — | Sem menus interativos; usa predefinições (ex.: Single-Server). |
| `--mode` `<modo>` | `--install-mode` | Define o modo e pula o menu. Valores: `single-server`, `single-server-prod`, `docker`. |
| `--mqtt-mode` `<modo>` | — | Perfil MQTT em single-server: `dev` ou `production`. |
| `--https-self-signed` | — | HTTPS com certificado autoassinado (single-server). |
| `--reset-db` | — | Apaga e recria o PostgreSQL se já existir (fluxo completo). |
| `--preserve-db` | — | Preserva a base existente durante reinstalação. |
| `--db-only` | — | Só base de dados (drop + schema + seeds); sem rebuild backend/frontend. Ativa `--skip-menu`. |
| `--backend-only` | — | Só backend (deps, `tsc`, serviço); sem banco/Nginx/frontend. Ativa `--skip-menu`. |
| `--frontend-only` | — | Só frontend (deps, build React, Nginx); sem banco/backend. Ativa `--skip-menu`. |
| `--backfront-build` | — | Build backend + frontend e arranque; sem tocar no banco. Ativa `--skip-menu`. |
| `--load-seeds` | `--with-seeds` | Carrega dados de demonstração (`database/carga-inicial-v6.sql`) sem prompt. |
| `--skip-seeds` | `--no-seeds` | Não carrega dados de demonstração. |
| `--starttotem` | — | Após instalar, abre dois players web (`/player`) com totens demo (laboratório). |
| `--skip-players` | — | Com `--skip-menu`: não copia players cliente (webOS, Android, Tizen, etc.); só servidor + build. |
| `--totemdigital-install` | — | Alias de `--skip-players` (instalação estilo servidor TotemDigital). |
| `--totemdigital-compact` | `--compact-profile` | Gera `.env` com perfil TotemDigital compacto (`TOTEMDIGITAL_COMPACT` / `REACT_APP_TOTEMDIGITAL_COMPACT` = true). |
| `--smartsignage-pro` | `--pro-profile` | Gera `.env` com perfil Pro completo multi-agência (mesmas variáveis = false). |
| `--help` | `-h` | Mostra a ajuda e sai. |

---

## Variáveis de ambiente (antes de executar)

| Variável | Efeito |
|----------|--------|
| `INSTALL_TOTEMDIGITAL_COMPACT` | `true` ou `false`: com `--skip-menu`, valor usado no `.env` para **compacto (= mono)** vs Pro. No menu interativo a escolha 1/2 define o perfil (a variável pode servir de referência mental; não bloqueia o menu). As flags `--totemdigital-compact` / `--smartsignage-pro` saltam a pergunta. |

Para instalação sem menus, use **`--skip-menu`** na linha de comando (não há variável de ambiente equivalente documentada para isso).

---

## Menu interativo (sem `--skip-menu`)

1. Modo de instalação (Single-Server dev, Single-Server produção + MQTT local, Docker, ou rebuild/restart).
2. Perfil da aplicação: **compacto (= mono)** vs Smart Signage Pro (define `TOTEMDIGITAL_COMPACT` / `REACT_APP_TOTEMDIGITAL_COMPACT` no `.env`), exceto se passares `--totemdigital-compact` / `--smartsignage-pro` (saltam a pergunta).
3. Outros passos do script (base, Nginx, players, etc.), conforme o fluxo.

---

## Exemplos

```bash
# Instalação guiada (menus)
./scripts/install-smartsignage.sh
```

```bash
# Servidor único sem menu, sem copiar players cliente, modo compacto por defeito
./scripts/install-smartsignage.sh --skip-menu --mode single-server --skip-players
```

```bash
# Modo Pro no .env, sem menu
./scripts/install-smartsignage.sh --skip-menu --mode single-server --smartsignage-pro
```

```bash
# Ou via ambiente
INSTALL_TOTEMDIGITAL_COMPACT=false ./scripts/install-smartsignage.sh --skip-menu --mode single-server
```

```bash
# Só rebuild de backend e frontend (sem base)
./scripts/install-smartsignage.sh --backfront-build
```

```bash
# Reinstalar apenas a base
./scripts/install-smartsignage.sh --db-only
```

```bash
# Fresh completo (cuidado: apaga dados conforme o script)
sudo ./scripts/install-smartsignage.sh --fresh
```

---

## Documentação relacionada

- [Guia de instalação (técnico)](./technical/04-instalacao.md)
- [Configuração e modo compacto](./platform/03-configuracao.md#modo-totemdigital-compacto-recomendado)
- [Política de rotas — compacto](./platform/09-politica-rotas-totemdigital-compacto.md)

A lista acima reflecte as opções implementadas em `parse_arguments` e em `--help` no repositório; em caso de divergência, prevalece o script.
