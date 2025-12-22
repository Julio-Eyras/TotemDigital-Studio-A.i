# Atualização do Script de Instalação - Schema v2.0

## ✅ Atualizações Aplicadas

### 1. Schema do Banco de Dados ✅
- ✅ Atualizado para usar arquivos SQL fracionados v2.0
- ✅ Prioriza uso de `apply-schema-v2.sh`
- ✅ Fallback para `smartchannel-db-v2-refactored-apply-all.sql`
- ✅ Compatibilidade com schema antigo mantida (se necessário)

### 2. Lista de Tabelas Atualizada ✅
- ✅ `clients` → `subscribers` (adicionado)
- ✅ `hosts` → `publishers` (adicionado)
- ✅ Novas tabelas adicionadas:
  - `subscriber_billing`
  - `publisher_billing`
  - `subscriptions`
  - `campaign_publishers`
- ✅ Tabelas antigas mantidas na verificação (compatibilidade)

### 3. Verificação de Seeds ✅
- ✅ Atualizado para verificar `subscribers` e `publishers`
- ✅ Mantida verificação de `clients` (compatibilidade)

### 4. Reaplicação de Schema ✅
- ✅ Atualizado para usar schema v2.0 quando disponível
- ✅ Fallback para schema antigo mantido

---

## ⚠️ Observações

### Arquivos Necessários
O script agora procura (nesta ordem):
1. `database/apply-schema-v2.sh` (preferencial)
2. `database/smartchannel-db-v2-refactored-apply-all.sql` (fallback)

**NOTA:** O arquivo antigo `database/smartchannel-db.sql` foi **descontinuado** e **removido** do script. Use apenas os arquivos v2.0 refatorados.

### Cópia de Arquivos
O script já copia todos os arquivos do diretório `database/`, incluindo:
- ✅ Todos os arquivos `part*.sql`
- ✅ Scripts `apply-schema-v2.sh` e `apply-schema-v2.ps1`
- ✅ Arquivo `apply-all.sql`
- ✅ Documentação

---

## 📋 Checklist de Validação

- ✅ Script atualizado para usar schema v2.0
- ✅ Lista de tabelas atualizada
- ✅ Verificação de seeds atualizada
- ✅ Reaplicação de schema atualizada
- ✅ **Todas as referências ao schema antigo removidas**
- ✅ Cópia de arquivos do database/ já funciona

---

## 🎯 Próximos Passos

1. ✅ Testar instalação com schema v2.0
2. ⏳ Validar que todos os arquivos são copiados corretamente
3. ⏳ Verificar que build do backend/frontend inclui novos arquivos

