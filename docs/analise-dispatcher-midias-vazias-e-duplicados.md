# Análise: Player com lista de mídias vazia e duplicados na tela Dispatcher

**Data:** 2026-03-12  
**Escopo:** Apenas detecção e análise; sugestões para você escolher (sem alterar código).

---

## 1. Problema 1: Players recebendo `mediaItems: []`

### Sintoma

- No debug do player: `DispatchPlan` com `"mediaItems": []`, `"playlistName": "Mix 108"`, `"source": "mix"`, `"sourceId": 108`.
- Na UI: "Gerenciar Dispatcher" mostra campanhas elegíveis; "Playlist - Totem #1" mostra 1 mídia (ex.: Mídia ID 2, 45s).

### Causa raiz identificada

O plano do player é montado quando a estratégia do dispatcher é **`mix`**:

1. **Dispatcher** chama `mixService.generateMixForTotem(totemId)` e depois `convertMixToDispatchPlan(mix, ...)`.
2. **`convertMixToDispatchPlan`** (em `dispatcherTotemService.ts`) monta `mediaItems` **somente** a partir de `mix.mix_items`. Se `mix.mix_items` for `[]`, o plano sai com `mediaItems: []`.
3. O `mix` com `mix_items` vazio vem do **serviço de Mix** (`totemPlaylistMixService.generateMixForTotem`), que:
   - pode devolver um mix **em cache** (`totem_mix:${totemId}:current`), ou
   - gera um mix novo usando **`getMixedCampaignsForTotem(publisher_id, totemId)`**.

**Diferença crítica entre “Campanhas Elegíveis” e o Mix:**

| Origem | Onde está | Regra de elegibilidade |
|--------|-----------|-------------------------|
| **Campanhas Elegíveis** (tela Dispatcher) | `dispatcherTotemService.getCandidateSchedules` | CTE com **4 pernas**: (1) `campaign_totems` (direto), (2) `campaign_publishers` + totem do local, (3) fallback por contrato, (4) contrato/plano. Ou seja, campanha pode aparecer **sem** estar em `campaign_totems`. |
| **Mix (geração do plano do player)** | `publisherCampaignMixService.getMixedCampaignsForTotem` → `getMixedCampaigns` | **Exige** `INNER JOIN campaign_totems` com `ct.totem_id = $totemId` e `ct.is_active = true`. Ou seja, **só** campanhas com vínculo **direto** no totem via `campaign_totems`. |

Consequência: se a campanha “campanha1” estiver elegível apenas por **publisher/contrato/plano** (sem linha em `campaign_totems` para esse totem), então:

- A tela **Campanhas Elegíveis** mostra a campanha.
- O Mix **não** a vê → `getMixedCampaignsForTotem` retorna 0 campanhas → `mixedCampaigns` vazio → `allItems`/`finalItems` vazios → mix gravado com `mix_items: []` → cache/BD com mix vazio → `convertMixToDispatchPlan` → **`mediaItems: []`** no player.

Além disso, um mix **já em cache** (ou lido do BD como “current”) com `mix_items: []` também faz o player receber lista vazia, mesmo que depois existam campanhas elegíveis na tela.

---

## 2. Problema 2: Duplicados em “Campanhas Elegíveis”

### Sintoma

Na tabela “Campanhas Elegíveis” aparecem duas linhas idênticas (ex.: “campanha1”, mesma prioridade, tier, playlist, status).

### Causa raiz identificada

- **Backend:** `getCandidateSchedules` usa uma CTE com **4 UNIONs**. A mesma campanha pode ser devolvida em **várias pernas** (ex.: “direct” e “publisher”). O laço que monta os `candidates` faz **um candidato por linha** da CTE (por campanha + primeira playlist com `LIMIT 1`). Assim, a API pode devolver **vários candidatos com o mesmo `campaignId` e `playlistId`**.
- **Frontend:** Já existe deduplicação por chave `campaignId-playlistId` (Map em `DispatcherManager.tsx`). Se ainda aparecem duas linhas iguais, possíveis causas:
  - Tipos inconsistentes na resposta (ex.: um candidato com `playlistId` numérico e outro com `undefined` ou string), gerando chaves diferentes no Map.
  - Ou outro fluxo/estado alimentando a tabela sem passar por essa deduplicação.

---

## 3. Resumo da engenharia

- **Dispatcher (estratégia mix):**  
  `dispatcherTotemService.dispatch()` → `generateMixForTotem(totemId)` → `convertMixToDispatchPlan(mix)` → plano com `mediaItems` = `mix.mix_items` mapeados para mídias.
