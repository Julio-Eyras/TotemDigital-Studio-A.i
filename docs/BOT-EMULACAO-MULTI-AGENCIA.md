# Bot de emulação Multi-agência (Ubuntu / clone / install / testes)

**Script:** `node scripts/bot-multiagencia-emulate.mjs`  
**Branch:** `TotemDigital-MultiAgencia`  
**Relacionado:** `PLANO-TESTES-MULTI-AGENCIA-DEV.md` · `HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md`

## Resposta directa

**Sim, parcialmente.** O bot automatiza:

| Nível | O quê | Requisito |
|-------|--------|-----------|
| **L0** | Docs, presets off/lite/Pro, portal sim, dry-run do instalador | Só Node (+ bash/Git Bash) |
| **L1** | Contentor **Ubuntu 22.04** + Postgres efémero + schema + Jest (purge/lite) + L0 + dry-run install | **Docker Desktop** |
| **L2** | Smoke no VPS Contabo (`/api/health` + SSH branch/serviço) | `TDI_EMU_SSH_HOST` + chave SSH |

**Não emula** (ainda) um VPS Contabo completo com Nginx + systemd + Let’s Encrypt + DNS público dentro do Docker — isso continua a ser o install real no `dev` (`Instala-TotemDigital-Server.sh --instancia dev`).

## Como correr

```bash
# Tudo o que for possível neste PC
node scripts/bot-multiagencia-emulate.mjs --level all

# Só estático (sempre)
node scripts/bot-multiagencia-emulate.mjs --level l0

# Ubuntu emulado (precisa Docker)
node scripts/bot-multiagencia-emulate.mjs --level l1

# Smoke VPS (Remote SSH Host do Cursor / ~/.ssh/config)
set TDI_EMU_SSH_HOST=contabo-totem
set TDI_EMU_SSH_BASE_URL=https://dev.totemdigital.app.br
node scripts/bot-multiagencia-emulate.mjs --level l2
```

PowerShell:

```powershell
cd C:\TotemDigital-Studio
node scripts/bot-multiagencia-emulate.mjs --level all
```

Relatórios: `runtime/multiagencia-emu/BOT-REPORT.json` (+ `l0-console.txt`, `l1-console.txt`, `L1-REPORT.txt`).

## L1 manual (sem o bot)

```bash
docker compose -f docker-compose.multiagencia-emu.yml up --build --abort-on-container-exit
docker compose -f docker-compose.multiagencia-emu.yml down -v
```

## Ficheiros

| Ficheiro | Função |
|----------|--------|
| `scripts/bot-multiagencia-emulate.mjs` | Orquestrador |
| `scripts/sim-vps-dev-pipeline.mjs` | Harness L0 |
| `docker-compose.multiagencia-emu.yml` | Postgres + Ubuntu runner |
| `scripts/emu/Dockerfile.ubuntu-runner` | Imagem Ubuntu+Node20 |
| `scripts/emu/l1-ubuntu-runner.sh` | Passos dentro do contentor |

## Limitações conscientes

1. Install **real** com sudo/Nginx/LE só no VPS (`--instancia dev`).
2. L1 usa schema via init do Postgres (não o script de wipe/password do VPS).
3. Sem Docker → L1 é saltado em `--level all` (não falha o bot).
4. L2 não clica na UI; só health + SSH.

## Próximas evoluções possíveis

- Playwright login `dev`/`dev123` + toggle Pro no L2  
- Contentor com Nginx + backend build (quase-VPS)  
- CI GitHub Actions a correr L0 (+ L1 se runners com Docker)
