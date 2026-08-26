# Lane TDEP 0.1 no Dispatcher (lab)

O Dispatcher deste clone pode **ordenar** um fill TDEP. **Não** escolhe `media_id`. **Não** mexe no Player-AD. Opt-in no Direct: accordion no fundo de `TotemEditDialog` ([UI-0.1.md](./UI-0.1.md)).

```text
prioridade_local  >  flight.guaranteed  >  fill  >  idle
kill-switch do owner  >  tudo
cap de % de ar          >  guaranteed
```

Default **off** (`capabilities.tdep_fill_enabled`). Seeds e instalador não ligam a flag. Pitch de 15 min não menciona TotemNet.

## Regras

| Estado | Vencedor |
|--------|----------|
| Flag off | Local / Direct (TDEP nem com peso 900) |
| Flag on + conteúdo local | **Local** — o cardápio não perde para o parceiro |
| Flag on + só idle | Fill TDEP (cap 10%) |
| Kill-switch | Idle |
| Guaranteed acima do cap | Idle (`NO_CAPACITY`) |

UI: accordion colapsado, default off. Pitch de 15 min não menciona TotemNet.

## Verificar

```powershell
python scripts/lab-tdep/test_lane.py
python scripts/lab-tdep/run_lane_lab.py
python scripts/lab-tdep/verify_lane.py
cd backend
npx jest --selectProjects unit --testPathPattern="tdepDispatchLane|labTdep.routes" --forceExit --coverage=false
```

Já entra em `python scripts/lab-emulate/run_emulation.py`. Relatório: `logs/lab-tdep-lane-report.json` (gitignored).

SQL humano (não entra no instalador): o mesmo padrão do ACE — merge JSONB `tdep_fill_enabled: true` num totem de lab, se existir Postgres.
