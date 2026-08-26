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
| [SSID-0.1.md](./SSID-0.1.md) | SSID só de players 5/6 GHz (lab virtual; campo opcional) |
| [../lab-field/FIELD-0.1.md](../lab-field/FIELD-0.1.md) | Pre-voo ADB: skip sem hardware; SQL ACE humano |
| [../scripts/lab-maestro/validate_maestro.py](../scripts/lab-maestro/validate_maestro.py) | Validador local |

SKU B (matriz de pixels) **não** entra neste schema.
