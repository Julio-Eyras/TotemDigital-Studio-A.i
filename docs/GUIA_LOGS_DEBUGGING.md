# Guia de Logs e Debugging - SmartSignage Pro

## 📍 Localização dos Logs

### Diretórios de Log (em ordem de prioridade):

1. **Diretório Principal** (padrão):
   ```bash
   /opt/smart-signage/Logs/
   ```

2. **Diretório Fallback** (se não tiver permissão em /opt):
   ```bash
   ~/.smart-signage/logs
   # ou
   $HOME/.smart-signage/logs
   ```

3. **Diretório Temporário** (último recurso):
   ```bash
   /tmp/smart-signage-logs
   ```

### Arquivos de Log Disponíveis:

#### Logs Principais:
- **`app-current.log`** - Link simbólico para o log mais recente (todos os níveis)
- **`app-YYYY-MM-DD.log`** - Logs diários rotacionados
- **`error-current.log`** - Link simbólico para erros mais recentes
- **`error-YYYY-MM-DD.log`** - Logs de erro diários

#### Logs Especiais:
- **`exceptions-YYYY-MM-DD.log`** - Exceções não capturadas
- **`rejections-YYYY-MM-DD.log`** - Promises rejeitadas não tratadas

## 🔍 Como Verificar Logs

### 1. Logs em Tempo Real (tail):
```bash
# Log geral mais recente
tail -f /opt/smart-signage/Logs/app-current.log

# Apenas erros
tail -f /opt/smart-signage/Logs/error-current.log

# Últimas 100 linhas
tail -n 100 /opt/smart-signage/Logs/app-current.log
```

### 2. Buscar Erros Específicos:
```bash
# Buscar por "campanha" ou "campaign"
grep -i "campaign\|campanha" /opt/smart-signage/Logs/app-current.log

# Buscar erros de criação de campanha
grep -i "criar campanha\|createCampaign" /opt/smart-signage/Logs/error-current.log

# Buscar erros nas últimas 24 horas
grep -i "error" /opt/smart-signage/Logs/app-$(date +%Y-%m-%d).log
```

### 3. Verificar Logs do Backend (console):
Se o backend estiver rodando como serviço systemd:
```bash
# Ver logs do serviço
sudo journalctl -u smartsignage-backend -f

# Últimas 100 linhas
sudo journalctl -u smartsignage-backend -n 100
```

### 4. Logs do Banco de Dados:
```bash
# PostgreSQL (se habilitado)
sudo tail -f /var/log/postgresql/postgresql-*.log

# Ou via psql
psql -U smartsignage -d smartsignage -c "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50;"
```

## 🐛 Debugging de Cadastro de Campanha

### Verificar Logs da API:
```bash
# Buscar logs relacionados a campanhas
grep -i "POST /api/campaigns\|campaign" /opt/smart-signage/Logs/app-current.log | tail -50

# Buscar erros específicos
grep -A 10 "Erro ao criar campanha" /opt/smart-signage/Logs/error-current.log
```

### Verificar Console do Navegador:
1. Abra o DevTools (F12)
2. Vá para a aba **Console**
3. Tente cadastrar uma campanha
4. Verifique mensagens de erro

### Verificar Network (Requisições):
1. Abra o DevTools (F12)
2. Vá para a aba **Network**
3. Filtre por "campaigns"
4. Clique na requisição POST `/api/campaigns`
5. Verifique:
   - **Status Code** (deve ser 201 ou mostrar erro)
   - **Response** (conteúdo da resposta)
   - **Request Payload** (dados enviados)

### Verificar Resposta da API:
```bash
# Testar endpoint diretamente (substitua TOKEN pelo seu JWT)
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "title": "Teste Campanha",
    "description": "Descrição teste",
    "campaign_type": "standard",
    "status": "draft",
    "clientId": 1
  }'
```

## 🔧 Verificações Comuns

### 1. Verificar se o Diretório de Logs Existe:
```bash
ls -la /opt/smart-signage/Logs/
# ou
ls -la ~/.smart-signage/logs/
```

### 2. Verificar Permissões:
```bash
ls -la /opt/smart-signage/Logs/app-current.log
# Deve ter permissão de leitura
```

### 3. Verificar Configuração de Log:
```bash
# Ver variável de ambiente LOG_LEVEL
echo $LOG_LEVEL
# ou
cat /opt/smart-signage/backend/.env | grep LOG_LEVEL
```

### 4. Verificar Últimas Entradas no Banco:
```bash
# Ver última campanha criada (ou tentativa)
psql -U smartsignage -d smartsignage -c "
SELECT campaign_id, title, status, created_at 
FROM campaigns 
ORDER BY created_at DESC 
LIMIT 10;"

# Ver logs de auditoria
psql -U smartsignage -d smartsignage -c "
SELECT * FROM audit_logs 
WHERE entity_type = 'campaign' 
ORDER BY created_at DESC 
LIMIT 20;"
```

## 📊 Níveis de Log

Os níveis de log configuráveis são:
- **`error`** - Apenas erros
- **`warn`** - Avisos e erros
- **`info`** - Informações, avisos e erros
- **`debug`** - Tudo (mais verboso)

### Alterar Nível de Log:
```bash
# Editar .env
nano /opt/smart-signage/backend/.env

# Adicionar/alterar:
LOG_LEVEL=debug

# Reiniciar serviço
sudo systemctl restart smartsignage-backend
```

## 🚨 Problemas Comuns

### 1. Logs Não Estão Sendo Gerados:
- Verifique permissões do diretório
- Verifique se o serviço está rodando
- Verifique LOG_LEVEL no .env

### 2. Não Consigo Ver Erros:
- Aumente LOG_LEVEL para `debug`
- Verifique arquivo `error-current.log` separadamente
- Verifique console do navegador

### 3. Logs Muito Grandes:
- Logs são rotacionados automaticamente
- Configuração padrão: 100MB por arquivo, 30 dias de retenção
- Verifique configuração em `system_settings`:
  ```sql
  SELECT * FROM system_settings WHERE setting_key LIKE 'log.rotation.%';
  ```

## 📝 Exemplos de Comandos Úteis

```bash
# Ver últimas 50 linhas de erro
tail -n 50 /opt/smart-signage/Logs/error-current.log

# Buscar campanha específica nos logs
grep -i "campaign.*123" /opt/smart-signage/Logs/app-current.log

# Ver logs das últimas 2 horas
grep "$(date -d '2 hours ago' '+%Y-%m-%d %H')" /opt/smart-signage/Logs/app-$(date +%Y-%m-%d).log

# Contar quantos erros hoje
grep -c "ERROR" /opt/smart-signage/Logs/app-$(date +%Y-%m-%d).log

# Ver logs do sistema (systemd)
sudo journalctl -u smartsignage-backend --since "1 hour ago"
```

## 🔐 Acesso Remoto aos Logs

Se precisar acessar logs remotamente, use a API de logs:
```bash
# Listar arquivos de log disponíveis
curl http://localhost:3000/api/logs/files

# Ver configuração de logs
curl http://localhost:3000/api/logs/config

# Verificar espaço em disco dos logs
curl http://localhost:3000/api/logs/disk-space
```

