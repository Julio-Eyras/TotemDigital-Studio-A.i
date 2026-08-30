# Fiabilidade Fase 2 — Player-Linux

Contrato HTTP e RN-PAD **não mudam**. Objectivo: **provar** parse, cache, jsonl e dedup sem ecrã.

## O que entra

| Superfície | Teste (`ctest`) |
|------------|-----------------|
| Parse JSON | `parseDispatchPlan` (mediaId numérico, snake_case, `contentVersion`); `stripVinhetasFromOnlinePlan`; `PlayerConfig` (TRIM+UPPER, clamps); `DisplaySchedule` merge preserva `forceMode` |
| Cache `contentVersion` | `MediaCache::cacheVersionHit`; hit em disco **não** descarrega |
| Fila events com tecto | `rotateJsonlIfNeeded` — abaixo do limite fica; acima → `.1` |
| CommandExecutor dedup | `CommandReceipts` persistido, at-most-once, tecto 200 (ao passar, fica só o id novo) |

Sanitizers: `-DPLAYER_LINUX_SANITIZE=ON` (ASan + UBSan). Job local / WSL, não CI GitHub.

```bash
cd Player-Linux
bash scripts/run-ctest.sh
```

Ou:

```bash
cmake -S . -B build-test -DCMAKE_BUILD_TYPE=Debug \
  -DPLAYER_LINUX_WITH_GSTREAMER=OFF -DPLAYER_LINUX_SANITIZE=ON
cmake --build build-test --target player-linux-tests
ctest --test-dir build-test --output-on-failure
```

## Fora desta fase

Overlay debug X11, `.deb` reproduzível, soak 8–24 h (Fase 3).
