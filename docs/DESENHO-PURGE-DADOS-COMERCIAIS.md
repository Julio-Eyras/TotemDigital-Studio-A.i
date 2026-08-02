# Desenho — Purge explícito de dados comerciais (multi-agência OFF)

**Branch:** `TotemDigital-MultiAgencia`  
**Estado:** implementado (API + service + UI + schedule)  
**Relacionado:** D3 / D6 em `MODO-MULTI-AGENCIA-MASTER-SWITCH.md`

## Objectivo

Permitir **apagar de propósito** dados comerciais (billing, contratos, campanhas, playlists, anunciantes opcional, media em disco opcional) **sem** ligar isso ao botão OFF do multi-agência.

O OFF continua a só **esconder** superfícies (arquivo silencioso).

## Princípios

1. **Nunca** cascade delete no `PUT /api/installation/multi-agency { mode: "off" }`
2. Purge = acção separada, `owner_system` / `admin_sql`
3. Ordem destrutiva segura (filhos → pais)
4. Dry-run por defeito; execução real exige confirmação tipada
5. Audit log + export JSON em `runtime/purges/<timestamp>/`

## Confirmação tipada

```text
APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO
```

Body:

```json
{
  "dryRun": false,
  "confirmPhrase": "APAGAR DADOS COMERCIAIS DESTA INSTALAÇÃO",
  "scopes": ["billing", "campaigns", "playlists", "contracts", "subscribers", "media_files"],
  "publisherId": null,
  "keepPublishers": true,
  "keepMediaFiles": true
}
```

- `publisherId` preenchido → purge **parcial** só dessa organização
- `keepMediaFiles: false` → inclui scope `media_files` (BD + disco via StorageService)

## Scopes

| Scope | O que apaga | Nota |
|-------|-------------|------|
| `billing` | billing publisher/subscriber | primeiro |
| `campaigns` | campanhas + relações | |
| `playlists` | playlists + items | |
| `contracts` | contratos | após billing |
| `media_files` | `medias` + ficheiros em disco | só se `keepMediaFiles=false` |
| `subscribers` | anunciantes + SPA | opcional / perigoso |
| `publishers_extra` | orgs não system owner | só se `keepPublishers=false` |

## API

```
POST /api/installation/commercial-purge/preview
POST /api/installation/commercial-purge          → dryRun default true
GET  /api/installation/commercial-purge/last
GET  /api/installation/commercial-purge/schedule
PUT  /api/installation/commercial-purge/schedule → cron + enabled
```

Schema: `installation_purge_runs`, `installation_purge_schedules` (part2 tables-base).

Worker: tick minuto a minuto em `operationalWorkersLifecycle` → `tickPurgeSchedule`.

## UI

Complementos → acordeão vermelho «Zona de perigo»:

1. Pré-visualizar / dry-run  
2. `publisher_id` opcional  
3. Manter media (switch)  
4. Frase + executar  
5. Agendar cron

## Critérios de aceite

- [x] OFF multi-agência **não** chama purge  
- [x] Preview sem escrita  
- [x] Frase errada → 400  
- [x] dryRun=true → zero DELETE  
- [x] Audit + pasta de export  
- [x] Media em disco (scope opcional)  
- [x] Purge parcial por org  
- [x] Agendamento  
