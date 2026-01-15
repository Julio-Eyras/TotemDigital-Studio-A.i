# Exemplos Práticos de Uso dos Campos do Sistema PostgreSQL

## 🎯 **EXEMPLOS PRÁTICOS PARA O PROJETO SMART SIGNAGE**

### **1. Auditoria de Criação de Subscribers**

```sql
-- Ver quando cada subscriber foi criado (aproximadamente)
SELECT 
  s.subscriber_id,
  s.name,
  s.created_at,  -- Campo normal (preciso)
  s.xmin,        -- Transaction ID (para análise)
  pg_xact_commit_timestamp(s.xmin) as transaction_commit_time
FROM subscribers s
ORDER BY s.xmin DESC;
```

**Uso:** Comparar `created_at` (preciso) com `xmin` (aproximado) para validar consistência.

---

### **2. Detecção de Subscribers "Fantasma" (Deletados mas não removidos)**

```sql
-- Subscribers que foram deletados mas ainda estão no banco
-- (aguardando VACUUM para remoção física)
SELECT 
  s.subscriber_id,
  s.name,
  s.xmax as deleted_by_transaction,
  pg_xact_commit_timestamp(s.xmax) as deleted_at_approx
FROM subscribers s
WHERE s.xmax != 0  -- Foi deletado
  AND s.xmax::text::int NOT IN (
    SELECT xid FROM pg_prepared_xacts  -- Não está em transação preparada
  )
ORDER BY s.xmax DESC;
```

**Uso:** Identificar linhas que precisam de `VACUUM` para liberar espaço.

---

### **3. Análise de Fragmentação da Tabela Subscribers**

```sql
-- Ver como as linhas estão distribuídas fisicamente
SELECT 
  (s.ctid::text::point)[0]::int as page_number,
  COUNT(*) as rows_per_page,
  MIN(s.subscriber_id) as min_id,
  MAX(s.subscriber_id) as max_id
FROM subscribers s
GROUP BY (s.ctid::text::point)[0]::int
ORDER BY page_number;
```

**Uso:** Identificar se a tabela está fragmentada e precisa de `VACUUM FULL`.

---

### **4. Detecção de Locks em Subscribers**

```sql
-- Ver subscribers que estão bloqueados por transações
SELECT 
  s.subscriber_id,
  s.name,
  s.xmax as locking_transaction_id,
  pg_blocking_pids(s.xmax::text::int) as blocking_process_ids,
  pg_stat_activity.query as blocking_query
FROM subscribers s
LEFT JOIN pg_stat_activity ON pg_stat_activity.pid = ANY(pg_blocking_pids(s.xmax::text::int))
WHERE s.xmax != 0
  AND s.xmax::text::int IN (
    SELECT xid FROM pg_stat_activity WHERE state = 'active'
  );
```

**Uso:** Identificar deadlocks e transações que estão bloqueando linhas.

---

### **5. Ordem de Criação Dentro de uma Transação**

```sql
-- Ver a ordem exata de criação de subscribers na mesma transação
SELECT 
  s.subscriber_id,
  s.name,
  s.xmin as transaction_id,
  s.cmin as command_order,
  s.created_at
FROM subscribers s
WHERE s.xmin = (
  SELECT MAX(xmin) FROM subscribers  -- Última transação
)
ORDER BY s.cmin;  -- Ordem dos comandos
```

**Uso:** Entender a sequência de inserções em uma transação batch.

---

### **6. Acesso Direto e Rápido a uma Linha Específica**

```sql
-- ⚠️ ATENÇÃO: Só use se souber o ctid exato e a linha não foi atualizada
-- Útil para debugging ou operações de manutenção

-- Primeiro, encontre o ctid
SELECT subscriber_id, name, ctid
FROM subscribers
WHERE subscriber_id = 1;

-- Depois, use para acesso direto (muito rápido, sem índice)
SELECT * FROM subscribers WHERE ctid = '(0, 5)';  -- Exemplo
```

**Uso:** Acesso ultra-rápido para debugging, mas **não use em produção**.

---

### **7. Análise de Atualizações (MVCC)**

```sql
-- Ver quantas versões de uma linha existem (histórico MVCC)
-- Nota: Versões antigas são removidas pelo VACUUM
SELECT 
  s.subscriber_id,
  s.name,
  s.xmin as current_version_transaction,
  s.xmax as previous_version_deleted_by,
  COUNT(*) OVER (PARTITION BY s.subscriber_id) as version_count
FROM subscribers s
WHERE s.xmax != 0  -- Foi atualizado pelo menos uma vez
ORDER BY s.subscriber_id, s.xmin;
```

