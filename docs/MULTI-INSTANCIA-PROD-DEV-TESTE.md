# Multi-instância no mesmo servidor — produção, desenvolvimento e testes

**Data:** 2026-07-30  
**Contexto:** TotemDigital Studio · branch `SmartSignage-direc-totem`  
**Relacionado:** [INSTALA-TOTEMDIGITAL-SERVER.md](./INSTALA-TOTEMDIGITAL-SERVER.md) · [ORGANIZACAO-BRANCHES.md](./ORGANIZACAO-BRANCHES.md)

---

## 1. Resumo

Três ambientes isolados no **mesmo VPS**, cada um com clone, BD, portas, systemd e Nginx próprios.

| Instância | Domínio sugerido | Clone | Deploy | BD | Backend | HTTP aux. |
|-----------|------------------|-------|--------|-----|---------|-----------|
| **producao** | `totemdigital.app.br` | `~/TotemDigital-Studio` | `/opt/smart-signage` | `smartsignage` | `:3000` | `:8080` |
| **dev** | `dev.totemdigital.app.br` | `~/TotemDigital-Studio-dev` | `/opt/totemdigital-dev` | `smartsignage_dev` | `:3001` | `:8081` |
| **teste** | `test.totemdigital.app.br` | `~/TotemDigital-Studio-test` | `/opt/totemdigital-test` | `smartsignage_test` | `:3002` | `:8082` |

---

## 2. DNS (registos A no mesmo IP)

```text
totemdigital.app.br        → VPS produção (apex)
dev.totemdigital.app.br    → mesmo IP
test.totemdigital.app.br   → mesmo IP
```

Evitar **AAAA** se IPv6 na 443 não estiver configurado (Player-AD / boxes antigas).

---

## 3. Ficheiros modelo (no repositório)

Templates gerados automaticamente pelo instalador v1.1+:

| Ficheiro | Destino no servidor |
|----------|---------------------|
| `scripts/templates/instancia/env.instancia.example` | `~/TotemDigital-Studio-{dev,test}/.env` |
| `scripts/templates/instancia/nginx.instancia.conf.tpl` | `/etc/nginx/sites-available/totemdigital-{dev,test}` |
| `scripts/templates/instancia/systemd.service.tpl` | `/etc/systemd/system/smart-signage-{dev,test}.service` |

Lógica: `scripts/lib/totemdigital-instancia.sh` (sourced por `Instala-TotemDigital-Server.sh`).

### 3.1 systemd (exemplo dev)

```ini
# /etc/systemd/system/smart-signage-dev.service
[Unit]
Description=TotemDigital Backend (Desenvolvimento — dev.totemdigital.app.br)
After=network.target postgresql.service

[Service]
User=smartchannel
WorkingDirectory=/home/smartchannel/TotemDigital-Studio-dev/backend
ExecStart=/usr/bin/node dist/index.js
Environment=PLAYER_DIR=/opt/totemdigital-dev/player-web
EnvironmentFile=-/home/smartchannel/TotemDigital-Studio-dev/.env
Restart=always
```

### 3.2 Nginx (exemplo dev)

- **443** — `dev.totemdigital.app.br` → frontend estático + `/api/` → `127.0.0.1:3001`
- **8081** — painel HTTP auxiliar (IP/LAN)
- Certificado LE: `/etc/letsencrypt/live/dev.totemdigital.app.br/`

### 3.3 `.env` (exemplo dev — campos críticos)

```bash
PORT=3001
DOMAIN_NAME=dev.totemdigital.app.br
DATABASE_URL=postgresql://smartsignage_dev:***@localhost:5432/smartsignage_dev
UPLOAD_PATH=/opt/totemdigital-dev/public/assets/uploads
FRONTEND_BUILD_PATH=/opt/totemdigital-dev/frontend/build
PLAYER_DIR=/opt/totemdigital-dev/player-web
TOTEMDIGITAL_COMPACT=true
DIRECT_TOTEM_MODE=true
# JWT_SECRET, TOTEM_SECRET_KEY — distintos de produção
```

---

## 4. Comandos no VPS

### Produção (motor completo — inalterado)

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/Instala-TotemDigital-Server.sh --modo producao
# updates sem DROP:
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar
```

### Desenvolvimento (stack isolada — **não** chama `install-smartsignage.sh`)

```bash
cd ~/TotemDigital-Studio
git pull
bash scripts/Instala-TotemDigital-Server.sh --modo producao --instancia dev --sim \
  --email admin@totemdigital.app.br --owner-user ismael

# Actualizar código (sem apagar BD):
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull

# Wipe só da BD dev:
bash scripts/Instala-TotemDigital-Server.sh --modo wipe --instancia dev
```

### Testes / homologação

```bash
bash scripts/Instala-TotemDigital-Server.sh --modo producao --instancia teste --sim
bash scripts/Instala-TotemDigital-Server.sh --modo wipe --instancia teste   # interactivo
```

### Dry-run (ver plano sem executar)

```bash
bash scripts/Instala-TotemDigital-Server.sh --dry-run --modo producao --instancia dev
```

---

## 5. O que cada modo faz por instância

| Modo | producao | dev / teste |
|------|----------|-------------|
| **producao** | Motor `install-smartsignage.sh` + LE split | Clone, BD, schema v2, build, systemd, Nginx, certbot |
| **atualizar** | Rebuild + Nginx prod | git pull opcional, rebuild, restart unit dedicada |
| **reparar** | `.env` + Nginx prod | `.env` + systemd + Nginx da instância |
| **wipe** | `--fresh` motor (**smartsignage**) | DROP só `smartsignage_dev` ou `smartsignage_test` |
| **docker** | Motor Docker | **Não suportado** para dev/test nesta versão |

---

## 6. Player-AD

| Uso | `serverUrl` |
|-----|-------------|
| Totens em campo | **só produção** (`https://totemdigital.app.br`) |
| Box de laboratório | `https://dev.…` ou `https://test.…` |

---

## 7. O que não fazer

1. Três installs de **produção** no mesmo `~/TotemDigital-Studio`.  
2. Partilhar BD ou `JWT_SECRET` entre ambientes.  
3. `--modo wipe` sem `--instancia` em ambiente partilhado (apaga produção).  
4. Apontar Player-AD de clientes para dev/test.

---

## 8. Diagrama operacional

```text
┌──────────────────────────────────────────────────────────────┐
│                        Mesmo VPS                              │
├─────────────────┬────────────────────┬───────────────────────┤
│ PRODUÇÃO        │ DEV                 │ TESTE                 │
│ motor install   │ --instancia dev     │ --instancia teste     │
│ :3000 / :8080   │ :3001 / :8081       │ :3002 / :8082         │
│ smartsignage    │ smartsignage_dev    │ smartsignage_test     │
│ wipe = PERIGO   │ wipe OK             │ wipe OK               │
└─────────────────┴────────────────────┴───────────────────────┘
```

---

## 9. Checklist pós-instalação

- [ ] DNS A para `dev.` e `test.`  
- [ ] `curl -sI https://dev.totemdigital.app.br/login` → 200  
- [ ] `systemctl status smart-signage-dev` → active  
- [ ] Produção intacta: `curl -sI https://totemdigital.app.br/login`  
- [ ] Segredos distintos em cada `.env`  
- [ ] Player-AD de campo → só apex produção  
