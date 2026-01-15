# Campos do Sistema PostgreSQL - Documentação

## 📋 **INTRODUÇÃO**

O PostgreSQL adiciona automaticamente **colunas de sistema** em todas as tabelas. Essas colunas são essenciais para o funcionamento interno do banco de dados, especialmente para:

- **Controle de Concorrência (MVCC - Multi-Version Concurrency Control)**
- **Rastreamento de Transações**
- **Gerenciamento de Herança de Tabelas**
- **Localização Física de Dados**

---

## 🔍 **CAMPOS DO SISTEMA**

### **1. `tableoid` (OID da Tabela)**

**O que é:**
- Identificador numérico (OID) da tabela que contém a linha
- Cada tabela no PostgreSQL tem um OID único

**Para que serve:**
- **Tabelas Particionadas**: Identifica em qual partição a linha está
- **Herança de Tabelas**: Identifica de qual tabela filha a linha veio
- **Queries Complexas**: Permite distinguir linhas de diferentes tabelas em UNIONs

**Exemplo de uso:**
```sql
-- Descobrir de qual tabela veio uma linha (em herança)
SELECT tableoid, name, email
FROM subscribers;

-- Obter o nome da tabela
SELECT s.name, c.relname as table_name
FROM subscribers s
JOIN pg_class c ON s.tableoid = c.oid;
```

**Quando usar:**
- ✅ Consultas em tabelas particionadas
- ✅ Hierarquias de herança de tabelas
- ✅ Debugging de queries complexas
- ❌ **NÃO usar como chave primária ou identificador lógico**

---

### **2. `xmin` (Transaction ID de Inserção)**

**O que é:**
- ID da transação que **inseriu** a versão atual da linha
- Cada atualização cria uma nova versão da linha (MVCC)

**Para que serve:**
- **Controle de Versões**: Rastreia qual transação criou a versão atual
- **Isolamento de Transações**: Determina se uma linha é visível para uma transação
- **Auditoria**: Saber quando uma linha foi criada (via `pg_xact`)

**Exemplo de uso:**
```sql
-- Ver quando uma linha foi inserida (aproximadamente)
SELECT 
  subscriber_id,
  name,
  xmin,
  pg_xact_commit_timestamp(xmin) as inserted_at
FROM subscribers
WHERE subscriber_id = 1;
```

**Quando usar:**
- ✅ Auditoria e rastreamento de criação
- ✅ Debugging de problemas de concorrência
- ✅ Análise de transações
- ❌ **NÃO usar como timestamp exato** (use `created_at`)

---

### **3. `xmax` (Transaction ID de Exclusão/Atualização)**

**O que é:**
- ID da transação que **deletou** ou **atualizou** a linha
- `0` = linha não foi deletada/atualizada
- Diferente de `0` = linha foi deletada ou atualizada (nova versão criada)

**Para que serve:**
- **Detecção de Exclusões**: Identifica linhas deletadas (mas ainda no banco)
- **Controle de Lock**: Indica se uma linha está bloqueada por uma transação
- **MVCC**: Determina se uma linha é visível para outras transações

**Exemplo de uso:**
```sql
-- Verificar linhas que foram deletadas mas ainda não removidas fisicamente
SELECT subscriber_id, name
FROM subscribers
WHERE xmax != 0;

-- Verificar linhas bloqueadas
SELECT subscriber_id, name, xmax
FROM subscribers
WHERE xmax != 0 
  AND xmax::text::int NOT IN (
    SELECT xid FROM pg_prepared_xacts
  );
```

**Quando usar:**
- ✅ Debugging de locks e deadlocks
- ✅ Identificar linhas "fantasma" (deletadas mas não removidas)
- ✅ Análise de concorrência
- ❌ **NÃO usar para lógica de negócio** (use `is_active` ou `deleted_at`)

---

### **4. `cmin` (Command ID de Inserção)**

**O que é:**
- Identificador do **comando dentro da transação** que inseriu a linha
- Começa em `0` para o primeiro comando da transação
- Incrementa para cada comando subsequente

**Para que serve:**
- **Ordem de Comandos**: Rastreia a ordem dos comandos dentro de uma transação
- **Dependências**: Identifica dependências entre comandos na mesma transação
- **Debugging**: Entender a sequência de operações

