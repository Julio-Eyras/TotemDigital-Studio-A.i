# Análise: crash no meio do processo e poluição das tabelas (contrato vs publisher/subscriber)

**Objetivo:** Entender onde um crash ou falha parcial pode deixar dados inconsistentes e avaliar a solução de **concatenar o ID do subscriber ou do publisher** no número de contrato (garantir que o pai seja gravado antes).  
**Não foram feitas alterações de código** — apenas análise para decisão.

---

## 1. Onde está o problema

### 1.1 Fluxo atual – **Publisher** (criação com recursos)

- **Frontend** envia um único payload: `{ publisher, locals, totems, smartTvs, contracts }`.
- **Backend** (`POST /api/publishers`):
  - Se vier `locals`, `totems`, `smartTvs` ou `contracts`, chama `createPublisherWithResources(payload)`.
  - Ordem dentro de **uma transação**:
    1. INSERT publisher → obtém `publisher_id`
    2. INSERT locals (com `publisher_id`)
    3. INSERT totems (com `local_id`)
    4. INSERT smart_tvs (com `totem_id`)
    5. INSERT publisher_contracts (com `publisher_id` e `contract_number` vindo do payload)
  - Se qualquer passo falhar, a transação faz **rollback** → não fica “contrato sem publisher” nesse caminho.

- **Depois** da resposta do backend, o frontend faz **outro loop**:
  - Para cada contrato em `tempPublisherContracts`, chama `publisherContractApi.create({ ...contract, publisher_id: publisherId })`.
  - Ou seja: os contratos já foram criados **dentro** da transação; esse segundo loop tenta **criar de novo** os mesmos contratos.
  - Se o `contract_number` for o mesmo → **409 (Conflict)** “Número de contrato já existe” no primeiro contrato do loop.
  - Resultado típico: “Publicador criado. Alguns contratos não foram criados: …” e sensação de “deu crash no publisher” ou “tabelas poluídas”, mesmo com publisher e contratos já gravados na primeira chamada.

Conclusão para **Publisher**:

- **Poluição por “contrato gravado e publisher falhou”** não ocorre nesse fluxo: ou tudo é gravado na transação, ou nada é.
- A “poluição” que aparece na prática é mais: **duplicação de tentativa** (contratos criados na transação + novo create em loop) e **409** ou estado confuso na UI.

### 1.2 Fluxo atual – **Subscriber** (criação com contratos)

- **Frontend**:
  1. Cria o **subscriber** com `subscriberApi.create(subscriberData)` → obtém `subscriber_id`.
  2. Para cada contrato em `tempSubscriberContracts`, chama `contractApi.create()` com:
     - `subscriber_id: subscriberId`
     - `contract_number: \`SUB-${subscriberId}.${String(i+1).padStart(6,'0')}\``
- Não há **transação única** no backend que crie subscriber + todos os contratos juntos; cada contrato é um `POST` separado.

Cenário de crash/falha:

- Se o subscriber foi criado e o **terceiro** `contractApi.create()` falhar (rede, 409, validação, etc.):
  - Ficam **subscriber + apenas os contratos já criados** (ex.: 2 de 3).
  - Isso é “poluição” no sentido de **estado parcial**: subscriber com apenas parte dos contratos.

Conclusão para **Subscriber**:

- O **número de contrato já depende do subscriber**: `SUB-{subscriber_id}.{seq}`.
- O pai (subscriber) **já é gravado antes** dos contratos.
- O problema aqui é **falha no meio do loop** (subscriber ok, contratos parciais), não “contrato gravado sem subscriber”.

---

## 2. Sua proposta: concatenar ID do subscriber ou do publisher

Ideia: **só ter número de contrato quando o pai existir**, e esse número ser **determinístico** a partir do ID do pai (ex.: `SUB-{subscriber_id}.{seq}` ou `PUB-{publisher_id}.{seq}`).

### 2.1 O que já existe

- **Subscriber:** Na criação, o frontend já gera `contract_number = SUB-${subscriberId}.${seq}` **depois** de criar o subscriber. Ou seja: **subscriber gravado antes**; número de contrato já concatenado ao `subscriber_id`.
- **Publisher (edição):** O frontend já tem `generateInlinePublisherContractNumber(publisherId)` → `PUB-${publisherId}.${seq}`. Ou seja: formato “concatenar ID” já existe quando o publisher **já está criado**.

### 2.2 O que falta para alinhar à proposta

- **Publisher na criação:**  
  No fluxo transacional, o `contract_number` hoje vem **do payload** (digitado ou sugerido no frontend **antes** de existir `publisher_id`). Para seguir a regra “só gravar contrato quando o pai existir e número = f(pai)”:
  - O backend, **dentro** de `createPublisherWithResources`, depois de ter `publisher_id`, poderia **ignorar** o `contract_number` do payload e gerar sempre `PUB-{publisher_id}.{seq}` (por exemplo seq = 1, 2, 3… por contrato no payload).
  - Assim: **sempre** “publisher gravado antes” (na mesma transação, o publisher é inserido primeiro) e número de contrato **sempre** derivado do `publisher_id`, sem depender de valor vindo do frontend.
