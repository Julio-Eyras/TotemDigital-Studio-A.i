# Tracework — o que falta (até 3 níveis)

Rastreio de **falhas** do lab 0.1, não do que já está feito.  
Irmão: [ANDAMENTO-0.1.md](./ANDAMENTO-0.1.md) (inventário do plano).

Checkout: `main` @ `cec6cd1c` (andamento) / ciclo mock `077f5823`.  
Código 28–30: ramo `cursor/lab-tdep-tick-refusals` (`c05122de`), **não** em `main`.

| Tipo | Significado |
|------|-------------|
| **Falta em main** | Trabalho 0.1 ainda aberto neste checkout |
| **No ramo** | Já existe no ramo; falta merge |
| **Bloqueado** | Lab pronto; falta hardware ou BD de lab |
| **Fora** | Não entra no 0.1 de propósito |

Níveis: **L1** camada → **L2** função → **L3** item (rota, código, script ou peça de campo).

---

## 1. ACE — contexto desta tela

### 1.1 Opt-in persistente (`totems.capabilities`)

| L3 | Tipo | O que falta |
|----|------|-------------|
| Merge do ramo (SELECT lab, `hydrateSql`, `NO_DATABASE` / `NO_TOTEM`) | No ramo | `labAceSql.ts`, `POST /api/lab/system/optin/:id/sql` |
| `UPDATE` humano num totem de lab | Bloqueado | `scripts/lab-ace/optin-totem-lab.sql` à mão; **não** v6 / instalador |
| Tick em `main` a ler só RAM | Falta em main | Sem `hydrateSql` até ao merge |

O Dispatcher de produto já faz `SELECT capabilities` (`isTotemAceEnabled`). O buraco é o **tick de lab** neste checkout e o **UPDATE** real.

### 1.2 Recusas no tick (parceiro / SQL)

| L3 | Tipo | O que falta |
|----|------|-------------|
| `CATEGORY_BLOCKED` no tick | No ramo | Passo 28 |
| `NOT_CEDIBLE` no tick | No ramo | Passo 28 |

No `main`, `mockTdepPartnerAccepts` só recusa leak, `POLICY_AUDIO` e `FORMAT_MISMATCH`. Policy Python (`seller_decide`) já tem categoria e cedible.

### 1.3 Sensores

| L3 | Tipo | O que falta |
|----|------|-------------|
| Câmara local a alimentar `audience.context` | Fora | Edge HOG sintético basta no 0.1 |
| Face / embedding / `person_id` | Fora | Identity isolada; API 501 |

---

## 2. Maestro — quando as boxes tocam

### 2.1 Relógio

| L3 | Tipo | O que falta |
|----|------|-------------|
| NTP medido em 2 TV boxes ADB | Bloqueado | Script skip `NO_HARDWARE`; `|drift|<=200` já no mock |

### 2.2 Rede de players

| L3 | Tipo | O que falta |
|----|------|-------------|
| `dumpsys wifi` em 2 devices USB | Bloqueado | Fixtures de loja/players já recusam `SSID_STORE` |

### 2.3 Cue no dispositivo

| L3 | Tipo | O que falta |
|----|------|-------------|
| Player-AD a ler cue Maestro | Fora | APK 2.15 / 115 intocado de propósito |
| SKU B / CEC / genlock / PTP | Fora | Outro SKU |

---

## 3. TDEP — ar entre CMS

### 3.1 Recusas no tick (espelho dos nós)

| L3 | Tipo | O que falta |
|----|------|-------------|
| `NO_HANDSHAKE` no tick | No ramo | Passo 29 |
| `HANDSHAKE_REPLAY` no tick | No ramo | Passo 29 · ts > 60 s |
| `HANDSHAKE_REJECTED` no tick | Falta em main | HMAC / segredo; já em `tdep_nodes.handshake`, **não** no tick (nem no ramo) |

### 3.2 HTTP de produto

| L3 | Tipo | O que falta |
|----|------|-------------|
| `POST /tdep/v1/partners/handshake` | Fora | Papel em TDEP-0.1 |
| `GET /tdep/v1/inventory/faces` | Fora | Idem |
| `GET /tdep/v1/inventory/availability` | Fora | Idem |
| `POST /tdep/v1/creatives` | Fora | Idem |
| `POST /tdep/v1/flights` | Fora | Idem |
| `POST /tdep/v1/flights/{id}/decision` | Fora | Idem |
| `POST /tdep/v1/flights/{id}/revoke` | Fora | Idem |
| `POST/GET /tdep/v1/proofs` | Fora | Proof HMAC só no tick lab |

### 3.3 Parceiro e dinheiro

| L3 | Tipo | O que falta |
|----|------|-------------|
| CMS parceiro real (além do LED in-memory) | Fora | `led_cms.py` fecha a 2.ª implementação de lab |
| Factura / preço no Flight | Fora | Cap 10% e proof; sem dinheiro no 0.1 |
| `audience` no JSON TDEP | Fora | ADR-0008; recusa `AUDIENCE_FORBIDDEN` |

---

## 4. Ciclo de sistema e UI

### 4.1 Consola `/lab/system`

| L3 | Tipo | O que falta |
|----|------|-------------|
| Chips CATEGORY / CEDIBLE / handshake / SQL | No ramo | `labSystemTick.ts` no `main` para no `policy_audio` |
| Página no menu Direct | Fora | URL oculta de propósito |
| Pitch 15 min a citar o lab | Fora | Manuais 12 e 06 não vendem isto |

### 4.2 Integração git

| L3 | Tipo | O que falta |
|----|------|-------------|
| Merge `cursor/lab-tdep-tick-refusals` → `main` | Falta em main | Fecha passos 28–30 neste checkout |
| Push do andamento `cec6cd1c` | Falta em main | 1 commit local à frente de `origin/main` (se ainda não enviado) |

---

## 5. Campo (hardware / Postgres)

### 5.1 Pre-voo ADB

| L3 | Tipo | O que falta |
|----|------|-------------|
| 2 boxes `adb devices` = `device` | Bloqueado | Sem isto o lab **não falha**; skip `NO_HARDWARE` |

### 5.2 Postgres de lab

| L3 | Tipo | O que falta |
|----|------|-------------|
| Linha `totem_id` (ex. 41) + `ace_enabled: true` | Bloqueado | SELECT skip `NO_DATABASE` no ramo; UPDATE só SQL humano |
| Coluna SQL nova para ACE | Fora | Só JSONB `capabilities`; schema part3 já documenta default false |

---

## Ordem sugerida (só o que ainda é 0.1)

1. Merge do ramo (L3 4.2 + 1.1 + 1.2 + 3.1 parciais).
2. `HANDSHAKE_REJECTED` no tick (L3 3.1).
3. SQL humano num Postgres de lab, se existir (L3 1.1 / 5.2) — nunca no instalador.
4. 2 boxes ADB, se existirem (L3 2.1 / 5.1) — senão o skip continua válido.

Face, cue no APK, `/tdep/v1` de produto, SKU B e pitch 15 min **não** entram nesta ordem.