**Exemplo de uso:**
```sql
-- Ver a ordem de inserção dentro de uma transação
SELECT 
  subscriber_id,
  name,
  xmin,
  cmin,
  pg_xact_commit_timestamp(xmin) as transaction_time
FROM subscribers
ORDER BY xmin, cmin;
```

**Quando usar:**
- ✅ Debugging de transações complexas
- ✅ Análise de ordem de operações
- ✅ Entender dependências entre comandos
- ❌ **Raramente usado em produção**

---

### **5. `cmax` (Command ID de Exclusão)**

**O que é:**
- Identificador do **comando dentro da transação** que deletou a linha
- Similar ao `cmin`, mas para exclusões
- `0` = linha não foi deletada

**Para que serve:**
- **Ordem de Exclusões**: Rastreia qual comando deletou a linha
- **Debugging**: Entender a sequência de exclusões em uma transação
- **Análise de Transações**: Compreender o fluxo de operações

**Exemplo de uso:**
```sql
-- Ver ordem de exclusões
SELECT 
  subscriber_id,
  name,
  xmax,
  cmax
FROM subscribers
WHERE xmax != 0
ORDER BY xmax, cmax;
```

**Quando usar:**
- ✅ Debugging avançado
- ✅ Análise de transações
- ❌ **Raramente usado em produção**

---

### **6. `ctid` (Tuple ID - Localização Física)**

**O que é:**
- **Localização física** da linha na tabela (página + offset)
- Formato: `(page_number, tuple_number)`
- Exemplo: `(0, 1)` = página 0, tupla 1

**Para que serve:**
- **Acesso Direto**: Localizar uma linha sem usar índice
- **Performance**: Acesso muito rápido a uma linha específica
- **VACUUM**: Identificar linhas para limpeza

**⚠️ IMPORTANTE:**
- **NÃO é estável**: Muda quando a linha é atualizada ou movida
- **NÃO usar como chave primária**: Use `subscriber_id` ou outra PK
- **Pode mudar**: Após `VACUUM FULL` ou atualizações

**Exemplo de uso:**
```sql
-- Acesso direto a uma linha (muito rápido)
SELECT * FROM subscribers WHERE ctid = '(0, 1)';

-- Ver localização física de todas as linhas
SELECT 
  subscriber_id,
  name,
  ctid
FROM subscribers
ORDER BY ctid;

-- ⚠️ NÃO FAÇA ISSO (ctid muda):
-- UPDATE subscribers SET name = 'Novo Nome' WHERE ctid = '(0, 1)';
-- -- Depois disso, o ctid pode mudar!
```

**Quando usar:**
- ✅ Acesso direto e rápido a uma linha conhecida
- ✅ Análise de fragmentação de tabelas
- ✅ Debugging de problemas de performance
- ✅ Operações de manutenção (VACUUM)
- ❌ **NÃO usar como identificador permanente**
- ❌ **NÃO usar em lógica de negócio**

---

## 🎯 **CASOS DE USO PRÁTICOS**

### **1. Auditoria e Rastreamento**

```sql
-- Ver histórico de criação de subscribers
SELECT 
  subscriber_id,
  name,
  xmin as transaction_id,
  pg_xact_commit_timestamp(xmin) as created_at_approx
FROM subscribers
ORDER BY xmin DESC;
```

### **2. Detecção de Locks e Deadlocks**

```sql
-- Ver linhas bloqueadas
SELECT 
  s.subscriber_id,
  s.name,
  s.xmax as locking_transaction,
  pg_blocking_pids(s.xmax::text::int) as blocking_pids
FROM subscribers s
WHERE s.xmax != 0;
```

### **3. Análise de Fragmentação**

```sql
-- Ver distribuição física das linhas
SELECT 
  (ctid::text::point)[0]::int as page_number,
  COUNT(*) as rows_per_page
FROM subscribers
GROUP BY (ctid::text::point)[0]::int
ORDER BY page_number;
```

### **4. Identificar Linhas "Fantasma" (Deletadas mas não removidas)**

```sql
-- Linhas deletadas mas ainda no banco (aguardando VACUUM)
SELECT 
  subscriber_id,
  name,
  xmax as deleted_by_transaction
FROM subscribers
WHERE xmax != 0
  AND xmax::text::int NOT IN (
    SELECT xid FROM pg_prepared_xacts
  );
```

---

## ⚠️ **AVISOS IMPORTANTES**

### **❌ NÃO FAÇA:**