**Uso:** Entender quantas vezes uma linha foi atualizada.

---

### **8. Verificação de Integridade (Comparar created_at com xmin)**

```sql
-- Validar se created_at está consistente com xmin
SELECT 
  s.subscriber_id,
  s.name,
  s.created_at,
  pg_xact_commit_timestamp(s.xmin) as xmin_timestamp,
  EXTRACT(EPOCH FROM (pg_xact_commit_timestamp(s.xmin) - s.created_at)) as diff_seconds
FROM subscribers s
WHERE pg_xact_commit_timestamp(s.xmin) IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (pg_xact_commit_timestamp(s.xmin) - s.created_at))) > 1;
  -- Diferença maior que 1 segundo (pode indicar problema)
```

**Uso:** Validar que os timestamps estão corretos.

---

### **9. Identificar Tabelas em Queries com Herança**

```sql
-- Se subscribers tivesse tabelas filhas (exemplo hipotético)
-- Identificar de qual tabela veio cada linha
SELECT 
  s.subscriber_id,
  s.name,
  s.tableoid,
  c.relname as table_name
FROM subscribers s
JOIN pg_class c ON s.tableoid = c.oid
ORDER BY s.subscriber_id;
```

**Uso:** Útil se você usar particionamento ou herança de tabelas.

---

### **10. Monitoramento de Transações Longas**

```sql
-- Ver subscribers criados por transações que ainda estão ativas
SELECT 
  s.subscriber_id,
  s.name,
  s.xmin as creating_transaction,
  pg_stat_activity.state,
  pg_stat_activity.query_start,
  NOW() - pg_stat_activity.query_start as transaction_duration
FROM subscribers s
JOIN pg_stat_activity ON pg_stat_activity.xid = s.xmin::text::int
WHERE pg_stat_activity.state = 'active'
  AND NOW() - pg_stat_activity.query_start > INTERVAL '5 minutes';
```

**Uso:** Identificar transações longas que podem estar causando problemas.

---

## 🛠️ **FUNÇÕES ÚTEIS DO POSTGRESQL**

### **Funções para Trabalhar com Campos do Sistema:**

```sql
-- Converter xmin para timestamp (aproximado)
pg_xact_commit_timestamp(xmin)

-- Ver processos bloqueando uma transação
pg_blocking_pids(xid)

-- Ver informações de uma transação
pg_xact_status(xid)  -- 'committed', 'aborted', 'in progress', etc.

-- Obter nome da tabela a partir do tableoid
SELECT relname FROM pg_class WHERE oid = tableoid;
```

---

## ⚠️ **AVISOS PARA O PROJETO**

### **❌ NÃO Use em Código de Produção:**

```typescript
// ❌ ERRADO - Não use ctid em queries normais
const subscriber = await db.findFirst(`
  SELECT * FROM subscribers WHERE ctid = $1
`, [ctid]);

// ❌ ERRADO - Não use xmin como timestamp
const subscribers = await db.findMany(`
  SELECT * FROM subscribers 
  WHERE xmin > $1
`, [transactionId]);
```

### **✅ Use Campos Normais:**

```typescript
// ✅ CORRETO - Use campos normais
const subscriber = await db.findFirst(`
  SELECT * FROM subscribers WHERE subscriber_id = $1
`, [subscriberId]);

// ✅ CORRETO - Use created_at
const subscribers = await db.findMany(`
  SELECT * FROM subscribers 
  WHERE created_at > $1
`, [date]);
```

---

## 📊 **QUANDO USAR NO SEU PROJETO**

### **✅ Use para:**

1. **Debugging de Performance**
   - Análise de fragmentação
   - Identificação de locks
   - Análise de transações

2. **Manutenção do Banco**
   - Identificar linhas para VACUUM
   - Análise de espaço
   - Otimização de tabelas

3. **Auditoria Avançada**
   - Rastreamento de transações
   - Análise de histórico
   - Validação de integridade

### **❌ NÃO use para:**

1. **Lógica de Negócio**
   - Use `subscriber_id`, `created_at`, `is_active`

2. **Queries de Produção**
   - Use índices e campos normais

3. **Identificadores Permanentes**
   - Use chaves primárias normais

---

## 🎓 **RESUMO**

Esses campos são **ferramentas poderosas** para:
- 🔍 **Debugging** avançado
- 📊 **Análise** de performance
- 🛠️ **Manutenção** do banco
- 🔐 **Auditoria** de transações

Mas **sempre prefira campos normais** para a lógica de aplicação!

