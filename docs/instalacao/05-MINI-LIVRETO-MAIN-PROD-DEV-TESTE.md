# Mini-livreto — Instalar e atualizar a `main`

**TotemDigital Studio** · branch operacional **`main`**  
**Atualizado:** 2026-08-12 · Commit de referência: `cf7260bb`

Guia curto para instalar **do zero** e atualizar **sem perder dados** em produção, DEV e TESTE.

Documentação detalhada: [README.md](./README.md) · [01-PRODUCAO](./01-PRODUCAO-DIRECT-TOTEM.md) · [02-DEV-TESTE](./02-DEV-TESTE-MULTI-INSTANCIA.md) · [03-MANUTENCAO](./03-MANUTENCAO-BACKUP-RESTORE.md) · [04-PLAYER-AD](./04-PLAYER-AD.md)

---

## 1. Mapa rápido

| | Produção | DEV | TESTE |
|---|---|---|---|
| Branch | `main` | `main` | `main` |
| Clone | `~/TotemDigital-Studio` | `~/TotemDigital-Studio-dev` | `~/TotemDigital-Studio-test` |
| Deploy | `/opt/smart-signage` | `/opt/totemdigital-dev` | `/opt/totemdigital-test` |
| BD | `smartsignage` | `smartsignage_dev` | `smartsignage_test` |
| Serviço | `smart-signage` | `smart-signage-dev` | `smart-signage-test` |
| Domínio | `totemdigital.app.br` | `dev.totemdigital.app.br` | `test.totemdigital.app.br` |
| API | 3000 | 3001 | 3002 |
| Auxiliar HTTP | `:8080` | `:8081` | `:8082` |

**Regra de ouro**

| Objectivo | Modo | BD |
|---|---|---|
| Instalar do zero (servidor vazio ou instância nova) | `--modo producao` | Pode criar / recriar |
| Atualizar código sem perder dados | `--modo atualizar` | **Preserva** |
| Só corrigir Nginx / `.env` / HTTPS | `--modo reparar` | Preserva |
| Apagar BD de propósito | `--modo wipe` | **Apaga** — perigoso |

Nunca uses `--modo producao` numa produção já com dados “só para actualizar”.  
Nunca inicies o script com `sudo bash` — corre como utilizador normal com `sudo` disponível.

```bash
export TDI_GIT_BRANCH=main   # em todos os exemplos abaixo
```

---

## 2. Produção — do zero

### 2.1 Pré-requisitos

- DNS A de `totemdigital.app.br` → VPS  
- Portas 80, 443, 8080  
- Git, Node.js, PostgreSQL, Nginx, Certbot  
- Utilizador com `sudo`

```bash
node -v && npm -v && git --version && psql --version && nginx -v && certbot --version && sudo -v
```

### 2.2 Clone

```bash
cd ~
git clone --branch main \
  https://github.com/Julio-Eyras/TotemDigital-Studio.git \
  TotemDigital-Studio
cd ~/TotemDigital-Studio
git log -1 --oneline
```

### 2.3 Dry-run (opcional) e instalação

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia producao \
  --dry-run \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

Sem `--dry-run` para instalar de verdade:

```bash
bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia producao \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

### 2.4 Verificar

```bash
sudo systemctl status smart-signage --no-pager
curl -fsS https://totemdigital.app.br/api/health
curl -sI https://totemdigital.app.br/login
git -C ~/TotemDigital-Studio log -1 --oneline
```

URLs: `https://totemdigital.app.br` · login · `/api` · auxiliar `http://IP:8080/login`

---

## 3. Produção — actualizar **sem perder dados**

### 3.1 Backup (obrigatório)

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh --instancia producao --sim
```

Anota o caminho impresso, ex.:

```text
/home/smartchannel/backups/producao-AAAAmmdd_HHMMSS
```

### 3.2 Alinhar o clone com `origin/main`

Se o `git pull` falhar por ficheiros locais modificados:

```bash
cd ~/TotemDigital-Studio
git status -sb
git stash push -m "pre-update-main-$(date +%Y%m%d_%H%M%S)"
```

Depois:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline
# esperado: tip actual da main (ex. cf7260bb)
```

Se tiveres a certeza que o working tree local do clone não importa:

```bash
git fetch origin
git reset --hard origin/main
git clean -fd
```

