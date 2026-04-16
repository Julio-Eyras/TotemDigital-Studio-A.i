# Modelo ER — Mídias, campanhas, totens e Smart TVs

Documento de referência para o **modelo de dados** e os **fluxos** usados para gerir mídias em **totens** e **Smart TVs** no SmartSignage Pro.  
Alinha-se ao **schema definitivo** em `database/smartchannel-db-v2-refactored-part*.sql` e à **carga de demonstração v6** em `database/carga-inicial-v6.sql` (validação: `database/validate-v6.js`).

**Diagrama visual de todo o sistema (PNG):** [`diagrams/SmartSignage-ER-sistema-completo.png`](./diagrams/SmartSignage-ER-sistema-completo.png) — lista completa de tabelas por ficheiro `part*.sql`; ver também [`diagrams/SmartSignage-ER-sistema-completo-detalhe.png`](./diagrams/SmartSignage-ER-sistema-completo-detalhe.png).

> **Sobre o ZIP** `docs/ModeloERparaGerenciarMídiasEmTvsSmart.zip`: permanece no repositório como **anexo** (diagramas / export). A **fonte de verdade** para o modelo em evolução é o SQL em `database/` + este Markdown (o ZIP pode ficar desfasado entre releases).

---

## 1. Visão geral

| Conceito | Descrição |
|----------|-----------|
| **Subscriber** | Dono das mídias, playlists e campanhas (`subscribers`). |
| **Publisher** | Dono dos locais, totens e da infraestrutura física (`publishers`). |
| **Totem** | Ponto de exibição / dispositivo de campo (`totems` → `locals` → `publishers`). |
| **Smart TV** | Ecrã ligado a um totem (relação **1 totem : N TVs**, `smart_tvs.totem_id`). |
| **Mídia** | Ficheiro metadado em `medias` (sempre com `subscriber_id`). |
| **Campanha** | Agrega conteúdo e regras de exibição (`campaigns`). |
| **Playlist** | Lista ordenada de mídias (`playlists` + `playlist_items`). |

O **dispatcher** escolhe campanhas elegíveis para um `totemId` e gera um **plano de reprodução** (JSON) consumido pelos players (`GET /api/player/dispatch`, ver `backend/src/routes/player.ts`).

---

## 2. Tabelas centrais (resumo)

### 2.1 Conteúdo do assinante

- **`medias`**: ficheiros (vídeo/imagem/HTML…), `subscriber_id`, estado (`status`, `is_active`).
- **`playlists`**: conjuntos reutilizáveis, `subscriber_id`.
- **`playlist_items`**: ordem e duração por mídia dentro da playlist.

### 2.2 Campanha e ligações N:N

Definidas em `database/smartchannel-db-v2-refactored-part5-tables-relationships.sql`:

| Tabela | Função |
|--------|--------|
| **`campaigns`** | Campanha (`subscriber_id`, datas, `contract_id`, etc.). |
| **`campaign_playlists`** | Campanha ↔ playlist (prioridade, `metadata` JSONB). |
| **`campaign_medias`** | Campanha ↔ mídia **direta** (sem playlist), com `order_index`, `display_seconds`, `metadata`. |
| **`campaign_publishers`** | Campanha ↔ publisher (forma “por grupo” / contrato-plano). |
| **`campaign_totems`** | Campanha ↔ totem (restrição explícita de destino). |
| **`campaign_locals`** | Campanha ↔ local (quando aplicável). |

### 2.3 Infraestrutura do publisher

- **`locals`**: locais físicos do publisher.
- **`totems`**: dispositivos por `local_id`.
- **`smart_tvs`**: TVs associadas ao totem (`totem_id`), plataforma (`webOS`, `Tizen`, `Android TV`, …).

---

## 3. Diagrama ER (Mermaid)

> Sintaxe simplificada: cardinalidades indicativas. FKs completas estão no SQL das `part7` (foreign keys).

