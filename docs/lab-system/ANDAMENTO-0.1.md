# Andamento do lab 0.1

Plano ACE + Maestro + TDEP neste clone **TotemDigital-Studio-A.i**.  
Checkout de referência: `main` @ `077f5823`.  
Lote 28–30: ramo `cursor/lab-tdep-tick-refusals` (`c05122de`), ainda não em `main`.

Direct default **off**. Pitch de 15 min **não** cita TotemNet, TDEP, Maestro SSID nem `/lab/system`.

## Resumo

| Superfície | Contagem |
|------------|----------|
| Passos do spec no `main` | 27 / 30 (falta o 9; 1–8 e 10–27 feitos) |
| Passos no ramo (não merged) | 28, 29, 30 |
| Lab ACE/TDEP/Maestro em produção | 0% de propósito |

## Plano (ACE 0.1 §8)

| # | Passo | Onde | Estado |
|---|--------|------|--------|
| 1 | Spec humana ACE | `docs/ACE-0.1-SPEC.md` | Feito · main |
| 2 | JSON Schema `ace/0.1` | `docs/lab-ace/` | Feito · main |
| 3 | Privacy Gateway + fixtures | `aceGateway.ts` + examples | Feito · main |
| 4 | Emissor sintético | `emit_ace_synthetic.py` | Feito · main |
| 5 | Hint no Dispatcher (opt-in) | `applyAceHintToWeight` | Feito · main |
| 6 | Visão edge HOG / sintético | `edge_vision.py` | Feito · main |
| 7 | FX / NFC / QR anónimos | `POST /api/lab/ace/interaction` | Feito · main |
| 8 | Auditoria `ace.hint` | `aceAudit.ts` + `event_logs` | Feito · main |
| 10 | Pipeline + opt-in documentado | `run_lab.py` · OPT-IN-0.1 | Feito · main |
| 11 | FX apresenta o hint | `publishAceHint` · `ace_category` | Feito · main |
| 12 | Emulação in-memory | `runLabAceTick` · `run_emulation.py` | Feito · main |
| 13 | Opt-in verificado (sem Postgres) | `verify_optin.py` | Feito · main |
| 14 | NTP Maestro 2 boxes virtuais | `measureMaestroPair` | Feito · main |
| 15 | SSID de players | `measureSsidPair` | Feito · main |
| 16 | TDEP 6 objectos (sem HTTP produto) | `tdep_policy.py` | Feito · main |
| 17 | Dois nós TDEP | `tdep_nodes.py` | Feito · main |
| 18 | CMS LED 2.ª implementação | `led_cms.py` | Feito · main |
| 19 | Lane TDEP no Dispatcher | `applyTdepLane` | Feito · main |
| 20 | UI Direct ceder ar ocioso | accordion `TotemEditDialog` | Feito · main |
| 21 | One-pager parceiro | `ONE-PAGER-PARCEIRO-0.1.md` | Feito · main |
| 22 | Pre-voo de campo | `test_field.py` · `NO_HARDWARE` | Feito · main |
| 23 | Ciclo de sistema mock | `POST /api/lab/system/tick` | Feito · main |
| 24 | UI `/lab/system` | `LabSystem.tsx` (fora do menu) | Feito · main |
| 25 | Opt-in ACE mock SQL no tick | `PATCH /optin` · store RAM | Feito · main |
| 26 | `STALE_CONTEXT` + `FORMAT_MISMATCH` | tick | Feito · main |
| 27 | `LOW_CONFIDENCE` + `POLICY_AUDIO` | tick | Feito · main |
| 28 | `CATEGORY_BLOCKED` + `NOT_CEDIBLE` | `mockTdepPartnerAccepts` | Ramo · não em main |
| 29 | `NO_HANDSHAKE` + `HANDSHAKE_REPLAY` | `handshake_ok` / `handshake_ts` | Ramo · não em main |
| 30 | SELECT ACE lab (`NO_DATABASE`) | `labAceSql.ts` · `hydrateSql` | Ramo · não em main |

### Próximo (se avançar)

1. Trazer o ramo `cursor/lab-tdep-tick-refusals` para `main`.
2. Correr `optin-totem-lab.sql` à mão num Postgres de lab (não no instalador nem na v6).
3. Recusa `HANDSHAKE_REJECTED` no tick (já existe em `tdep_nodes.handshake`).

## Recusas

| Código | Camada | No tick `main` |
|--------|--------|----------------|
| `ACE_DISABLED` | ACE | Sim (default) |
| `IDENTITY_LEAK` | gateway | Sim |
| `STALE_CONTEXT` | gateway | Sim |
| `LOW_CONFIDENCE` | gateway | Sim |
| `TOTEMNET_OFF` | lane | Sim (default) |
| `NO_CAPACITY` | lane | Sim |
| `RIGHTS_REVOKED` | lane | Sim |
| `KILL_SWITCH` | lane | Sim |
| `AUDIENCE_FORBIDDEN` | parceiro mock | Sim |
| `FORMAT_MISMATCH` | parceiro | Sim |
| `POLICY_AUDIO` | parceiro | Sim |
| `CLOCK_DRIFT` | Maestro | Sim |
| `SSID_STORE` / `MIXED` / `BAND` / `SHARED` | Maestro | Sim (loja no chip) |
| `CATEGORY_BLOCKED` | policy | Só no ramo |
| `NOT_CEDIBLE` | policy | Só no ramo |
| `NO_HANDSHAKE` | nodes | Só no ramo |
| `HANDSHAKE_REPLAY` | nodes | Só no ramo |
| `HANDSHAKE_REJECTED` | nodes | Ainda não no tick |
| `NO_DATABASE` / `NO_TOTEM` | SQL ACE | Só no ramo |

