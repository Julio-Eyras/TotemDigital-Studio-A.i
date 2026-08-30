# Arquitectura — Player-Linux

Espelha os pacotes do Player-AD (`api`, `config`, `cache`, `playback`, `ota`, `util`).

```text
Player-Linux/
├── CMakeLists.txt
├── README.md
├── config/exemplo-player-config.json
├── scripts/
│   ├── install-player-linux.sh   # binário + systemd
│   ├── kiosk-escape.sh           # SIGUSR1 (menu 3× OK + overlay debug)
│   ├── apply-branding.sh         # copia logo.png → data/branding/
│   ├── player-linux-xsession.sh  # xset / unclutter
│   ├── player-linux.service
│   └── player-linux.desktop
├── docs/
└── src/
    ├── main.cpp                 # arranque + kiosk/rotação
    ├── version.hpp              # parity AD 2.15/115
    ├── util/                    # logger, paths
    ├── config/                  # PlayerConfig, DisplaySchedule, PollAdaptive
    ├── api/                     # DispatcherClient (libcurl + JSON)
    ├── cache/                   # MediaCache
    ├── playback/                # Orchestrator + GStreamer FIT 720×1280
    ├── remote/                  # CommandExecutor
    └── ops/                     # Wi-Fi NM, screenshot, OTA .deb, HTML kiosk
```

## Threads / fluxo

```text
main
  ├─ carrega config + applyKiosk (xrandr / xset)
  ├─ SIGUSR1 só pede escape (atomic); SIGTERM pede stop
  ├─ splash branding/logo.png (~3 s) se existir
  ├─ systemd READY=1 + watchdog 30 s
  ├─ token + sync/heartbeat (OTA: download na rede, dpkg após stop)
  ├─ dispatch quando necessário (EMPTY_PLAN estável)
  ├─ pré-cache mídias
  └─ loop playback  (thread A)
        ├─ drain OTA/reboot/escape
        ├─ se !schedule.active → idle preto + keep-alive + watchdog
        └─ senão véu 300ms + play item (vídeo FIT / imagem / HTML Chromium)
  thread B netLoop
        └─ HB/dispatch **sem** segurar mu_ durante curl
```

GST `ERROR` → skip item (não aborta). HTML: grupo de processos + `waitpid`. Detalhe: [RELIABILITY-FASE1.md](./RELIABILITY-FASE1.md). Provas sem ecrã: [RELIABILITY-FASE2.md](./RELIABILITY-FASE2.md) (`ctest` + ASan). Campo: [RELIABILITY-FASE3.md](./RELIABILITY-FASE3.md) (overlay 3× OK, `.deb`, soak).

Polls de heartbeat e dispatch são **independentes** do fim do ciclo de playlist (como no Android).

Dispatch HTTP falho + sem plano útil + sem EMPTY_PLAN autoritativo → **FALLBACK_LOCAL** mix N:1 (`fallbackPropagandasPerVinheta`).

## Dependências

| Lib | Uso |
|-----|-----|
| libcurl | HTTP (token, sync, dispatch, OTA download) |
| nlohmann/json | JSON |
| GStreamer (opc.) | vídeo FIT + imagem (`imagefreeze`) |
| Chromium (runtime) | HTML kiosk |
| NetworkManager / nmcli | `configure_wifi` |
| grim ou ImageMagick `import` ou scrot | screenshot |
| dpkg | OTA `.deb` |
| systemd | autostart 24/7 |

## Storage

Definido por `--data-dir` ou `PLAYER_LINUX_DATA` / default `/var/lib/player-linux` (dev: `./data`).

```text
<dataRoot>/
  player-config.json
  display-schedule.json
  last-dispatch-plan.json
  current-plan-source.txt
  remote-command-receipts.json
  ota/incoming.deb last.deb prev.deb
  screenshots/screen.jpg
  propagandas/  vinhetas/
```
