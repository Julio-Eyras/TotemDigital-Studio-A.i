# Etapa E — Workers, bootstrap e hardening multi-agência

**Branch:** `TotemDigital-MultiAgencia`  
**Depende de:** master switch (`docs/MODO-MULTI-AGENCIA-MASTER-SWITCH.md`)

## O que mudou

1. **Workers no boot** leem `resolveInstallationCapabilities` → `buildOperationalWorkerFlags`:
   - Bull export/agenda → `modules.multi_agency` (+ Redis)
   - Playlist Mix/Engine → `modules.playlists_advanced`
   - Billing (Invoice/Financial) → `modules.billing`
   - Subscriber access worker → `modules.subscribers`
   - Cron de alertas → `dispatcher_admin` ou `multi_agency`
2. **Studio (compact)** nunca arranca Bull; outras flags vêm das capabilities.
3. **API** `/api/playlist-engine` exige `playlists_advanced`.
4. **Bootstrap seguro** ao activar multi-agência: se `COUNT(publishers activos)=0`, cria **uma** organização `is_system_owner` (não cria 2ª agência).
5. **PUT avançado** sincroniza `installation.profile` se `multi_agency` mudar e devolve `requiresBackendRestart`.
6. **UI** alerta persistente de restart do backend (reload da UI ≠ restart do serviço).

## Testar

```bash
cd ~/TotemDigital-Studio && git fetch && git checkout TotemDigital-MultiAgencia && git pull
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Complementos → activar multi-agência → confirmar aviso de restart → `systemctl restart` (ou equivalente da instância)
2. Logs do backend devem mostrar workers Bull/billing/playlist conforme módulos
3. Desactivar → restart → Bull/comercial off; Direct Totem de volta
4. Com modo off, `GET /api/playlist-engine/...` → 403 `MODULE_DISABLED`

## Ainda fora

- Hot-reload de workers sem restart do processo
- DNS/portal one-click
- Seed automático de 2ª organização / anunciante demo
