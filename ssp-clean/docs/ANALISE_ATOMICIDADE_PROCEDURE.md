# Atomicidade: procedure no banco vs transação no backend

**Contexto:** Garantir que a criação de publisher (ou subscriber) com todos os relacionados — locals, totems, smart_tvs, contratos — seja **atómica**: ou grava tudo ou nada, sem “poluição” em caso de crash.

**Sua ideia:** Atomizar no banco com uma **procedure** (ou função) que implemente todas as regras em SQL; o backend orquestra o resto.

**Conclusão curta:** Para este tipo de operação, **faz todo o sentido usar atomicidade**. Hoje já existe atomicidade via **transação no backend** (`transaction()` + BEGIN/COMMIT/ROLLBACK). Mover a lógica para uma **stored procedure** no PostgreSQL é uma opção válida e em muitos casos **melhor** para este cenário: uma única chamada ao banco, regras críticas (incluindo geração de `contract_number`) no próprio DB, e o backend fica mais simples. Abaixo fica a análise e uma proposta de divisão (o que na procedure, o que no backend).

---

## 1. Situação atual

- **Publisher com recursos:** O backend usa `transaction(async (client) => { ... })`: faz BEGIN, depois vários INSERTs (publisher → locals → totems → smart_tvs → publisher_contracts), depois COMMIT; em erro faz ROLLBACK. Ou seja, **já há atomicidade** ao nível da aplicação.
- **Subscriber + contratos:** O frontend cria o subscriber e depois, em **várias chamadas** HTTP, cria cada contrato. Não há uma transação única no backend que crie subscriber + todos os contratos; por isso um crash no meio pode deixar subscriber com apenas parte dos contratos.

Para “este tipo de questão” (criar entidade pai + vários relacionados), **usar atomicidade** é a abordagem certa. A decisão é **onde** implementar: só transação no backend ou **procedure no banco**.

---

## 2. Procedure no banco: prós e contras

### Vantagens de uma procedure (função PL/pgSQL)

- **Atomicidade garantida pelo motor:** Tudo corre dentro de uma transação implícita da função; se algo falhar (constraint, regra, exceção), o DB faz rollback. Crash do servidor de aplicação no meio não deixa “meio gravado”.
- **Uma ida ao banco:** Em vez de N round-trips (INSERT publisher, INSERT local, INSERT totem, …), uma única chamada `SELECT * FROM create_publisher_with_resources(...)` reduz latência e janela de falha.
- **Regras no mesmo sítio que os dados:**  
  - Geração de `contract_number` (ex.: `PUB-{publisher_id}.{seq}`) pode ser feita em SQL (e até com trigger ou default), garantindo que nunca se grava contrato sem número consistente.  
  - Unicidades, checks e FKs já estão no banco; a procedure pode validar e inserir em ordem correta, sem depender da aplicação.
- **Reutilizável:** Outros clientes (outro serviço, job, script SQL) podem chamar a mesma procedure com as mesmas garantias.
- **Menos lógica crítica no backend:** O backend passa a “validar input, montar payload, chamar procedure, mapear resultado”; a parte que mais importa para integridade fica no DB.

### Desvantagens / cuidados

- **Lógica em dois sítios:** Regras de negócio ficam em parte no backend (validação, auth, formato da API) e em parte no banco (ordem de inserts, geração de números, integridade). É preciso documentar e manter os dois.
- **Debug e testes:** Erros vêm como mensagens do PostgreSQL; é preciso boa mensagem em `RAISE EXCEPTION` e, se necessário, logging. Testes podem chamar a procedure diretamente (por exemplo em migrações ou testes de integração com DB).
- **Versioning:** Procedures vivem em migrações ou em ficheiros de schema (como os `part*.sql`). Qualquer alteração de regra exige migração/script idempotente e alinhado com a regra do projeto (schema como fonte da verdade).
- **Payload complexo:** Se os dados vierem em JSON (ex.: array de totems, smart_tvs, contratos), a procedure pode receber `JSONB` e fazer `jsonb_array_elements` etc.; a construção desse JSON continua a poder ser no backend.

---

## 3. Proposta: divisão procedure vs backend

Para este tipo de questão, uma divisão razoável é:

