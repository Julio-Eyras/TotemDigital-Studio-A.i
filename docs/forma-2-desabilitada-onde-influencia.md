# Forma 2 (vínculo Campanha ↔ Totem) – comportamento e onde influencia

A **forma 2** (elegibilidade via `campaign_totems` / aba **Totens**) está **ativa** por padrão. Ela permite restringir a campanha a totens específicos entre os dos publicadores selecionados na aba Publicadores.

Controle: `DISABLE_DIRECT_CAMPAIGN_TOTEM` em `backend/src/config/featureFlags.ts`.  
- **Padrão:** `false` (forma 2 ativa).  
- Para **desabilitar** a forma 2: `DISABLE_DIRECT_CAMPAIGN_TOTEM=true` no `.env`.

---

## Destino final da campanha (forma 2 ativa)

- **Aba Publicadores:** define a base (publicadores onde a campanha pode ser exibida). Totens base = todos os totens dos locais desses publicadores.
- **Aba Totens:** restringe a **totens específicos** entre os dos publicadores já escolhidos. Se vazia, a campanha vale para todos os totens da base; se houver totens marcados, vale só para esses.
- O dispatcher e o mix consideram como **destino final** essa lista de totens (base dos Publicadores, opcionalmente restrita pela aba Totens).

---

## Deduplicação

Para evitar duplicidade na tela “Campanhas elegíveis” (mesma campanha aparecer por “direct” e por “publisher”), o backend **deduplica** os candidatos por `(campaignId, playlistId)` em `getCandidateSchedules`. Em caso de duplicata, é mantido o candidato da perna **direct** (totem explícito na aba Totens).

---

## Onde a forma 2 influencia (quando ativa)

| Área | Comportamento |
|------|----------------|
| **Dispatcher – candidatos** | Considera a perna “direct” (`campaign_totems`): campanhas que tenham aquele totem marcado na aba Totens entram nos candidatos. Deduplicação por (campaignId, playlistId) evita linhas duplicadas. |
| **Mix (playlist do player)** | Quando há `totemId`, usa `campaign_totems` para o totem (campanhas que incluam esse totem na aba Totens, além de estarem nos publicadores). |
| **Validação “campanha ativa no totem”** | Usa `campaign_totems` quando a forma 2 está ativa. |
| **Player – fallback de playlist** | O bloco que busca “playlist ativa via campanha” (query com `campaign_totems`) é executado quando a forma 2 está ativa. |

Quando a forma 2 está **desabilitada** (`DISABLE_DIRECT_CAMPAIGN_TOTEM=true`), o dispatcher e o mix ignoram `campaign_totems` e consideram apenas contrato/plano + `campaign_publishers` (todos os totens dos publicadores).