(Configs de runtime ficam em `/opt/smart-signage`, não no clone.)

### 3.3 Deploy que preserva a BD

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia producao \
  --git-pull \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

### 3.4 Rollback (se algo correr mal)

```bash
cd ~/TotemDigital-Studio
bash scripts/restore-totemdigital-prod.sh \
  /home/smartchannel/backups/producao-AAAAmmdd_HHMMSS \
  --instancia producao \
  --sim
```

---

## 4. DEV — do zero e actualizar

O instalador corre a partir do **clone controlador** `~/TotemDigital-Studio` e cria/usa `~/TotemDigital-Studio-dev`.

### 4.1 Do zero

```bash
cd ~/TotemDigital-Studio
git fetch origin && git checkout main && git pull --ff-only origin main
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia dev \
  --sim \
  --dominio dev.totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital DEV"
```

### 4.2 Actualizar sem perder dados (BD `smartsignage_dev`)

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh --instancia dev --sim   # recomendado

# Se o clone DEV tiver alterações locais:
#   cd ~/TotemDigital-Studio-dev && git stash push -m "pre-update-dev"

cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia dev \
  --git-pull \
  --sim \
  --dominio dev.totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

Verificar: `curl -fsS https://dev.totemdigital.app.br/api/health`

---

## 5. TESTE — do zero e actualizar

### 5.1 Do zero

```bash
cd ~/TotemDigital-Studio
git fetch origin && git checkout main && git pull --ff-only origin main
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia teste \
  --sim \
  --dominio test.totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital TESTE"
```

### 5.2 Actualizar sem perder dados (BD `smartsignage_test`)

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh --instancia teste --sim

cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia teste \
  --git-pull \
  --sim \
  --dominio test.totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

Verificar: `curl -fsS https://test.totemdigital.app.br/api/health`

---

## 6. Checklist “não perder dados”

1. **Backup** antes de actualizar produção (e de preferência DEV/TESTE).  
2. Usar **`--modo atualizar`**, nunca `--modo producao` / `--modo wipe` em instância com dados.  
3. Se `git pull` falhar → **`git stash`** (ou `reset --hard origin/main` só no clone).  
4. Confirmar `TDI_GIT_BRANCH=main` e `--instancia` correcta.  
5. Não misturar `.env`, JWT, BD ou uploads entre produção / DEV / TESTE.  
6. Anotar o caminho do backup para restore.

---

## 7. Player-AD (TV Box) — à parte do servidor

O instalador do servidor **não** instala o APK.

Actualização em produção (preserva config no aparelho):

```powershell
cd C:\TotemDigital-Studio
git checkout main
git pull --ff-only origin main

cd Player-AD
powershell -ExecutionPolicy Bypass -File .\scripts\install-player-adb.ps1 -NoConfigPush
```

Versão de referência: **Player-AD 2.12** (`versionCode` 112).  
`serverUrl` produção: `https://totemdigital.app.br`

Assistente com pergunta de logos: `Instala-Player-TotemDigital.apk` — ver [04-PLAYER-AD.md](./04-PLAYER-AD.md).

---

## 8. Problemas frequentes

| Sintoma | O que fazer |
|---|---|
| `Your local changes would be overwritten by merge` | `git stash` e voltar a `pull --ff-only origin main` |
| Actualizei com `--modo producao` por engano | Parar; restore do backup; não repetir |
| Serviço em baixo após update | `sudo systemctl status smart-signage` + `journalctl -u smart-signage -n 100` |
| HTTPS / Nginx / WS | `--modo reparar` + [01 § pós-instalação](./01-PRODUCAO-DIRECT-TOTEM.md) |
| Preciso reverter tudo | `restore-totemdigital-prod.sh` com a pasta do backup |

Ajuda dos scripts:

```bash
bash scripts/Instala-TotemDigital-Server.sh --ajuda
bash scripts/backup-totemdigital-prod.sh --ajuda
bash scripts/restore-totemdigital-prod.sh --ajuda
```

---

## 9. Versões de referência (baseline)

```text
Branch:    main (default no GitHub)
Frontend:  2.1.22
Backend:   2.1.16
Player-AD: 2.12 / 112
Commit:    cf7260bb
```

Fim do mini-livreto.
