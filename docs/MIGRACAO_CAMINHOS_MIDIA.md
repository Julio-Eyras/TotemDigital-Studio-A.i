# Migração de Caminhos de Mídia: client-X → subscriber-X

## 📋 Visão Geral

Este guia descreve como migrar os arquivos de mídia e atualizar os caminhos no banco de dados de `client-X` para `subscriber-X`, mantendo compatibilidade com o novo sistema.

---

## 🎯 Por que migrar?

- **Consistência**: O sistema agora usa `subscriber` em vez de `client` em toda a arquitetura
- **Novos arquivos**: Arquivos novos já são salvos em `subscriber-X`
- **Compatibilidade**: O código já suporta ambos os formatos, mas é recomendado migrar para consistência

---

## 🚀 Método 1: Script Automatizado (Recomendado)

### Passo 1: Executar Script de Migração

```bash
cd /home/smartchannel/SmartSignage-Pro

# Modo DRY RUN (simulação - recomendado primeiro)
DRY_RUN=true ./scripts/migrate-media-paths-client-to-subscriber.sh

# Execução real
./scripts/migrate-media-paths-client-to-subscriber.sh
```

O script irá:
- ✅ Encontrar todos os diretórios `client-X`
- ✅ Migrar arquivos para `subscriber-X`
- ✅ Atualizar caminhos no banco de dados
- ✅ Manter compatibilidade com arquivos existentes

### Passo 2: Verificar Resultado

O script mostrará um resumo do que foi migrado. Verifique:
- ✅ Arquivos migrados corretamente
- ✅ Banco de dados atualizado
- ✅ Nenhum erro durante a migração

---

## 🔧 Método 2: Manual (Passo a Passo)

### Passo 1: Migrar Arquivos Físicos

```bash
# Definir diretório base
UPLOADS_BASE="/opt/smart-signage/public/assets/uploads"

# Para cada diretório client-X encontrado
for client_dir in $UPLOADS_BASE/client-*; do
    if [ -d "$client_dir" ]; then
        client_id=$(basename "$client_dir" | sed 's/client-//')
        subscriber_dir="$UPLOADS_BASE/subscriber-${client_id}"
        
        echo "Migrando client-${client_id} → subscriber-${client_id}"
        
        # Criar diretório subscriber se não existir
        mkdir -p "$subscriber_dir"
        
        # Mover conteúdo
        mv "$client_dir"/* "$subscriber_dir/" 2>/dev/null || true
        
        # Remover diretório vazio
        rmdir "$client_dir" 2>/dev/null || true
    fi
done
```

### Passo 2: Atualizar Banco de Dados

```bash
# Conectar ao banco
psql -U smartsignage -d smartsignage -h localhost

# Ou usar o script SQL
psql -U smartsignage -d smartsignage -f database/migrations/016-update-media-paths-client-to-subscriber.sql
```

---

## 📊 Verificação Pós-Migração

### 1. Verificar Arquivos Físicos

```bash
# Verificar se ainda existem diretórios client-X
ls -la /opt/smart-signage/public/assets/uploads/client-* 2>/dev/null

# Verificar diretórios subscriber-X
ls -la /opt/smart-signage/public/assets/uploads/subscriber-* 2>/dev/null
```

### 2. Verificar Banco de Dados

```sql
-- Verificar caminhos atualizados
SELECT 
    COUNT(*) FILTER (WHERE file_path LIKE '%/client-%') as paths_ainda_client,
    COUNT(*) FILTER (WHERE file_path LIKE '%/subscriber-%') as paths_subscriber,
    COUNT(*) as total
FROM medias;

-- Ver mídias que ainda têm caminhos antigos (se houver)
SELECT media_id, name, file_path 
FROM medias 
WHERE file_path LIKE '%/client-%'
LIMIT 10;
```

### 3. Testar Sistema

- ✅ Fazer upload de nova mídia (deve ir para `subscriber-X`)
- ✅ Visualizar mídias existentes (devem carregar corretamente)
- ✅ Editar mídia e alterar status (deve funcionar sem erros)

---

## ⚠️ Notas Importantes

### Compatibilidade

O sistema já possui compatibilidade automática:
- ✅ Arquivos em `client-X` ainda funcionam (verificação automática)
- ✅ Arquivos em `subscriber-X` funcionam normalmente
- ✅ Novos arquivos vão para `subscriber-X`

### Backup

**IMPORTANTE**: Faça backup antes de migrar:

```bash
# Backup dos arquivos
tar -czf backup-uploads-$(date +%Y%m%d).tar.gz /opt/smart-signage/public/assets/uploads/

# Backup do banco de dados
pg_dump -U smartsignage smartsignage > backup-db-$(date +%Y%m%d).sql
```

### Rollback

Se precisar reverter:

```bash
# Reverter arquivos (exemplo para subscriber-1)
mv /opt/smart-signage/public/assets/uploads/subscriber-1 \
   /opt/smart-signage/public/assets/uploads/client-1

# Reverter banco de dados
psql -U smartsignage -d smartsignage <<EOF
UPDATE medias 
SET file_path = REPLACE(file_path, '/subscriber-', '/client-') 
WHERE file_path LIKE '%/subscriber-%';
EOF
```

---

## 🐛 Troubleshooting

### Erro: "Diretório não encontrado"

Verifique se o caminho está correto:
```bash
echo $UPLOADS_BASE_PATH
# Deve mostrar: /opt/smart-signage/public/assets/uploads
```

### Erro: "Permissão negada"

Execute com permissões adequadas:
```bash
sudo ./scripts/migrate-media-paths-client-to-subscriber.sh
```

### Arquivos não aparecem após migração

1. Verifique se os arquivos foram movidos corretamente
2. Verifique permissões dos arquivos
3. Verifique se o banco de dados foi atualizado
4. Limpe cache do navegador

---

## ✅ Checklist de Migração

- [ ] Backup dos arquivos criado
- [ ] Backup do banco de dados criado
- [ ] Script executado em modo DRY RUN primeiro
- [ ] Migração executada com sucesso
- [ ] Arquivos físicos migrados
- [ ] Banco de dados atualizado
- [ ] Verificação pós-migração realizada
- [ ] Sistema testado e funcionando

---

## 📞 Suporte

Se encontrar problemas durante a migração:
1. Verifique os logs do script
2. Verifique permissões de arquivos
3. Verifique logs do backend
4. Consulte a documentação técnica
