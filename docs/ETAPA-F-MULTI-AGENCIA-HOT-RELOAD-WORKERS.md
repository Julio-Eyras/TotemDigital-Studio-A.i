# Etapa F — Hot-reload de workers multi-agência

**Branch:** `TotemDigital-MultiAgencia`  
**Depende de:** Etapa E (`docs/ETAPA-E-MULTI-AGENCIA-WORKERS.md`)

## O que mudou

1. **`operationalWorkersLifecycle.ts`** — `reconcileOperationalWorkers` faz diff das flags e liga/desliga:
   - Bull export/agenda
   - Billing (Invoice + Financial)
   - Subscriber access
   - Playlist Mix / Engine
   - Cron de alertas (com handle guardado)
2. **Master switch / PUT avançado** chamam `warmInstallationRuntime` + `reconcileWorkersFromCapabilities`.
3. **`requiresBackendRestart`** só fica `true` se o hot-reload falhar; em sucesso vem `workersReconciled: true`.
4. Guards anti double-start nos workers cron e nos `register*Worker` Bull.
5. Shutdown do processo usa `stopOperationalWorkers`.

## Testar

```bash
cd ~/TotemDigital-Studio && git fetch && git checkout TotemDigital-MultiAgencia && git pull
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Complementos → activar multi-agência → mensagem deve dizer workers em runtime (sem pedir restart)
2. Logs: `Hot-reload workers: reconcile workers`
3. Desactivar → workers comerciais param sem `systemctl restart`
4. Se Redis/Bull falhar no reconcile, a UI pede restart (fallback)

## Ainda fora

- DNS/portal one-click
- Seed automático de 2ª organização / anunciante demo
