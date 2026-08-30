# Briefing para I.A. colaboradora — lab 0.1

**Leia este ficheiro primeiro.** Depois a spec e o código. Não invente componentes que não estão na tabela de inventário.

| | |
|---|---|
| **Para** | Outra I.A. (ou humano) que vai implementar, sugerir melhorias e **correr testes** |
| **Repo** | [TotemDigital-Studio-A.i](https://github.com/Julio-Eyras/TotemDigital-Studio-A.i) — clone de laboratório |
| **Não é** | O produto operacional [TotemDigital-Studio](https://github.com/Julio-Eyras/TotemDigital-Studio) (`totemdigital.app.br`) |
| **Língua** | Português europeu/brasileiro nos docs e comentários, para bater certo com o resto do repo |
| **Data deste briefing** | 27 de agosto de 2026 |
| **Branch de referência ao escrever** | `cursor/lab-tdep-tick-refusals` · HEAD `c05122de` (`feat(lab): SELECT ACE no tick com skip NO_DATABASE`) |
| **Baseline neste clone** | Frontend 2.1.22 · Backend 2.1.16 · Player-AD **2.15 / 115** · Instala-Player **1.7 / 8** |

Norma humana: [ACE-0.1-SPEC.md](./ACE-0.1-SPEC.md).  
ADRs: [0006](./adr/0006-ace-audience-nao-identidade.md) · [0007](./adr/0007-maestro-cue-nao-e-matriz.md) · [0008](./adr/0008-tdep-nao-transporta-audiencia.md).

---

## 0. Missão (o que se pede a si)

1. **Entender** as três camadas do lab (ACE, Maestro, TDEP) e o tick que as junta.
2. **Sugerir** implementações e melhorias **dentro do 0.1** — não um produto novo.
3. **Implementar** só com decisão explícita humana quando o spec diz “cada passo espera decisão”.
4. **Correr os testes** da §7 antes e depois de qualquer alteração. Sem testes verdes, o lote não está feito.
5. **Não partir** o Direct, o Dispatcher, o Player-AD de campo, o instalador, a carga v6 nem o pitch de 15 min.

Promessa numa frase: *o totem sabe o que está a acontecer agora; não precisa de saber quem é a pessoa.*

---

## 1. O que este clone é (e não é)

| É | Não é |
|---|---|
| Lab de ACE (audiência anónima), Maestro Cue (relógio) e TDEP/TotemNet (ar entre CMS) | Produção em `totemdigital.app.br` |
| HTTP `/api/lab/*` + consola `/lab/system` **fora do menu** | Feature do Kit Pronto / pitch de 15 min |
| Mocks de câmara, TV box, Player-AD e CMS parceiro | Visão com face, cue no APK, `/tdep/v1` de produto |
| Opt-in por totem, default **off** | ACE ligado na carga inicial ou no Direct |

O código de produto (painel, Dispatcher, Player-AD) **vive neste mesmo git** porque o clone partiu do Studio. Alterar produto só se o lote o exigir e **sem** levar ACE/TDEP/Maestro para o Studio operacional.

Três modos de produto (nunca Direct e multi-agência ao mesmo tempo): **Direct Totem** · **Multi Lite** · **Multi Pro**.

---

## 2. Invariantes — NUNCA fazer isto

Violar qualquer ponto abaixo é regressão, mesmo que “melhore o demo”.

1. **Não** reconhecer face, idade, género, emoção, `person_id`, embedding, `tag_id` no barramento ACE. Identity permanece `FEATURE_DEFERRED` (HTTP 501).
2. **Não** alterar o Player-AD (APK de campo) no 0.1. Cue Maestro no APK é decisão à parte. Nome do APK: `Player-AD-Vs{versionName}-build-{versionCode}.apk` — nunca `Player-AD-release.apk`.
3. **Não** criar `/tdep/v1` de produto. Lab HTTP é `/api/lab/tdep` e `/api/lab/system`.
4. **Não** meter `audience.context` no TDEP. Recusa `AUDIENCE_FORBIDDEN`.
5. **Não** ligar ACE na carga `database/carga-inicial-v6.sql` nem no instalador (`scripts/Instala-TotemDigital-Server.sh` / `database/apply-schema-v2.sh`).
6. **Não** fazer `UPDATE` Postgres a partir do HTTP do tick. `POST /api/lab/system/optin/:id/sql` só escreve a **tabela lab em RAM** com `apply: true`. SQL humano: `scripts/lab-ace/optin-totem-lab.sql`.
7. **Não** adicionar colunas SQL novas para ACE. Opt-in = `totems.capabilities.ace_enabled` (JSONB já existente). Schema definitivo = `database/smartchannel-db-v2-refactored-part*.sql` — sem migrations temporárias.
8. **Não** citar ACE, TotemNet, `/lab/system` ou Maestro no pitch: `docs/manuais/12-ROTEIRO-DEMO-15-MIN.md`, `docs/manuais/06-APRESENTACAO-COMERCIAL-SAAS.md`. Há testes que falham se isto acontecer.
9. **Não** pôr `/lab/system` no `menuHierarchy` nem no Command Palette compacto.
10. **Não** deixar o ACE escolher `media_id`. O Dispatcher é o árbitro. ACE só emite **hint** (`category`, `priority_delta`, `reason`).
11. **Não** fazer silent takeover: sem hint válido ou flag off, o ar é **exactamente** o de sempre.
12. Boolean estrito: `ace_enabled: "true"` (string) **não** liga. Só `true` booleano.
13. Direct local **sempre** ganha ao hint ACE. Prioridade: `kill-switch do dono > conteúdo local > hint ACE > fill TDEP > idle`.
14. **Não** misturar as três camadas: ACE = ambiente *desta* tela; TDEP = inventário *entre* CMS; Maestro = *quando* as boxes tocam (não envia vídeo).
15. SKU B (matriz de pixels), CEC, genlock, PTP: **fora**. Não “salvam o demo”.

---

## 3. Arquitectura 0.1

```text
Câmara / NFC / QR / BLE / POS / hora     ← 0.1: mocks ou HOG sintético
        │
        ▼
   Vision AI (edge)     ← só sinais; vídeo não sobe; sem face
        │
        ▼
   Privacy Gateway      ← DROP_IMAGE / FACE / EMBEDDING / BIOMETRIC / PERSISTENT_ID
        │
        ▼
   ACE  (audience.context ace/0.1)  → hint
        │
        ▼
   Rule Engine          → category + priority_delta   (NÃO media_id)
        │
        ▼
   Dispatcher           → árbitro final (já existe em produto)
        │                 + lane TDEP: local > fill > idle
        ▼
   Player-AD / FX       → 0.1: nowPlaying / cue em RAM, não o APK
```

### Três labs, um tick

| Lab | Camada | Contrato | Runtime 0.1 |
|-----|--------|----------|-------------|
| **ACE** | Audiência anónima *desta* instalação | `ace/0.1` `audience.context` | `backend/src/services/ace/` + `/api/lab/ace` |
| **Maestro Cue** | `play item_id @ t0` se NTP e SSID ok | `maestro/0.1` | medição mock / dumpsys fixture |
| **TDEP** | Inventário e flight *entre* CMS | `tdep/0.1` (6 objectos) | lane + Proof HMAC lab |
| **System** | Junta os três num ciclo | HTTP lab | `POST /api/lab/system/tick` · UI `/lab/system` |

### Gateway — recusas ACE (sem hint)

| Código | Quando |
|--------|--------|
| `IDENTITY_LEAK` | face / embedding / `person_id` / `tag_id` / `privacy.*.dropped !== true` |
| `STALE_CONTEXT` | `observed_at` > 3 s |
| `LOW_CONFIDENCE` | `confidence` < 0.50 |
| `ACE_DISABLED` | opt-in off (default Direct) |
| `NO_DATABASE` | tick com `hydrateSql` sem ligação |
| `NO_TOTEM` | SELECT sem linha |

`IDENTITY_LEAK` **ganha** a `LOW_CONFIDENCE`.

### Regras de hint (já no código)

Ficheiro: `backend/src/services/ace/aceRuleEngine.ts`.

- PREMIUM +30 se atenção alta **e** `dwell_ms >= 4000` (+5 extra se `commercial_tier=premium` no peso).
- STANDARD +20 NFC/QR; +10 grupo+atenção; +8 touch; +5 approaching.
- FILL se loja fechada / vazio (conforme regras no motor).
- Cache Dispatcher 60 s é **ignorado** quando ACE está on (hint ~3 s).

### TDEP — recusas seller já no tick

`FORMAT_MISMATCH` · `POLICY_AUDIO` · `CATEGORY_BLOCKED` · `NOT_CEDIBLE` · `NO_HANDSHAKE` · `HANDSHAKE_REPLAY` · `NO_CAPACITY` · `RIGHTS_REVOKED` · `KILL_SWITCH` · `AUDIENCE_FORBIDDEN`.

Proof HMAC de lab (`tdep-0.1-lab-not-product`) só se fill ou guaranteed ganhar. **Sem** audiência no proof. Cap default 10%.

### Maestro — recusas cue

`CLOCK_DRIFT` se `|offsetA − offsetB| > 200 ms`.  
SSID: recusa `SSID_STORE` / `SSID_MIXED` / `SSID_BAND` / `SSID_SHARED`. A **medição ganha ao JSON**.

---

## 4. Ponto actual (agosto 2026)

O ciclo 0.1 **em mocks está fechado**. Hardware real, APK e `/tdep/v1` de produto **não** fazem parte deste fecho.

| Camada | % | Leitura |
|--------|--:|---------|
| Lab 0.1 (papel + mocks + HTTP neste clone) | **93** | Passos 1–30 da spec feitos |
| Direct vendável (Kit Pronto, sem ACE) | **90** | Produto herdado; pitch não fala de lab |
| Lab em 2 TV boxes ADB reais | **8** | Script skipa `NO_HARDWARE` |
| ACE / TDEP / Maestro **em produção** | **0** | Default off; outro repositório |

### 4.1 Funções do lab

Duas colunas: **Lab** = contrato + mocks neste clone. **Campo** = hardware / APK / Postgres vivo / CMS parceiro.

| Bloco | Função | Lab % | Campo % | Estado |
|-------|--------|------:|--------:|--------|
| ACE | Contrato `audience.context` + schema + exemplos | 100 | 0 | Fechado |
| ACE | Privacy Gateway | 100 | 0 | Papel + TS |
| ACE | Hint no Dispatcher (opt-in) | 95 | 15 | Só neste clone |
| ACE | Visão edge HOG / sintético | 90 | 0 | Sem face |
| ACE | Bus NFC/QR/touch anónimos | 100 | 5 | HTTP lab |
| ACE | Auditoria `ace.hint` | 100 | 10 | `event_logs` + anel RAM |
| ACE | Opt-in SQL (RAM + SELECT lab) | 85 | 0 | UPDATE só humano |
| Maestro | Cue + NTP 2 boxes virtuais | 90 | 5 | Skip sem hardware |
| Maestro | SSID só de players 5/6 GHz | 90 | 5 | Fixture dumpsys |
| Maestro | Cue no Player-AD | 0 | 0 | **Fora do 0.1** |
| TDEP | 6 objectos + policy | 100 | 0 | Sem HTTP produto |
| TDEP | Lane + accordion Direct | 95 | 5 | Default off |
| TDEP | Proof HMAC no tick | 100 | 0 | Segredo de lab |
| System | Tick ACE+Maestro+TDEP | 98 | 0 | `POST /tick` |
| System | UI `/lab/system` | 100 | 0 | Fora do menu |
| Campo | Pre-voo ADB | 70 | 10 | `NO_HARDWARE` = skip |

### 4.2 Funções de produto (herdadas — não são o lab)

Tratar como **chão estável**. Não refatorar “de passagem”.

| Função | % | Nota |
|--------|--:|------|
| Publicar em Totem | 95 | Fluxo Direct |
| Mídias / upload / quotas | 92 | |
| Dispatcher | 95 | Locked; ACE só sugere |
| Player-AD 2.15 kiosk HOME | 90 | Não mexer no 0.1 ACE |
| Org / totens / users | 95 | |
| Quick publish | 92 | V3x 1–2 fechadas no repo |
| Campanhas / playlists / mix | 88 | |
| Telemetria / remoto | 85 | |
| Planos / contratos / billing | 75 | Pro |
| OTA | 70 | Pro |
| SmartDisplayFX | 62 | Ponte ACE anónima; **mood fora** |
| Analytics / IA de produto | 35 | Histórico adiado |
| Tags CRUD | 20 | API 501 |
| Facial / backups / notificações UI | 8 | 501 `FEATURE_DEFERRED` |

V3x fases **0–6** fechadas **no repositório**. Fases 7–9 (piloto real, SaaS cloud, módulos avançados) **não fecham por commit**.

---

## 5. Mapa de código (não inventar paths)

### Backend

| Path | Papel |
|------|--------|
| `backend/src/services/ace/` | Gateway, regras, store de hint, audit, interaction, FX publish |
| `backend/src/services/lab/labSystemTick.ts` | Ciclo único ACE+Maestro+TDEP |
| `backend/src/services/lab/labAceSql.ts` | SELECT lab `capabilities`; skip `NO_DATABASE` |
| `backend/src/services/lab/labCapabilitiesStore.ts` | Opt-in mock em RAM |
| `backend/src/services/lab/tdepDispatchLane.ts` | Lane local > fill > idle |
| `backend/src/services/lab/labTdepProof.ts` | Proof HMAC lab |
| `backend/src/services/lab/labEmulation.ts` | Emulação in-memory |
| `backend/src/routes/lab-ace.ts` | `/api/lab/ace` |
| `backend/src/routes/lab-tdep.ts` | `/api/lab/tdep` |
| `backend/src/routes/lab-system.ts` | `/api/lab/system` |
| `backend/src/services/dispatcherTotemService.ts` | `applyAceHintToWeight` se opt-in |
| `backend/src/startup/registerCompactRoutes.ts` | Montagem das rotas lab |
| `backend/src/policy/deferredFeatures.ts` | Facial/tags/backups = 501 |

### Frontend

| Path | Papel |
|------|--------|
| `frontend/src/pages/LabSystem/LabSystem.tsx` | Consola `/lab/system` |
| `frontend/src/utils/labSystemTick.ts` | Payloads dos cenários mock |
| Accordion em `TotemEditDialog` | Lab ciclo + TDEP fill; colapsado |
| `frontend/src/config/deferredFeatures.ts` | Espelho FE do 501 |

### Scripts Python (fonte de verdade dos contratos JSON)

| Path | Papel |
|------|--------|
| `scripts/lab-ace/` | Schema, emissor, edge, opt-in, regras |
| `scripts/lab-maestro/` | NTP, SSID, validate cue |
| `scripts/lab-tdep/` | 6 objectos, nós, LED CMS, lane, one-pager |
| `scripts/lab-field/` | Pre-voo ADB; skip sem 2 devices |
| `scripts/lab-emulate/` | Orquestra ACE+Maestro+TDEP |
| `scripts/lab-system/test_ui.py` | Rota fora do menu + pitch limpo |
| `scripts/lab-ace/optin-totem-lab.sql` | UPDATE humano; **não** no instalador |

### Contratos JSON

| Path | Schema |
|------|--------|
| `docs/lab-ace/audience.context.schema.json` | `ace/0.1` |
| `docs/lab-ace/examples/` | Válidos + recusas |
| `docs/lab-maestro/cue.schema.json` | `maestro/0.1` |
| `docs/lab-tdep/*.schema.json` | Partner, Face, Availability, Creative, Flight, Proof |

### HTTP lab (auth como o resto da API)

```text
POST /api/lab/ace/context
POST /api/lab/ace/interaction          { totem_id, nfc|qr|touch }  sem tag_id
GET  /api/lab/ace/hint/:totemId
GET  /api/lab/ace/audit/:totemId

GET/PATCH /api/lab/tdep/fill/:totemId
POST      /api/lab/tdep/lane/preview

POST /api/lab/system/tick
GET  /api/lab/system/now/:totemId
GET  /api/lab/system/proofs/:totemId
POST /api/lab/system/revoke
GET/PATCH /api/lab/system/optin/:totemId
POST /api/lab/system/optin/:totemId/sql     apply:true = RAM, não Postgres
POST /api/lab/system/maestro/preview
```

UI: `/lab/system` (não está no menu). Cenários: `frontend/src/utils/labSystemTick.ts` (`LabTickScenarioId`).

---

## 6. Próximas implementações (backlog autorizado)

Cada item **espera decisão humana** antes de código grande. Ordem sugerida pelo spec:

### P0 — ainda 0.1, sem hardware

1. **`HANDSHAKE_REJECTED` no tick**  
   Já existe em Python (`scripts/lab-tdep/led_cms.py`, `tdep_nodes.py`). **Não** existe em `backend/src/services/lab/`.  
   Critério: cenário na consola + teste Jest + `test_ui.py` se houver label novo. Sem `/tdep/v1`. Direct default off.

2. **SQL humano verificado num Postgres de lab**  
   Correr à mão `scripts/lab-ace/optin-totem-lab.sql`. HTTP **não** faz UPDATE.  
   `python scripts/lab-ace/test_sql_optin.py` com `LAB_ACE_DATABASE_URL` ou `DATABASE_URL`. Sem BD → skip `NO_DATABASE` (exit 0).  
   **Proibido:** meter isto no instalador ou na v6.

3. **Cenário UI para recusas TDEP que o tick já tem mas a consola pode não nomear**  
   Conferir `LAB_TICK_SCENARIOS` vs códigos da §3. Completar labels, não inventar códigos novos.

### P1 — melhorias 0.1 (só se o humano pedir)

- Paridade tick TS ↔ `tdep_policy.py` (qualquer recusa Python que o tick ainda não cubra, excepto as da lista “fora”).
- Testes de `aceRuleEngine` para ramos FILL / loja fechada se a cobertura falhar.
- Documentar no spec o passo 31 quando P0.1 ou P0.2 fechar.
- Pre-voo: quando existirem **2** devices ADB `device` (não `unauthorized`), `python scripts/lab-field/run_field_lab.py` deixa de skipar. **Não** fingir hardware.

### Fora (não sugerir como “próximo sprint” sem pedido explícito)

Player-AD cue · face · SKU B · CEC · `/tdep/v1` produto · dinheiro no Flight · ACE no pitch · merge para TotemDigital-Studio operacional · coluna SQL nova · ligar `FxOrchestratorService.mood` ao ACE.

---

## 7. Testes — correr isto

Ambiente: Windows PowerShell, raiz do repo. Python 3 com `jsonschema`. Node para Jest.

### 7.1 Suite mínima do lab (obrigatória após cada lote)

```powershell
python scripts/lab-ace/run_lab.py
python scripts/lab-ace/test_sql_optin.py
python scripts/lab-maestro/test_ntp.py
python scripts/lab-maestro/test_ssid.py
python scripts/lab-tdep/test_tdep.py
python scripts/lab-tdep/test_nodes.py
python scripts/lab-tdep/test_led_cms.py
python scripts/lab-tdep/test_lane.py
python scripts/lab-tdep/test_onepager.py
python scripts/lab-field/test_field.py
python scripts/lab-emulate/test_emulation.py
python scripts/lab-system/test_ui.py
python scripts/lab-ace/verify_optin.py

cd backend
npx jest --selectProjects unit --testPathPattern="labSystemTick|labSystem.routes|labCapabilitiesStore|labAceSql|labAce.routes|labTdep.routes|labEmulation|labTdepProof|aceHint|tdepDispatchLane" --forceExit --coverage=false
cd ..

cd frontend
npx react-scripts test --watchAll=false --testPathPattern="labSystemTick|rolePermissions" --coverage=false
cd ..
```

Exit code **0** em todos. `test_field.py` **pode** passar com skip `NO_HARDWARE` — isso é sucesso.

### 7.2 Isolados úteis

```powershell
python scripts/lab-ace/validate_ace_schema.py
python scripts/lab-ace/test_edge_vision.py
python scripts/lab-ace/test_ace_rules.py
python scripts/lab-ace/edge_vision.py --synthetic --frames 6
python scripts/lab-tdep/validate_tdep.py
python scripts/lab-maestro/validate_maestro.py
python scripts/lab-emulate/run_emulation.py
```

### 7.3 Ficheiros de teste (Jest)

```text
backend/src/__tests__/unit/services/aceHint.test.ts
backend/src/__tests__/unit/services/labSystemTick.test.ts
backend/src/__tests__/unit/services/labAceSql.test.ts
backend/src/__tests__/unit/services/labCapabilitiesStore.test.ts
backend/src/__tests__/unit/services/labEmulation.test.ts
backend/src/__tests__/unit/services/labTdepProof.test.ts
backend/src/__tests__/unit/services/tdepDispatchLane.test.ts
backend/src/__tests__/unit/routes/labAce.routes.test.ts
backend/src/__tests__/unit/routes/labSystem.routes.test.ts
backend/src/__tests__/unit/routes/labTdep.routes.test.ts
frontend/src/utils/labSystemTick.test.ts
frontend/src/utils/rolePermissions.test.ts
```

### 7.4 Invariantes que os testes de UI já cobrem

`scripts/lab-system/test_ui.py` falha se:

- `App.tsx` não tiver rota `/lab/system`
- `menuHierarchy` ou Command Palette compacto listarem `/lab/system`
- Pitch 15 min / apresentação SaaS citarem `/lab/system`, “ciclo de sistema lab” ou TotemNet

Não “corrigir” o teste para deixar passar menção comercial.

### 7.5 Como acrescentar um teste (padrão do repo)

- Recusa nova no tick → caso em `labSystemTick.test.ts` **e** cenário em `labSystemTick.ts` **e** (se houver copy na página) `test_ui.py` / `labSystemTick.test.ts` FE.
- Recusa nova no schema JSON → fixture em `docs/lab-*/examples/` + validador Python + teste Python.
- Opt-in → boolean estrito (`"true"` string não liga).
- Nomear o teste pelo **código de recusa** (`IDENTITY_LEAK`, não “caso 3”).

---

## 8. Como sugerir melhorias (formato)

Quando propor trabalho, use este bloco. Sem isto, o humano não consegue decidir.

```text
## Proposta
Título curto.

## Camada
ACE | Maestro | TDEP | System | Produto (explicar porquê)

## Porque agora
1–3 frases. Ligar à spec ou a um teste vermelho.

## Invariantes tocados
Lista da §2. Se tocar Player-AD, schema, v6, pitch ou face → PARAR e perguntar.

## Alterações
- ficheiros
- códigos de recusa novos (se houver)
- UI: só /lab/system ou accordion colapsado

## Testes
Comandos exactos da §7 que vai correr.
Casos novos.

## Fora de âmbito
O que deliberadamente NÃO faz.
```

Melhorias **boas** neste lab: mais recusas do papel no tick; paridade Python/TS; testes em falta; docs alinhadas ao código; skip honesto sem hardware.

Melhorias **más**: “ligar a câmara para o demo”; “meter face só no lab”; “endpoint TDEP de produto”; “coluna metadata em tags”; “ACE on por default”; “mencionar TotemNet no pitch”.

---

## 9. Definition of done (lote lab)

- [ ] Spec ou doc 0.1 do bloco actualizado (não só o código).
- [ ] Default off. Direct local continua a ganhar nos testes.
- [ ] Sem coluna SQL nova. Sem v6. Sem instalador. Sem Player-AD.
- [ ] Sem menção no pitch / menu compacto.
- [ ] Suite §7.1 verde.
- [ ] Recusas **não** persistem payload com PII (audit já sanitiza; não reverter).
- [ ] Comentário de commit no estilo do repo: `feat(lab): …` / `feat(ace): …` / `docs(lab): …`

Não fazer commit a menos que o humano peça.

---

## 10. Schema e instalador (regra de ouro do workspace)

Alterações de tabelas/colunas/índices: **só** em `database/smartchannel-db-v2-refactored-part*.sql` e seeds (`database/carga-inicial-v6.sql`, etc.), mais `database/apply-schema-v2.sh` e o instalador. Sem `ALTER TABLE` em migration temporária.

O ACE 0.1 **não precisa** de coluna nova. Se achar que precisa, está a sair do 0.1 — pergunte.

---

## 11. Glossário rápido

| Termo | Significado |
|-------|-------------|
| **ACE** | Audience Context Engine — contexto anónimo da audiência |
| **hint** | Sugestão ao Dispatcher; não é o vídeo |
| **Privacy Gateway** | Filtro que corta identidade **antes** do ACE |
| **Maestro Cue** | `play @ t0`; cada box toca o ficheiro em cache |
| **Maestro Matriz / SKU B** | Pixels / encoder — **fora** do 0.1 |
| **TDEP / TotemNet** | Protocolo entre CMS (inventário + flight + proof) |
| **Face** (TDEP) | Face de inventário (tela), **não** rosto humano |
| **Direct** | Modo uma-org; Kit Pronto; ACE default off |
| **tick** | Um ciclo mock ACE+Maestro+TDEP em `POST /api/lab/system/tick` |
| **FEATURE_DEFERRED** | API responde 501 de propósito |

---

## 12. Leitura ordenada (depois deste briefing)

1. [ACE-0.1-SPEC.md](./ACE-0.1-SPEC.md) — contrato + inventário real + passos 1–30 feitos  
2. [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) + [UI-0.1.md](./lab-system/UI-0.1.md)  
3. [lab-ace/OPT-IN-0.1.md](./lab-ace/OPT-IN-0.1.md) + [PRIVACY-GATEWAY-0.1.md](./lab-ace/PRIVACY-GATEWAY-0.1.md)  
4. [lab-tdep/TDEP-0.1.md](./lab-tdep/TDEP-0.1.md) + [LANE-0.1.md](./lab-tdep/LANE-0.1.md)  
5. [lab-maestro/NTP-0.1.md](./lab-maestro/NTP-0.1.md) + [SSID-0.1.md](./lab-maestro/SSID-0.1.md)  
6. [lab-field/FIELD-0.1.md](./lab-field/FIELD-0.1.md)  
7. Código: `labSystemTick.ts` + `aceRuleEngine.ts` + `frontend/src/utils/labSystemTick.ts`  
8. Índice geral: [00-INDICE.md](./00-INDICE.md) §6b–6e  

Índice de módulos de **produto** (não lab): [modulos/00-INDICE.md](./modulos/00-INDICE.md).

---

## 13. Arranque em 10 minutos

```text
1. Abrir este ficheiro e a §2 (invariantes).
2. Correr a suite §7.1 — confirmar verde no HEAD actual.
3. Ler ACE-0.1-SPEC.md secção 8 (caminho) e secção 10 (próximo).
4. Se o humano não escolheu lote: propor P0.1 HANDSHAKE_REJECTED no tick
   no formato da §8. Não começar a recodificar o Dispatcher.
5. Depois de código: suite §7.1 outra vez + actualizar spec se o passo fechar.
```

**Próximo do spec (citação):** SQL humano `optin-totem-lab.sql` num Postgres de lab **ou** recusa `HANDSHAKE_REJECTED` no tick. Player-AD, face, SKU B, CEC, `/tdep/v1` de produto e TV box reais continuam fora. Direct default off.