```mermaid
erDiagram
  subscribers ||--o{ medias : possui
  subscribers ||--o{ playlists : possui
  subscribers ||--o{ campaigns : possui
  subscribers ||--o{ subscriber_contracts : contratos

  campaigns ||--o{ campaign_playlists : usa
  campaigns ||--o{ campaign_medias : usa
  campaigns ||--o{ campaign_publishers : publica_em
  campaigns ||--o{ campaign_totems : restringe_totem

  playlists ||--o{ playlist_items : contem
  medias ||--o{ playlist_items : referenciada

  publishers ||--o{ locals : possui
  locals ||--o{ totems : possui
  totems ||--o{ smart_tvs : controla

  campaigns }o--|| subscribers : pertence
  medias }o--|| subscribers : pertence
  playlists }o--|| subscribers : pertence
```

---

## 4. Duas formas de a campanha chegar ao totem

Documento detalhado: [`duas-formas-propaganda-chegar-ao-totem.md`](./duas-formas-propaganda-chegar-ao-totem.md).

- **Forma 1**: contrato/plano → `plan_publisher_access` → publishers → locais → totens; campanha ligada em `campaign_publishers`.
- **Forma 2**: `campaign_totems` — restrição explícita a totens (aba Totens na UI).

---

## 5. Dispatch: playlist + mídias diretas da campanha

Na geração do plano para o player, o serviço **`DispatcherTotemService`** consolida:

1. Itens vindos de **`playlist_items`** (playlist da campanha vencedora).
2. Itens vindos de **`campaign_medias`** (mídias diretas da mesma campanha).

Regras gerais:

- Filtro de mídias ativas e aprovadas/publicadas (alinhado às queries do serviço).
- **Deduplicação** por `media_id` com ordem determinística (`order_index`, origem playlist vs campanha).
- Metadados do plano podem incluir contagens `playlistItemsCount`, `campaignMediaCount`, `mergedItemsCount` (ver `backend/src/types/dispatcherTotem.types.ts`).

Isto garante que campanhas com **só mídias diretas** ou **playlist + extras** produzem lista coerente para o player.

---

## 6. Smart TV vs totem

- O **player liga-se ao totem** (identificador/UIN no fluxo de registro e dispatch).
- **`smart_tvs`** regista ecrãs sob o totem (inventário, heartbeat, capacidades).
- Agendamentos específicos por ecrã podem usar tabelas como **`totem_playlists`** com `smart_tv_id` quando o schema prevê segmentação por TV (ver comentários em `part5`).

---

## 7. Leituras relacionadas

| Documento | Tema |
|-----------|------|
| [`duas-formas-propaganda-chegar-ao-totem.md`](./duas-formas-propaganda-chegar-ao-totem.md) | Elegibilidade campanha ↔ totem |
| [`cadastro-atrelar-campanha-totem.md`](./cadastro-atrelar-campanha-totem.md) | UI: abas Publicadores / Totens |
| [`analise-dispatcher-midias-vazias-e-duplicados.md`](./analise-dispatcher-midias-vazias-e-duplicados.md) | Mix e listas vazias |
| [`INTEGRACAO_SCHEMA_PRINCIPAL.md`](./INTEGRACAO_SCHEMA_PRINCIPAL.md) | Política schema sem migrations paliativas |
| [`README_INSTALACAO_SERVIDOR.md`](./README_INSTALACAO_SERVIDOR.md) | Instalação |
| [`PORTAS_E_SERVICOS_EXCLUSIVOS.md`](./PORTAS_E_SERVICOS_EXCLUSIVOS.md) | Portas e serviços |

---

## 8. Evolução e validação (v6)

- **Seeds / dados demo:** `database/carga-inicial-v6.sql`
- **Validação pós-instalação:** `node database/validate-v6.js` (requer `pg`; pode usar `NODE_PATH` apontando para `backend/node_modules`)

Desenvolvimento: apenas árvore principal (`backend/`, `frontend/`, `database/`, `scripts/`); cópia paralela `ssp-clean` foi removida do repositório.

---

**Última revisão:** abril de 2026.
