# ADR-0007 — Maestro Cue não é matriz de pixels

**Estado:** Aceite (lab em TotemDigital-Studio-A.i)  
**Data:** 2026-08-23  
**Módulos:** Player-AD (não alterar no 0.1), dispatcher (independente)

## Contexto

Pedidos de “Player-AD como hub Wi‑Fi de N TVs” misturam dois problemas: alinhar *quando* várias boxes tocam o mesmo item (Cue) e espelhar *pixels* para LED/TV (Matriz).

## Decisão

1. SKU A (Cue) = relógio + `play item_id @ t0`. Cache local. Sem vídeo no momento do cue.
2. SKU B (Matriz) = encoder à parte; a TV_BOX_3 não é matriz.
3. HDMI-CEC continua fora.
4. O schema `maestro/0.1` no 0.1 cobre **só Cue**. Matriz não entra no JSON.
5. Player-AD operacional **não** muda neste lote.

## Consequências

- Lab em `docs/lab-maestro/` + `scripts/lab-maestro/validate_maestro.py`.
- Recusa de campo: `CLOCK_DRIFT` se `|drift_ms| > 200`.
- Lab NTP (2 boxes virtuais): `scripts/lab-maestro/ntp_measure.py`. Medição ganha ao JSON.
- Lab SSID de players: `scripts/lab-maestro/ssid_measure.py`. Cue recusa Wi-Fi da loja (`SSID_STORE`).
- TDEP e ACE são labs irmãos; o cue não transporta audiência nem campanha entre CMS.

## Alternativas rejeitadas

- Um SKU único “hub sem fio”.
- Genlock de cinema no Direct v1.
- Multicast de vídeo no Wi‑Fi de clientes da loja.
