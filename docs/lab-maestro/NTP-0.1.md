# NTP Maestro 0.1 (lab, sem duas boxes fisicas)

O Cue so toca se as duas boxes estiverem a `|drift_ms| <= 200` e `ntp_ok = true`.
O Player-AD **nao** muda. SKU B / CEC continuam fora.

A medicao **ganha** ao JSON: se o cue declarar 18 ms e os relogios medirem 480 ms, o player mock recusa `CLOCK_DRIFT`.

## Verificar em lab (sem hardware)

Duas boxes virtuais, algoritmo SNTP/Cristian (`offset = ((T2-T1)+(T3-T4))/2`):

```powershell
python scripts/lab-maestro/test_ntp.py
python scripts/lab-maestro/run_ntp_lab.py
```

Ja entra em `python scripts/lab-emulate/run_emulation.py`. Relatorio: `logs/lab-ntp-report.json` (gitignored).

UDP/123 a `pool.ntp.org` e **opcional**. Se o firewall bloquear, o lab in-memory continua OK.

## Medir em 2 boxes reais (quando existirem)

1. Mesmo servidor NTP nas duas TV boxes (SSID de players, nao o Wi-Fi da loja).
2. Ler offset de cada uma (ex. `w32tm /query /status` no Windows, `timedatectl timesync-status` no Linux).
3. `drift_ms` do cue = diferenca entre as duas (nao o offset absoluto vs pool).
4. Se `|drift| > 200` ou NTP down: **nao** enviar cue. O ar e o de sempre (cada totem no seu relogio, sem Maestro).
5. So depois disto o Cue deixa de ser mock de JSON.

Nao ligar PTP, genlock, SKU B nem CEC para “melhorar o demo”.

Pre-voo ADB (opcional): [../lab-field/FIELD-0.1.md](../lab-field/FIELD-0.1.md).
