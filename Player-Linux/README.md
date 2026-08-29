# Player-Linux

Player de sinalização digital para **Linux** (totem / PC / painel), em **C++17**, com **parity funcional** face ao **Player-AD 2.15 (versionCode 115)**.

| Campo | Valor |
|-------|--------|
| Paridade alvo | Player-AD **Vs2.15-build-115** (`br.com.smartchannel.playerad`) |
| Linguagem | C++17 |
| Build | CMake ≥ 3.16 |
| Platform (API) | `"linux"` |
| Versão deste projecto | `0.1.0` |

## Objectivo

Reproduzir no Linux as **mesmas regras de negócio, contratos de API, config JSON, cache, horário de tela, comandos remotos, poll adaptativo e ciclo de playback** já definidos no Player-AD Android — trocando apenas a camada de SO (GStreamer/Chromium em vez de ExoPlayer/WebView; systemd/X11 em vez de lock-task).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/PARITY-PLAYER-AD-2.13.md](./docs/PARITY-PLAYER-AD-2.13.md) | Checklist de parity Android → Linux (alvo 2.15/115) |
| [docs/ARQUITETURA.md](./docs/ARQUITETURA.md) | Módulos C++, threads, storage |
| [docs/API-E-CONFIG.md](./docs/API-E-CONFIG.md) | Endpoints e schema `player-config.json` |
| [../docs/players/EQUIVALENCIA-PLAYER-AD-2.15.md](../docs/players/EQUIVALENCIA-PLAYER-AD-2.15.md) | Mapa cruzado AD / Linux / WOS / Tizen |
| [config/exemplo-player-config.json](./config/exemplo-player-config.json) | Modelo de configuração (igual ao kit Android) |

## Build (Linux)

```bash
sudo apt-get install -y build-essential cmake libcurl4-openssl-dev \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  gstreamer1.0-plugins-good gstreamer1.0-libav \
  nlohmann-json3-dev pkg-config chromium network-manager \
  grim scrot imagemagick

cd Player-Linux
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j"$(nproc)"
./build/player-linux --config config/exemplo-player-config.json
```

Sem GStreamer (só heartbeat/dispatch/cache — stub de vídeo):

```bash
cmake -S . -B build -DPLAYER_LINUX_WITH_GSTREAMER=OFF
cmake --build build -j"$(nproc)"
```

Kiosk 24/7 (systemd + autostart):

```bash
sudo ./scripts/install-player-linux.sh
# editar /var/lib/player-linux/player-config.json
# logo de arranque (opcional): sudo ./scripts/apply-branding.sh /caminho/com/logo.png
sudo systemctl start player-linux
# escape (equivalente ao menu 3× OK): sudo ./scripts/kiosk-escape.sh
```

## Layout runtime (parity com Player-AD)

```text
<dataRoot>/                          # ex. /var/lib/player-linux  ou --data-dir
  player-config.json
  display-schedule.json
  player-linux-operations.log
  last-dispatch-plan.json
  current-plan-source.txt
  remote-command-receipts.json
  telemetry/events-v2.jsonl
  ota/  screenshots/  branding/logo.png
  propagandas/
    metadata.json
    {mediaId}.mp4|jpg|png|html|…
  vinhetas/
```

## Estado actual (0.1.0 — fase 2 fechada no software)

- [x] Contrato HTTP 2.15 (token, sync/HB, dispatch condicionado, ACK at-most-once)
- [x] RN-PAD-001…007, vinhetas só no fallback, poll adaptativo
- [x] Playback GStreamer FIT 720×1280, imagem (10 s), véu preto
- [x] HTML via Chromium `--kiosk` (duração mín. 30 s / default 60 s)
- [x] OTA `.deb` + SHA-256 + rollback; screenshot; Wi‑Fi `nmcli`
- [x] Kiosk systemd + xrandr; escape SIGUSR1
- [x] Splash de branding (`<data>/branding/logo.png`, ~3 s) + `scripts/apply-branding.sh`
- [ ] Plymouth / bootanimation de firmware (SO, não o binário; ver `docs/hardware/SOC-BOOT-PATHS.md`)
- [ ] Cue Maestro no binário (fora do lab 0.1)

Referência Android: `Player-AD/` e `Player-AD-Vs2.15-build-115.apk`.
