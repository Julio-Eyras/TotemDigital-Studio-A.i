# Dois nós TDEP 0.1 (lab, sem dois CMS reais)

Prod (seller Direct) fala com DEV/LED (buyer) **in-memory**. Um Flight fill + um Proof. Sem `/tdep/v1` em produto. Sem Player-AD. Opt-in Direct: [UI-0.1.md](./UI-0.1.md).

O hub **não** fala com a TV box. Cada CMS manda nos seus dispositivos.

## Regras

1. Handshake HMAC de lab (máquinas). Sem handshake → `NO_HANDSHAKE`, zero plays.
2. TotemNet **default off**. Opt-in **por face**, cap 10% do ar. Sem opt-in → `TOTEMNET_OFF`.
3. Ligar uma face **não** liga as outras da mesma instalação.
4. Fill aceite → seller assina Proof. Buyer consulta proofs. Fill sem proof é best-effort; neste lab o seller envia na mesma.
5. Kill-switch do owner recusa a meio (`KILL_SWITCH`).
6. Timestamp fora de 60 s → `HANDSHAKE_REPLAY`.
7. Pitch de 15 min **não** menciona TDEP / TotemNet.

## Verificar

```powershell
python scripts/lab-tdep/test_nodes.py
python scripts/lab-tdep/run_nodes_lab.py
```

Já entra em `python scripts/lab-emulate/run_emulation.py`. Relatório: `logs/lab-tdep-nodes-report.json` (gitignored).

Chave HMAC `tdep-0.1-lab-not-product` é **fixture**. Não vai no instalador nem no Studio operacional.

## Próximo (se avançar)

CMS LED (segunda implementação) já está em [LED-CMS-0.1.md](./LED-CMS-0.1.md). Direct continua Direct.
