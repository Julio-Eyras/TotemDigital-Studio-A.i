# Fiabilidade Fase 1 — Player-Linux

Contrato HTTP e RN-PAD **não mudam**. Objectivo: o processo sobrevive a GST, HTML, HTTP lento e OTA.

## O que entrou

| Falha | Mitigação |
|-------|-----------|
| GST `ERROR` tratado como “ainda a tocar” | `isPlaying()` devolve false e loga; o loop passa ao item seguinte |
| Chromium zombie / órfão | `setpgid` + `kill(-pid)` + `waitpid`; HTML morto → fim do item |
| `curl` em thread de rede + playback | `CURLOPT_NOSIGNAL`; timeouts; token com mutex; **HTTP fora** do `mu_` |
| OTA/`dpkg` a meio do vídeo | download na rede; **install só depois** de `backend->stop()`; `_Exit(0)` para o systemd relançar |
| Reboot com pipeline vivo | ACK → fila → parar playback → `systemctl reboot` |
| SIGUSR1 no handler | só `atomic`; `releaseKiosk()` no loop principal |
| systemd hung | `Type=notify` + `WatchdogSec=30` + `WATCHDOG=1` no loop (incluindo idle) |
| jsonl sem tecto | `events-v2.jsonl` > 8 MiB → rename `.1` |

## Unidade systemd

`scripts/player-linux.service`: `Type=notify`, `WatchdogSec=30`. Instalar **binário e unidade juntos** (`install-player-linux.sh`). Binário antigo + unidade nova: o systemd mata o processo aos 30 s sem keepalive.

## Fora desta fase

Testes C++/`ctest`, ASan, overlay X11, plymouth.