1. **Usar `ctid` como chave primária**
   ```sql
   -- ❌ ERRADO
   CREATE TABLE exemplo (
     id ctid PRIMARY KEY  -- NÃO FAÇA ISSO!
   );
   ```

2. **Usar `xmin` como timestamp exato**
   ```sql
   -- ❌ ERRADO - Use created_at
   SELECT * FROM subscribers 
   WHERE xmin > 123456;  -- NÃO FAÇA ISSO!
   ```

3. **Modificar diretamente esses campos**
   ```sql
   -- ❌ ERRADO - O PostgreSQL gerencia automaticamente
   UPDATE subscribers SET xmin = 123;  -- NÃO FAÇA ISSO!
   ```

4. **Usar `tableoid` como identificador de linha**
   ```sql
   -- ❌ ERRADO - Use subscriber_id
   SELECT * FROM subscribers WHERE tableoid = 123;  -- NÃO FAÇA ISSO!
   ```

### **✅ FAÇA:**

1. **Use campos normais para lógica de negócio**
   ```sql
   -- ✅ CORRETO
   SELECT * FROM subscribers 
   WHERE subscriber_id = 1 
     AND is_active = true
     AND created_at > '2024-01-01';
   ```

2. **Use para debugging e análise**
   ```sql
   -- ✅ CORRETO - Para análise
   SELECT 
     subscriber_id,
     name,
     xmin,
     ctid
   FROM subscribers
   WHERE xmax != 0;  -- Linhas deletadas
   ```

3. **Use para manutenção**
   ```sql
   -- ✅ CORRETO - Para VACUUM
   VACUUM ANALYZE subscribers;
   ```

---

## 📊 **RESUMO COMPARATIVO**

| Campo | Tipo | Estável? | Uso Principal | Usar em Produção? |
|-------|------|----------|---------------|-------------------|
| `tableoid` | OID | ✅ Sim | Herança/Particionamento | ⚠️ Raramente |
| `xmin` | Transaction ID | ✅ Sim | Auditoria/MVCC | ⚠️ Debugging |
| `xmax` | Transaction ID | ✅ Sim | Locks/Exclusões | ⚠️ Debugging |
| `cmin` | Command ID | ✅ Sim | Ordem de comandos | ❌ Raramente |
| `cmax` | Command ID | ✅ Sim | Ordem de exclusões | ❌ Raramente |
| `ctid` | Tuple ID | ❌ **NÃO** | Localização física | ⚠️ Apenas debugging |

---

## 🔧 **QUANDO USAR NO SEU PROJETO**

### **✅ Casos Válidos:**

1. **Debugging de Performance**
   ```sql
   -- Ver fragmentação
   SELECT ctid, subscriber_id, name 
   FROM subscribers 
   ORDER BY ctid;
   ```

2. **Análise de Transações**
   ```sql
   -- Ver ordem de criação
   SELECT subscriber_id, name, xmin, cmin
   FROM subscribers
   ORDER BY xmin, cmin;
   ```

3. **Detecção de Problemas**
   ```sql
   -- Ver linhas bloqueadas
   SELECT * FROM subscribers WHERE xmax != 0;
   ```

### **❌ Evitar:**

1. **Lógica de Negócio**: Use `subscriber_id`, `created_at`, `is_active`
2. **Chaves Primárias**: Use campos normais
3. **Queries de Produção**: Use índices e campos normais
4. **Modificações Diretas**: Deixe o PostgreSQL gerenciar

---

## 📝 **CONCLUSÃO**

Esses campos são **ferramentas de sistema** do PostgreSQL, úteis para:

- ✅ **Debugging** e análise
- ✅ **Manutenção** do banco
- ✅ **Auditoria** avançada
- ✅ **Otimização** de performance

**Mas NÃO devem ser usados para:**
- ❌ Lógica de negócio
- ❌ Identificadores permanentes
- ❌ Chaves primárias
- ❌ Queries de produção normais

**Sempre prefira campos normais** como `subscriber_id`, `created_at`, `is_active`, etc., para a lógica de aplicação.

---

## 🔗 **REFERÊNCIAS**

- [PostgreSQL System Columns Documentation](https://www.postgresql.org/docs/current/ddl-system-columns.html)
- [PostgreSQL MVCC (Multi-Version Concurrency Control)](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [PostgreSQL Table Inheritance](https://www.postgresql.org/docs/current/ddl-inherit.html)

