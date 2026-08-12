# DEV e TESTE — multi-instância no mesmo VPS

Instala ambientes isolados sem alterar a produção em `/opt/smart-signage`.

## Mapa das instâncias

| Item | DEV | TESTE |
|---|---|---|
| Branch padrão nos exemplos | `main` | `main` |
| Clone | `~/TotemDigital-Studio-dev` | `~/TotemDigital-Studio-test` |
| Deploy | `/opt/totemdigital-dev` | `/opt/totemdigital-test` |
| BD | `smartsignage_dev` | `smartsignage_test` |
| Serviço | `smart-signage-dev` | `smart-signage-test` |
| API | 3001 | 3002 |
| HTTP auxiliar | 8081 | 8082 |
| Domínio | `dev.totemdigital.app.br` | `test.totemdigital.app.br` |
| Uploads | `/opt/totemdigital-dev/public/assets/uploads` | `/opt/totemdigital-test/public/assets/uploads` |

> Guia curto do zero + actualizar sem perder dados: [05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](./05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md)

## 1. Preparar o clone controlador

O instalador pode criar automaticamente os clones DEV/TESTE. Execute-o a partir do clone principal:

```bash
cd ~/TotemDigital-Studio
git fetch origin
git checkout main
git pull --ff-only origin main
export TDI_GIT_BRANCH=main
```

## 2. Instalar DEV do zero

### Simulação

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia dev \
  --dry-run \
  --sim \
  --dominio dev.totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

### Execução

```bash
cd ~/TotemDigital-Studio
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

## 3. Atualizar DEV

```bash
cd ~/TotemDigital-Studio-dev
git fetch origin
git checkout main
git pull --ff-only origin main

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

## 4. Instalar TESTE do zero

```bash
cd ~/TotemDigital-Studio
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

## 5. Atualizar TESTE

```bash
cd ~/TotemDigital-Studio-test
git fetch origin
git checkout main
git pull --ff-only origin main

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

## 6. Assistente interativo

```bash
cd ~/TotemDigital-Studio
bash scripts/run-instala-totemdigital-prompt.sh

# Preset DEV:
bash scripts/run-instala-totemdigital-prompt.sh --defaults-dev
```

## 7. Reparar uma instância

```bash
# DEV
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar --instancia dev --sim \
  --dominio dev.totemdigital.app.br

# TESTE
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar --instancia teste --sim \
  --dominio test.totemdigital.app.br
```

## 8. Wipe isolado

> O wipe é interativo e não aceita `--sim`. Confirme cuidadosamente a instância.

```bash
# Apaga somente smartsignage_dev:
bash scripts/Instala-TotemDigital-Server.sh \
  --modo wipe --instancia dev \
  --dominio dev.totemdigital.app.br

# Apaga somente smartsignage_test:
bash scripts/Instala-TotemDigital-Server.sh \
  --modo wipe --instancia teste \
  --dominio test.totemdigital.app.br
```

## 9. Validar isolamento e storage

```bash
sudo systemctl status smart-signage-dev --no-pager
sudo systemctl status smart-signage-test --no-pager
sudo nginx -t

curl -fsS https://dev.totemdigital.app.br/api/health
curl -fsS https://test.totemdigital.app.br/api/health
curl -fsS https://totemdigital.app.br/api/health

git -C ~/TotemDigital-Studio-dev branch --show-current
git -C ~/TotemDigital-Studio-test branch --show-current

sudo ls -la /opt/totemdigital-dev/public/assets/uploads
sudo ls -la /opt/totemdigital-test/public/assets/uploads

grep -E '^(UPLOAD_PATH|ASSETS_BASE_PATH)=' ~/TotemDigital-Studio-dev/.env
grep -E '^(UPLOAD_PATH|ASSETS_BASE_PATH)=' ~/TotemDigital-Studio-test/.env
```

Valores esperados:

```text
DEV:
UPLOAD_PATH=/opt/totemdigital-dev/public/assets/uploads
ASSETS_BASE_PATH=/opt/totemdigital-dev/public/assets

TESTE:
UPLOAD_PATH=/opt/totemdigital-test/public/assets/uploads
ASSETS_BASE_PATH=/opt/totemdigital-test/public/assets
```

## 10. Backups

```bash
cd ~/TotemDigital-Studio

bash scripts/backup-totemdigital-prod.sh --instancia dev --sim
bash scripts/backup-totemdigital-prod.sh --instancia teste --sim
```