### No banco (procedure + triggers/constraints)

- **Uma função** (ex.: `create_publisher_with_resources(p_publisher jsonb, p_locals jsonb, p_totems jsonb, p_smart_tvs jsonb, p_contracts jsonb)`):
  - INSERT em `publishers` → obtém `publisher_id`.
  - Para cada local em `p_locals`: INSERT em `locals` com `publisher_id`.
  - Para cada totem em `p_totems`: INSERT em `totems` com o `local_id` correto (por índice no array).
  - Para cada smart_tv em `p_smart_tvs`: INSERT em `smart_tvs` com o `totem_id` correto.
  - Para cada contrato em `p_contracts`: INSERT em `publisher_contracts` com `publisher_id` e **`contract_number` gerado na procedure** (ex.: `'PUB-' || publisher_id || '.' || lpad((row_number)::text, 6, '0')`), em vez de confiar no valor vindo do cliente.
- **Regras no DB:**  
  - Ordem dos INSERTs respeitando FKs.  
  - Geração de `contract_number` sempre como `PUB-{publisher_id}.{seq}` (e equivalente para subscriber, noutra função).  
  - Constraints e triggers já existentes continuam a valer; a procedure não contorna o schema.
- **Retorno:** A função pode devolver um `jsonb` com os IDs criados (publisher_id, local_ids, totem_ids, etc.) para o backend devolver na API.

### No backend

- **Validação de entrada:** Campos obrigatórios, formatos, limites (tamanho de arrays, etc.), autorização (quem pode criar publisher/subscriber).
- **Montagem do payload:** Transformar o body da API (ex.: `req.body`) no JSON que a procedure espera (snake_case, estrutura esperada).
- **Chamada à procedure:** Uma única query, por exemplo  
  `SELECT * FROM create_publisher_with_resources($1::jsonb, $2::jsonb, ...);`  
  usando o client da pool (ou dentro de uma transação se ainda quiser envolver outras operações no mesmo request).
- **Tratamento de erros:** Traduzir exceções do Postgres (códigos SQLSTATE, mensagens) em respostas HTTP adequadas (409, 400, 500).
- **Não** repetir a criação de contratos no frontend depois de chamar a API que invoca a procedure (evitar o loop extra que hoje causa 409).

Assim, a **atomicidade** fica garantida pelo banco (tudo dentro da procedure), e as **regras críticas** (ordem de inserts, número de contrato derivado do ID do pai) ficam implementadas em SQL. O backend fica responsável por auth, validação de API e orquestração.

---

## 4. Subscriber + contratos

O mesmo princípio aplica-se a “criar subscriber + N contratos”:

- **Procedure** (ex.: `create_subscriber_with_contracts(p_subscriber jsonb, p_contracts jsonb)`):
  - INSERT em `subscribers` → `subscriber_id`.
  - Para cada elemento de `p_contracts`: INSERT em `subscriber_contracts` com `contract_number = 'SUB-' || subscriber_id || '.' || lpad(seq, 6, '0')`.
- **Backend:** Uma chamada à procedure após validar o body; o frontend deixa de fazer N chamadas separadas para criar contratos, e passa a enviar subscriber + lista de contratos (sem número obrigatório; o número é gerado na procedure).

Assim, mesmo em caso de crash, não fica “subscriber com metade dos contratos”: ou tudo é gravado ou nada é.

---

## 5. Resumo

- **Sim:** Para este tipo de questão (criar pai + vários relacionados), **usar atomicidade** é o caminho certo.
- **Procedure no banco** é uma boa opção: centraliza a parte crítica no DB, reduz round-trips e garante que as regras (incluindo “concatenar ID” no `contract_number`) são aplicadas de forma atómica.
- **Backend** continua a fazer: validação, auth, montagem do payload e chamada única à procedure; não duplica criação de contratos no frontend.
- **Implementação:** Pode ser feita por fases: primeiro procedure para publisher com recursos (e remover o loop de criação de contratos no frontend); depois procedure para subscriber com contratos, substituindo o loop atual de `contractApi.create`.

Nenhuma alteração de código foi feita; este documento serve apenas para apoiar a decisão de atomizar com procedure no banco e o que colocar em cada camada.
