# CMS LED 0.1 (segunda implementação TDEP)

Um script a fingir um **CMS de painéis LED**. Não é a mesma classe que o nó TotemDigital. Fala só JSON `tdep/0.1`. Sem `/tdep/v1` em produto. Sem sending card. Sem Player-AD.

Duas implementações independentes + o mesmo schema = o standard começou a existir em lab.

## O que o LED faz de diferente

- Motor próprio (`scripts/lab-tdep/led_cms.py`). **Não** importa `tdep_nodes` / `tdep_policy`.
- Inventário interno = painel 1920×1080; no fio exporta `Face` landscape.
- Matching **mais estrito**: variante tem de casar `pixel_w` / `pixel_h`, não só a orientação.
- Opt-in do painel default **off**. Kill-switch local. Hub não fala com o dispositivo.

## Dois sentidos

| Buyer | Seller | Resultado |
|-------|--------|-----------|
| CMS LED | Totens TotemDigital | Fill portrait + Proof verificado no LED |
| TotemDigital | CMS LED | Fill landscape (variante 1920×1080) + Proof verificado no TotemDigital |

Criativo só portrait contra LED → `FORMAT_MISMATCH` (não estica).

## Verificar

```powershell
python scripts/lab-tdep/test_led_cms.py
python scripts/lab-tdep/run_led_lab.py
```

Já entra em `python scripts/lab-emulate/run_emulation.py`. Relatório: `logs/lab-tdep-led-report.json` (gitignored).

## Próximo (se avançar)

SQL ACE / NTP+SSID em hardware. Direct default **off**. Pitch de 15 min não menciona TotemNet.
