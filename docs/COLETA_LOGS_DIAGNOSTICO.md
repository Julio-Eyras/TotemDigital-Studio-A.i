# Guia: Coleta de Logs e Diagnóstico - Auto-Registro de Totens

## 📋 Visão Geral

Este guia explica como coletar logs e informações para diagnosticar problemas no auto-registro de totens.

## 🚀 Método Rápido: Script Automático

Execute o script de diagnóstico:

```bash
cd /opt/smart-signage
sudo bash scripts/diagnose-player-registration.sh
```

O script irá:
1. Coletar informações do sistema
2. Verificar status do backend
3. Coletar logs do backend
4. Verificar banco de dados
5. Testar APIs
6. Coletar configurações
7. Criar guia para logs do player

**Saída:** Arquivos em `/tmp/smartsignage-diagnosis-YYYYMMDD-HHMMSS/`

---

## 📊 Coleta Manual de Logs

### 1. Logs do Backend

#### Via Systemd (Recomendado)

```bash
# Ver logs em tempo real
sudo journalctl -u smart-signage -f

# Ver últimas 100 linhas
sudo journalctl -u smart-signage -n 100

# Buscar por Request ID específico
sudo journalctl -u smart-signage | grep "REG-1234567890"

# Buscar erros de registro
sudo journalctl -u smart-signage | grep -i "register\|auto-registro\|REG-"

# Ver logs das últimas 24 horas
sudo journalctl -u smart-signage --since "24 hours ago"
```

#### Via Arquivo de Log

```bash
# Ver logs do arquivo
tail -f /opt/smart-signage/backend/logs/app.log

# Buscar por Request ID
grep "REG-1234567890" /opt/smart-signage/backend/logs/app.log

# Ver últimas 100 linhas
tail -n 100 /opt/smart-signage/backend/logs/app.log
```

### 2. Logs do Player (Console do Navegador)

1. **Abrir o player:**
   ```
   http://localhost/player/
   ```

2. **Abrir DevTools:**
   - Pressione `F12` ou `Ctrl+Shift+I` (Linux/Windows)
   - Ou `Cmd+Option+I` (Mac)

3. **Ir para a aba "Console"**

4. **Limpar o console:**
   - Clique no ícone de lixeira ou pressione `Ctrl+L`

5. **Recarregar a página:**
   - Pressione `F5` ou `Ctrl+R`

6. **Observar logs:**
   - Procure por logs que começam com `[PLAYER-xxx]` ou `[REG-xxx]`
   - Anote o Request ID (formato: `REG-1234567890-abc123`)

7. **Copiar logs:**
   - Clique com botão direito no console
   - Selecione "Save as..." ou copie manualmente
   - Ou use o filtro para mostrar apenas erros

#### Filtrar Logs no Console

- **Filtrar por Request ID:** Digite `REG-1234567890` na barra de filtro
- **Filtrar erros:** Digite `❌` ou `error` na barra de filtro
- **Filtrar registro:** Digite `auto-registro` ou `register` na barra de filtro

### 3. Logs do Banco de Dados

```bash
# Conectar ao banco
psql -h localhost -U smartsignage -d smartsignage

# Ver totens registrados recentemente
SELECT totem_id, identifier, uin, status, created_at, ip_address
FROM totems
ORDER BY created_at DESC
LIMIT 10;

# Ver totens pendentes de aprovação
SELECT totem_id, identifier, uin, status, created_at, config
FROM totems
WHERE status = 'pending_approval'
ORDER BY created_at DESC;

# Verificar se há erros de constraint
SELECT * FROM pg_stat_database WHERE datname = 'smartsignage';
```

### 4. Teste de API

```bash
# Testar health check
curl http://localhost:8080/api/health

# Testar hardware info
curl http://localhost:8080/api/player/hardware-info

# Testar registro (mock)
curl -X POST http://localhost:8080/api/player/register \
  -H "Content-Type: application/json" \
  -d '{
    "uin": "SSP-TEST-123",
    "hardware": {
      "macAddress": "00:00:00:00:00:00",
      "hostname": "test-hostname",
      "platform": "linux",
      "arch": "x64"
    }
  }'

# Ver logs de registro via API de debug
curl http://localhost:8080/api/debug/player-registration-logs

# Ver informações do sistema
curl http://localhost:8080/api/debug/system-info

# Ver informações de um totem específico
curl http://localhost:8080/api/debug/totem/1
```

---

## 🔍 Rastreamento de Request ID

Cada requisição de auto-registro tem um Request ID único:

- **Backend:** Formato `REG-1234567890-abc123`
- **Player:** Formato `PLAYER-1234567890-abc123`

### Como usar o Request ID:

1. **No player (console do navegador):**
   - Anote o Request ID que aparece nos logs
   - Exemplo: `[PLAYER-1234567890-abc123] 📡 Iniciando auto-registro...`

2. **No backend:**
   - Busque pelo mesmo Request ID nos logs
   - Exemplo: `[REG-1234567890-abc123] 📡 Iniciando auto-registro de totem`

3. **Rastrear a requisição completa:**
   ```bash
   # Buscar no backend
   sudo journalctl -u smart-signage | grep "REG-1234567890-abc123"
   
   # Buscar no arquivo de log
   grep "REG-1234567890-abc123" /opt/smart-signage/backend/logs/app.log
   ```

---

## 📤 Endpoints de Debug

### `/api/debug/player-registration-logs`

