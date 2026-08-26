# Conversa — Protocolo de interoperabilidade DOOH (TDEP / TotemNet)

**Tipo:** debate e plano (sem alteração de código)  
**Data:** 13 de agosto de 2026  
**Produção de referência:** https://totemdigital.app.br  
**Repositório:** TotemDigital-Studio (`main`)  
**Autor / licença:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções — proprietária  
**Baseline:** Front 2.1.22 · Back 2.1.16 · Player-AD 2.12 / 112  

Este documento regista a conversa de produto sobre uma **camada de interoperabilidade** entre CMS de DOOH (Digital Out-of-Home), usando o TotemDigital apenas como **laboratório / exemplo inicial**. Não implica alterar a plataforma operacional.

---

## 0. Estatuto deste texto

- **Não é especificação normativa final.** É maturação de conceito.
- **Não substitui** Direct / Lite / Pro, nem o pitch de 15 min do Kit Pronto.
- **Não altera** `main`, schema, player nem painel.
- Objetivo: sair de “cada CMS fala só com os seus dispositivos” para “redes DOOH podem conversar entre si”.

---

## 1. A questão central

A pergunta **não** é: “Qual CMS deveríamos utilizar?”

A pergunta **é**:

> Seria possível criar um protocolo comum que permitisse que diferentes CMS de DOOH compartilhassem campanhas, inventário e agendamentos, preservando a autonomia tecnológica de cada empresa?

E, se for viável técnica e comercialmente:

> Quais seriam os padrões, regras, APIs, modelos de dados, mecanismos de autenticação, governação e modelos comerciais necessários?

**Resposta curta desta conversa:** sim, é viável — desde que o protocolo seja uma **língua de ar** (inventário, flight, autorização, proof-of-play), não um CMS disfarçado, e desde que o dono da tela conserve veto, prioridade local e kill-switch.

---

## 2. Contexto de mercado (proposta do autor)

O mercado de DOOH evolui rapidamente. Existem inúmeras plataformas de CMS e soluções próprias para painéis LED, Smart TVs, totens digitais e outros dispositivos de mídia.

Cada empresa desenvolve:

- a sua tecnologia;
- o seu CMS;
- os seus formatos de campanha;
- os seus mecanismos de agendamento e distribuição.

A ideia não é fazer com que todos usem o mesmo CMS. É estabelecer um **protocolo, conjunto de regras ou framework aberto** para partilha de conteúdo, campanhas, inventário e agendamento entre empresas parceiras de uma mesma rede DOOH.

**Exemplo:** `totemdigital.app.br` continuaria com o seu CMS e a sua infraestrutura. Outra empresa poderia usar uma plataforma completamente diferente. Ambas adeririam a um protocolo comum capaz de definir:

- como uma campanha é descrita;
- como conteúdos são identificados e disponibilizados;
- como horários e períodos de veiculação são definidos;
- como um espaço publicitário é disponibilizado;
- como uma campanha é partilhada entre parceiros;
- como os conflitos de agenda são tratados;
- como cada parceiro autoriza ou rejeita uma publicação;
- como é confirmado que determinado conteúdo foi efetivamente exibido;
- como são gerados registos e comprovantes de veiculação;
- como são tratados diferentes tipos de dispositivos, resoluções e formatos;
- como são definidas permissões, responsabilidades e regras comerciais entre os participantes.

O objetivo **não** seria substituir os CMS existentes. Cada empresa manteria liberdade tecnológica. O protocolo funcionaria como **linguagem comum** entre os sistemas.

### Exemplo prático

Uma empresa tem **500 totens digitais**; outra tem **200 painéis LED**.

Hoje, uma campanha nas duas redes exige integração específica entre sistemas.

Com um protocolo comum, o anunciante publicaria a campanha **uma vez** e, mediante autorização e regras prévias, ela poderia ser distribuída às redes participantes. Cada rede continuaria responsável pelo seu CMS, dispositivos, operação e inventário. O protocolo cuidaria da **comunicação entre plataformas**.

