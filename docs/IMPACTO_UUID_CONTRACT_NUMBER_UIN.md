# Impacto da conversão para UUID (gen_random_uuid())

Este documento lista **todas as tabelas, campos e índices** afetados se converter para UUID (tipo `UUID` com `DEFAULT gen_random_uuid()`) os seguintes tipos de campo:

1. **Número de contrato** (`contract_number`)
2. **UIN** (Unique Identifier Number)
3. **Identifier** (identificador único de totem/Smart TV)
4. *(Opcional)* **IDs primários** (ex.: `contract_id`, `totem_id`) — impacto muito maior; listado em seção à parte.

---

## Parte 1: Conversão apenas de contract_number, UIN e identifier

Ou seja: manter PKs e FKs como `SERIAL`/`INTEGER`; apenas os campos de “identificador de negócio” passam a ser `UUID`.

### 1.1 Tabelas e campos afetados

| Tabela | Campo | Tipo atual | Alteração |
|--------|--------|------------|-----------|
| **subscriber_contracts** | contract_number | TEXT NOT NULL | → UUID, DEFAULT gen_random_uuid() |
| **publisher_contracts** | contract_number | TEXT NOT NULL | → UUID, DEFAULT gen_random_uuid() |
| **totems** | identifier | TEXT UNIQUE NOT NULL | → UUID UNIQUE NOT NULL, DEFAULT gen_random_uuid() |
| **totems** | uin | TEXT UNIQUE | → UUID UNIQUE, DEFAULT gen_random_uuid() |
| **smart_tvs** | identifier | TEXT UNIQUE NOT NULL | → UUID UNIQUE NOT NULL, DEFAULT gen_random_uuid() |
| **device_tokens** | uin | TEXT | → UUID, DEFAULT gen_random_uuid() (opcional) |

**Observações:**

- Em **totems** e **smart_tvs**, `device_id` continua TEXT (pode ser legado do fabricante); só `identifier` e, no totem, `uin` seriam UUID.
- Em **device_tokens**, `uin` é opcional; se converter, manter compatibilidade com o valor que o player envia (UIN hoje é string; após migração seria UUID string).

---

### 1.2 Índices afetados

Índices que usam esses campos precisam ser recriados (ou o tipo da coluna já define o índice único).

| Índice | Tabela | Colunas | Ficheiro schema |
|--------|--------|---------|------------------|
| **Constraint UNIQUE** (identifier) | totems | (identifier) | part3 |
| **Constraint UNIQUE** (uin) | totems | (uin) | part3 |
| **idx_totems_identifier** | totems | (identifier) | part8 |
| **Constraint UNIQUE** (identifier) | smart_tvs | (identifier) | part3 |
| **idx_smart_tvs_identifier** | smart_tvs | (identifier) | part8 |
| **idx_subscriber_contracts_subscriber_contract_number** | subscriber_contracts | (subscriber_id, contract_number) | part4 |
| **idx_publisher_contracts_publisher_contract_number** | publisher_contracts | (publisher_id, contract_number) | part4 |

**Constraints únicas implícitas:**

- `totems.identifier` e `totems.uin` têm UNIQUE na definição da coluna (part3).
- `smart_tvs.identifier` tem UNIQUE na definição da coluna (part3).

Ao alterar o tipo para UUID, as constraints UNIQUE continuam válidas; os índices explícitos em part8 (idx_totems_identifier, idx_smart_tvs_identifier) passam a indexar UUID.

**Remoções prévias (já no schema):**

- `subscriber_contracts_contract_number_key` e `publisher_contracts_contract_number_key` já são removidos em part4 (unicidade é por par subscriber_id/publisher_id + contract_number).

---

### 1.3 Foreign keys

Nenhuma FK referencia **contract_number**, **uin** ou **identifier**. As FKs usam apenas:

- subscriber_id, publisher_id, contract_id, totem_id, smart_tv_id, etc. (inteiros).

Portanto, na conversão **só** de contract_number, UIN e identifier, **nenhuma FK é alterada**.

---

### 1.4 Outros ficheiros que referenciam esses campos

- **database/carga-inicial-v6.sql** – INSERTs em subscriber_contracts e publisher_contracts com `contract_number` (valores literais); terão de passar a usar gen_random_uuid() ou valores UUID.
- **database/smartchannel-db-v2-refactored-part10-views.sql** – Views que usam `t.identifier`, `sc.contract_number`; continuam a funcionar após alteração de tipo para UUID.
- **database/validate-seeds.sql**, **sanity-checklist.sql** – SELECTs a `identifier`; compatíveis com UUID.
- **database/validate-plano-basico-limits.sql** – SELECT a `sc.contract_number`; compatível com UUID.
- **Backend / frontend** – Qualquer código que formate, valide ou mostre contract_number, UIN ou identifier (por exemplo geração de “número de contrato” legível) terá de ser ajustado para UUID (ou manter um alias legível noutro campo).

---

## Parte 2: Se converter também PKs (contract_id, totem_id, etc.) para UUID

Se além de contract_number/UIN/identifier forem convertidos **IDs primários** para UUID (ex.: contract_id, totem_id), todas as colunas que referenciam essas PKs (FKs) e os índices que as usam ficam afetados. Abaixo está o impacto por entidade.

