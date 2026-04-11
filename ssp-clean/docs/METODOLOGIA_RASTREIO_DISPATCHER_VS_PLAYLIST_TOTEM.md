# Metodologia: Rastrear por que a campanha aparece em "Playlist - Totem #10" mas não no Dispatcher

## Objetivo

Entender **passo a passo** o que acontece com:
- **Campanhas** (ex.: "campanha pao qentinho" – subscriber 12)
- **Playlists** (ex.: "paoquentinho")
- **Totens** (ex.: Totem #10 / td-academia)
- **Publishers** (o publisher ao qual o Totem #10 pertence)

Para visualizar **o que está impedindo** a campanha do assinante de aparecer como candidato no dispatcher, mesmo quando a "Playlist - Totem #10" já mostra os itens corretos.

---

## 1. Por que existem dois resultados diferentes?

### Fluxo A: "Playlists por Totem" → Playlist - Totem #10 (com itens)

- **O que você vê:** Modal "Playlist - Totem #10" com 2 itens (Mídia 17, Campanha 12, Subscriber 12).
- **Origem dos dados:** Tabelas **`totem_playlists`** e **`totem_playlist_items`**.
- **Quem escreve nessas tabelas:** O **motor de playlist** (ex.: PlaylistEngine ou serviço que gera playlist por totem), quando alguém clica em **Atualizar** na tela "Playlists de Totem" ou quando uma rotina regenera a playlist.
- **Lógica desse motor:** Ele usa as suas próprias regras para decidir quais campanhas/playlists/mídias entram (ex.: subscribers com acesso ao publisher do totem, campanhas ativas, etc.). O resultado é **gravado** em `totem_playlists` e `totem_playlist_items`.

Ou seja: **aqui os itens estão corretos porque você está vendo o resultado de uma geração anterior**, que foi salva nessas tabelas.

### Fluxo B: Player → Dispatcher → Candidatos (sem campanha → plano vazio ou fallback)

- **O que você vê:** No dispatcher (ou no player em debug), a campanha **não** aparece como candidato, ou o plano vem vazio (a menos que o fallback use `totem_playlists`).
- **Origem dos dados:** O **Dispatcher** calcula em **tempo real** os "candidatos" para o totem.
- **Lógica do dispatcher (resumida):**
  1. Busca campanhas que estejam ligadas **diretamente** ao totem em **`campaign_totems`** (e o subscriber tem acesso ao publisher do totem), **ou**
  2. Campanhas ligadas ao **publisher** do totem em **`campaign_publishers`** (e o subscriber tem acesso a esse publisher via `subscriber_publisher_access_active` ou fallback contrato/plano).
  3. Só essas campanhas viram "candidatos". Se **nenhuma** campanha atender a (1) ou (2), o dispatcher não tem candidatos.
  4. Se implementou fallback: com 0 candidatos, o dispatcher tenta montar o plano a partir de **`totem_playlists`** (o mesmo que a tela "Playlist - Totem #10"). Aí o player pode receber os mesmos itens.

Conclusão: **"Playlist - Totem #10" mostra itens corretos** porque lê o que **já foi gerado e salvo**. O **dispatcher** depende de **campaign_totems** / **campaign_publishers** para *mostrar* a campanha como candidato; se a campanha não estiver vinculada aí, ela não aparece na lista de candidatos do dispatcher (mesmo que já esteja na playlist consolidada do totem).

---

## 2. O que pode estar a impedir a campanha no Dispatcher?

Para a **"campanha pao qentinho"** (subscriber 12) aparecer como **candidato** do dispatcher para o **Totem #10**, é necessário que **pelo menos uma** das condições seja verdadeira:

| Condição | Onde verificar | O que significa |
|----------|----------------|------------------|
| **C1** | Tabela **`campaign_totems`** | Existe uma linha com `campaign_id` = ID da "campanha pao qentinho" e `totem_id` = 10. Ou seja: a campanha está **vinculada diretamente ao Totem #10**. |
| **C2** | Tabela **`campaign_publishers`** | Existe uma linha com `campaign_id` = ID da campanha e `publisher_id` = **ID do publisher ao qual o Totem #10 pertence** (Totem → Local → Publisher). Ou seja: a campanha está vinculada ao **publisher** desse totem. |
| **C3** | Acesso do subscriber ao publisher | O subscriber 12 tem acesso a esse publisher: em **`subscriber_publisher_access_active`** (ou no fallback contrato/plano: contrato ativo com plano que tem esse publisher em **`plan_publisher_access`**). |

Se **C1** ou **C2** falhar (campanha não vinculada ao totem nem ao publisher), a campanha **nunca** entra na lista de candidatos do dispatcher, mesmo que o motor de playlist a tenha incluído em `totem_playlists`.  
Se **C3** falhar (subscriber sem acesso ao publisher), o dispatcher também não considera essa campanha como candidato.

---

## 3. Metodologia de rastreio (sem alterar comportamento)

Objetivo: **registrar e visualizar** em cada etapa o que está a acontecer, sem mudar a lógica de negócio.

### 3.1 Dados a recolher (uma vez por cenário)

Para o **Totem #10** e a **campanha do assinante (ex.: "campanha pao qentinho")**:

1. **Totem e publisher**
   - `totem_id` = 10, `uin` = td-academia.
   - Qual o `local_id` do totem 10?
   - Qual o `publisher_id` desse local? → este é o **publisher do Totem #10**.

2. **Campanha**
   - `campaign_id` da "campanha pao qentinho".
   - `subscriber_id` da campanha (ex.: 12).

3. **Vínculos da campanha**
   - Existe linha em **`campaign_totems`** com `campaign_id` = X e `totem_id` = 10? (Sim/Não.)
   - Existe linha em **`campaign_publishers`** com `campaign_id` = X e `publisher_id` = (publisher do totem 10)? (Sim/Não.)

4. **Acesso do subscriber ao publisher**
   - Existe linha em **`subscriber_publisher_access_active`** com `subscriber_id` = 12 e `publisher_id` = (publisher do totem 10)? (Sim/Não.)
   - Se não: o subscriber 12 tem contrato ativo com plano que tem esse publisher em **`plan_publisher_access`**? (fallback.)

5. **Playlist consolidada (para comparar)**
   - Na tabela **`totem_playlists`**: existe linha para `totem_id` = 10, ativa? Quantos itens (`total_items`)?
   - Na tabela **`totem_playlist_items`**: quais `campaign_id` e `subscriber_id` aparecem para esse `totem_playlist_id`?

Com isso você vê **exatamente** onde a corrente se parte: falta vínculo em `campaign_totems`/`campaign_publishers` ou falta acesso em `subscriber_publisher_access_active`/plano.

### 3.2 Onde “logar” / inspecionar (proposta)

- **Diagnóstico já existente**  
  - Endpoint **`GET /api/dispatcher-totem/10/diagnostics`** já devolve contagens e sugestões (ex.: `directWithAccess`, `groupWithAccess`, `suggestion`).  
  - Use-o como **primeira ferramenta** de rastreio: ele indica se há candidatos por totem direto ou por publisher e se o problema é acesso.

- **Logs adicionais (proposta – só após sua confirmação)**  
  - **No dispatcher**, quando calcular candidatos para um totem:
    - Logar: `totemId`, `publisherId` do totem, número de campanhas em `campaign_totems` para este totem (antes do filtro de acesso), número em `campaign_publishers` para este publisher (antes do filtro de acesso), e depois os totais **com** acesso (`directWithAccess`, `groupWithAccess`).
    - Opcional: para cada campanha considerada (ex.: campaign_id, subscriber_id), logar se veio de `campaign_totems` ou `campaign_publishers` e se passou no filtro de acesso.
  - **Na geração da playlist por totem** (quando "Playlist - Totem #10" é gerada):
    - Logar: totem_id, publisher_id, quais campaign_id e subscriber_id foram incluídos e por qual regra (ex.: “incluída por plan_publisher_access”).

Assim você consegue **comparar**:
- o que o **motor de playlist** usou para preencher "Playlist - Totem #10",
- e o que o **dispatcher** usou para decidir candidatos (e por que a campanha do assinante não aparece).

### 3.3 Ordem sugerida de análise

1. Chamar **`/api/dispatcher-totem/10/diagnostics`** e anotar:
   - `totem.publisherId`
   - `counts.dispatcherQuery.directWithAccess` e `groupWithAccess`
   - `suggestion`
2. No banco (ou via um script/query que eu possa propor depois):
   - Confirmar se existe vínculo da campanha ao Totem #10 ou ao publisher do totem (`campaign_totems` / `campaign_publishers`).
   - Confirmar se o subscriber 12 tem acesso a esse publisher (`subscriber_publisher_access_active` ou contrato + `plan_publisher_access`).
3. Comparar com os itens em **`totem_playlist_items`** para o Totem #10: quais campanhas/subscribers o motor de playlist incluiu.
4. Só depois decidir se quer ativar os **logs adicionais** no dispatcher e no gerador de playlist (conforme acima) para rastrear cada execução.

---

## 4. Resumo visual (o que está a impedir)

```
[Campanha "campanha pao qentinho" (subscriber 12)]
         |
         |  Está vinculada ao Totem #10?
         |  → campaign_totems (campaign_id, totem_id=10)
         |
         |  OU está vinculada ao publisher do Totem #10?
         |  → campaign_publishers (campaign_id, publisher_id do totem)
         |
         v
    [Não vinculada]  →  Dispatcher não considera →  "Candidatos" vazios
         |
         v
    [Vinculada]  →  Subscriber 12 tem acesso a esse publisher?
                    (subscriber_publisher_access_active ou contrato+plano)
         |
         v
    [Sem acesso]  →  Dispatcher não considera
    [Com acesso]  →  Campanha vira CANDIDATO e pode aparecer no dispatcher
```

A "Playlist - Totem #10" ter itens corretos significa que o **motor de playlist** incluiu essa campanha ao gerar `totem_playlists`. O dispatcher **não** usa essa decisão para montar a lista de candidatos; ele usa só **campaign_totems** + **campaign_publishers** + acesso. Por isso a metodologia foca em: **vínculos** (campaign_totems / campaign_publishers) e **acesso** (subscriber ↔ publisher).

---

## 5. Próximo passo (aguardando sua confirmação)

- **Não** será alterado nenhum comportamento de negócio neste documento.
- Quando você confirmar, posso:
  1. Propor **queries SQL** concretas para você rodar (totem 10, campaign_id da "campanha pao qentinho", subscriber 12) e colar os resultados para interpretarmos juntos; e/ou
  2. Propor **exatamente** onde e que mensagens de log adicionar no código (dispatcher + gerador de playlist) para você visualizar o que está a impedir a campanha no dispatcher.

Assim você consegue visualizar e rastrear tudo entre campanhas, playlists, totens e publishers sem mudar o comportamento até decidir o que corrigir.
