## Modelo ER (v2) — Contratos, Acessos, Dispatcher e Playlist Mix

### Objetivo
- Documentar a lógica atual (modelo ER + views/funções) sob a regra **publisher ≠ subscriber**.
- Explicar como **contratos** e **acessos** habilitam execução de campanhas.
- Definir a interface SQL para um “dispatcher burro”: `v_dispatcher_resolved_playlist`.

### Entidades centrais (visão rápida)
- **Subscribers** (`subscribers`): anunciantes (compram mídia).
- **Publishers** (`publishers`): publicadores (instalam totens/smart TVs). No schema v2 mantém campos históricos (`is_subscriber/is_publisher/client_type`), mas com **CHECK** fixando: `client_type='publisher'`, `is_subscriber=false`, `is_publisher=true`.
- **Locals/Totems/Smart TVs** (`locals`, `totems`, `smart_tvs`): pertencem ao publisher via `locals.publisher_id` → `totems.local_id`.
- **Medias** (`medias`): pertencem ao subscriber.
- **Playlists** (`playlists`): pertencem ao subscriber; contém `playlist_items` (mídias).
- **Campaigns** (`campaigns`): pertencem ao subscriber; podem apontar para playlists (`campaign_playlists`) e/ou mídias diretas (`campaign_medias`); e são direcionadas por publisher (`campaign_publishers`) e por totem (`campaign_totems`).

### Contratos — separação por recurso (lógica atual)
O modelo possui **tabelas separadas por tipo de contrato** (não existe “contrato genérico”):
- **`subscriber_contracts`**: contrato do **Subscriber** (anunciante). Pode ter `plan_id` (plano do subscriber) e datas/status. Permite existir antes do subscriber usando `created_before_subscriber=true`.
- **`publisher_contracts`**: contrato do **Publisher** (publicador). Define `revenue_share_percentage` e pode ser híbrido (subscription + revenue share). Permite existir antes do publisher usando `created_before_publisher=true`.

### Planos e Acesso ao Publisher
Existe uma matriz **Plano → Publisher**:
- `plan_publisher_access(plan_id, publisher_id, is_allowed, restrictions)`

E a concessão efetiva de **Subscriber → Publisher** é registrada em:
- `subscriber_publisher_access(subscriber_id, publisher_id, contract_id, plan_id, access_type, granted_at, expires_at, is_active, ...)`

Ponto importante:
- `subscriber_publisher_access.contract_id` referencia **`subscriber_contracts.contract_id`** (contrato do anunciante), não `publisher_contracts`.
- O acesso ativo consolidado é exposto por:
  - `subscriber_publisher_access_active` (view)

### Dispatcher (SQL-first)
Para reduzir dependência de lógica “inteligente” no backend, foi criada a interface:
- **`v_dispatcher_resolved_playlist`**

Regra de resolução:
- **Primário**: se existir `totem_playlist_mix.is_current=true` → usa `mix_items`
- **Fallback**: se não existir mix atual → calcula **“single campaign winner”** no SQL e retorna itens via:
  - `campaign_playlists` + `playlist_items` (preferencial) ou
  - `campaign_medias` (se não houver playlist)
- **Último fallback (defensivo)**: se não houver mix e não houver winner → usa `totem_playlists` + `totem_playlist_items` (playlist gerada legacy)

### Playlist Mix (tabelas/funções)
O “mix engine” está no banco em:
- `playlist_mix_rules`
- `ai_context_data`
- `totem_playlist_mix`
- `playlist_mix_history`

E as funções utilitárias estão em:
- `get_mix_rule_for_totem(...)`
- `get_ai_context_for_totem(...)`
- `set_current_mix_for_totem(...)`
- `get_current_mix_for_totem(...)`

### Recomendações (v5 seed)
- Garantir datas **sempre 2025–2035** para testes de calendário.
- Incluir cenários:
  - `totem_id` com **mix current** (caminho “mix”)
  - `totem_id` sem mix mas com campanhas ativas (caminho “single winner”)
  - Conflitos intencionais (campanhas sobrepostas e regras por tempo/dias) para validar o dispatcher.

