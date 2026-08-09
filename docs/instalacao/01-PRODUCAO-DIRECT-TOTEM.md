# Produção — Direct Totem

Sequência de comandos para produção com perfil compacto, Direct Totem, Nginx e HTTPS.

## Valores esperados

```text
Branch: main
Clone: ~/TotemDigital-Studio
Deploy: /opt/smart-signage
BD: smartsignage
Serviço: smart-signage
Domínio: totemdigital.app.br
Painel auxiliar: :8080
```

## 1. Pré-requisitos

Antes do install:

- DNS A de `totemdigital.app.br` apontando para o VPS;
- portas TCP 80, 443 e 8080 abertas;
- Git, Node.js, PostgreSQL, Nginx e Certbot disponíveis;
- utilizador normal com acesso a `sudo`;
- remover DNS AAAA caso o VPS não aceite HTTPS por IPv6.

Verificação:

```bash
node -v
npm -v
git --version
psql --version
nginx -v
certbot --version
sudo -v
```

## 2. Obter a branch correta

### Primeiro clone

```bash
cd ~
git clone --branch main \
  https://github.com/Julio-Eyras/TotemDigital-Studio.git \
  TotemDigital-Studio
cd ~/TotemDigital-Studio
git status -sb
```

### Clone já existente

```bash
cd ~/TotemDigital-Studio
git fetch origin
git checkout main
git pull --ff-only origin main
git status -sb
git log -1 --oneline
```

## 3. Simular antes de instalar

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

## 4. Instalação nova de produção

> Use somente para instalação nova. O motor pode recriar a BD se identificar reinstalação limpa.

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=main

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao \
  --instancia producao \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br \
  --owner-user ismael \
  --owner-name "Totem Digital"
```

O wrapper ativa automaticamente:

- `--totemdigital-compact`;
- `--direct-totem`;
- frontend/site na porta 80;
- painel auxiliar na porta 8080;
- HTTPS unificado na porta 443;
- MQTT desligado por padrão.

Para incluir MQTT ou players:

```bash
# Acrescente apenas se necessário:
--com-mqtt
--com-players
--com-seeds
```

## 5. Atualização segura de produção

### 5.1 Backup integral

```bash
cd ~/TotemDigital-Studio
bash scripts/backup-totemdigital-prod.sh \
  --instancia producao \
  --sim
```

Guarde o diretório informado pelo script.

### 5.2 Atualizar branch e executar deploy

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
  --owner-user ismael \
  --owner-name "Totem Digital"
```

O modo `atualizar` preserva a BD e executa build, deploy, correções de `.env`/HTTPS e restart do serviço.

## 6. Pós-instalação

```bash
sudo systemctl status smart-signage --no-pager
sudo journalctl -u smart-signage -n 100 --no-pager
sudo nginx -t
sudo bash scripts/fix-nginx-websocket.sh
sudo nginx -T 2>/dev/null | grep -A12 -B2 "location /ws"
curl -fsS https://totemdigital.app.br/api/health
curl -sI https://totemdigital.app.br/login

git -C ~/TotemDigital-Studio branch --show-current
git -C ~/TotemDigital-Studio log -1 --oneline

sudo ls -la /opt/smart-signage/public/assets/uploads
```

Baseline esperado:

```text
Branch:    main
Frontend:  2.1.17
Backend:   2.1.11
Player-AD: 2.07 / 107
Commit funcional de origem: 4bc88462
```

URLs:

```text
Site/painel: https://totemdigital.app.br
Login:       https://totemdigital.app.br/login
API:         https://totemdigital.app.br/api
Player-AD:   serverUrl=https://totemdigital.app.br
Auxiliar:    http://IP_DO_VPS:8080/login
```

No DevTools, a conexão em **Network → WS** deve usar
`wss://totemdigital.app.br/ws` e receber `101 Switching Protocols`. Não deve
existir `/api/ws`. O bloco Nginx `/ws` deve conter `access_log off;` para não
persistir o JWT da query string em logs de acesso.

## 7. Reparação sem rebuild

```bash
cd ~/TotemDigital-Studio
bash scripts/Instala-TotemDigital-Server.sh \
  --modo reparar \
  --instancia producao \
  --sim \
  --dominio totemdigital.app.br \
  --email admin@totemdigital.app.br
```

## 8. Rollback

```bash
cd ~/TotemDigital-Studio
bash scripts/restore-totemdigital-prod.sh \
  ~/backups/producao-AAAAmmdd_HHMMSS \
  --instancia producao \
  --sim
```

Use `--with-env`, `--with-nginx` ou `--with-le` somente se também precisar restaurar essas configurações.