- **Mix:**  
  `totemPlaylistMixService.generateMixForTotem` usa cache ou gera novo; na geração usa **apenas** `getMixedCampaignsForTotem` (campanhas com `campaign_totems` para o totem). Não usa a mesma regra que `getCandidateSchedules`.
- **Candidatos da tela:**  
  `getCandidateSchedules` (4 UNIONs) → um candidato por linha da CTE (1 playlist por campanha) → possível repetição do mesmo (campaign_id, playlist_id).
- **Playlist Totem #1 (modal):**  
  Mostra playlist consolidada do totem (ex.: `totem_playlists` / itens do totem), que é um fluxo **diferente** do Mix usado pelo dispatcher para o plano do player. Por isso a UI pode mostrar 1 mídia enquanto o player recebe Mix 108 com `mediaItems: []`.

---

## 4. Sugestões (para você escolher)

### 4.1. Lista de mídias vazia no player

**Opção A – Alinhar Mix às regras do Dispatcher (recomendada)**  
- Fazer o serviço de Mix usar a **mesma** definição de “campanhas elegíveis para o totem” que o Dispatcher (ex.: reutilizar a lógica de `getCandidateSchedules` ou uma função compartilhada que considere as 4 pernas: direct, publisher, fallback, contract_plan), em vez de só `getMixedCampaignsForTotem` (que exige `campaign_totems`).  
- Assim, se a campanha aparece em “Campanhas Elegíveis”, ela pode entrar no mix e o player deixa de receber `mediaItems: []` nesses casos.

**Opção B – Não exigir `campaign_totems` no Mix**  
- Alterar `getMixedCampaigns` (em `publisherCampaignMixService`) para incluir campanhas ligadas ao totem via **publisher/local** (e, se desejado, contrato/plano), sem obrigar `campaign_totems` para aquele totem.  
- Equivalente a “replicar” no Mix as outras pernas do Dispatcher, mantendo um único critério de elegibilidade.

**Opção C – Cache e mix vazio**  
- Quando o mix gerado tiver `mix_items.length === 0`, **não** gravar em `totem_playlist_mix` como “current” e **não** colocar no cache (ou invalidar cache nesse caso).  
- Opcionalmente: se já existir mix “current” no BD com `mix_items` vazio, ao servir o plano considerar “sem mix” e cair em fallback no servidor (**playlist consolidada** `totem_playlists`; sem plano montado a partir de pastas locais no servidor).  
- Isso evita que o player fique preso a um mix vazio, mas **não** resolve sozinho o caso em que a geração sempre resulta em 0 itens por causa da regra restritiva do Mix (por isso A ou B são mais estruturais).

### 4.2. Duplicados em “Campanhas Elegíveis”

**Opção D – Deduplicar no backend**  
- Ao montar a lista de `candidates` em `getCandidateSchedules`, deduplicar por `(campaign_id, playlist_id)` (ex.: Map ou DISTINCT na agregação) antes de retornar.  
- A API passa a devolver no máximo um candidato por (campanha, playlist), e a UI fica consistente mesmo se o frontend tiver algum edge case.

**Opção E – Garantir tipos na API e revisar chave no front**  
- Garantir que a API sempre envia `campaignId` e `playlistId` como números (nunca `undefined`/string) nos candidatos.  
- Revisar no front se a chave de deduplicação usa exatamente os mesmos campos e tipos (ex.: `Number(campaignId)` e `Number(playlistId)` na chave do Map) para não criar chaves diferentes por tipo.

**Opção F – Deduplicar no backend + normalizar tipos (D + E)**  
- Aplicar D e E juntos para eliminar duplicados e evitar inconsistências de tipo.

---

## 5. Recomendações resumidas

- **Para `mediaItems: []`:**  
  Priorizar **Opção A** (ou B) para que o Mix use as mesmas campanhas que a tela “Campanhas Elegíveis”. Complementar com **Opção C** para não fixar mix vazio em cache/BD.

- **Para duplicados na tabela:**  
  Priorizar **Opção D** (deduplicar no backend por `campaign_id` + `playlist_id`). Se ainda restar alguma duplicata, aplicar **Opção E** (ou F).

Quando decidir quais opções aplicar, posso ajudar a detalhar os pontos exatos de código (arquivos e funções) para implementar cada uma, sem alterar nada até você escolher.
