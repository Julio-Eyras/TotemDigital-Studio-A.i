# Database - SmartSignage Pro

## 📁 Estrutura

```
database/
├── smartchannel-db-v2-refactored-apply-all.sql          # ⭐ Schema completo (FONTE ÚNICA DA VERDADE)
├── carga-inicial-db-smarsignage-v4.sql  # Carga inicial principal (seeds v4)
├── scripts/                      # Scripts utilitários
│   ├── validate-schema.sh        # Validação (Linux/Mac)
│   ├── validate-schema.ps1       # Validação (Windows)
│   ├── apply-schema.sh           # Aplicar schema (Linux/Mac)
│   └── apply-schema.ps1          # Aplicar schema (Windows)
├── PROCESSO_ALTERACOES_BANCO.md  # Processo de trabalho
├── CHANGELOG.md                  # Histórico de alterações
├── PRÓXIMOS_PASSOS.md            # Roadmap e sugestões
├── DOCUMENTACAO_TABELAS.md       # Documentação completa das tabelas
├── MIGRATIONS_INTEGRADAS.md      # Documentação de migrations integradas
└── README.md                     # Este arquivo
```

## 🎯 Diretriz Principal

**Todas as alterações no schema do banco de dados devem ser feitas diretamente no arquivo `smartchannel-db-v2-refactored-apply-all.sql`.**

Este arquivo é a **fonte única da verdade** para o schema do banco de dados.

## 🚀 Como Usar

### Aplicar Schema Completo

```bash
# PostgreSQL
psql -U postgres -d smartsignage -f smartchannel-db-v2-refactored-apply-all.sql

# Ou com variáveis de ambiente
psql $DATABASE_URL -f smartchannel-db-v2-refactored-apply-all.sql
```

### Verificar Sintaxe

```bash
# Linux/Mac
./database/scripts/validate-schema.sh

# Windows (PowerShell)
.\database\scripts\validate-schema.ps1

# Ou manualmente
psql -f smartchannel-db-v2-refactored-apply-all.sql --dry-run
```

### Aplicar Schema (Interativo)

```bash
# Linux/Mac
./database/scripts/apply-schema.sh

# Windows (PowerShell)
.\database\scripts\apply-schema.ps1
```

### Aplicar em Banco Existente

O arquivo usa `IF NOT EXISTS` e verificações condicionais, então pode ser executado múltiplas vezes sem problemas.

## 📚 Documentação

- **PROCESSO_ALTERACOES_BANCO.md** - Como fazer alterações
- **CHANGELOG.md** - Histórico de alterações
- **PRÓXIMOS_PASSOS.md** - Roadmap e sugestões
- **MIGRATIONS_INTEGRADAS.md** - Migrations já integradas

## 🔄 Processo de Trabalho

1. **Fazer alterações** diretamente em `smartchannel-db-v2-refactored-apply-all.sql`
2. **Usar `IF NOT EXISTS`** para todas as estruturas
3. **Adicionar comentários** explicativos
4. **Atualizar CHANGELOG.md** com as alterações
5. **Testar** em ambiente de desenvolvimento
6. **Aplicar** em produção

## ⚠️ Importante

- ❌ **NÃO** criar novas migrations separadas
- ✅ **SIM** editar apenas `smartchannel-db-v2-refactored-apply-all.sql`
- ✅ **SIM** documentar alterações significativas
- ✅ **Sistema sendo criado do zero** - tudo consolidado em `smartchannel-db-v2-refactored-apply-all.sql`

## 📊 Estatísticas Atuais

- **Tabelas:** 50+
- **Índices:** 100+
- **Views:** 15+
- **Triggers:** 20+
- **Versão atual:** v2.1

## 🛠️ Ferramentas Recomendadas

- **pgAdmin** - Interface gráfica
- **DBeaver** - Gerenciador de banco universal
- **psql** - CLI do PostgreSQL
- **pg_dump** - Backup e exportação

## 📝 Exemplo de Alteração

```sql
-- =============================================
-- NOVA FEATURE (v2.X)
-- =============================================
-- Descrição da feature
-- Data: YYYY-MM-DD

CREATE TABLE IF NOT EXISTS nova_tabela (
    id SERIAL PRIMARY KEY,
    ...
);

CREATE INDEX IF NOT EXISTS idx_nova_tabela_campo ON nova_tabela(campo);

COMMENT ON TABLE nova_tabela IS 'Descrição';
```

## 🔗 Links Úteis

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [SQL Style Guide](https://www.sqlstyle.guide/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)

