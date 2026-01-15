# Como Usar os Scripts de Aplicação do Schema v2.0

## 🚀 Opções de Execução

### Opção 1: Script PowerShell (Windows)

```powershell
# Navegar até o diretório database
cd database

# Executar script (solicitará senha do PostgreSQL)
.\apply-schema-v2.ps1

# Com parâmetros customizados
.\apply-schema-v2.ps1 -DatabaseName "meu_banco" -Username "meu_usuario" -Host "192.168.1.100" -Port 5432

# Pular confirmação (útil para automação)
.\apply-schema-v2.ps1 -SkipConfirm
```

**Parâmetros disponíveis:**
- `-DatabaseName`: Nome do banco de dados (padrão: `smartchannel_db`)
- `-Username`: Usuário PostgreSQL (padrão: `postgres`)
- `-Host`: Host do PostgreSQL (padrão: `localhost`)
- `-Port`: Porta do PostgreSQL (padrão: `5432`)
- `-SkipConfirm`: Pular confirmação (útil para scripts automatizados)

### Opção 2: Script Bash (Linux/Ubuntu)

```bash
# Navegar até o diretório database
cd database

# Dar permissão de execução (apenas primeira vez)
chmod +x apply-schema-v2.sh

# Executar script
./apply-schema-v2.sh

# Com variáveis de ambiente
DB_NAME="meu_banco" DB_USER="meu_usuario" DB_HOST="192.168.1.100" DB_PORT="5432" ./apply-schema-v2.sh

# Pular confirmação
SKIP_CONFIRM=true ./apply-schema-v2.sh
```

**Variáveis de ambiente:**
- `DB_NAME`: Nome do banco de dados (padrão: `smartchannel_db`)
- `DB_USER`: Usuário PostgreSQL (padrão: `postgres`)
- `DB_HOST`: Host do PostgreSQL (padrão: `localhost`)
- `DB_PORT`: Porta do PostgreSQL (padrão: `5432`)
- `PGPASSWORD`: Senha do PostgreSQL (ou será solicitada)
- `SKIP_CONFIRM`: `true` para pular confirmação

### Opção 3: Usando psql diretamente (Manual)

```bash
# Conectar ao banco
psql -U postgres -d smartchannel_db

# Executar script master
\i database/smartchannel-db-v2-refactored-apply-all.sql
```

Ou executar cada parte individualmente:

```bash
psql -U postgres -d smartchannel_db -f database/smartchannel-db-v2-refactored-part1-schema-setup.sql
psql -U postgres -d smartchannel_db -f database/smartchannel-db-v2-refactored-part2-tables-base.sql
# ... e assim por diante
```

## 📋 Pré-requisitos

1. **PostgreSQL Client instalado**
   - Windows: Incluído no PostgreSQL Server ou baixe o cliente standalone
   - Linux: `sudo apt-get install postgresql-client`

2. **Acesso ao banco de dados**
   - Usuário com permissões para criar tabelas, índices, triggers, etc.
   - Banco de dados criado (ou criar antes)

3. **Scripts SQL no diretório correto**
   - Todos os arquivos `part*.sql` devem estar no mesmo diretório

## ⚠️ IMPORTANTE

### ⚠️ Backup Antes de Executar

Este script **recria o banco do zero**. Faça backup antes:

```bash
# Backup
pg_dump -U postgres smartchannel_db > backup_antes_v2.sql

# Restaurar (se necessário)
psql -U postgres -d smartchannel_db < backup_antes_v2.sql
```

### ⚠️ Criar Banco Vazio (Recomendado)

Se você quer manter o banco antigo:

```bash
# Criar novo banco
createdb -U postgres smartchannel_db_v2

# Aplicar schema no novo banco
./apply-schema-v2.sh  # ou ajustar DB_NAME
```

## 🔍 Exemplos de Uso

### Exemplo 1: Aplicar em banco local

```bash
# Windows PowerShell
cd database
.\apply-schema-v2.ps1

# Linux
cd database
./apply-schema-v2.sh
```

### Exemplo 2: Aplicar em servidor remoto

```bash
# Windows PowerShell
.\apply-schema-v2.ps1 -Host "192.168.1.100" -DatabaseName "smartchannel_prod"

# Linux
DB_HOST="192.168.1.100" DB_NAME="smartchannel_prod" ./apply-schema-v2.sh
```

### Exemplo 3: Automação (sem confirmação)

```bash
# Windows PowerShell
.\apply-schema-v2.ps1 -SkipConfirm

# Linux
SKIP_CONFIRM=true ./apply-schema-v2.sh
```

### Exemplo 4: Com senha em variável de ambiente

```bash
# Linux (mais seguro que passar na linha de comando)
export PGPASSWORD="sua_senha_aqui"
./apply-schema-v2.sh

# Windows PowerShell
$env:PGPASSWORD = "sua_senha_aqui"
.\apply-schema-v2.ps1
```

## 🐛 Troubleshooting

### Erro: "psql não encontrado"

**Windows:**
- Adicione o PostgreSQL ao PATH:
  - `C:\Program Files\PostgreSQL\<versão>\bin`
- Ou use o caminho completo:
  - `& "C:\Program Files\PostgreSQL\15\bin\psql.exe" ...`

**Linux:**
```bash
sudo apt-get install postgresql-client
```

### Erro: "relation already exists"

O banco já tem tabelas. Opções:

1. **Dropar schema e recriar** (CUIDADO - perde todos os dados):
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
```

2. **Usar banco novo**:
```bash
createdb -U postgres smartchannel_db_v2
DB_NAME="smartchannel_db_v2" ./apply-schema-v2.sh
```

### Erro: "permission denied"

Verifique permissões do usuário PostgreSQL:

```sql
-- Conectar como superuser
psql -U postgres

-- Dar permissões
GRANT ALL PRIVILEGES ON DATABASE smartchannel_db TO seu_usuario;
GRANT ALL ON SCHEMA public TO seu_usuario;
```

### Erro: "password authentication failed"

Verifique:
- Usuário e senha corretos
- Configuração do `pg_hba.conf` permite conexão
- Firewall não está bloqueando

## ✅ Validação Após Execução

Após aplicar os scripts, valide:

```sql
-- Conectar ao banco
psql -U postgres -d smartchannel_db

-- Verificar tabelas criadas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- Verificar Foreign Keys
SELECT COUNT(*) as total_fks
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_type = 'FOREIGN KEY';

-- Verificar triggers
SELECT COUNT(*) as total_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Verificar versão do schema
SELECT * FROM schema_version ORDER BY applied_at DESC LIMIT 1;
```

## 📝 Notas

- Os scripts são executados em ordem sequencial
- Se um script falhar, a execução para automaticamente
- O script mostra progresso em tempo real
- Materialized Views precisam ser atualizadas periodicamente (ver README principal)

## 🆘 Suporte

Para problemas ou dúvidas, consulte:
- `README-V2-REFACTORED.md` - Documentação completa
- `docs/PLANO_ACAO_RENOMENACOES_METICULOSO.md` - Plano de implementação

