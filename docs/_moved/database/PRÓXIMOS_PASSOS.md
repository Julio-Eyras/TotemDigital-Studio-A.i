# Próximos Passos - Desenvolvimento do Banco de Dados

## 🎯 Objetivos Imediatos

### 1. ✅ Consolidar Processo
- [x] Definir `smartchannel-db-v2-refactored-apply-all.sql` como fonte única da verdade
- [x] Criar processo de trabalho documentado
- [x] Criar changelog

### 2. 🔧 Ferramentas de Suporte

#### A. Script de Validação SQL
Criar script para validar sintaxe do `smartchannel-db-v2-refactored-apply-all.sql`:
```bash
# Validar sintaxe PostgreSQL
psql -f smartchannel-db-v2-refactored-apply-all.sql --dry-run
```

#### B. Script de Comparação
Criar script para comparar schema atual vs arquivo:
```bash
# Gerar diff entre banco atual e arquivo
pg_dump --schema-only > current_schema.sql
diff current_schema.sql smartchannel-db-v2-refactored-apply-all.sql
```

#### C. Script de Aplicação
Criar script para aplicar alterações de forma segura:
```bash
# Aplicar apenas alterações novas (não destrutivas)
psql -f smartchannel-db-v2-refactored-apply-all.sql
```

### 3. 📚 Documentação

#### A. Mapeamento Completo
- [ ] Documentar todas as tabelas e relacionamentos
- [ ] Criar diagrama ER (Entity-Relationship)
- [ ] Documentar índices e performance

#### B. Guias de Uso
- [ ] Guia de queries comuns
- [ ] Guia de otimização
- [ ] Guia de backup e restore

### 4. 🔍 Melhorias Sugeridas

#### A. Performance
- [ ] Revisar índices existentes
- [ ] Adicionar índices compostos onde necessário
- [ ] Analisar queries lentas

#### B. Integridade
- [ ] Revisar constraints e foreign keys
- [ ] Adicionar check constraints onde apropriado
- [ ] Revisar cascades e on delete

#### C. Segurança
- [ ] Revisar permissões e roles
- [ ] Documentar políticas de acesso
- [ ] Implementar row-level security se necessário

## 🚀 Sugestões de Features Futuras

### 1. Sistema de Notificações
```sql
-- Tabela de notificações em tempo real
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 2. Sistema de Comentários/Anotações
```sql
-- Tabela para comentários em campanhas/mídias
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL, -- campaign, media, totem
    entity_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 3. Sistema de Favoritos
```sql
-- Tabela para favoritos de usuários
CREATE TABLE IF NOT EXISTS favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, entity_type, entity_id)
);
```

### 4. Histórico de Alterações
```sql
-- Tabela para versionamento de entidades
CREATE TABLE IF NOT EXISTS entity_versions (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    changes JSONB NOT NULL,
    changed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 5. Sistema de Templates
```sql
-- Tabela para templates reutilizáveis
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- campaign, playlist, media
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

## 📋 Checklist de Implementação

Ao implementar novas features:

- [ ] Adicionar tabelas no `smartchannel-db-v2-refactored-apply-all.sql`
- [ ] Adicionar índices apropriados
- [ ] Adicionar foreign keys
- [ ] Adicionar comentários
- [ ] Atualizar changelog
- [ ] Testar em desenvolvimento
- [ ] Documentar uso
- [ ] Adicionar/ajustar dados iniciais em `carga-inicial-db-smarsignage-v4.sql` se necessário (não usar migrations separadas)

## 🎯 Prioridades

1. **Alta Prioridade:**
   - Script de validação
   - Documentação de tabelas principais
   - Revisão de índices

2. **Média Prioridade:**
   - Sistema de notificações
   - Histórico de alterações
   - Templates

3. **Baixa Prioridade:**
   - Sistema de favoritos
   - Sistema de comentários
   - Melhorias de performance avançadas

## 📝 Notas

- Sempre manter `smartchannel-db-v2-refactored-apply-all.sql` como fonte única da verdade
- Testar todas as alterações em desenvolvimento primeiro
- Documentar decisões importantes
- Manter changelog atualizado

