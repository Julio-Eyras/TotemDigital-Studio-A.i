# Duas formas de uma propaganda chegar ao totem

Este documento descreve as **duas formas** pelas quais uma campanha (propaganda) pode ser elegível para exibição em um totem, a **função** de cada caminho e o **modelo E-R** das tabelas envolvidas.

---

## 1. Primeira forma: Contrato → Plano → Publicadores → Totens (e campanhas ligadas a publicadores/totens)

**Sim, é isso mesmo.** O fluxo é:

1. **Assinante (subscriber)** tem um **contrato** (`subscriber_contracts`) com **plano** (`plans`) associado (`subscriber_contracts.plan_id`).
2. O **plano** define **quais publicadores** o assinante pode usar: tabela **`plan_publisher_access`** (`plan_id`, `publisher_id`, `is_allowed`, `is_active`).
3. A concessão efetiva **Subscriber → Publisher** fica em **`subscriber_publisher_access`** (e na view **`subscriber_publisher_access_active`**), ligando assinante, publisher, contrato e plano, com datas e status.
4. **Publicadores** têm **locais** (`locals.publisher_id`) e cada local tem **totens** e **Smart TVs** (`totems.local_id`, `smart_tvs`).
5. O assinante cria **mídias**, **playlists** e **campanhas** (`campaigns.subscriber_id`). A campanha pode ter **`contract_id`** apontando para `subscriber_contracts`.
6. A campanha é direcionada a **publicadores** e/ou **totens**:
   - **`campaign_publishers`**: campanha ↔ publisher (time share, revenue share, etc.).
   - **`campaign_totems`**: campanha ↔ totem (agendamento por totem).

**Resumo do caminho:**  
Subscriber → Contrato (plan_id) → Plano → plan_publisher_access → Publishers → Locals → Totens; campanhas ligadas a esses publishers/totens (e com contrato ativo) ficam elegíveis para o totem.

---

## 2. Segunda forma: Vínculo direto Campanha ↔ Totem (sem depender do plano na hora de decidir “onde”)

A **segunda forma** é o vínculo **direto** da campanha ao totem:

- **`campaign_totems`**: associa **campanha** a **totem** específico, com agendamento (start_date, end_date, start_time, end_time, days_of_week), prioridade e `is_active`.

Nesse caso, a campanha pode chegar ao totem **por ter sido colocada diretamente naquele totem** (e o assinante ainda precisa ter acesso ao publisher do totem via contrato/plano para a regra de negócio fazer sentido; no código do dispatcher, a perna “direct” usa `campaign_totems` e também exige que o contrato esteja ativo e o plano permita o publisher, via `subscriber_contracts` + `plan_publisher_access`).

Ou seja:

- **Forma 1:** elegibilidade “por grupo”: contrato do assinante com plano que inclui os publicadores (e seus totens); campanha ligada a **publishers** (`campaign_publishers`) e/ou ao **contrato**; o totem entra porque pertence a um local desse publisher.
- **Forma 2:** elegibilidade “por totem”: campanha ligada **diretamente ao totem** em **`campaign_totems`** (mantendo a exigência de contrato ativo e plano com acesso ao publisher).

No **dispatcher** isso aparece nas pernas da CTE “Campanhas elegíveis”:
- **direct:** campanhas via `campaign_totems` (segunda forma).
- **publisher / contract_plan:** campanhas via `campaign_publishers` + contrato + `plan_publisher_access` (primeira forma).

---

## 3. Função de cada peça

| Peça | Função |
|------|--------|
| **subscribers** | Anunciantes (donos das campanhas, mídias e playlists). |
| **publishers** | Donos dos locais, totens e Smart TVs. |
| **subscriber_contracts** | Contrato do assinante; tem `plan_id`; define vigência e status. |
| **plans** | Define limites e features; não guarda “quem” tem acesso — isso está em plan_publisher_access e subscriber_publisher_access. |
| **plan_publisher_access** | Define **quais publishers** um plano pode usar (`plan_id`, `publisher_id`, `is_allowed`, `is_active`). |
| **subscriber_publisher_access** | Registra **concessão** Subscriber → Publisher (contrato, plano, datas, revogação). View **subscriber_publisher_access_active** filtra apenas acessos ativos e válidos. |
| **campaigns** | Campanha do assinante; `subscriber_id` obrigatório; `contract_id` opcional (recomendado para execução no totem). |
| **campaign_publishers** | “Esta campanha pode rodar nos totens **desse(s) publisher(s)**” + time share, revenue share, etc. (forma 1 – por grupo). |
| **campaign_totems** | “Esta campanha pode rodar **neste(s) totem(ns)**” + agendamento por totem (forma 2 – direta). |
| **locals** | Pertencem ao publisher; agrupam totens/Smart TVs. |
| **totems** | Pertencem a um local (`local_id`); são os pontos de exibição. |
| **campaign_playlists** | Campanha usa quais playlists (e prioridade). |
| **playlists** / **playlist_items** | Playlist do assinante e itens (mídias). |
| **medias** | Arquivos de mídia do assinante. |

