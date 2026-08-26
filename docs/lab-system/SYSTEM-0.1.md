# Sistema lab 0.1 — um ciclo com mocks

ACE (audiência desta tela) + Maestro (cue entre boxes) + TDEP (ar entre CMS) no **mesmo tick**. Câmara, TV box, Player-AD e CMS parceiro são **mocks**. Sem `/tdep/v1` de produto. Direct default **off**. Pitch de 15 min **não** menciona isto.

```text
audience.context (mock)  →  pesos ACE
                         →  lane TDEP (local > fill > idle)
                         →  cue Maestro (NTP+SSID medidos em mock)
                         →  nowPlaying in-memory (não é o APK)
                         →  Proof HMAC se fill ou guaranteed ganhar (sem audiência)
```

O Dispatcher de produto continua a escolher `media_id` real só com ACE. O fill TDEP **não** entra no ranking de campanhas Postgres — só neste tick de lab.

## HTTP (auth, como ACE)

```text
POST /api/lab/system/tick
GET  /api/lab/system/now/:totemId
GET  /api/lab/system/proofs/:totemId
POST /api/lab/system/revoke
GET  /api/lab/system/optin/:totemId
PATCH /api/lab/system/optin/:totemId
POST /api/lab/system/maestro/preview
```

`POST /tick` com body vazio: ACE off, TotemNet off, NTP 18 ms, SSID `totem-players` 5 GHz. Vencedor **direct-local**. Cue mock enviado. **Sem proof** (não houve fill).

`totemIds: [41, 42]`: o mesmo ciclo em dois totens mock (cue local partilhado; fill gera um proof por totem). HMAC de lab `tdep-0.1-lab-not-product` — fixture, não vai no instalador.

Flags no body: `ace.aceEnabled`, `tdep.enabled`, `tdep.killSwitch`, `tdep.revoked`, `tdep.flightPriority` (`fill` | `guaranteed`), `tdep.capSharePct` / `shareUsedPct` / `wantSharePct`, `maestro.offsetAMs` (480 → `CLOCK_DRIFT`).

Se `ace.aceEnabled` vier omitido, o tick lê o store de opt-in (mock SQL). `PATCH /optin/:totemId` `{ aceEnabled: true }` replica `optin-totem-lab.sql` em RAM. Context com `person_id` → `IDENTITY_LEAK`; `observed_at` > 3 s → `STALE_CONTEXT`; `confidence` < 0.50 → `LOW_CONFIDENCE`. O ar continua o de sempre.

Parceiro TDEP com `refuse_code: FORMAT_MISMATCH`, áudio na variante (`audio: true`, `face_audio: false` → `POLICY_AUDIO`) ou `audience` no payload recusa o fill. Sem proof.

`POST /revoke` marca o flight lab; o próximo tick recusa `RIGHTS_REVOKED` (sem proof novo). Cap acima de 10% → `NO_CAPACITY`. Guaranteed no idle → proof obrigatório.

## UI (fora do menu)

`/lab/system` — consola de cenários mock. Accordion colapsado em `TotemEditDialog`. Não está no menu Direct nem no Command Palette compacto. Doc: [UI-0.1.md](./UI-0.1.md).

## Verificar

```powershell
cd backend
npx jest --selectProjects unit --testPathPattern="labSystemTick|labSystem.routes|labCapabilitiesStore" --forceExit --coverage=false
cd ..
python scripts/lab-system/test_ui.py
cd frontend
npx react-scripts test --watchAll=false --testPathPattern="labSystemTick|rolePermissions" --coverage=false
```

Já entra na lista de rotas compactas (`/api/lab/system`). Emulação Python continua a cobrir ACE/Maestro/TDEP isolados.

## O que fica mock de propósito

| Peça | Mock | Quando deixar de ser mock |
|------|------|---------------------------|
| Player-AD | `nowPlaying` em RAM | Cue no APK (decisão à parte) |
| TV box / ADB | offsets + dumpsys fixtures | 2 boxes no USB |
| Câmara / face | `audience.context` sintético | **Não** neste 0.1 |
| CMS parceiro | `tdep-fill-mock` + Proof HMAC | `/tdep/v1` de produto |
| Postgres ACE | capabilities em RAM (`PATCH /optin`) | SQL humano `optin-totem-lab.sql` |