## HTTP lab

| Método | Rota | Estado |
|--------|------|--------|
| POST | `/api/lab/ace/context` | Main |
| POST | `/api/lab/ace/interaction` | Main |
| GET | `/api/lab/ace/hint/:totemId` | Main |
| GET | `/api/lab/ace/audit/:totemId` | Main |
| GET/PATCH | `/api/lab/tdep/fill/:totemId` | Main |
| POST | `/api/lab/tdep/lane/preview` | Main |
| PUT | `/api/totems/:id` (`tdepFill`) | Main |
| POST | `/api/lab/system/tick` | Main |
| GET | `/api/lab/system/now/:totemId` | Main |
| GET | `/api/lab/system/proofs/:totemId` | Main |
| POST | `/api/lab/system/revoke` | Main |
| GET/PATCH | `/api/lab/system/optin/:totemId` | Main |
| POST | `/api/lab/system/maestro/preview` | Main |
| POST | `/api/lab/system/optin/:id/sql` | Só no ramo |
| * | `/tdep/v1/…` | Fora (papel) |

## Funções TypeScript (lab + ACE)

| Ficheiro | Função | Papel |
|----------|--------|--------|
| `aceGateway.ts` | `aceGatewayDecide` | Aceitar ou recusar context |
| `aceRuleEngine.ts` | `aceContextToHint` | PREMIUM / STANDARD / FILL |
| `aceRuleEngine.ts` | `applyAceHintToWeight` | Delta no Dispatcher |
| `aceRuleEngine.ts` | `isAceEnabledInCapabilities` | Boolean estrito |
| `aceHintStore.ts` | `put` / `audit` | Anel RAM ~3 s |
| `aceAudit.ts` | `recordAceAudit` / `listAceAudit` | Whitelist `event_logs` |
| `aceInteraction.ts` | `parseAnonymousInteraction` | Bools; corta `tag_id` |
| `aceFxBridge.ts` | `mapFxInteractionToAce` | Touch/NFC → ACE |
| `aceFxPublish.ts` | `publishAceHintWire` | Bus FX sem PII |
| `dispatcherTotemService.ts` | `isTotemAceEnabled` | SELECT `capabilities` |
| `labEmulation.ts` | `runLabAceTick` | Dispatcher+FX mock |
| `labEmulation.ts` | `measureMaestroPair` | NTP 18 vs 480 ms |
| `labEmulation.ts` | `measureSsidPair` | SSID players vs loja |
| `labEmulation.ts` | `mockMaestroPlayerAcceptsCue` | `CLOCK_DRIFT` / SSID |
| `labEmulation.ts` | `mockTdepPartnerAccepts` | Parceiro TDEP |
| `tdepDispatchLane.ts` | `applyTdepLane` | local > fill > idle |
| `labTdepProof.ts` | `signLabTdepProof` | HMAC lab |
| `labCapabilitiesStore.ts` | `putLabAceOptIn` | Merge JSONB RAM |
| `labSystemTick.ts` | `runLabSystemTick` | Um ciclo completo |
| `labAceSql.ts` | `selectLabAceSql` | Só no ramo |
| `labSystemTick.ts` (UI) | `buildLabTickBody` | Chips da consola |

## Python

| Módulo | Função | Papel |
|--------|--------|--------|
| `ace_gateway.py` | `gateway_decide` | Espelho TS |
| `ace_rules.py` | `ace_context_to_hint` | Pesos |
| `edge_vision.py` | `detections_to_context` | Sem face |
| `verify_optin.py` | `sql_enable` / scan v6 | Instalador não liga ACE |
| `sql_optin.py` | `LabAceSql.select` | Só no ramo |
| `ntp_measure.py` | `measure_pair` | Medição ganha ao JSON |
| `ssid_measure.py` | `measure_ssid_pair` | `SSID_STORE` |
| `tdep_policy.py` | `seller_decide` | Recusas de seller |
| `tdep_nodes.py` | `handshake` / `exchange_fill` | Dois nós |
| `tdep_lane.py` | `apply_tdep_lane` | Lane |
| `led_cms.py` | `LedCms.decide` | 2.ª implementação |
| `mocks.py` | `mock_tdep_partner_accepts` | Emulação |
| `field_parse.py` | `list_adb_serials` | Skip `NO_HARDWARE` |

## Fora do 0.1

Face, cue no APK Player-AD, `/tdep/v1` de produto, SKU B / CEC, ACE no pitch de 15 min, `ace_enabled` na v6, dinheiro no Flight, `audience` no TDEP (ADR-0008).