- **Subscriber na criação:**  
  Já está alinhado: subscriber é criado primeiro; depois o frontend gera `SUB-{subscriber_id}.{seq}`. Opcionalmente o backend poderia também gerar o número no servidor (ex.: ao criar contrato, se `contract_number` vier vazio ou em formato “SUB-NOVO.*”, substituir por `SUB-{subscriber_id}.{seq}`).

### 2.3 Vantagens da abordagem “concatenar ID”

1. **Ordem garantida:** Contrato só existe com número que depende do pai → conceptualmente “pai antes do contrato”.
2. **Unicidade simples:** Por regra de negócio, `(subscriber_id, contract_number)` ou `(publisher_id, contract_number)` continuam únicos; com padrão `SUB-{id}.{seq}` / `PUB-{id}.{seq}` fica mais difícil duplicar por engano.
3. **Menos 409 no publisher:** Se o backend gerar o número na criação transacional e o frontend **não** chamar de novo `publisherContractApi.create` para os mesmos contratos (ou o backend passar a ignorar contratos duplicados nesse cenário), desaparece o 409 “Número de contrato já existe” causado pela dupla criação.
4. **Recuperação mais clara:** Em caso de falha no meio do loop (subscriber), o estado “subscriber com N contratos” continua consistente: todos os números são `SUB-{id}.{seq}` e o pai sempre existe.

### 2.4 Pontos de atenção (sem alterar nada ainda)

- **Compatibilidade:** Contratos já existentes com formato antigo (ex.: “CT-001”, “PC-001”) continuam válidos; a regra nova pode aplicar só a **novos** contratos (ou migração futura).
- **Frontend – Publisher:** Se o backend passar a gerar `contract_number` na criação com recursos, o frontend não precisa mais enviar `contract_number` nos contratos do payload (ou envia e o backend ignora). E o **segundo loop** que chama `publisherContractApi.create` para cada contrato após criar o publisher deveria ser **removido** quando os contratos já tiverem sido enviados no payload (para não tentar criar de novo).
- **Subscriber “SUB-NOVO”:** Hoje, no formulário de **novo** subscriber (ainda sem ID), o frontend usa `SUB-NOVO.{seq}` como valor temporário. Na hora de criar, já é substituído por `SUB-{subscriberId}.{seq}`. Manter esse fluxo ou, no backend, aceitar “SUB-NOVO” e trocar por `SUB-{subscriber_id}.{seq}` é uma decisão de desenho.

---

## 3. Resumo

| Aspecto | Situação atual | Com “concatenar ID” (sua proposta) |
|--------|----------------|-------------------------------------|
| **Quem grava primeiro** | Subscriber: subscriber → contratos. Publisher: tudo na mesma transação (publisher primeiro, depois contratos). | Continua: pai (subscriber ou publisher) sempre antes do contrato. Número de contrato **só** faz sentido quando o pai existe. |
| **Risco “contrato sem pai”** | Publisher: não existe (transação). Subscriber: não existe (subscriber criado antes). | Mantido; ainda mais claro na regra de negócio. |
| **Poluição por crash** | Subscriber: possível “subscriber com apenas parte dos contratos” se um `contractApi.create()` falhar no meio do loop. Publisher: transação evita estado parcial; a confusão vem do segundo loop (tentativa de criar contratos já criados). | Subscriber: igual (crash no loop ainda pode deixar contratos parciais); números ficam sempre SUB-{id}.{seq}. Publisher: ao gerar número no backend e remover dupla criação no frontend, reduz 409 e confusão. |
| **Geração do número** | Subscriber: frontend gera `SUB-{id}.{seq}` após criar. Publisher: frontend envia número no payload; backend usa; depois frontend tenta criar de novo com o mesmo número. | Subscriber: pode manter ou mover geração para o backend. Publisher: **gerar no backend** como `PUB-{publisher_id}.{seq}` na criação com recursos evita duplicação e garante “sempre com publisher_id”. |

Recomendação para quando **optar** por implementar:

1. **Publisher:** No `createPublisherWithResources`, após inserir o publisher, gerar `contract_number` como `PUB-{publisher_id}.{seq}` para cada item de `payload.contracts` (em vez de usar o valor vindo do frontend). No frontend, **não** chamar `publisherContractApi.create` em loop quando os contratos já tiverem sido enviados no payload de criação do publisher.
2. **Subscriber:** Manter “subscriber criado primeiro” e `SUB-{subscriber_id}.{seq}`; opcionalmente, backend pode passar a gerar o número ao criar o contrato quando `subscriber_id` já existir.
3. **Regra geral:** Documentar que “para ter ID do subscriber ou do publisher, este deve ser gravado antes”; número de contrato deve ser derivado desse ID (concatenar ID + sequência) para novos registos.

Nenhuma alteração foi feita no código; este documento serve apenas para apoiar a decisão.
