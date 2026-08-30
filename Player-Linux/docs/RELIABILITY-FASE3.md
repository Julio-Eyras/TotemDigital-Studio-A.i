# Fiabilidade Fase 3 — Player-Linux

Contrato HTTP e RN-PAD **não mudam**. Objectivo: campo — overlay de debug, pacote `.deb` reproduzível, soak no totem.

## Overlay debug X11

Paridade WOS/Tizen / Player-AD: **3 toques em 1200 ms** na zona **OK** (faixa inferior ao centro). Também **SIGUSR1** / `kiosk-escape.sh`.

| Superfície | Comportamento |
|------------|----------------|
| Zona OK (libX11) | janela override-redirect; 3 cliques → overlay + `releaseKiosk()` |
| SIGUSR1 | atomic → overlay (X11 ou zenity/`xmessage`) + escape de kiosk |
| Sem DISPLAY / sem X11 | texto em `/tmp/player-linux-debug.txt` + zenity se existir |
| Conteúdo | version, parity AD, uin, deviceId, serverUrl, planSource, planVersion, items, lastOta |

Compilar com X11: `libx11-dev`. Sem a lib, o binário usa o fallback.

## `.deb` reproduzível

```bash
cd Player-Linux
bash scripts/build-deb.sh
# player-linux_0.1.0_amd64.deb
# SOURCE_DATE_EPOCH = git commit time; dpkg-deb --root-owner-group -Zgzip
```

Instalar **binário e unidade juntos** (igual Fase 1). `VERSION=0.1.1 bash scripts/build-deb.sh` para outra versão.

## Soak 8–24 h (totem)

Não corre no WSL. No aparelho:

1. Instalar o `.deb` (ou `install-player-linux.sh`) com config válida.
2. `systemctl start player-linux` com `DISPLAY=:0`.
3. Deixar 8–24 h com playlist real.
4. A meio: desligar a rede ~5 min; confirmar recover de HB e playback.
5. `sudo bash scripts/soak-observe.sh 24`

Critério: sem kill do watchdog, HB no journal, jsonl com tecto, RSS estável o suficiente para o turno.

## Fora desta fase

Plymouth/bootanimation de firmware, Cue Maestro, soak executado neste ambiente.
