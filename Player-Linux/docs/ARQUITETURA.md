# Arquitectura — Player-Linux

Espelha os pacotes do Player-AD (`api`, `config`, `cache`, `playback`, `ota`, `util`).

```text
Player-Linux/
├── CMakeLists.txt
├── README.md
├── config/exemplo-player-config.json
├── docs/
└── src/
    ├── main.cpp                 # arranque + loop
    ├── version.hpp
    ├── util/                    # logger, paths, time
    ├── config/                  # PlayerConfig, DisplaySchedule, PollAdaptive
    ├── api/                     # DispatcherClient (libcurl + JSON)
    ├── cache/                   # MediaCache
    ├── playback/                # PlayerOrchestrator (+ GStreamer opcional)
    └── remote/                  # CommandExecutor
```

## Threads / fluxo

```text
main
  ├─ carrega config
  ├─ token + sync/heartbeat (thread ou async)
  ├─ dispatch quando necessário
  ├─ pré-cache mídias
  └─ loop playback
        ├─ se !schedule.active → idle preto + keep-alive
        └─ senão play item (vídeo/imagem/html)
```

Polls de heartbeat e dispatch são **independentes** do fim do ciclo de playlist (como no Android).

## Dependências

| Lib | Uso |
|-----|-----|
| libcurl | HTTP |
| nlohmann/json | JSON |
| GStreamer (opc.) | vídeo/áudio |
| Threads C++11 | heartbeat / download |

## Storage

Definido por `--data-dir` ou `storagePathOverride` / default `/var/lib/player-linux` (dev: `./data`).

Nomes de ficheiros alinhados ao Player-AD para facilitar suporte cruzado.
