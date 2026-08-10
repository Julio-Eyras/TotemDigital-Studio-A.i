# Deploy / teste — TotemDigital-Lacunas-MA

**PR:** https://github.com/Julio-Eyras/TotemDigital-Studio/pull/1  
**Branch:** `TotemDigital-Lacunas-MA` (`bc13021f`)  
**Alvo recomendado antes de produção:** instância **TESTE** (`/opt/totemdigital-test`), não `/opt/smart-signage`.

## No VPS (TESTE)

```bash
cd /opt/totemdigital-test
sudo systemctl stop totemdigital-test || sudo systemctl stop smart-signage-test || true

# backup rápido
tar -czf /root/backup-totemdigital-test-$(date +%Y%m%d%H%M).tgz \
  --exclude=node_modules --exclude=.git \
  /opt/totemdigital-test/backend/.env \
  /opt/totemdigital-test/frontend/.env 2>/dev/null || true

git fetch origin TotemDigital-Lacunas-MA
git checkout TotemDigital-Lacunas-MA
git pull origin TotemDigital-Lacunas-MA

# backend
cd /opt/totemdigital-test/backend && npm ci && npm run build
# frontend
cd /opt/totemdigital-test/frontend && npm ci && npm run build

sudo systemctl start totemdigital-test || sudo systemctl restart smart-signage-test
curl -sS http://localhost:3000/api/health | head
```

> Nomes exactos de systemd/portas variam por instalação — ajustar ao serviço TESTE real.

## Smoke pós-deploy

1. Login admin Direct → home `/publish-totem`
2. Abrir mídia da biblioteca (só publisher) → sem 404
3. Menu: sem Tags; `/plans` redireciona
4. `GET /api/tags` autenticado → `501 FEATURE_DEFERRED`
5. Comando remoto + HB: `remote_commands.status` ∈ `completed|failed|…` (nunca `executed`)

## Produção

Só após smoke OK em TESTE e merge do PR #1 em `main`.
