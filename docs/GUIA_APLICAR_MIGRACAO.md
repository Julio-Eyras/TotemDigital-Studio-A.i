# 📋 Guia para Aplicar Migração da Tabela event_logs

**Versão:** 2.1.0  
**Data:** 2025-01-XX

---

## 🎯 **OBJETIVO**

Aplicar a migração que cria a tabela `event_logs` no banco de dados PostgreSQL para registrar eventos importantes do sistema (playback de vídeo, exibição de anúncios, BI, campanhas).

---

## 📋 **PRÉ-REQUISITOS**

- ✅ PostgreSQL instalado e rodando
- ✅ Banco de dados `smartsignage` criado
- ✅ Usuário `smartsignage` com permissões
- ✅ Acesso ao servidor (SSH ou local)

---

## 🚀 **MÉTODO 1: Script Automatizado (Recomendado)**

### **Passo 1: Navegar até o diretório de migrações**

```bash
cd /caminho/para/SmartSignage-Pro/database/migrations
```

### **Passo 2: Tornar o script executável (se necessário)**

```bash
chmod +x apply-event-logs-migration.sh
```

### **Passo 3: Executar o script**

```bash
# Com configurações padrão (smartsignage@localhost:5432)
./apply-event-logs-migration.sh

# Ou com parâmetros customizados
./apply-event-logs-migration.sh [database_name] [user] [host] [port]

# Exemplo:
./apply-event-logs-migration.sh smartsignage smartsignage localhost 5432
```

### **Passo 4: Fornecer senha (se necessário)**

Se solicitado, forneça a senha do PostgreSQL:

```bash
export PGPASSWORD=smartsignage123
./apply-event-logs-migration.sh
```

### **Passo 5: Verificar a migração**

```bash
./verify-event-logs-table.sh
```

---

## 🔧 **MÉTODO 2: Manual via psql**

### **Passo 1: Conectar ao PostgreSQL**

```bash
sudo -u postgres psql -d smartsignage
```

Ou com usuário específico:

```bash
psql -U smartsignage -d smartsignage -h localhost
```

### **Passo 2: Executar o script SQL**

```sql
\i database/migrations/add-event-logs-table.sql
```

Ou copiar e colar o conteúdo do arquivo diretamente no psql.

### **Passo 3: Verificar criação**

```sql
-- Verificar se a tabela existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'event_logs'
);

-- Ver estrutura da tabela
\d event_logs

-- Ver índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'event_logs';

-- Ver foreign keys
SELECT 
    tc.constraint_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name, 
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu 
    ON tc.constraint_name = kcu.constraint_name 
JOIN information_schema.constraint_column_usage AS ccu 
    ON ccu.constraint_name = tc.constraint_name 
WHERE tc.table_name = 'event_logs' 
    AND tc.constraint_type = 'FOREIGN KEY';
```

---

## 🐳 **MÉTODO 3: Via Docker**

### **Se o PostgreSQL estiver em container Docker:**

```bash
# Copiar arquivo de migração para o container
docker cp database/migrations/add-event-logs-table.sql smartsignage-postgres:/tmp/

# Executar migração dentro do container
docker exec -i smartsignage-postgres psql -U smartsignage -d smartsignage < /tmp/add-event-logs-table.sql

# Ou executar diretamente
docker exec -i smartsignage-postgres psql -U smartsignage -d smartsignage < database/migrations/add-event-logs-table.sql
```

---

## ✅ **VERIFICAÇÃO**

### **Script de Verificação Automática**

```bash
cd database/migrations
chmod +x verify-event-logs-table.sh
./verify-event-logs-table.sh
```

### **Verificação Manual**

```sql
-- 1. Verificar se a tabela existe
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name = 'event_logs';

-- 2. Contar colunas (deve ter 10 colunas)
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'event_logs';

-- 3. Verificar índices (deve ter 7+ índices)
SELECT COUNT(*) 
FROM pg_indexes 
WHERE tablename = 'event_logs';

-- 4. Testar inserção
INSERT INTO event_logs (event_type, entity_type) 
VALUES ('test_event', 'test') 
RETURNING id;

-- 5. Remover teste
DELETE FROM event_logs WHERE event_type = 'test_event';
```

---

## 📊 **ESTRUTURA ESPERADA**

A tabela `event_logs` deve ter:

### **Colunas:**
- `id` (SERIAL PRIMARY KEY)
- `event_type` (TEXT NOT NULL)
- `entity_type` (TEXT NOT NULL)
- `entity_id` (INTEGER)
- `totem_id` (INTEGER)
- `campaign_id` (INTEGER)
- `playlist_id` (INTEGER)
- `media_id` (INTEGER)
- `metadata` (JSONB)
- `timestamp` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP)

### **Foreign Keys:**
- `totem_id` → `totems(totem_id)`
- `campaign_id` → `campaigns(campaign_id)`
- `playlist_id` → `playlists(playlist_id)`
- `media_id` → `medias(media_id)`

### **Índices:**
- `idx_event_logs_event_type`
- `idx_event_logs_totem_id`
- `idx_event_logs_campaign_id`
- `idx_event_logs_playlist_id`
- `idx_event_logs_media_id`
- `idx_event_logs_timestamp`
- `idx_event_logs_entity`
- `idx_event_logs_bi`

---

## 🐛 **SOLUÇÃO DE PROBLEMAS**

### **Erro: "relation does not exist"**

A tabela referenciada (totems, campaigns, etc) não existe. Execute primeiro o schema principal:

```bash
sudo -u postgres psql -d smartsignage -f database/smartchannel-db.sql
```

### **Erro: "permission denied"**

Verifique permissões do usuário:

```sql
GRANT ALL PRIVILEGES ON DATABASE smartsignage TO smartsignage;
GRANT ALL ON SCHEMA public TO smartsignage;
```

### **Erro: "duplicate key value"**

A tabela já existe. Use o script com a opção de recriar ou remova manualmente:

```sql
DROP TABLE IF EXISTS event_logs CASCADE;
```

---

## 📚 **PRÓXIMOS PASSOS**

Após aplicar a migração:

1. ✅ Verificar que a tabela foi criada corretamente
2. ⏳ Integrar EventLogService no player para logging de playback
3. ⏳ Integrar EventLogService nas rotas de campanhas
4. ⏳ Testar inserção de eventos

---

## 📝 **ARQUIVOS RELACIONADOS**

- **Script de Migração:** `database/migrations/add-event-logs-table.sql`
- **Script de Aplicação:** `database/migrations/apply-event-logs-migration.sh`
- **Script de Verificação:** `database/migrations/verify-event-logs-table.sh`
- **EventLogService:** `backend/src/services/eventLogService.ts`
- **Documentação:** `DOCUMENTACAO_ESTRATEGIA_LOGGING.md`

---

**Última atualização:** 2025-01-XX

