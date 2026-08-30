# TDEP 0.1 (lab) — seis objectos

**Papel + JSON.** Sem `/tdep/v1` em produto. Sem `audience.context`. Sem Player-AD. Sem factura no Flight.

Norma longa: [../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](../CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md).  
Schema: este directorio. Validador: `python scripts/lab-tdep/validate_tdep.py`.

TDEP partilha **inventário e ar entre CMS**. ACE descreve o ambiente *diante de uma tela desta instalação*. Maestro alinha *quando* as boxes tocam. Não misturar.

## Seis objectos (`tdep/0.1`)

| Objecto | Ficheiro | Analogia |
|---------|----------|----------|
| Partner | [partner.schema.json](./partner.schema.json) | quem fala |
| Face | [face.schema.json](./face.schema.json) | onde |
| Availability | [availability.schema.json](./availability.schema.json) | o que posso emprestar |
| Creative | [creative.schema.json](./creative.schema.json) | o quê (com **variantes**) |
| Flight | [flight.schema.json](./flight.schema.json) | quando / quanto |
| Proof | [proof.schema.json](./proof.schema.json) | aconteceu |

Kill-switch e conflito de agenda **não** são um 7.º objecto: ficam no CMS vendedor.

```text
prioridade_local  >  flight.guaranteed  >  fill  >  idle
kill-switch do owner  >  tudo
revogação de creative  >  tudo
cap de % de ar da rede  >  guaranteed
```

## Recusas (seller)

| Código | Quando |
|--------|--------|
| `FORMAT_MISMATCH` | Nenhuma variante casa orientação/mime da face |
| `POLICY_AUDIO` | Variante tem som e a face não aceita áudio |
| `CATEGORY_BLOCKED` | Categoria da marca vetada na face |
| `NO_CAPACITY` | Quota do flight estoura o `cap_share_pct` |
| `NOT_CEDIBLE` | Availability `cedible: false` |
| `RIGHTS_REVOKED` | `valid_until` passou ou take-down |
| `KILL_SWITCH` | Dono corta o parceiro/criativo |
| `AUDIENCE_FORBIDDEN` | JSON traz `audience` / `ace` / `person_id` / `mood` |
| `NO_HANDSHAKE` | Handshake HMAC em falta ou `handshake_ok: false` |
| `HANDSHAKE_REPLAY` | Timestamp do handshake com `|now − ts| > 60 s` |
| `HANDSHAKE_REJECTED` | Tipo ≠ hmac, `secret_ok` false, ou ts ilegível |

Proof **obrigatório** em `guaranteed`. Fill pode ser best-effort.

## Endpoints (papel; lab não sobe `/tdep/v1` de produto)

Opt-in Direct e preview de lane: [UI-0.1.md](./UI-0.1.md) (`PUT /api/totems/:id` `tdepFill`, `GET/PATCH /api/lab/tdep/fill/:totemId`).

```text
POST   /tdep/v1/partners/handshake
GET    /tdep/v1/inventory/faces
GET    /tdep/v1/inventory/availability
POST   /tdep/v1/creatives
POST   /tdep/v1/flights
POST   /tdep/v1/flights/{id}/decision
POST   /tdep/v1/flights/{id}/revoke
POST   /tdep/v1/proofs
GET    /tdep/v1/proofs?flight_id=…
```

Autenticação de lab: HMAC + timestamp + `partner_id` (máquinas). OAuth de browser fica fora.

## Verificar em lab (sem dois CMS)

```powershell
python scripts/lab-tdep/validate_tdep.py
python scripts/lab-tdep/test_tdep.py
python scripts/lab-tdep/run_tdep_lab.py
python scripts/lab-tdep/test_nodes.py
python scripts/lab-tdep/run_nodes_lab.py
python scripts/lab-tdep/test_led_cms.py
python scripts/lab-tdep/run_led_lab.py
python scripts/lab-tdep/test_lane.py
python scripts/lab-tdep/run_lane_lab.py
python scripts/lab-tdep/verify_lane.py
python scripts/lab-tdep/test_onepager.py
```

UI Direct: [UI-0.1.md](./UI-0.1.md).

Já entra em `python scripts/lab-emulate/run_emulation.py`. Relatórios: `logs/lab-tdep-report.json`, `logs/lab-tdep-nodes-report.json`, `logs/lab-tdep-led-report.json`, `logs/lab-tdep-lane-report.json` (gitignored).

## Próximo (se avançar)

Ciclo de sistema com mocks: [../lab-system/SYSTEM-0.1.md](../lab-system/SYSTEM-0.1.md). Player-AD, face, SKU B, CEC e `/tdep/v1` de produto continuam fora. Direct default **off**.

UI lab: [UI-0.1.md](./UI-0.1.md). One-pager parceiro: [ONE-PAGER-PARCEIRO-0.1.md](./ONE-PAGER-PARCEIRO-0.1.md).