Lista totens registrados recentemente e logs do sistema:

```bash
curl http://localhost:8080/api/debug/player-registration-logs
```

**Resposta:**
```json
{
  "success": true,
  "totems": [
    {
      "id": 1,
      "identifier": "TOTEM-1",
      "uin": "SSP-1234567890",
      "status": "pending_approval",
      "createdAt": "2025-11-04T10:00:00Z",
      "ipAddress": "192.168.1.100",
      "hardware": {
        "mac": "00:00:00:00:00:00",
        "hostname": "totem-hostname"
      }
    }
  ],
  "systemLogs": [...],
  "count": 10
}
```

### `/api/debug/totem/:id`

Obter informações detalhadas de um totem:

```bash
curl http://localhost:8080/api/debug/totem/1
# ou por UIN
curl http://localhost:8080/api/debug/totem/SSP-1234567890
```

### `/api/debug/system-info`

Informações do sistema e estatísticas:

```bash
curl http://localhost:8080/api/debug/system-info
```

---

## 🐛 Problemas Comuns e Como Diagnosticar

### Problema 1: Player não consegue conectar ao backend

**Sintomas:**
- Console mostra: "Erro de conexão" ou "Failed to fetch"

**Diagnóstico:**
```bash
# Verificar se backend está rodando
sudo systemctl status smart-signage

# Verificar se porta está acessível
curl http://localhost:8080/api/health

# Verificar CORS
# (vá para Network tab no DevTools e veja headers da requisição)
```

**Logs relevantes:**
- Player: Console do navegador (Network tab)
- Backend: `journalctl -u smart-signage | grep CORS`

### Problema 2: Erro de validação

**Sintomas:**
- Resposta HTTP 400
- Mensagem: "Parâmetros inválidos"

**Diagnóstico:**
```bash
# Ver logs do backend com Request ID
sudo journalctl -u smart-signage | grep "REG-" | grep "validação"

# Verificar payload enviado pelo player
# (vá para Network tab no DevTools, clique na requisição, veja "Payload")
```

**Logs relevantes:**
- Backend: `[REG-xxx] ❌ Erros de validação:`
- Player: Console mostra payload enviado

### Problema 3: Erro ao inserir no banco de dados

**Sintomas:**
- Resposta HTTP 500
- Mensagem: "Erro interno do servidor"

**Diagnóstico:**
```bash
# Ver logs detalhados do backend
sudo journalctl -u smart-signage | grep "REG-" | grep -i "erro\|error"

# Verificar banco de dados
psql -h localhost -U smartsignage -d smartsignage -c "SELECT * FROM totems WHERE uin = 'SSP-xxx';"

# Verificar se tabela existe
psql -h localhost -U smartsignage -d smartsignage -c "\d totems"
```

**Logs relevantes:**
- Backend: `[REG-xxx] ❌ Erro ao inserir totem:`
- Backend: Stack trace completo

### Problema 4: Totem criado mas não encontrado após inserção

**Sintomas:**
- Resposta HTTP 500
- Mensagem: "Totem inserido mas não encontrado após criação"

**Diagnóstico:**
```bash
# Verificar se totem foi realmente inserido
psql -h localhost -U smartsignage -d smartsignage -c "
  SELECT totem_id, uin, identifier, status 
  FROM totems 
  WHERE uin = 'SSP-xxx';
"

# Ver logs do backend
sudo journalctl -u smart-signage | grep "REG-" | grep -i "encontrado\|found"
```

**Logs relevantes:**
- Backend: `[REG-xxx] ❌ Totem não encontrado após inserção!`
- Backend: `[REG-xxx] 🔍 Buscando totem criado...`

---

## 📝 Checklist de Informações para Reportar

Quando reportar um problema, inclua:

- [ ] **Request ID** do player e do backend (se disponível)
- [ ] **UIN gerado** (se houver)
- [ ] **Logs do console do navegador** (completo)
- [ ] **Logs do backend** (com Request ID)
- [ ] **Mensagem de erro completa** (do player e do backend)
- [ ] **Status HTTP** da resposta
- [ ] **Payload enviado** (do Network tab)
- [ ] **Resposta do servidor** (do Network tab)
- [ ] **Resultado do script de diagnóstico** (`diagnose-player-registration.sh`)
- [ ] **Screenshot** da tela de erro (se houver)
- [ ] **Configurações relevantes** (.env, sem senhas)

---

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
sudo journalctl -u smart-signage -f

# Buscar por erro específico
sudo journalctl -u smart-signage | grep -i "erro\|error"

# Ver últimas tentativas de registro
sudo journalctl -u smart-signage --since "10 minutes ago" | grep -i "register"

# Testar API de registro
curl -v -X POST http://localhost:8080/api/player/register \
  -H "Content-Type: application/json" \
  -d '{"uin":"SSP-TEST","hardware":{"macAddress":"00:00:00:00:00:00"}}'

# Ver totens no banco
psql -h localhost -U smartsignage -d smartsignage -c "SELECT * FROM totems;"

# Verificar configuração do Nginx
sudo nginx -t
cat /etc/nginx/sites-available/smart-signage
```

---

## 📞 Suporte

Se precisar de ajuda adicional:

1. Execute o script de diagnóstico: `scripts/diagnose-player-registration.sh`
2. Colete logs do player seguindo este guia
3. Anote o Request ID da tentativa falha
4. Envie todas as informações coletadas

**Última atualização:** 2025-11-04