### Arquitectura em três camadas (proposta do autor)

1. **CMS local** — cada empresa mantém o seu sistema de gestão.
2. **Protocolo de interoperabilidade** — camada padronizada: campanhas, conteúdos, inventário, agenda, permissões, eventos e confirmações.
3. **Redes parceiras** — operadores e proprietários partilham inventário e campanhas através dessa camada.

Isto transformaria várias redes independentes num **ecossistema interoperável** de mídia digital.

Analogia usada no debate: o e-mail não ganhou porque todos usaram o mesmo cliente; ganhou porque existia SMTP.

---

## 3. O que o TotemDigital já tem vs o que a rede mútua precisa

| Já existe no TotemDigital | O que a federação precisa |
|---------------------------|---------------------------|
| Direct / Lite / Pro **dentro de uma instalação** | Federação **entre instalações** (e, no limite, entre CMS diferentes) |
| Dispatcher + playlists + agenda | Contrato de slot: quem cede, quem recebe, prioridade |
| Heartbeat + telemetria do Player-AD | Proof-of-play assinado, auditável pelo parceiro |
| OpenAPI própria (centenas de paths) | Esquema **neutro** (vocabulário comum), não só a API interna |
| `totemdigital.app.br` como produção | Pode ser o **primeiro hub / lab**, não o dono de todas as telas |

Lite/Pro resolvem multi-agência **no mesmo servidor**. O protocolo resolve **parceiros que não querem (nem devem) partilhar BD, billing nem player**.

| Modo actual | Papel |
|-------------|--------|
| **Direct** | Dono local; pode *optar* por ceder N% do ar (default off) |
| **Lite** | Várias orgs na **mesma** instância |
| **Pro** | Agência + contratos + billing |
| **TDEP / TotemNet** | **Entre** instâncias e **entre** marcas de CMS |

---

## 4. Nomes de trabalho

| Uso | Nome | Função |
|-----|------|--------|
| Comercial | **TotemNet** | A “rede” / a promessa |
| Técnico | **TDEP** (TotemDigital Exchange Protocol) | O schema + API |
| Lab | `totemdigital.app.br` | Implementação de referência + primeiro nó |

Promessa numa frase: *“As telas continuam tuas. O ar pode ser partilhado.”*

Três papéis (não misturar):

1. **Screen owner** — dono da tela. Veto absoluto.
2. **Air partner** — quem pede/cede slots.
3. **Hub** (opcional) — descoberta, reputação, relógio de prova. Pode haver vários hubs.

---

## 5. Três alternativas e veredito

| Opção | Ideia | Veredito |
|-------|-------|----------|
| A | TotemDigital como CMS único da rede | Perde. Ninguém grande abandona o CMS. |
| B | Marketplace fechado só entre installs TotemDigital | Útil como piloto (P1); pequeno demais como visão. |
| C | Protocolo aberto (TDEP) + hub de referência | A jogada certa: vocês implementam primeiro; outros podem aderir. |

**Recomendação:** **C**, com **B como piloto**. Primeiro dois nós TotemDigital; o whitepaper já descreve C para parceiros LED/shopping.

---

## 6. Problemas que o protocolo tem de resolver

Ordem em que o sistema rebenta se falhar:

1. **Identidade** — parceiro, tela, campanha, criativo (IDs estáveis, não “playlist 37 do Postgres”).
2. **Inventário** — o que é uma “face”: geo, indoor/outdoor, orientação, resolução, horários, categoria, restrições.
3. **Disponibilidade** — o que está *cedível*, não a playlist interna inteira.
4. **Criativo** — URI, hash, duração, codec, rights, validade, brand-safety.
5. **Flight / pedido de ar** — plays, janela, faces, prioridade (garantido vs fill).
6. **Autorização** — aceite / recusa / aceite condicional.
7. **Conflito de agenda** — prioridade local vs rede vs fill.
8. **Distribuição** — o CMS local *puxa* o criativo; o protocolo **não** manda no player do parceiro.
9. **Confirmação de exibição** — proof-of-play assinado.
10. **Dispositivos / formatos** — 9:16 totem, 16:9 LED, áudio sim/não.
11. **Responsabilidade** — dono da tela, do criativo, do incumprimento, do take-down.
12. **Comercial** (fase 2) — barter, fill, CPM, rev-share. **Não bloquear a fase 1.**

