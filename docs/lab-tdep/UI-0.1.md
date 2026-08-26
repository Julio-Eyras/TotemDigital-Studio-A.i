# UI TDEP 0.1 — ceder ar ocioso (lab Direct)

Accordion **colapsado no fundo** de `TotemEditDialog`. Default **off**. Não entra no pitch de 15 min. Máximo 10% do ar. O cardápio local continua a ganhar.

Não é setting do Player-AD. Não liga `/tdep/v1` de produto. O Dispatcher de produto ainda não consome candidatos TDEP — a lane continua lab.

## Onde está

| Superfície | Comportamento |
|------------|----------------|
| Direct → editar totem | «Laboratório — ceder ar ocioso». Switches: ceder fill; kill-switch. Cap fixo 10%. |
| `PUT /api/totems/:id` | Campo `tdepFill` `{ enabled, killSwitch, capSharePct }`. Merge JSONB em `totems.capabilities`. |
| `GET/PATCH /api/lab/tdep/fill/:totemId` | Store **in-memory** (testes sem Postgres). `undefined` no PATCH não força `false`. |
| `POST /api/lab/tdep/lane/preview` | Preview da lane (`applyTdepLane`). |

Flags em `capabilities`: `tdep_fill_enabled`, `tdep_kill_switch`, `tdep_cap_share_pct` (1–10). String `"true"` **não** liga.

## Verificar

```powershell
python scripts/lab-tdep/test_lane.py
cd backend
npx jest --selectProjects unit --testPathPattern="tdepDispatchLane|labTdep.routes" --forceExit --coverage=false
cd ..\frontend
npx react-scripts test --watchAll=false --testPathPattern="totemTdepFill" --coverage=false
```

Pitch: `docs/manuais/12-ROTEIRO-DEMO-15-MIN.md` e `06-APRESENTACAO-COMERCIAL-SAAS.md` **não** citam TotemNet / TDEP.
