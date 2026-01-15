# Processo de Alterações no Banco de Dados

## 📋 Diretriz Principal

**A partir de agora, todas as alterações no schema do banco de dados devem ser feitas diretamente no arquivo `smartchannel-db-v2-refactored-apply-all.sql`.**

O arquivo `smartchannel-db-v2-refactored-apply-all.sql` é a **fonte única da verdade** para o schema do banco de dados.

## 🔄 Processo de Trabalho

### 1. Fazer Alterações
- ✅ Editar diretamente `database/smartchannel-db-v2-refactored-apply-all.sql`
- ✅ Usar `CREATE TABLE IF NOT EXISTS` para novas tabelas
- ✅ Usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para novas colunas
- ✅ Usar `CREATE INDEX IF NOT EXISTS` para novos índices
- ✅ Sempre adicionar comentários (`COMMENT ON TABLE/COLUMN`)

### 2. Estrutura de Alterações
```sql
-- =============================================
-- NOME DA FEATURE (v2.X)
-- =============================================
-- Descrição breve da alteração
-- Data: YYYY-MM-DD

-- Tabelas
CREATE TABLE IF NOT EXISTS nova_tabela (
    ...
);

-- Modificações em tabelas existentes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tabela_existente' AND column_name = 'nova_coluna') THEN
        ALTER TABLE tabela_existente ADD COLUMN nova_coluna TEXT;
    END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_nova_tabela_campo ON nova_tabela(campo);

-- Comentários
COMMENT ON TABLE nova_tabela IS 'Descrição da tabela';
```

### 3. Ordem de Inserção
- Adicionar novas seções no **final do arquivo**, antes do último comentário
- Manter organização por módulos/features
- Usar seções claras com `-- =============================================`

### 4. Versionamento
- Atualizar o cabeçalho do arquivo com data
- Adicionar comentário na seção descrevendo a versão

## 📝 Checklist de Alterações

Antes de considerar uma alteração completa:

- [ ] Tabelas criadas com `IF NOT EXISTS`
- [ ] Colunas adicionadas com verificação de existência
- [ ] Índices criados com `IF NOT EXISTS`
- [ ] Foreign keys com verificações de existência
- [ ] Comentários adicionados (tabelas e colunas importantes)
- [ ] Cabeçalho do arquivo atualizado
- [ ] Testado em ambiente de desenvolvimento
- [ ] Documentação atualizada (se necessário)

## 🚫 O que NÃO fazer

- ❌ Criar arquivos de migration separados
- ❌ Criar diretório `migrations/` - tudo deve estar em `smartchannel-db-v2-refactored-apply-all.sql`
- ❌ Duplicar código em arquivos separados
- ❌ Esquecer de usar `IF NOT EXISTS`

## ✅ O que fazer

- ✅ Editar apenas `smartchannel-db-v2-refactored-apply-all.sql` (fonte única da verdade)
- ✅ Documentar alterações significativas
- ✅ Testar em ambiente de desenvolvimento primeiro
- ✅ Usar transações (`DO $$ ... END $$`) para alterações condicionais
- ✅ Sistema sendo criado do zero - tudo consolidado em um único arquivo

## 🔍 Verificação

Após fazer alterações:

1. Verificar sintaxe SQL
2. Testar em banco de desenvolvimento
3. Verificar se não há conflitos com estruturas existentes
4. Atualizar documentação se necessário

## 📚 Exemplo de Alteração

```sql
-- =============================================
-- NOTIFICATIONS SYSTEM (v2.2)
-- =============================================
-- Sistema de notificações em tempo real
-- Data: 2025-01-XX

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info', -- info, warning, error, success
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Comentários
COMMENT ON TABLE notifications IS 'Sistema de notificações em tempo real para usuários';
COMMENT ON COLUMN notifications.type IS 'Tipo: info, warning, error, success';
```

## 🎯 Próximos Passos Sugeridos

1. **Criar script de validação** - Verificar sintaxe do arquivo
2. **Criar script de diff** - Comparar schema atual vs arquivo
3. **Documentar estrutura atual** - Mapear todas as tabelas e relacionamentos
4. **Criar changelog** - Registrar alterações significativas