Dois problemas que matam o standard se forem ignorados:

13. **Kill-switch** — o dono corta criativo/parceiro em segundos.
14. **Revogação de rights** — criativo expirado ou puxado pelo anunciante; tem de parar mesmo com cache offline (cenário real do Player-AD 24/7).

---

## 7. Arquitectura afinada (três camadas)

```text
┌─────────────────────────────────────────────────────────┐
│  Anunciante / agência / operador                        │
│  (TotemDigital, outro CMS, ou só a API TDEP)            │
└───────────────────────────┬─────────────────────────────┘
                            │  TDEP (HTTPS + JSON + assinatura)
┌───────────────┐   ┌───────▼────────┐   ┌────────────────┐
│ CMS A         │◄─►│ Camada TDEP    │◄─►│ CMS B          │
│ TotemDigital  │   │ (hub opcional) │   │ LED / outro    │
│ totens 500    │   │ inventário,    │   │ painéis 200    │
│ Player-AD     │   │ flight, proof  │   │ player próprio │
└───────────────┘   └────────────────┘   └────────────────┘
```

Regras:

- O **CMS local** continua a mandar no dispositivo.
- O **hub** é opcional (dois CMS podem ser peer-to-peer).
- Uma campanha “publicada uma vez” é um **Flight TDEP** replicado a N nós, cada um **autorizando** no seu inventário.
- Erro clássico: o hub *falar* com a TV box do parceiro. Aí morre a interoperabilidade.

---

## 8. Modelo de dados mínimo (TDEP 0.1 conceptual)

Seis objectos. UUIDs, relógio UTC, schema versionado (`tdep/1.0`).

| Objecto | O que é | Analogia |
|---------|---------|----------|
| `Partner` | Org + chaves + política | quem fala |
| `Face` | Uma tela / face de inventário | onde |
| `Availability` | Janelas cedíveis + caps (% ar, max plays) | o que posso emprestar |
| `Creative` | Pacote de mídia + constraints + hash + rights | o quê |
| `Flight` | Pedido/reserva de ar | quando / quanto |
| `Proof` | Evento de exibição assinado | aconteceu |

### Face (inventário)

`face_id`, geo, indoor/outdoor, `orientation` (portrait/landscape), `pixel_w/h`, `supported_mime`, `audio` (bool), timezone, `venue_category`, `owner_partner_id`.

### Creative

`creative_id`, `uri` (HTTPS), `sha256`, duração ms, `mime`, **variantes** (`9:16`, `16:9`), `valid_from/until`, `license` (uso, território, take-down URL), `brand_categories` (álcool, kids, político…).

500 totens + 200 LEDs **não** partilham o mesmo ficheiro. O protocolo trata **Creative com variantes**, não um MP4 único. Sem variante compatível → recusa `FORMAT_MISMATCH`, não “força e estica”.

### Flight

`flight_id`, `buyer_partner_id`, `seller_partner_id`, lista de `face_id` ou selector (cidade + categoria), `window`, `priority` (`guaranteed` | `fill` | `preemptible`), `quota` (plays/dia ou share %), `creative_ids[]`, `status` (`offered` → `accepted` | `rejected` | `active` | `paused` | `revoked`).

### Proof

`proof_id`, `face_id`, `creative_id`, `flight_id`, `played_at`, `duration_ms`, `player_hash` (checksum do ficheiro que correu), assinatura do **seller** (e, se possível, do dispositivo). Sem isto não há confiança mútua.

