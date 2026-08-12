# Manutenção — atualização, reparação, Docker, wipe, backup e restore

## 1. Atualização normal (sem apagar BD)

Faça backup antes de atualizar produção:

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh --instancia producao --sim
```

Atualização:

```bash
cd ~/TotemDigital-Studio
git fetch origin
git checkout main
git pull --ff-only origin main
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia producao \
  --git-pull \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

Para DEV/TESTE, troque `--instancia` e `--dominio`. Guia curto: [05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](./05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md).

## 2. Reparação

Use quando o código já está instalado, mas `.env`, HTTPS, Nginx ou serviço ficaram inconsistentes:

```bash
# Produção
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar --instancia producao --sim \
  --dominio totemdigital.app.br

# DEV
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar --instancia dev --sim \
  --dominio dev.totemdigital.app.br

# TESTE
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar --instancia teste --sim \
  --dominio test.totemdigital.app.br
```

## 3. Docker

Docker só suporta a instância de produção neste wrapper:

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo docker \
  --instancia producao \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael
```

Não use `--instancia dev` ou `--instancia teste` com `--modo docker`.

## 4. Backup integral

### Produção

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh \
  --instancia producao \
  --sim
```

### DEV e TESTE

```bash
bash scripts/backup-totemdigital-prod.sh --instancia dev --sim
bash scripts/backup-totemdigital-prod.sh --instancia teste --sim
```

### Diretório escolhido

```bash
bash scripts/backup-totemdigital-prod.sh \
  --instancia producao \
  --out ~/backups/producao-antes-do-deploy \
  --sim
```

### Opções

```text
--keep-running  não para o serviço durante o dump
--sem-le        não inclui /etc/letsencrypt
--sem-sql       gera apenas o dump custom PostgreSQL
```

Verifique o resultado:

```bash
ls -lah ~/backups/producao-antes-do-deploy
cat ~/backups/producao-antes-do-deploy/MANIFEST.txt
```

## 5. Restore

### Simular

```bash
cd ~/TotemDigital-Studio
bash scripts/restore-totemdigital-prod.sh \
  ~/backups/producao-AAAAmmdd_HHMMSS \
  --instancia producao \
  --dry-run
```

### Restaurar BD e uploads

```bash
bash scripts/restore-totemdigital-prod.sh \
  ~/backups/producao-AAAAmmdd_HHMMSS \
  --instancia producao \
  --sim
```

### Restaurar também configuração

```bash
bash scripts/restore-totemdigital-prod.sh \
  ~/backups/producao-AAAAmmdd_HHMMSS \
  --instancia producao \
  --with-env \
  --with-nginx \
  --with-le \
  --sim
```

Use as três flags extras somente quando realmente quiser substituir os arquivos atuais.

### Restore DEV/TESTE

```bash
bash scripts/restore-totemdigital-prod.sh \
  ~/backups/dev-AAAAmmdd_HHMMSS \
  --instancia dev \
  --sim

bash scripts/restore-totemdigital-prod.sh \
  ~/backups/teste-AAAAmmdd_HHMMSS \
  --instancia teste \
  --sim
```

## 6. Wipe

> Ação destrutiva. O instalador exige confirmação interativa e bloqueia wipe com `--sim`.

```bash
# Produção — apaga smartsignage:
bash scripts/Instala-TotemDigital-Server.sh \
  --modo wipe \
  --instancia producao \
  --dominio totemdigital.app.br

# DEV — apaga somente smartsignage_dev:
bash scripts/Instala-TotemDigital-Server.sh \
  --modo wipe \
  --instancia dev \
  --dominio dev.totemdigital.app.br

# TESTE — apaga somente smartsignage_test:
bash scripts/Instala-TotemDigital-Server.sh \
  --modo wipe \
  --instancia teste \
  --dominio test.totemdigital.app.br
```

Faça backup antes de qualquer wipe.

## 7. Diagnóstico pós-operação

```bash
# Serviços
sudo systemctl status smart-signage --no-pager
sudo systemctl status smart-signage-dev --no-pager
sudo systemctl status smart-signage-test --no-pager

# Logs
sudo journalctl -u smart-signage -n 100 --no-pager
sudo journalctl -u smart-signage-dev -n 100 --no-pager
sudo journalctl -u smart-signage-test -n 100 --no-pager

# Nginx e portas
sudo nginx -t
sudo ss -lntp | grep -E ':80|:443|:3000|:3001|:3002|:8080|:8081|:8082'

# APIs
curl -fsS https://totemdigital.app.br/api/health
curl -fsS https://dev.totemdigital.app.br/api/health
curl -fsS https://test.totemdigital.app.br/api/health
```

