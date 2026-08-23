# Lab Maestro 0.1 (SKU A — Cue)

**Papel + JSON.** Sem alteração no Player-AD operacional. Default off. Não é TDEP. Não é ACE.

Norma humana: [../PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md](../PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md)

O maestro **não envia o vídeo**. Envia `play item_id @ t0`. Cada totem toca o ficheiro em cache.

| Ficheiro | Função |
|----------|--------|
| [cue.schema.json](./cue.schema.json) | Mensagem `maestro/0.1` SKU cue |
| [examples/01-play-t0.json](./examples/01-play-t0.json) | Cue válido |
| [examples/reject-clock-drift.json](./examples/reject-clock-drift.json) | `CLOCK_DRIFT` |
| [NTP-0.1.md](./NTP-0.1.md) | Medição NTP em 2 boxes (lab virtual; hardware opcional) |
| [../scripts/lab-maestro/validate_maestro.py](../scripts/lab-maestro/validate_maestro.py) | Validador local |

SKU B (matriz de pixels) **não** entra neste schema.
