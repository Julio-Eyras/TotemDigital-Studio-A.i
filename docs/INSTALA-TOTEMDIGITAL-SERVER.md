# Instala TotemDigital Server

**Script oficial:** `scripts/Instala-TotemDigital-Server.sh`  
**Versão do instalador:** 1.1.0  
**Idioma:** português  
**Motor:** `scripts/install-smartsignage.sh` (**não é alterado** — apenas envolvido)

O wrapper antigo `install-totemdigital-prod-https.sh` está **depreciado** e redirecciona para este script.

---

## Uso rápido

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/Instala-TotemDigital-Server.sh
```

Não-interactivo (produção, defaults):

```bash
bash scripts/Instala-TotemDigital-Server.sh --modo producao --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

**Dev / test no mesmo VPS** (stack isolada, sem motor):

```bash
bash scripts/Instala-TotemDigital-Server.sh --modo producao --instancia dev --sim
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia teste --git-pull
```

Ver [MULTI-INSTANCIA-PROD-DEV-TESTE.md](./MULTI-INSTANCIA-PROD-DEV-TESTE.md).

Dry-run (só mostra o plano):

```bash
bash scripts/Instala-TotemDigital-Server.sh --modo producao --dry-run
```

---

## Modos do menu

| # | Modo | Flag | O que faz | BD |
|---|------|------|-----------|-----|
| 1 | **Produção** (HTTPS 443) | `--modo producao` | Compact + direct-totem + site:80 + painel:8080 + Let's Encrypt | Pode recriar se o motor entrar em “reinstalação limpa” |
| 2 | **Actualizar** | `--modo atualizar` | git pull opcional, compile back, rebuild front `/api`, `.env`, Nginx 443 | **Não apaga** |
| 3 | **Reparar** | `--modo reparar` | Aspas no `.env`, `FINANCIAL_PUBLIC_APP_URL` HTTPS, Nginx 443 | Não toca |
| 4 | **Docker** | `--modo docker` | Motor `--mode docker` + perfil TotemDigital | Conforme Compose |
| 5 | **Wipe** | `--modo wipe` | `--fresh` no motor — **apaga BD** | **Apaga** (confirmação `APAGAR` + domínio; bloqueado com `--sim`) |

---

## Opções CLI

| Opção | Descrição |
|-------|-----------|
| `--modo <nome>` | `producao` \| `atualizar` \| `reparar` \| `docker` \| `wipe` |
| `--instancia <id>` | `producao` (default) \| `dev` \| `teste` — paths, BD, portas e Nginx isolados |
| `--dominio <fqdn>` | Default: apex prod; `dev.` / `test.` se `--instancia` correspondente |
| `--email <addr>` | LE + owner |
| `--owner-user` / `--owner-name` | Admin e organização |
| `--com-mqtt` | Mosquitto (só SmartDisplayFX) |
| `--com-players` | Copia players cliente |
| `--com-seeds` | Seeds demo |
| `--git-pull` | No modo actualizar |
| `--sim` / `--yes` | Sem perguntas (wipe recusado) |
| `--dry-run` | Não executa |
| `--ajuda` | Ajuda |

---

## O que o instalador garante (pós-passos)

Sem alterar o motor, após produção/wipe bem-sucedidos (e nos modos 2/3):

1. `.env` com aspas (`fix-env-shell-quoting.sh`) — evita `CHANNEL: command not found`
2. `FINANCIAL_PUBLIC_APP_URL=https://<domínio>`
3. Nginx HTTPS unificado (`apply-https-unified-443.sh`)
4. No modo **actualizar**: rebuild front com `REACT_APP_API_URL=https://domínio/api`

---

## Pré-requisitos

- Utilizador **não-root** (ex.: `smartchannel`)
- Repo `TotemDigital-Studio`, branch preferida `SmartSignage-direc-totem`
- DNS **A** do domínio → IPv4 do VPS (evitar AAAA se 443 IPv6 fechado)
- Portas **80**, **443**, **8080**

Player-AD (APK) **não** é instalado por este script — use ADB/pendrive.

---

## Relação com outros docs

- **[Procedimentos por modalidade](./instalacao/README.md)** — sequências completas para produção, DEV/TESTE, manutenção, backup/restore e Player-AD
- **[Manuais (índice)](./manuais/README.md)** — visão geral, instalação, 1ª vez, módulos, admin, técnico E.R./API
- [ORGANIZACAO-BRANCHES.md](./ORGANIZACAO-BRANCHES.md) — repo/branch
- [INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md](./INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md) — detalhe técnico do perfil produção
- [INSTALL-SMARTSIGNAGE-MENU-OPCOES.md](./INSTALL-SMARTSIGNAGE-MENU-OPCOES.md) — menu legado do motor
- [MULTI-INSTANCIA-PROD-DEV-TESTE.md](./MULTI-INSTANCIA-PROD-DEV-TESTE.md) — instâncias `dev` / `teste`
- [HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md](./HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md) — continuidade multi-agência