### Conflito de agenda (função no seller, não um 7.º objecto)

```text
prioridade_local  >  flight.guaranteed  >  fill  >  idle
kill-switch do owner  >  tudo
revogação de creative  >  tudo
cap de % de ar da rede  >  guaranteed (não pode estourar o contrato local)
```

Se o guaranteed não cabe, o Flight **não** passa a `accepted`. Recusa explícita com motivo, por exemplo:

- `NO_CAPACITY`
- `POLICY_AUDIO`
- `FORMAT_MISMATCH`
- `CATEGORY_BLOCKED`

---

## 9. API pequena de propósito (~8 endpoints)

Se passar de ~15, já não é standard: é o CMS TotemDigital disfarçado.

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

Webhook opcional: `flight.updated`, `proof.batch`, `creative.revoked`.

### Autenticação

| Fase | Mecanismo |
|------|-----------|
| Lab (dois nós TotemDigital) | mTLS **ou** HMAC no body + timestamp + `partner_id` |
| Parceiro real | mTLS + allowlist + rotação de chaves |
| Hub público | o mesmo + reputação (taxa de proof vs promised) |

São **máquinas a falar com máquinas**. OAuth “login Google” aqui é teatro. Assinatura + relógio + janela anti-replay.

---

## 10. Governação

Se o TDEP for “spec no Git da TotemDigital, só vocês mudam”, o mercado trata-o como API privada. Três chapéus separados:

1. **Spec** — documento versionado (JSON Schema + semântica). Breaking change = `tdep/2.0`.
2. **Lab / referência** — `totemdigital.app.br` implementa `tdep/1.0`. O CMS pode inovar à vontade.
3. **Governação** — changelog público; idealmente **duas implementações independentes** antes de chamar “padrão”. Um terceiro (associação, shopping, operador LED) no conselho *quando* houver volume.

Não inventar ISO no dia 1. Inventar **um PDF + JSON Schema + dois nós a conversar**.

---

## 11. Modelos comerciais (sem preços)

O protocolo deve **suportar**, não impor:

| Modo | O que é | Quando |
|------|---------|--------|
| **Barter / fill** | Troca de ar ocioso. Sem factura. | Fase 1, confiança |
| **Cessão contratual** | Ex.: shopping cede 15% do ar à agência X. Quota no `Availability`. | Fase 2 |
| **Monetizado** | CPM / play / share. Settlement **fora** do TDEP v1 (ou extensão futura). | Fase 3 |

Erro fatal: meter factura no `Flight`. O CMS Pro já tem billing. O TDEP v1 fica **agnóstico a dinheiro**, senão nenhum CMS concorrente adere.

Valor imediato para um dono Direct: telas ligadas muitas horas com ar ocioso passam a ter **fill de parceiro de confiança**, sem mudar de CMS nem de player.

---

## 12. Regras de ouro (framework)

- **Opt-in por tela**, nunca por instalação inteira sem dono.
- **Prioridade local > rede > fill.** O cardápio da loja não perde para o anúncio do parceiro, salvo contrato explícito.
- **Veto e kill-switch** em segundos.
- **Não há silent takeover.** Sem handshake + política, zero plays.
- **Creative policy** no inventário (orientação, duração, áudio, categorias).
- **Proof obrigatório** para slot garantido; fill pode ser best-effort.
- **Dinheiro é fase 2.**
- **CMS estrangeiro entra por gateway**, não reescrevendo o Player-AD.
- Direct continua Direct: TotemNet **default off**; não entra no pitch de 15 min.

---

## 13. Viabilidade

| Eixo | Veredito |
|------|----------|
| Técnica | Alta. Objectos conhecidos (inventário, criativo, agenda, evento). |
| Comercial | Média. Só funciona se o dono da tela **ganhar** (ar ocioso, fill, marca; depois receita) e **não perder** controlo. |
| Governação | Ponto frágil. Sem dono neutro do *standard*, vira “API da TotemDigital disfarçada”. |
| Adoção | Só se o P1 for simples: 6 JSON + ~8 endpoints + opt-in. |

