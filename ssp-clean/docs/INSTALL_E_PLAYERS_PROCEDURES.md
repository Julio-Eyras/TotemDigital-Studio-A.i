# Install e Players — impacto das procedures atómicas (part17)

Este documento descreve como o **instalador** e os **players** (totem/client) ficam com as alterações de procedures atómicas (part17), `contract_number` (SUB-/PUB-) e endpoints de criação com contratos.

---

## 1. Install (`scripts/install-smartsignage.sh` e `database/`)

### O que o install faz hoje

1. **Schema:** Usa `database/apply-schema-v2.sh` (preferencial) ou `database/smartchannel-db-v2-refactored-apply-all.sql`.
2. **Seeds:** Se `--load-seeds`, executa `database/carga-inicial-v6.sql`.
3. **Sequências:** Executa `database/fix-sequences-after-seed.sql` após a carga.

### Compatibilidade com as alterações

| Item | Estado |
|------|--------|
| **part17 no apply-schema-v2.sh** | Incluído: a lista de scripts já tem part14, part15, part16 e **part17** (procedures atómicas). O install aplica part17 ao rodar `apply-schema-v2.sh`. |
| **part17 no apply-all.sql** | Incluído: o arquivo consolidado aplica part17 no passo [18/19]. Se o install usar o consolidado em fallback, part17 também é aplicado. |
| **carga-inicial-v6.sql** | Alinhada: usa `contract_number` no formato **SUB-{id}.000001** e **PUB-{id}.000001** (igual ao gerado pelas procedures). Nenhuma alteração extra no install. |
| **fix-sequences-after-seed.sql** | Inalterado: corrige apenas sequências de tabelas (SERIAL). Procedures não criam novas sequências; não é necessário referenciar part17. |

### Conclusão install

- Nenhuma mudança adicional é necessária no install.
- Nova instalação: schema (com part17) → seeds (carga v6 com SUB-/PUB-) → fix-sequences.
- Reinstalação (drop + schema + seeds): mesmo fluxo; procedures e dados ficam consistentes.

---

## 2. Players (player-web, player-client, player-fx)

### O que os players usam da API/banco

- **Autenticação:** `/api/player/register`, `/api/player/token` (UIN, totemSecret).
- **Conteúdo:** dispatcher/playlist (getDispatchPlan, playlist por totem).
- **Contrato:** apenas o campo booleano `contract_valid` na resposta (para fallback/comportamento); **não** leem nem interpretam `contract_number`.

### Impacto das alterações

| Alteração | Impacto nos players |
|-----------|----------------------|
| **Formato contract_number (SUB-x.000001, PUB-x.000001)** | Nenhum. Players não leem nem validam o formato de `contract_number`. |
| **Procedures create_publisher_with_resources / create_subscriber_with_contracts** | Nenhum. São usadas apenas pelo backend e pelo frontend admin (criação de publisher/subscriber). |
| **Novos payloads POST /api/publishers e POST /api/subscribers** | Nenhum. Players não criam publishers nem subscribers. |
| **Status 500 para erros de banco** | Nenhum. Players não chamam os endpoints de criação que passaram a retornar 500 em falha de procedure. |

### Conclusão players

- Nenhuma alteração é necessária nos players.
- Comportamento atual (auth por UIN/secret, consumo de playlist/dispatcher, uso de `contract_valid`) permanece válido.

---

## 3. Resumo

- **Install:** Já adequado; part17 está em `apply-schema-v2.sh` e em `apply-all.sql`; carga v6 já usa SUB-/PUB-.
- **Players:** Não dependem de `contract_number` nem das procedures; seguem funcionando como antes.

Se no futuro o install passar a usar outro script de schema (por exemplo, um apply-all alternativo), basta garantir que ele inclua **part17** na ordem correta (após part16, antes dos seeds de playlist-mix).
