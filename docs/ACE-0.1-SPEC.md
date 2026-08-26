# ACE 0.1 — Audience Context Engine

**Tipo:** especificação de laboratório (papel) — **sem alteração de schema, player nem painel**  
**Data:** 23 de agosto de 2026  
**Repositório:** [Julio-Eyras/TotemDigital-Studio-A.i](https://github.com/Julio-Eyras/TotemDigital-Studio-A.i)  
**Não é:** o produto operacional TotemDigital-Studio (`totemdigital.app.br`)  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  
**Licença:** proprietária  
**Irmãos (outras camadas, não misturar):**  
[TDEP / TotemNet](./CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md) · [Maestro Cue vs Matriz](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md) · [Avaliação comercial](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md)

---

## 0. Estatuto

ACE = **Audience Context Engine** (motor de contexto de audiência).  
**0.1** = primeiro contrato: JSON + regras de privacidade + mapa do código real.

- **Não entra** no pitch de 15 min nem no Kit Pronto.
- **Não é TDEP.** TDEP partilha campanha e inventário *entre CMS*. O ACE descreve o ambiente *diante de uma tela desta instalação*.
- **Não é Maestro.** Maestro sincroniza pixels ou cue. O ACE não transporta vídeo.
- Default **off**. Direct permanece Direct.
- Identificação persistente (face, embedding, `person_id`) fica **fora** do produto publicitário.

Promessa numa frase: *o totem sabe o que está a acontecer agora; não precisa de saber quem é a pessoa.*

---

## 1. A pergunta que o 0.1 responde

> Como o TotemDigital passa de “playlist no horário” para “experiência que reage ao ambiente”, sem virar plataforma de vigilância e sem partir o Dispatcher?

Resposta: uma camada **entre** sensores e decisão comercial.

```text
Câmara / NFC / QR / BLE / POS / hora
        │
        ▼
   Vision AI (edge)     ← só sinais; vídeo não sobe
        │
        ▼
   Privacy Gateway      ← corta imagem, face, embedding, ID
        │
        ▼
   ACE  (este spec)     → audience.context
        │
        ▼
   Rule Engine          → “o que devemos fazer?”
        │
        ▼
   Dispatcher           → árbitro final (já existe)
        │
        ▼
   Player-AD / FX       → “como apresentar?”
```

A IA **não** escolhe o vídeo. O Dispatcher **não** deixa de ser o árbitro. O player **não** decide estratégia comercial.

---

## 2. Dois domínios (não misturar)

| Domínio | O que é | No 0.1 |
|---------|---------|--------|
| **Audience Intelligence** | Estado anónimo e efémero da audiência | **Padrão.** Este spec. |
| **Identity** | Pessoa persistente, face, embedding, nome | **Isolado e desligado.** API `facial_recognition` já responde 501 (`FEATURE_DEFERRED`). |

### O que o Privacy Gateway **corta** (obrigatório)

`DROP_IMAGE` · `DROP_FACE` · `DROP_EMBEDDING` · `DROP_BIOMETRIC` · `DROP_PERSISTENT_ID`

Só passa: contagem, movimento, dwell, atenção, grupo, interacção (QR/NFC/touch sem identidade), hora, confiança.

### O que o 0.1 **não** inclui

- Reconhecimento facial, idade, género, emoção / “humor”
- `recognized_persons`, `emotion_data`, `person_id` em `interaction_logs`
- Campanha contextual no TDEP
- Learning Engine / bandits / RL
- Modelo de IA concreto (YOLO, MediaPipe, etc.) — o contrato é independente do modelo

---

## 3. Contrato `audience.context` (`ace/0.1`)

Um objecto por totem, por instante. Relógio UTC. Sem PII.

```json
{
  "schema": "ace/0.1",
  "context_id": "8f42a1e2-4c1a-4b9e-9d3a-0c7e1b2a9f10",
  "observed_at": "2026-08-23T06:32:11.420Z",
  "totem_id": 41,
  "site_id": "loja-centro",
  "privacy": {
    "gateway": "ace/0.1",
    "identity_dropped": true,
    "image_dropped": true
  },
  "presence": true,
  "count": 3,
  "group": true,
  "density": "medium",
  "motion": {
    "approaching": 2,
    "passing": 0,
    "stopped": 1,
    "leaving": 0
  },
  "attention": "high",
  "dwell_ms": 4200,
  "interaction": {
    "touch": false,
    "qr": false,
    "nfc": false
  },
  "clock": {
    "hour_local": 18,
    "day_of_week": 6,
    "store_open": true
  },
  "confidence": 0.91,
  "session_id": "ephemeral-8f42a1"
}
```

### Campos 0.1 (normativos)

| Campo | Tipo | Notas |
|-------|------|--------|
| `schema` | `"ace/0.1"` | Versionado. Breaking change = `ace/0.2`. |
| `context_id` | UUID | Id do snapshot, não da pessoa. |
| `observed_at` | ISO-8601 UTC | Relógio do emissor. |
| `totem_id` | int | Face local. |
| `site_id` | string | Opcional. |
| `privacy.identity_dropped` | bool | Tem de ser `true` para o ACE aceitar. |
| `presence` | bool | Há alguém na zona da tela. |
| `count` | int ≥ 0 | Pessoas na zona. Sem IDs. |
| `group` | bool | `count ≥ 2`. |
| `density` | `low` \| `medium` \| `high` | Relativo à zona, não à cidade. |
| `motion.*` | int ≥ 0 | Subconjuntos de `count`. Soma ≤ `count`. |
| `attention` | `none` \| `low` \| `medium` \| `high` | Comportamento visual, **não** emoção. |
| `dwell_ms` | int ≥ 0 | Tempo de permanência da sessão efémera. |
| `interaction.*` | bool | Eventos anónimos neste snapshot. |
| `clock.*` | | Contexto temporal local. Sem GPS obrigatório. |
| `confidence` | 0.0–1.0 | Do detector, não “certeza comercial”. |
| `session_id` | string | **Efémero.** TTL curto (ex.: 30–120 s). Não reutilizável amanhã. |

### Sessão efémera

`session_id` existe para ligar 2–3 snapshots seguidos (aproximação → dwell → saída). Expira sozinha. **Não** é `person_id`. **Não** vai para `recognized_persons`.

---

## 4. Linguagem de regras (0.1)

Expressões sobre o contexto, não sobre a pessoa.

```text
AUDIENCE.PRESENT
AUDIENCE.COUNT >= 2
AUDIENCE.ATTENTION = HIGH
AUDIENCE.DWELL_MS >= 4000
AUDIENCE.APPROACHING >= 1
CLOCK.HOUR_LOCAL BETWEEN 7 AND 10
```

Exemplo:

```text
WHEN
  AUDIENCE.ATTENTION = HIGH
  AND AUDIENCE.DWELL_MS >= 4000
THEN
  hint.category = PREMIUM
  hint.priority_delta = +30
```

O resultado 0.1 é um **hint** para o Dispatcher (`category`, `priority_delta`, `reason`).  
**Não** é “toca o MP4 X”. O Dispatcher continua a aplicar contratos, quotas, horário e kill-switch.

Códigos de recusa do ACE (o motor não emite hint):

| Código | Quando |
|--------|--------|
| `IDENTITY_LEAK` | Payload ainda tem face / embedding / person_id |
| `STALE_CONTEXT` | `observed_at` fora da janela (ex.: > 3 s) |
| `LOW_CONFIDENCE` | Abaixo do limiar configurável |
| `ACE_DISABLED` | Default no Direct: off |

---

## 5. Fase 0 — inventário real neste repo

Classificação contra o código em `TotemDigital-Studio-A.i` (`main`, 23/08/2026). Sem inventar componentes.

| Peça | Caminho | Classificação | Porquê |
|------|---------|---------------|--------|
| Dispatcher / `dispatcher_log` | backend + `database/...part6` | **REUTILIZAR** | Árbitro final. O ACE só sugere. |
| Player-AD 2.13 / 113 | `Player-AD/` | **NÃO ALTERAR** no 0.1 | Cache, heartbeat, kiosk. Visão no edge é fase posterior. |
| `FxOrchestratorService` | `backend/src/services/fxOrchestratorService.ts` | **PONTE lab** | Touch/NFC anónimos → ACE. `mood` / face **não** entram no ACE. |
| `FxRuleService` / `fx_rules` | serviço + `part2-tables-base.sql` | **PONTE lab** | Condição opcional `ace_category` (PREMIUM/STANDARD/FILL). Sem mood. |
| `FxMessageBridge` | `backend/src/services/fxMessageBridge.ts` | **PONTE lab** | `publishAceHint` — JSON sanitizado; MQTT opcional / log-only. |
| `event_logs` | schema part6 | **REUTILIZAR** | `event_type = ace.hint`; metadata sanitizada. Sem coluna nova. |
| `interaction_logs` | schema part6 | **NÃO USAR no 0.1** | Tem `person_id` → Identity. |
| `recognized_persons` + `facialRecognitionService` | schema + `backend/src/services/` | **NÃO ALTERAR** | Manter 501. Fora do ACE. |
| `ai_context_data` | `part11-playlist-mix.sql` | **NÃO USAR como store ACE** | Mistura `pedestrian_count` com sentimento, emoção e demografia. |
| `emotion_data` / `totem_ml_config` | schema part6 | **NÃO USAR no 0.1** | Emoção e flags de face. |
| `tags_crud` | `deferredFeatures.ts` | **NÃO ALTERAR agora** | 501. NFC/QR no ACE são bools (`POST /interaction`), sem `tag_id`. |
| `audience.context` / Privacy Gateway / ACE | lab + `backend/src/services/ace/` | **CRIADO** | Contrato + gateway + hint + auditoria. |
| TDEP endpoints | — | **NÃO MISTURAR** | Protocolo entre CMS; outro lab. |

**Correcção à conversa ChatGPT:** não há 60–70% de ACE pronto. Há um Dispatcher de produção e esboços FX/IA. O ACE 0.1 começa pelo contrato, não por ligar a câmara a `recognized_persons`.

---

## 6. Onde o ACE se encaixa no Dispatcher

Fluxo actual (simplificado):

```text
Campanha / Publicar em Totem / Mix
        → Dispatcher (prioridade, horário, quotas)
        → Player-AD
```

Fluxo com ACE (opt-in, default off):

```text
Campanha / Publicar em Totem / Mix
        → ACE hint (opcional, TTL curto)
        → Dispatcher (prioridade local > hint > fill)
        → Player-AD
```

Prioridade (igual à regra de ouro do Direct e do TDEP):

```text
kill-switch do dono  >  conteúdo local  >  hint ACE  >  fill  >  idle
```

Se o ACE falhar ou estiver off, o Dispatcher comporta-se **exactamente** como hoje.

---

## 7. Relação com TDEP e Maestro

| Lab | Camada | ACE 0.1 |
|-----|--------|---------|
| **TDEP** | Entre empresas / CMS | **Não** transporta `audience.context` no TDEP v1. |
| **Maestro Cue** | Relógio + `play @ t0` | Independente. Um sítio pode ter ACE sem cue. |
| **Maestro Matriz** | Pixels / encoder | Independente. |
| **ACE** | Contexto na instalação | Este spec. |

Expandir o TDEP com audiência agora tornaria o protocolo um CMS disfarçado. Se no futuro um parceiro quiser contexto, será `tdep/2.x` ou um objecto opcional — **não** o 0.1.

---

## 8. Caminho de maturação (ainda neste repo A.i)

Ordem. Cada passo espera decisão explícita antes de código.

1. **Este spec (feito)** — contrato + inventário.
2. **JSON Schema** `ace/0.1` em [`docs/lab-ace/`](./lab-ace/README.md) **(feito)**.
3. **Privacy Gateway em papel + fixtures de recusa (feito).** `STALE_CONTEXT` / `LOW_CONFIDENCE` também no gateway TS.
4. **Emissor sintético (feito)** — `scripts/lab-ace/emit_ace_synthetic.py` → `logs/ace-synthetic.jsonl`. Sem Dispatcher.
5. **Hint no Dispatcher (feito neste clone)** — `applyAceHintToWeight` se `totems.capabilities.ace_enabled === true`. Default **off**. Direct local continua a ganhar. Cache de 60s é ignorado quando ACE está on.
6. **Visão no edge (lab, feito)** — `scripts/lab-ace/edge_vision.py`: HOG de corpo ou modo `--synthetic`. Sem face, sem gravar frame. Contrato `ace/0.1` inalterado.
7. **FX / NFC / QR no mesmo bus (lab, feito)** — bools `interaction.*`; `POST /api/lab/ace/interaction`. Sem `tag_id`. `tags_crud` e `FxOrchestratorService` (mood) **não** foram ligados.
8. **Auditoria `ace.hint` (lab, feito)** — whitelist em `event_logs` + anel em RAM. Recusa nunca persiste o payload. Sem coluna SQL nova.
10. **Pipeline local + opt-in documentado (lab, feito)** — `python scripts/lab-ace/run_lab.py`. SQL de opt-in **não** vai na carga v6.
11. **FX apresenta o hint (lab, feito)** — `ace.hint` no MessageBridge; `fx_rules.ace_category`. Sem mood. Dispatcher continua a escolher o vídeo.
12. **Emulação lab (feito)** — `python scripts/lab-emulate/run_emulation.py` + `runLabAceTick` (Dispatcher/FX/player/TDEP in-memory). Sem Player-AD, sem face.
13. **Opt-in verificado em lab (feito, sem Postgres)** — `python scripts/lab-ace/verify_optin.py`. Default off. Seeds/v6/instalador não ligam ACE. SQL humano: `scripts/lab-ace/optin-totem-lab.sql`.
14. **NTP Maestro em 2 boxes virtuais (feito, sem TV box)** — `python scripts/lab-maestro/test_ntp.py`. `|drift|<=200` e `ntp_ok`; a medição ganha ao JSON. Player-AD intocado.
15. **SSID de players (feito, sem AP)** — `python scripts/lab-maestro/test_ssid.py`. Cue recusa `SSID_STORE` / `SSID_MIXED` / `SSID_BAND` / `SSID_SHARED`. Pitch 15 min não vende isto.
16. **TDEP 0.1 seis objectos (feito, sem HTTP)** — Partner / Face / Availability / Creative / Flight / Proof. Seller recusa `FORMAT_MISMATCH` / `KILL_SWITCH` / `NO_CAPACITY`. Sem dinheiro no Flight.
17. **Dois nós TDEP (feito, sem CMS reais)** — `python scripts/lab-tdep/test_nodes.py`. Prod seller ↔ DEV buyer. TotemNet default off; opt-in por face (10%). Fill + Proof. Pitch 15 min não vende.
18. **CMS LED segunda implementação (feito)** — `python scripts/lab-tdep/test_led_cms.py`. Motor próprio, JSON `tdep/0.1`. Fill nos dois sentidos. Sem Player-AD.
19. **Lane TDEP no Dispatcher (feito)** — `python scripts/lab-tdep/test_lane.py`. Local > fill > idle. `tdep_fill_enabled` default off. Player-AD intocado.
20. **UI Direct ceder ar ocioso (feito, lab)** — accordion colapsado em `TotemEditDialog`. `PUT tdepFill` + `GET/PATCH /api/lab/tdep/fill`. Default off. Pitch 15 min não menciona TotemNet.
21. **One-pager comercial parceiro TDEP (feito)** — [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](./lab-tdep/ONE-PAGER-PARCEIRO-0.1.md). Telas do parceiro; cap 10%; kill-switch; sem factura no Flight; fora do pitch de 15 min.
22. **Pre-voo de campo (feito, hardware opcional)** — `python scripts/lab-field/test_field.py`. Sem 2 boxes ADB: skip `NO_HARDWARE`. SQL ACE não faz UPDATE. Player-AD intocado. Pitch 15 min não vende.
23. **Ciclo de sistema lab com mocks (feito)** — `POST /api/lab/system/tick`. ACE + Maestro mock + TDEP mock. Proof HMAC no fill/guaranteed; cap `NO_CAPACITY`; revoke `RIGHTS_REVOKED`; `totemIds`. Sem TV box, sem APK, sem `/tdep/v1` de produto. Direct local continua a ganhar.
24. **UI lab do tick (feito)** — `/lab/system` fora do menu. Accordion colapsado em `TotemEditDialog`. Cenários mock (fill, guaranteed, cap, revoke, drift). Pitch 15 min não menciona.
25. **Opt-in ACE mock SQL no tick (feito)** — `GET/PATCH /api/lab/system/optin/:totemId` replica o merge JSONB em RAM. Tick lê o store. `IDENTITY_LEAK` recusa o hint. Sem `UPDATE` Postgres. Direct default off.
26. **Recusas STALE_CONTEXT e FORMAT_MISMATCH no tick (feito)** — context velho (>3 s) não gera hint. Parceiro sem variante → `FORMAT_MISMATCH`, idle, sem proof. Pitch 15 min não menciona.
27. **Recusas LOW_CONFIDENCE e POLICY_AUDIO no tick (feito)** — `confidence` < 0.50 sem hint. Variante com som em face muda → `POLICY_AUDIO`, idle, sem proof. Direct default off.
28. **Recusas CATEGORY_BLOCKED e NOT_CEDIBLE no tick (feito)** — categoria vetada ou `cedible: false` recusa o fill. Idle, sem proof. Pitch 15 min não menciona.
29. **Recusas NO_HANDSHAKE e HANDSHAKE_REPLAY no tick (feito)** — `handshake_ok: false` ou timestamp > 60 s recusa o fill. Idle, sem proof. Payload default do fill (sem estes campos) continua a aceitar. Pitch 15 min não menciona.

Não ligar face “para ter um demo”. NFC/QR entram no bus só como bools anónimos — sem `tag_id`.

---

## 9. Regras de ouro

- Opt-in por totem, default **off**.
- Sem imagem, face, embedding ou `person_id` no barramento ACE.
- Sem silent takeover: sem hint válido, o ar é o de sempre.
- Dispatcher manda. ACE sugere.
- Direct / Kit Pronto não mencionam ACE.
- Trabalho de evolução **só** em `TotemDigital-Studio-A.i`. O Studio operacional não recebe este lab.

---

## 10. Artefactos 0.1 (feitos) e próximo

| Artefacto | Estado |
|-----------|--------|
| Spec humana | [ACE-0.1-SPEC.md](./ACE-0.1-SPEC.md) |
| JSON Schema | [lab-ace/audience.context.schema.json](./lab-ace/audience.context.schema.json) |
| Exemplos válidos | [lab-ace/examples/](./lab-ace/examples/) (`01` vazio · `02` aproximação · `03` grupo · `04` NFC · `05` QR · `06` loja fechada) |
| Recusa identidade | [lab-ace/examples/reject-identity-leak.json](./lab-ace/examples/reject-identity-leak.json) |
| Gateway (papel + lab local) | [lab-ace/PRIVACY-GATEWAY-0.1.md](./lab-ace/PRIVACY-GATEWAY-0.1.md) · `scripts/lab-ace/` |
| Validador | `python scripts/lab-ace/validate_ace_schema.py` |
| Emissor sintético | `python scripts/lab-ace/emit_ace_synthetic.py` → `logs/ace-synthetic.jsonl` |
| Visão no edge | [lab-ace/EDGE-VISION-0.1.md](./lab-ace/EDGE-VISION-0.1.md) · `python scripts/lab-ace/edge_vision.py --synthetic` |
| Interacção anónima | [lab-ace/INTERACTION-BUS-0.1.md](./lab-ace/INTERACTION-BUS-0.1.md) · `POST /api/lab/ace/interaction` |
| Auditoria sem PII | [lab-ace/ACE-AUDIT-0.1.md](./lab-ace/ACE-AUDIT-0.1.md) · `GET /api/lab/ace/audit/:totemId` · `event_logs` (`ace.hint`) |
| Ponte FX | [lab-ace/FX-BRIDGE-0.1.md](./lab-ace/FX-BRIDGE-0.1.md) · touch/NFC anónimos; `publishAceHint`; `ace_category` |
| Pipeline / opt-in | `python scripts/lab-ace/run_lab.py` · [lab-ace/OPT-IN-0.1.md](./lab-ace/OPT-IN-0.1.md) |
| Emulação (mocks) | `python scripts/lab-emulate/run_emulation.py` · [../scripts/lab-emulate/README.md](../scripts/lab-emulate/README.md) |
| Opt-in verificado (sem Postgres) | `python scripts/lab-ace/verify_optin.py` · SQL manual `scripts/lab-ace/optin-totem-lab.sql` |
| NTP Maestro (2 boxes virtuais) | `python scripts/lab-maestro/test_ntp.py` · [lab-maestro/NTP-0.1.md](./lab-maestro/NTP-0.1.md) |
| SSID de players (sem AP) | `python scripts/lab-maestro/test_ssid.py` · [lab-maestro/SSID-0.1.md](./lab-maestro/SSID-0.1.md) |
| TDEP 6 objectos (sem HTTP) | `python scripts/lab-tdep/test_tdep.py` · [lab-tdep/TDEP-0.1.md](./lab-tdep/TDEP-0.1.md) |
| Dois nós TDEP (prod ↔ DEV) | `python scripts/lab-tdep/test_nodes.py` · [lab-tdep/NODES-0.1.md](./lab-tdep/NODES-0.1.md) |
| CMS LED (2.ª implementação) | `python scripts/lab-tdep/test_led_cms.py` · [lab-tdep/LED-CMS-0.1.md](./lab-tdep/LED-CMS-0.1.md) |
| Lane TDEP no Dispatcher | `python scripts/lab-tdep/test_lane.py` · [lab-tdep/LANE-0.1.md](./lab-tdep/LANE-0.1.md) |
| UI TDEP (ceder ar ocioso) | accordion `TotemEditDialog` · [lab-tdep/UI-0.1.md](./lab-tdep/UI-0.1.md) |
| One-pager parceiro TDEP | [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](./lab-tdep/ONE-PAGER-PARCEIRO-0.1.md) |
| Pre-voo de campo (ADB/SQL) | `python scripts/lab-field/test_field.py` · [lab-field/FIELD-0.1.md](./lab-field/FIELD-0.1.md) |
| Ciclo de sistema (mocks) | `POST /api/lab/system/tick` · [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) |
| UI ciclo de sistema (lab) | `/lab/system` · accordion Direct · [lab-system/UI-0.1.md](./lab-system/UI-0.1.md) |
| Opt-in ACE no tick (mock SQL) | `GET/PATCH /api/lab/system/optin/:totemId` · [lab-ace/OPT-IN-0.1.md](./lab-ace/OPT-IN-0.1.md) |
| Recusas no tick (stale / formato) | `STALE_CONTEXT` · `FORMAT_MISMATCH` · [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) |
| Recusas no tick (confiança / áudio) | `LOW_CONFIDENCE` · `POLICY_AUDIO` · [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) |
| Recusas no tick (categoria / cedible) | `CATEGORY_BLOCKED` · `NOT_CEDIBLE` · [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) |
| Recusas no tick (handshake) | `NO_HANDSHAKE` · `HANDSHAKE_REPLAY` · [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) |

**Próximo (se avançar):** SQL ACE real num totem de lab (`optin-totem-lab.sql`). Player-AD, face, SKU B, CEC, `/tdep/v1` de produto e TV box reais continuam fora. Direct default off.
