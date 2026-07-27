# Cache e metadados — Player-AD

Documento de referência (substitui a referência fantasma citada no código antigo).  
Alinhado a Player-AD **1.88+**. Ver também `HANDOFF-IA-SISTEMA-ARMAZENAMENTO-CACHE.md`.

## Layout no root (`AppDirs.root`)

```
<root>/
  propagandas/           # cache de mídias
    metadata.json        # metadados + sum_play
    {mediaId}.{ext}
  vinhetas/
  last-dispatch-plan.json
  current-plan-source.txt
  screenshots/           # se usado
```

Root resolvido por `StorageRootResolver` conforme `storage` no `player-config.json`  
(default de campo: `external_primary`).

## Limites

| Mecanismo | Comportamento |
|---|---|
| `maxCacheSizeMb` | Default 1000; 50–8192 |
| `maxCachePercentOfVolume` | Opcional 1–90; teto = min(MB, % do totalSpace) |
| LRU preferencial | Entradas `valid` com `lastAccessed` ≥ 8 dias |
| LRU sob pressão | Se ainda acima do teto, remove sem filtro de idade |
| Gate de disco | Antes do download: `ensureDiskSpaceFor` (+ reserva 200 MB) |
| Probe de escrita | `StorageRootResolver.probeWritableDirectory` |

## `metadata.json`

Por `mediaId`: `fileName`, `size`, `valid`, `lastAccessed`, `downloadedAt`, `sum_play`,  
`cacheOrientationReady`, `cacheRotated`, `contentVersion`, etc.

- `purge_cache` remoto: apaga ficheiros e chama `invalidateAllEntriesKeepHistory()` (mantém histórico).
- Mudança de root: `StorageRootMigrator` copia o que faltar; `MediaCacheManager.reloadStorageRootsIfNeeded`.

## Eventos de volume

`StorageVolumeMonitor` escuta eject/unmount/mount → debounce → migração + reinício do loop em `MainActivity`.
