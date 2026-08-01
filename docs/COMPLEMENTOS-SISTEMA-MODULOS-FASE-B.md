# Complementos do sistema — Fase B (gates)

**Branch:** `TotemDigital.app`  
**Depende de:** Fase A (`docs/COMPLEMENTOS-SISTEMA-MODULOS-FASE-A.md`)

## O que mudou

1. **Menu / `canAccess`** — paths complementares só aparecem/entram se o módulo estiver on (`installationModuleAccess.ts`).
2. **API** — `requireModule(...)` nas rotas de campanhas, billing, contratos, anunciantes, OTA, SmartDisplayFX, analytics, dispatcher, devices, playlists avançadas, quick-publish, planos.
3. **Sync runtime** — `directTotemMode`, `simpleTotemMode`, `smartDisplayFx`, `subscriberPortal`, `multiAgency` passam a reflectir `capabilities.modules` após merge com defaults/overrides.
4. Após **Guardar** no painel, a UI **recarrega** para aplicar o `ui-context`.

## Núcleo (sempre on)

- `core_publish`, `organization`
- Rotas: auth, media, totems, publishers, locals, users, settings, health, dashboard

## Testar

```bash
cd ~/TotemDigital-Studio && git checkout TotemDigital.app && git pull
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Login `owner_system` / `admin_sql` → **Complementos do sistema**
2. Desligar **Campanhas** → Guardar → menu/rota `/campaigns` deve falhar (UI e API 403 `MODULE_DISABLED`)
3. Ligar de novo → voltar a funcionar
4. Desligar **Modo Direct Totem** → após reload, menu deixa de ser o mínimo (sujeito a outros módulos)

## Ainda não coberto (próximas ondas)

- ~~Workers Bull só quando `multi_agency` on~~ → feito na Etapa E (`docs/ETAPA-E-MULTI-AGENCIA-WORKERS.md`)
- Seeds/DNS automáticos de portal / 2ª agência
- Hot-reload de workers sem restart
- Checklist comercial completo por módulo
