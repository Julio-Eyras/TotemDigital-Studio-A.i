# Player-Linux

Player de sinalização digital para **Linux** (totem / PC / painel), em **C++17**, com **parity funcional** face ao **Player-AD 2.15 (versionCode 115)**.

| Campo | Valor |
|-------|--------|
| Paridade alvo | Player-AD **Vs2.15-build-115** (`br.com.smartchannel.playerad`) |
| Linguagem | C++17 |
| Build | CMake ≥ 3.16 |
| Platform (API) | `"linux"` |
| Versão deste projecto | `0.1.0` (esqueleto + regras de negócio / API) |

## Objectivo

Reproduzir no Linux as **mesmas regras de negócio, contratos de API, config JSON, cache, horário de tela, comandos remotos, poll adaptativo e ciclo de playback** já definidos no Player-AD Android — trocando apenas a camada de SO (GStreamer/WebKit em vez de ExoPlayer/WebView; kiosk DRM/X11/Wayland em vez de lock-task).

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [docs/PARITY-PLAYER-AD-2.13.md](./docs/PARITY-PLAYER-AD-2.13.md) | Checklist de parity e mapeamento Android → Linux |
| [docs/ARQUITETURA.md](./docs/ARQUITETURA.md) | Módulos C++, threads, storage |
| [docs/API-E-CONFIG.md](./docs/API-E-CONFIG.md) | Endpoints e schema `player-config.json` |
| [config/exemplo-player-config.json](./config/exemplo-player-config.json) | Modelo de configuração (igual ao kit Android) |

## Build (Linux)

```bash
sudo apt-get install -y build-essential cmake libcurl4-openssl-dev \
  libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  gstreamer1.0-plugins-good gstreamer1.0-libav \
  nlohmann-json3-dev pkg-config

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

## Layout runtime (parity com Player-AD)

```text
<dataRoot>/                          # ex. /var/lib/player-linux  ou --data-dir
  player-config.json
  display-schedule.json
  player-linux-operations.log
  last-dispatch-plan.json
  current-plan-source.txt
  telemetry/events-v2.jsonl
  propagandas/
    metadata.json
    {mediaId}.mp4|jpg|png|html|…
  vinhetas/
```

## Estado actual (0.1.0)

- [x] Documentação de parity e arquitectura
- [x] Config JSON (mesmas chaves do Player-AD)
- [x] Cliente HTTP (token, sync/heartbeat, dispatch, command-result)
- [x] Display schedule + poll adaptativo (lógica)
- [x] Loop de orquestração (esqueleto)
- [ ] Playback GStreamer completo (vídeo/imagem)
- [ ] HTML (WebKitGTK)
- [ ] OTA pacote Linux
- [ ] Wi‑Fi via NetworkManager
- [ ] Kiosk fullscreen + rotação física

Referência Android: `Player-AD/` e `install-pendrive/apk/Player-AD-Vs2.13-build-113.apk`.
