# 🚀 Sistema Iniciado Localmente

## ✅ Status

O sistema Smart Signage Pro foi iniciado localmente em modo desenvolvimento.

## 📍 Acessos

- **Backend API:** http://localhost:3000
- **Frontend:** http://localhost:3001
- **API Docs:** http://localhost:3000/api-docs
- **Health Check:** http://localhost:3000/api/health

## 🔧 Serviços Iniciados

### Backend (Node.js/Express)
- **Porta:** 3000
- **Modo:** Desenvolvimento (nodemon)
- **Logs:** `backend/logs/backend.log` ou console

### Frontend (React)
- **Porta:** 3001
- **Modo:** Desenvolvimento (react-scripts)
- **Logs:** Console da janela PowerShell

## 📋 Próximos Passos

1. **Aguardar inicialização completa** (pode levar 30-60 segundos)
2. **Acessar o frontend** em http://localhost:3001
3. **Verificar logs** se houver problemas

## 🛑 Para Parar os Serviços

1. Feche as janelas do PowerShell que foram abertas
2. Ou execute:
   ```powershell
   Get-Process | Where-Object {$_.Path -like "*node*"} | Stop-Process -Force
   ```

## 🔍 Verificar Status

```powershell
# Verificar portas
Get-NetTCPConnection -LocalPort 3000,3001 | Select-Object LocalPort, State

# Verificar processos Node
Get-Process node | Select-Object Id, ProcessName, Path

# Testar backend
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```

## ⚠️ Problemas Comuns

### Backend não inicia
- Verifique se o PostgreSQL está rodando
- Verifique o arquivo `backend/.env`
- Veja os logs em `backend/logs/backend.log`

### Frontend não inicia
- Verifique se a porta 3001 está livre
- Verifique se as dependências foram instaladas (`frontend/node_modules`)
- Veja os logs no console do PowerShell

### Banco de dados não conecta
- Verifique se o PostgreSQL está rodando: `Get-Service postgresql*`
- Verifique as credenciais em `backend/.env`
- Teste a conexão: `psql -U postgres -d smartsignage`

## 📝 Notas

- Os serviços foram iniciados em janelas PowerShell separadas
- O backend usa `nodemon` para auto-reload em desenvolvimento
- O frontend usa `react-scripts` com hot-reload
- Logs são exibidos nos consoles das janelas PowerShell