---

## 14. Riscos

- **Standard-washing:** spec linda, uma só implementação → é API TotemDigital.
- **Hub-god:** o hub decide o que vai ao ar → os donos fogem.
- **Proof fraco:** CSV sem assinatura → o anunciante não confia.
- **Cache zombie:** player offline continua criativo revogado → TTL + hash + revoke no desenho.
- **Misturar com Lite/Pro:** multi-agência *dentro* de uma install ≠ federação *entre* CMS.
- **Abrir DOOH enterprise no slide 1:** mata o Kit Pronto. TotemNet é P3 de narrativa, P1 de lab.

---

## 15. Caminho de maturação (lab, sem código agora)

1. **Whitepaper TDEP 0.1 (feito neste clone)** — 6 objectos + matriz de prioridade + ~8 endpoints + códigos de recusa.
2. **Dois nós vossos (feito neste clone)** — prod ↔ DEV in-memory. Um Flight fill + um Proof. Zero UI nova no Direct. TotemNet default off; opt-in por face.
3. **Opt-in conceptual Direct (feito neste clone)** — “ceder até 10% do ar”, default off (`enable_totemnet`).
4. **Um parceiro externo (feito neste clone)** — script CMS LED (`led_cms.py`). Segunda implementação = o standard começou a existir em lab.
5. **Lane no Dispatcher (feito neste clone)** — `tdep_lane.py` / `tdepDispatchLane.ts`. Local > fill. Default off. UI: [lab-tdep/UI-0.1.md](./lab-tdep/UI-0.1.md).
6. **One-pager comercial (feito neste clone)** — [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](./lab-tdep/ONE-PAGER-PARCEIRO-0.1.md). Para um CMS LED/shopping. Fora do pitch de 15 min.

---

## 16. Conclusão da conversa

> Sim — um protocolo comum de DOOH é o movimento certo, desde que seja língua de ar (inventário, flight, autorização, proof), não um CMS disfarçado, e desde que o dono da tela conserve veto, prioridade local e kill-switch.

`totemdigital.app.br` não precisa ser “a rede”. Precisa ser a **primeira implementação honesta** e o sítio onde o schema nasce.

As 500 totens + 200 LEDs só se encontram se:

- o criativo tiver **variantes** de formato;
- o flight tiver **autorização**;
- o proof voltar **assinado**;
- cada CMS continuar a mandar nos **seus** dispositivos.

**TDEP 0.1 em lab (feito neste clone):** [lab-tdep/TDEP-0.1.md](./lab-tdep/TDEP-0.1.md) — 6 objectos JSON + recusas. Dois nós: [lab-tdep/NODES-0.1.md](./lab-tdep/NODES-0.1.md). CMS LED: [lab-tdep/LED-CMS-0.1.md](./lab-tdep/LED-CMS-0.1.md). Lane: [lab-tdep/LANE-0.1.md](./lab-tdep/LANE-0.1.md). UI Direct (accordion, default off): [lab-tdep/UI-0.1.md](./lab-tdep/UI-0.1.md). One-pager parceiro: [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](./lab-tdep/ONE-PAGER-PARCEIRO-0.1.md). Sem `/tdep/v1` de produto.

Próximo (se avançar): SQL ACE / NTP+SSID em hardware. Direct default off. Pitch de 15 min não menciona TotemNet.

Documento irmão (pixels e cue *dentro do sítio*, não campanha entre CMS): [PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md).

---

## 17. Origem desta conversa

Debate interno TotemDigital Studio, 13/08/2026. Participantes: Julio Cesar Eyras (visão de produto / tese) e assistente de arquitectura (análise, regras e plano de lab). Documento gerado a partir dessa conversa para arquivo e partilha com parceiros — **sem implicar implementação imediata**.
