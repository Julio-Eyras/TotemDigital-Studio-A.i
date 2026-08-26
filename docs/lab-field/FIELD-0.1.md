# Pre-voo de campo 0.1 (ACE SQL + NTP/SSID em hardware)

**Lab.** Sem 2 TV boxes o script **não falha**: `NO_HARDWARE`. Sem Postgres **não escreve**. O Player-AD **não** muda. SKU B / CEC / face / `/tdep/v1` continuam fora. Direct default **off**. Pitch de 15 min **não** menciona isto.

A medição **ganha** ao JSON: dumpsys na Wi-Fi da loja recusa `SSID_STORE` mesmo o papel dizer “players”. `|drift| > 200 ms` recusa `CLOCK_DRIFT`.

## Verificar em lab (sem hardware)

```powershell
python scripts/lab-field/test_field.py
python scripts/lab-field/run_field_lab.py
```

Já entra em `python scripts/lab-emulate/run_emulation.py`. Relatório: `logs/lab-field-report.json` (gitignored).

Fixtures de `dumpsys wifi`: [examples/](./examples/).

## Quando existirem 2 boxes ADB

1. As duas em `adb devices` como `device` (não `unauthorized`).
2. Mesmo SSID de players (`totem-players`, 5 ou 6 GHz). **Não** o Wi-Fi da loja.
3. `run_field_lab.py` lê `dumpsys wifi` e `date +%s%3N` em cada serial.
4. Se o par não passar: **não** enviar cue Maestro. Cada totem segue no ar de sempre.

USB na TV_BOX_3 falhou no passado — se ADB não listar 2 devices, o lab continua em skip. Não ligar PTP, genlock, SKU B nem CEC para “salvar o demo”.

## SQL ACE (humano, nunca neste script)

Script de referência: [`scripts/lab-ace/optin-totem-lab.sql`](../../scripts/lab-ace/optin-totem-lab.sql). **Não** entra no instalador nem na v6.

`run_field_lab.py` **não** corre `UPDATE`. Se existir Postgres de lab, o SELECT/UPDATE é à mão ([OPT-IN-0.1.md](../lab-ace/OPT-IN-0.1.md)).

Boolean estrito: `ace_enabled: "true"` (string) **não** liga.

Irmãos: [NTP-0.1.md](../lab-maestro/NTP-0.1.md) · [SSID-0.1.md](../lab-maestro/SSID-0.1.md).
