# Integração do Sistema de Logs na Instalação
## Documentação de Integração

---

## ✅ **Integrações Realizadas**

### **1. Schema de Configurações de Logs**

A seção de configurações de logs contida no **schema refatorado** `database/smartchannel-db-v2-refactored-apply-all.sql` (antigo `logs-config-schema.sql`) foi integrada ao script de instalação:

- ✅ **Criação da tabela `system_settings`** (se não existir)
- ✅ **Aplicação automática** após o schema principal
- ✅ **Verificação de sucesso** após aplicação
- ✅ **Tratamento de erros** idempotente

**Localização no script:**
```bash
# Em setup_first_boot(), aplicar smartchannel-db-v2-refactored-apply-all.sql (schema refatorado)
# Linha ~3580 em install-smartsignage.sh
```

### **2. Instalação de Dependência**

A dependência `winston-daily-rotate-file` foi integrada na instalação de dependências:

- ✅ **Instalação automática** junto com outras dependências do backend
- ✅ **Verificação de sucesso** após instalação
- ✅ **Tratamento de erros** com aviso (não bloqueia instalação)

**Localização no script:**
```bash
# Em install_project_dependencies(), após npm install --include=dev
# Linha ~563 em install-smartsignage.sh
```

---

## 📋 **Fluxo de Instalação**

### **1. Instalação de Dependências (install_project_dependencies)**

```bash
cd $INSTALL_DIR/backend
npm install --include=dev

# Instalar dependência adicional do sistema de logs
npm install winston-daily-rotate-file --save
```

**Ordem de execução:**
1. Instalar dependências do backend (npm install --include=dev)
2. Instalar winston-daily-rotate-file
3. Compilar TypeScript
4. Instalar dependências do frontend
5. Build do frontend

### **2. Setup do Banco de Dados (setup_database)**

```bash
# Executar schema refatorado (inclui configurações de logs)
# NOTE: o apply-all usa comandos \i, então execute a partir do diretório database/
(cd "$INSTALL_DIR/database" && psql "$DATABASE_URL" -f "smartchannel-db-v2-refactored-apply-all.sql")

# Executar seed de dados
psql "$DATABASE_URL" -f "$INSTALL_DIR/database/carga-inicial-2025.sql"
```

**Ordem de execução:**
1. Criar schema refatorado (smartchannel-db-v2-refactored-apply-all.sql)
2. Executar seed de dados (carga-inicial-2025.sql)

---

## 🔍 **Verificações Implementadas**

### **1. Verificação de Schema de Logs**

Após aplicação do schema, o script verifica:
- ✅ Contagem de configurações de logs criadas
- ✅ Log de sucesso/aviso
- ✅ Não bloqueia instalação se já existir

```bash
LOGS_CONFIG_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM system_settings WHERE setting_key LIKE 'log.%';")
```

### **2. Verificação de Dependência**

Após instalação, o script verifica:
- ✅ Sucesso da instalação
- ✅ Log de sucesso/aviso
- ✅ Não bloqueia instalação se falhar (pode ser instalado manualmente depois)

---

## 📂 **Arquivos Modificados**

### **1. install-smartsignage.sh**

**Modificações:**

1. **install_project_dependencies()** (linha ~563)
   - Adicionada instalação de `winston-daily-rotate-file`
   - Verificação de sucesso
   - Tratamento de erros

2. **setup_first_boot()** (linha ~3580)
   - Execução única de `smartchannel-db-v2-refactored-apply-all.sql` (schema refatorado)
   - Verificação de configurações criadas
   - Tratamento de erros idempotente

### **2. database/smartchannel-db-v2-refactored-apply-all.sql**

**Modificações:**

1. **Criação da tabela `system_settings`**
   - Definição completa da tabela
   - Índices para performance
   - Trigger para `updated_at`
   - Comentários e documentação

2. **INSERT de configurações**
   - ON CONFLICT para idempotência
   - Configurações padrão de logs
   - Validações e opções

---

## ✅ **Checklist de Verificação**

Após instalação, verificar:

- [ ] Tabela `system_settings` existe no banco
- [ ] Configurações de logs foram criadas (9 configurações)
- [ ] Dependência `winston-daily-rotate-file` instalada no backend
- [ ] Diretório `/opt/smart-signage/Logs` existe
- [ ] Logger inicia corretamente no backend

---

## 🔧 **Comandos de Verificação**

### **Verificar Configurações de Logs:**

```bash
# Verificar configurações criadas
psql -U smartsignage -d smartsignage -c "SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'log.%' ORDER BY setting_key;"

# Verificar tabela system_settings
psql -U smartsignage -d smartsignage -c "\d system_settings"
```

### **Verificar Dependência:**

```bash
# Verificar se winston-daily-rotate-file está instalado
cd /opt/smart-signage/backend
npm list winston-daily-rotate-file
```

### **Verificar Diretório de Logs:**

```bash
# Verificar se diretório existe
ls -la /opt/smart-signage/Logs

# Verificar permissões
stat /opt/smart-signage/Logs
```

---

## 🎯 **Resultado Esperado**

Após instalação completa:

1. ✅ **Tabela `system_settings` criada** com 9 configurações de logs
2. ✅ **Dependência instalada** no backend
3. ✅ **Diretório de logs criado** automaticamente pelo logger
4. ✅ **Sistema de logs funcionando** com rotação automática
5. ✅ **Interface admin configurável** para logs

---

## 📝 **Notas Importantes**

1. **Idempotência**: O schema pode ser executado múltiplas vezes sem problemas
2. **Ordem Importante**: Schema de logs deve ser executado após schema principal
3. **Dependência Opcional**: Se falhar, pode ser instalada manualmente depois
4. **Diretório de Logs**: Criado automaticamente pelo logger na primeira execução

---

**Integração concluída e pronta para uso!**


