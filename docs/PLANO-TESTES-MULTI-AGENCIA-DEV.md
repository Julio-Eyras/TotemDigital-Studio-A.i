# Plano de testes — Multi-agência + instância VPS `dev`

**Branch:** `TotemDigital-MultiAgencia`  
**Harness automático:** `node scripts/sim-vps-dev-pipeline.mjs`  
**Relacionado:** `docs/VPS-DEV-DO-ZERO-MULTI-AGENCIA.md` · `docs/DESENHO-PURGE-DADOS-COMERCIAIS.md`

## 1. Níveis de validação

| Nível | Onde | O que cobre | Limite |
|-------|------|-------------|--------|
| **L0 — Estático** | PC / CI | Ficheiros, presets A/B/C, portal sim, dry-run instalador | Sem Postgres/Nginx reais |
| **L1 — Emulado** | WSL/Docker (futuro) | BD efémera + API health + gates módulos | Sem LE/DNS público |
| **L2 — VPS `dev`** | `dev.totemdigital.app.br` | Install do zero, HTTPS, login, master switch, portal | Ambiente real |

Este documento + harness cobrem **L0 agora**. L1/L2 são checklists manuais/automatizáveis no servidor.

## 2. Casos de teste (L0 — automático)

| ID | Caso | Critério de aceite |
|----|------|-------------------|
| T01 | Branch/docs/scripts presentes | `TotemDigital-MultiAgencia`, guias VPS/purge, instalador |
| T02 | Preset OFF = Direct Totem | `direct_totem_mode`+`simple` on; comercial off |
| T03 | Preset ON = Pro | `multi_agency` on; Direct Totem off; billing/campaigns/playlists on |
| T04 | D6-C proibido | ON e Direct Totem nunca simultâneos no preset |
| T05 | Portal pipeline | `sim-portal-pipeline.mjs` 14 checks |
| T06 | SSL/DNS dry-run scripts | `--sim` sem root |
| T07 | Isolamento JWT↔slug | match OK / mismatch 403 / owner bypass |
| T08 | Seed 2ª agência (lógica) | 1 org → 2ª + anunciante |
| T09 | Instalador dry-run `dev` | Plano: domínio `dev.…`, porta 3001, clone `-dev` |
| T10 | Purge desenho | scopes + confirmação tipada documentados |
| T11 | Clone branch | `TDI_GIT_BRANCH` / default MultiAgencia (não direc-totem hardcoded) |

## 3. Casos de teste (L2 — VPS `dev`, manual/semi-auto)

| ID | Caso | Como validar |
|----|------|--------------|
| V01 | DNS A `dev.totemdigital.app.br` | `dig` / browser |
| V02 | Install do zero | guia VPS secção 4 |
| V03 | HTTPS + `/api/health` | `curl -fsS https://dev…/api/health` |
| V04 | Login `dev`/`dev123` | UI |
| V05 | Activar multi-agência | Complementos → ON → menu Pro |
| V06 | Desactivar | Direct Totem volta; dados intactos (D3) |
| V07 | Seed 2ª agência | aparece `agencia-demo-2` |
| V08 | Portal slug + sync `--sim` | artefactos + headers |
| V09 | JWT noutro tenant | 403 `TENANT_HOST_MISMATCH` |
| V10 | Wipe BD só `dev` | produção intacta |

## 4. Como correr o harness (L0)

```bash
# Windows (Git Bash / WSL) ou Linux
cd /path/to/TotemDigital-Studio   # ou /mnt/c/TotemDigital-Studio
node scripts/sim-vps-dev-pipeline.mjs
```

Saída: `runtime/vps-dev-sim/REPORT.json` + exit code 0/1.

## 5. Emulação de “máquina”

| Opção | Viável agora? | Notas |
|-------|---------------|-------|
| Dry-run instalador + Node | **Sim** | O que o harness faz |
| WSL Ubuntu no Windows | **Sim** (bash disponível) | Sem Docker nesta máquina |
| Docker Compose full stack | Parcial no repo (`e2e`) | Docker **não** instalado neste PC |
| VM/VPS real `dev` | Sim | Checklist L2 |

**Resposta directa:** dá para **emular e avaliar automaticamente o procedimento lógico** (L0). Emular Nginx+Postgres+systemd+LE como VPS completo exige Docker/VM ou o próprio VPS `dev` (L1/L2).

## 6. Critério de “pronto para testar no VPS”

- [ ] Harness L0 verde
- [ ] DNS `dev.totemdigital.app.br` aponta para o VPS
- [ ] Branch `TotemDigital-MultiAgencia` no remote
- [ ] Checklist V01–V10 executada