### 2.1 Tabelas cujas PKs poderiam passar a UUID (exemplos)

| Tabela | PK atual | Tipo atual |
|--------|----------|------------|
| subscriber_contracts | contract_id | SERIAL (INTEGER) |
| publisher_contracts | contract_id | SERIAL (INTEGER) |
| totems | totem_id | SERIAL (INTEGER) |
| smart_tvs | smart_tv_id | SERIAL (INTEGER) |

(Outras tabelas com SERIAL podem ser convertidas da mesma forma; a lista abaixo foca contract_id e totem_id por serem os que citou.)

### 2.2 Colunas (FKs) que referenciam contract_id (subscriber_contracts ou publisher_contracts)

Todas passariam de INTEGER para UUID:

| Tabela | Coluna FK | Referência |
|--------|-----------|------------|
| locals | created_via_contract_id | subscriber_contracts(contract_id) |
| totems | created_via_contract_id | subscriber_contracts(contract_id) |
| smart_tvs | created_via_contract_id | subscriber_contracts(contract_id) |
| campaigns | contract_id | subscriber_contracts(contract_id) |
| subscriber_publisher_access | contract_id | subscriber_contracts(contract_id) |

(Não há FK para publisher_contracts.contract_id no schema atual; apenas subscriber_contracts.contract_id é referenciado.)

### 2.3 Colunas (FKs) que referenciam totem_id

Todas passariam de INTEGER para UUID:

| Tabela | Coluna FK | Referência |
|--------|-----------|------------|
| smart_tvs | totem_id | totems(totem_id) |
| campaign_totems | totem_id | totems(totem_id) |
| publisher_billing | totem_id | totems(totem_id) |
| totem_playlists | totem_id | totems(totem_id) |
| totem_playlist_generation_log | totem_id | totems(totem_id) |
| execution_logs | totem_id | totems(totem_id) |
| analytics_sessions | totem_id | totems(totem_id) |
| analytics_emotions | totem_id | totems(totem_id) |
| analytics_gestures | totem_id | totems(totem_id) |
| event_logs | totem_id | totems(totem_id) |
| dispatcher_log | totem_id | totems(totem_id) |
| dispatcher_decisions | totem_id | totems(totem_id) |
| dispatcher_events | totem_id | totems(totem_id) (via decision → totem) |
| totem_playlist_items | (nenhuma; não referencia totem diretamente) | — |
| totem_ml_config | totem_id | totems(totem_id) |
| emotion_data | totem_id | totems(totem_id) |
| gesture_data | totem_id | totems(totem_id) |
| behavior_data | totem_id | totems(totem_id) |
| recognized_persons | totem_id | totems(totem_id) |
| interaction_logs | totem_id | totems(totem_id) |
| remote_commands | totem_id | totems(totem_id) |
| totem_update_status | totem_id | totems(totem_id) |
| fx_totem_sites | totem_id | totems(totem_id) |
| device_tokens | totem_id | totems(totem_id) |

### 2.4 Índices que usam contract_id ou totem_id

Todos os índices que incluem essas colunas passam a indexar UUID (e devem ser recriados após ALTER do tipo):

- **contract_id:**  
  idx_locals_contract, idx_totems_contract, idx_smart_tvs_contract, idx_campaigns_contract_id, idx_subscriber_publisher_access_contract (e FKs correspondentes em part7).
- **totem_id:**  
  idx_totems_local, idx_smart_tvs_totem, idx_campaign_totems_totem, idx_publisher_billing_totem, idx_totem_playlists_totem, idx_totem_playlist_gen_log_totem, idx_execution_logs_totem_time, idx_analytics_sessions_totem, idx_analytics_emotions_totem_time, idx_analytics_gestures_totem_time, idx_event_logs_totem_time, idx_dispatcher_log_totem_timestamp, idx_dispatcher_decisions_totem, idx_dispatcher_events_totem (e demais índices em part8 que referenciem totem_id), além de todas as FKs em part7 que referenciam totems(totem_id).

(Os nomes exatos estão em part7 e part8; esta lista é o conjunto de “todos os índices/constraints que usam contract_id ou totem_id”.)

---

## Resumo

- **Só contract_number + UIN + identifier:**  
  - **Tabelas/campos:** subscriber_contracts.contract_number, publisher_contracts.contract_number, totems.identifier, totems.uin, smart_tvs.identifier, (opcional) device_tokens.uin.  
  - **Índices:** os listados em 1.2; nenhuma FK alterada.  
  - **Seeds/views:** ajustar INSERTs e qualquer lógica que formate ou valide esses valores.

- **Incluindo PKs (contract_id, totem_id) como UUID:**  
  - **Tabelas/campos:** além dos acima, todas as PKs convertidas e **todas as colunas FK** que referenciam contract_id (subscriber_contracts) e totem_id (totems), como em 2.2 e 2.3.  
  - **Índices:** todos os que usam contract_id ou totem_id (part7 + part8), como em 2.4.

Recomendação: fazer primeiro a conversão apenas de **contract_number**, **UIN** e **identifier** (Parte 1); depois, se desejar, planejar a migração de PKs para UUID (Parte 2) com migração de dados e atualização do backend/frontend.
