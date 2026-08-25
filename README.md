# TotemDigital Studio — A.i (lab)

**Este repositório não é o produto operacional.**  
Clone de laboratório para temas de A.I. / ACE. Produção continua em [TotemDigital-Studio](https://github.com/Julio-Eyras/TotemDigital-Studio) (`totemdigital.app.br`).

Spec vigente do lab: [docs/ACE-0.1-SPEC.md](docs/ACE-0.1-SPEC.md).

---

# TotemDigital Studio

Plataforma de sinalização digital (digital signage) para gerir organizações, locais, totens/Smart TVs, mídias e — opcionalmente — anunciantes e operação comercial multi-agência.

**Repositório deste clone:** https://github.com/Julio-Eyras/TotemDigital-Studio-A.i.git  
**Produto operacional:** https://github.com/Julio-Eyras/TotemDigital-Studio.git  
**Branch default deste clone:** `main`  
**Produção (Studio, não este repo):** https://totemdigital.app.br  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária — todos os direitos reservados (ver [LICENSE](./LICENSE))  

---

## Baseline actual

| Componente | Versão |
|---|---|
| Frontend | 2.1.22 |
| Backend | 2.1.16 |
| Player-AD (Android) | 2.12 (build 112) |

Um código, três modos de produto (nunca Direct e multi-agência ao mesmo tempo):

| Modo | Ideia |
|---|---|
| **Direct Totem** | Uma organização; publicar nos próprios totens |
| **Multi Lite** | Várias orgs + anunciantes; sem planos/billing |
| **Multi Pro** | Agência completa (planos, contratos, billing, OTA, …) |

---

## Por onde começar

| Precisa de… | Abrir |
|---|---|
| **Índice de toda a documentação** | [docs/00-INDICE.md](docs/00-INDICE.md) |
| Usar o painel (primeira vez) | [docs/manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md](docs/manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md) |
| Telas do painel (capturas + PDF) | [docs/manuais/telas/README.md](docs/manuais/telas/README.md) |
| Avaliação comercial (v1.1) | [docs/AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md](docs/AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md) · [PDF](docs/AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf) |
| Índice de manuais | [docs/manuais/README.md](docs/manuais/README.md) |
| Instalar / actualizar servidor (prod, DEV, TESTE) | [docs/instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](docs/instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md) |
| Índice de instalação | [docs/instalacao/README.md](docs/instalacao/README.md) |
| Catálogo da API (OpenAPI) | [docs/technical/07-API-INVENTARIO.md](docs/technical/07-API-INVENTARIO.md) · [openapi.json](docs/technical/openapi.json) |
| Regras de negócio por módulo | [docs/modulos/00-INDICE.md](docs/modulos/00-INDICE.md) |
| Player-AD (TV Box) | [docs/instalacao/04-PLAYER-AD.md](docs/instalacao/04-PLAYER-AD.md) · [docs/player-apk/01-MANUAL-USUARIO.md](docs/player-apk/01-MANUAL-USUARIO.md) |
| Decisões técnicas (ADR) | [docs/adr/README.md](docs/adr/README.md) |

---

## Estrutura do repositório

```text
backend/          API Node/Express + workers
frontend/         Painel React
database/         Schema SQL v2 (part*.sql) + seeds v6
scripts/          Instala-TotemDigital-Server.sh, backup/restore, Nginx
Player-AD/        Player Android (produção de campo)
Player-AD-Installer/  Instala-Player-TotemDigital-Vs{versão}-build-{código}.apk (player + logos opcionais)
install-pendrive/ Kit de campo (APK + docs)
docs/             Manuais, instalação, módulos, ADRs
nginx/ systemd/   Artefactos de deploy
```

Schema: fonte da verdade em `database/smartchannel-db-v2-refactored-part*.sql` (sem migrations temporárias).

---

## Servidor — atalho

Script oficial: `scripts/Instala-TotemDigital-Server.sh`  
Correr como utilizador normal com `sudo` (não `sudo bash`).

```bash
# Clone
git clone --branch main \
  https://github.com/Julio-Eyras/TotemDigital-Studio.git \
  TotemDigital-Studio
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

# Actualizar produção SEM apagar a BD (após backup)
bash scripts/backup-totemdigital-prod.sh --instancia producao --sim
bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar --instancia producao --git-pull --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

| Instância | Clone | Deploy | Domínio |
|---|---|---|---|
| Produção | `~/TotemDigital-Studio` | `/opt/smart-signage` | `totemdigital.app.br` |
| DEV | `~/TotemDigital-Studio-dev` | `/opt/totemdigital-dev` | `dev.totemdigital.app.br` |
| TESTE | `~/TotemDigital-Studio-test` | `/opt/totemdigital-test` | `test.totemdigital.app.br` |

Detalhe completo: [docs/instalacao/](docs/instalacao/).

---

## Player-AD — atalho

O instalador do servidor **não** instala o APK.

```powershell
cd Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 -NoConfigPush
```

No aparelho: **3 toques** OK → configuração (Wi‑Fi, URL, UIN).  
Assistente de campo: `Instala-Player-TotemDigital-Vs{versão}-build-{código}.apk` (pergunta se altera logos de boot; logos exigem root).

---

## Regras importantes

1. Trabalhar e instalar a partir da branch **`main`**.
2. Actualizar com `--modo atualizar`; não usar `--modo producao` / `wipe` em instância com dados sem perceber o risco.
3. Backup antes de actualizar produção.
4. Não misturar `.env`, JWT, BD ou uploads entre produção / DEV / TESTE.
5. Documentação de ecrã: `docs/manuais/` · regras de módulo: `docs/modulos/`.

```bash
bash scripts/Instala-TotemDigital-Server.sh --ajuda
bash scripts/backup-totemdigital-prod.sh --ajuda
```

---

## Autor e licença

**Autor / titular:** Julio Cesar Eyras (J.C.E.) — Eyras Sistemas e Soluções  

Software **proprietário**. Todos os direitos reservados. Sem autorização escrita
não há permissão de cópia, distribuição ou sublicenciamento.

- Texto integral: [LICENSE](./LICENSE)
- Aviso canónico: [NOTICE](./NOTICE)

O código já existente não leva cabeçalho em cada ficheiro; a titularidade
aplica-se a todo o repositório. Ficheiros **novos** devem usar o banner curto
(regra Cursor `copyright-header`).
