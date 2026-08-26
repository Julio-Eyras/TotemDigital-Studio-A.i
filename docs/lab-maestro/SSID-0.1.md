# SSID de players Maestro 0.1 (lab, sem AP fisico)

O Cue **nao** vai no Wi-Fi da loja. As duas boxes tem de estar no **SSID so de players** (5/6 GHz), sem clientes da loja no mesmo AP.

O Player-AD **nao** muda. SKU B / CEC continuam fora. Direct / Kit Pronto **nao** vendem isto.

A medicao **ganha** ao papel: se o checklist disser “players” e a box estiver na Wi-Fi da loja, o player mock recusa `SSID_STORE` mesmo com NTP a 18 ms.

## Verificar em lab (sem hardware)

```powershell
python scripts/lab-maestro/test_ssid.py
python scripts/lab-maestro/run_ssid_lab.py
```

Ja entra em `python scripts/lab-emulate/run_emulation.py`. Relatorio: `logs/lab-ssid-report.json` (gitignored).

| Medicao | Codigo | Cue |
|---------|--------|-----|
| Duas boxes `totem-players` 5 GHz, sem clientes da loja | — | Aceite (se NTP tambem OK) |
| Uma box na Wi-Fi da loja | `SSID_STORE` | Recusa |
| SSIDs diferentes | `SSID_MIXED` | Recusa |
| 2.4 GHz | `SSID_BAND` | Recusa |
| Clientes da loja no mesmo AP | `SSID_SHARED` | Recusa |

## Campo (quando existirem 2 boxes + AP)

1. AP 5 ou 6 GHz. SSID dedicado (ex. `totem-players`). Sem roaming agressivo.
2. **Nao** usar o SSID de clientes / guest da loja.
3. As duas TV boxes no mesmo SSID. Preferir cabo Ethernet no maestro.
4. Confirmar que telemoveis da loja **nao** associam a esse SSID.
5. Se alguma box cair na Wi-Fi da loja: **nao** enviar cue. Cada totem segue no ar de sempre, sem Maestro.

Nao ligar SKU B, CEC, PTP ou genlock para “compensar Wi-Fi mau”.

Pre-voo ADB (opcional): [../lab-field/FIELD-0.1.md](../lab-field/FIELD-0.1.md).
