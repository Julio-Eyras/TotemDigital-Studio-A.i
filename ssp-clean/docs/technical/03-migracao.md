# Guia de Migração - SmartSignage Pro

## Migração de Dados

### Backup Antes de Migrar

```bash
# Backup completo do banco
pg_dump -U usuario banco_antigo > backup_antes_migracao.sql

# Backup apenas dados
pg_dump -U usuario -a banco_antigo > dados_backup.sql

# Backup apenas schema
pg_dump -U usuario -s banco_antigo > schema_backup.sql
```

## Migração de Versão

### De v1.x para v2.0/v2.1

#### 1. Backup Completo

```bash
pg_dump -U smartsignage smartsignage > backup_v1.sql
```

#### 2. Aplicar Novo Schema

```bash
cd database
# v2.1: usar scripts do schema refatorado (sem Prisma)
bash apply-schema-v2.sh
# Ou via install-smartsignage.sh (recomendado)
./scripts/install-smartsignage.sh
```

#### 3. Migrar Dados

```sql
-- Exemplo: Migrar campanhas
INSERT INTO campaigns (title, start_date, end_date, ...)
SELECT title, start_date, end_date, ...
FROM campaigns_old;

-- Migrar playlists
INSERT INTO playlists (name, subscriber_id, ...)
SELECT name, subscriber_id, ...
FROM playlists_old;
```

#### 4. Validar Dados

```sql
-- Verificar contagens
SELECT COUNT(*) FROM campaigns;
SELECT COUNT(*) FROM playlists;
SELECT COUNT(*) FROM medias;
SELECT COUNT(*) FROM totems;
```

## Migração de Servidor

### 1. Preparar Novo Servidor

```bash
# Instalar sistema no novo servidor
sudo bash scripts/install-smartsignage.sh
```

### 2. Transferir Dados

```bash
# No servidor antigo: Exportar dados
pg_dump -U smartsignage smartsignage > backup_completo.sql

# Transferir arquivo
scp backup_completo.sql usuario@novo-servidor:/tmp/

# No novo servidor: Importar dados
psql -U smartsignage smartsignage < /tmp/backup_completo.sql
```

### 3. Transferir Mídias

```bash
# No servidor antigo
tar -czf medias_backup.tar.gz /opt/smart-signage/public/assets/uploads

# Transferir
scp medias_backup.tar.gz usuario@novo-servidor:/tmp/

# No novo servidor
tar -xzf /tmp/medias_backup.tar.gz -C /opt/smart-signage/public/assets/
```

### 4. Atualizar Configurações

- Atualizar URLs em configurações
- Atualizar DNS (se aplicável)
- Testar totens com novo servidor

## Migração de Schema

### Adicionar Coluna

```sql
-- Exemplo: Adicionar playlist_id em event_logs
ALTER TABLE event_logs 
ADD COLUMN IF NOT EXISTS playlist_id INTEGER;
```

### Remover Coluna

```sql
-- Backup antes!
CREATE TABLE event_logs_backup AS SELECT * FROM event_logs;

-- Remover coluna
ALTER TABLE event_logs DROP COLUMN coluna_antiga;
```

### Renomear Tabela

```sql
-- Renomear
ALTER TABLE tabela_antiga RENAME TO tabela_nova;
```

## Migração de Mídias

### Migrar para Cloud Storage (S3)

1. **Configurar S3**

```env
AWS_ACCESS_KEY_ID=sua_chave
AWS_SECRET_ACCESS_KEY=sua_secreta
AWS_REGION=us-east-1
S3_BUCKET=smart-signage-media
```

2. **Script de Migração**

```bash
#!/bin/bash
MEDIA_DIR="/opt/smart-signage/public/assets/uploads"
S3_BUCKET="s3://smart-signage-media"

# Upload de arquivos
aws s3 sync "$MEDIA_DIR" "$S3_BUCKET" --exclude "*.tmp"
```

3. **Atualizar URLs no Banco**

```sql
UPDATE medias 
SET file_path = REPLACE(file_path, '/local/path', 'https://s3.amazonaws.com/bucket')
WHERE file_path LIKE '/local/path%';
```

## Migração de Usuários

### Exportar Usuários

```sql
-- Exportar para CSV
COPY (
  SELECT user_id, email, name, role, created_at
  FROM users
) TO '/tmp/usuarios.csv' WITH CSV HEADER;
```

### Importar Usuários

```sql
-- Importar do CSV
COPY users (email, name, role, created_at)
FROM '/tmp/usuarios.csv' WITH CSV HEADER;
```

**Nota**: Senhas precisam ser redefinidas (não migradas por segurança)

## Rollback

### Em Caso de Problemas

```bash
# Restaurar backup
psql -U smartsignage smartsignage < backup_antes_migracao.sql

# Restaurar mídias
tar -xzf medias_backup.tar.gz -C /opt/smart-signage/public/assets/

# Reiniciar serviços
sudo systemctl restart smart-signage
```

## Checklist de Migração

- [ ] Backup completo do banco
- [ ] Backup de mídias
- [ ] Backup de configurações
- [ ] Testar migração em ambiente de teste
- [ ] Validar dados após migração
- [ ] Testar funcionalidades críticas
- [ ] Atualizar documentação
- [ ] Comunicar mudanças aos usuários

## Próximos Passos

- [Instalação](./04-instalacao.md) - Guia de instalação
- [Desenvolvimento](./02-desenvolvimento.md) - Guia de desenvolvimento
- [API](./01-api.md) - Documentação da API