---

## 4. Modelo E-R (tabelas relacionadas ao tema)

Relações principais (nomes das tabelas; FKs implícitas pelo nome):

```
subscribers
  └── subscriber_contracts (subscriber_id, plan_id)
        └── plans (plan_id)
  └── campaigns (subscriber_id, contract_id → subscriber_contracts.contract_id)
  └── medias (subscriber_id)
  └── playlists (subscriber_id)
  └── subscriber_publisher_access (subscriber_id, publisher_id, contract_id, plan_id)
        └── subscriber_publisher_access_active (view sobre subscriber_publisher_access)

plans
  └── plan_publisher_access (plan_id, publisher_id)

publishers
  └── locals (publisher_id)
        └── totems (local_id)
  └── campaign_publishers (publisher_id, campaign_id)
  └── subscriber_publisher_access (publisher_id)

campaigns
  └── campaign_playlists (campaign_id, playlist_id)
  └── campaign_publishers (campaign_id, publisher_id)   ← forma 1 (por grupo)
  └── campaign_totems (campaign_id, totem_id)            ← forma 2 (direta)
  └── campaign_medias (campaign_id, media_id)
  └── campaign_locals (campaign_id, local_id)

playlists
  └── campaign_playlists (playlist_id)
  └── playlist_items (playlist_id, media_id)

totems
  └── campaign_totems (totem_id)
  └── locals (local_id) → publishers
```

**Fluxo forma 1 (contrato/plano/publicadores):**  
`subscribers` → `subscriber_contracts` (plan_id) → `plans` → `plan_publisher_access` (publisher_id) → `publishers` → `locals` → `totems`.  
Campanhas ligadas a esses publishers via **`campaign_publishers`** (e com contrato ativo) são elegíveis para os totens desses locals.

**Fluxo forma 2 (direto ao totem):**  
`campaigns` → **`campaign_totems`** (totem_id) → `totems`.  
A campanha está explicitamente associada àquele totem; o dispatcher ainda considera contrato ativo e plano com acesso ao publisher do totem.

---

## 5. Onde isso aparece no código

- **Dispatcher (campanhas elegíveis):** `dispatcherTotemService.getCandidateSchedules` usa uma CTE com várias pernas (UNION): uma para **campaign_totems** (direct), outras para **campaign_publishers** + **subscriber_contracts** + **plan_publisher_access** (publisher / contract_plan). Assim, as duas formas estão refletidas na lista de candidatos que alimenta a tela “Gerenciar Dispatcher” e o plano enviado ao player.
- **Mix (playlist do player):** Hoje o serviço de Mix usa apenas campanhas que têm **campaign_totems** para o totem (`getMixedCampaignsForTotem` → `getMixedCampaigns` com INNER JOIN em `campaign_totems`). Por isso campanhas elegíveis **só pela forma 1** (sem linha em `campaign_totems`) não entram no mix e podem resultar em `mediaItems: []` no player — conforme a análise em `docs/analise-dispatcher-midias-vazias-e-duplicados.md`.

Resumindo: **existem duas formas** — (1) contrato/plano que inclui os publicadores e seus totens, com campanhas ligadas a publicadores (e totens); (2) campanha ligada diretamente ao totem em `campaign_totems`. A função de cada tabela e o E-R acima descrevem o modelo e as relações usadas nesses fluxos.

**Nota:** A forma 2 está **ativa** por padrão: a aba **Totens** restringe a campanha a totens específicos entre os dos publicadores (aba Publicadores). O destino final é a lista de totens oriundos da aba Publicadores, opcionalmente restrita pela aba Totens. Para desativar a forma 2: `DISABLE_DIRECT_CAMPAIGN_TOTEM=true` no `.env`. Ver `docs/forma-2-desabilitada-onde-influencia.md` e `docs/cadastro-atrelar-campanha-totem.md`.
