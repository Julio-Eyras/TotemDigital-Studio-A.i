# Comandos para Parar Backend e Frontend
## Windows e Linux

---

## 🐳 **MODO DOCKER (Recomendado)**

### Linux

```bash
# Parar todos os serviços (backend + frontend)
docker compose down

# Parar apenas backend
docker compose stop backend

# Parar apenas frontend
docker compose stop frontend

# Parar e remover containers
docker compose down -v  # Remove volumes também
```

### Windows (PowerShell/CMD)

```powershell
# Parar todos os serviços
docker compose down

# Parar apenas backend
docker compose stop backend

# Parar apenas frontend
docker compose stop frontend

# Parar e remover containers
docker compose down -v
```

---

## 🔧 **MODO SYSTEMD (Linux - Serviços do Sistema)**

### Verificar se está rodando como serviço

```bash
# Verificar status
sudo systemctl status smart-signage
sudo systemctl status smartsignage-backend
sudo systemctl status smartsignage-frontend
```

### Parar serviços

```bash
# Parar backend
sudo systemctl stop smart-signage
# ou
sudo systemctl stop smartsignage-backend

# Parar frontend (se tiver serviço separado)
sudo systemctl stop smartsignage-frontend

# Desabilitar auto-start
sudo systemctl disable smart-signage
sudo systemctl disable smartsignage-backend
```

---

## 📦 **MODO NODE.JS DIRETO (Processos Node)**

### Linux

```bash
# Encontrar processos Node.js
ps aux | grep node
# ou
pgrep -f "node.*index.js"
pgrep -f "node.*backend"
pgrep -f "node.*frontend"

# Parar backend (porta 3000)
lsof -ti:3000 | xargs kill -9
# ou
pkill -f "node.*backend"
pkill -f "node.*dist/index.js"

# Parar frontend (porta 3001 ou 8080)
lsof -ti:3001 | xargs kill -9
lsof -ti:8080 | xargs kill -9
# ou
pkill -f "node.*frontend"

# Parar todos os processos Node do projeto
pkill -f "smartsignage"
```

### Windows (PowerShell)

```powershell
# Encontrar processos Node.js
Get-Process node -ErrorAction SilentlyContinue

# Parar backend (porta 3000)
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($process) { Stop-Process -Id $process -Force }

# Parar frontend (porta 3001 ou 8080)
$port = 3001  # ou 8080
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
if ($process) { Stop-Process -Id $process -Force }

# Parar todos os processos Node
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Windows (CMD)

```cmd
REM Encontrar processos na porta 3000
netstat -ano | findstr :3000

REM Parar processo por PID (substitua PID pelo número encontrado)
taskkill /PID <PID> /F

REM Parar todos os processos node
taskkill /IM node.exe /F
```

---

## 🛠️ **USANDO SCRIPTS DO PROJETO**

### Linux

```bash
# Usar script manage-system.sh
./manage-system.sh stop

# Ou se estiver em /opt/smart-signage
cd /opt/smart-signage
./manage-system.sh stop
```

### Windows

```cmd
REM Usar script manage-system.bat
manage-system.bat stop
```

---

## 🎯 **MÉTODOS POR PORTA**

### Linux

```bash
# Verificar o que está usando a porta
sudo lsof -i :3000  # Backend
sudo lsof -i :3001  # Frontend
sudo lsof -i :8080  # Frontend (alternativa)

# Parar processo na porta 3000 (Backend)
sudo kill -9 $(sudo lsof -t -i:3000)

# Parar processo na porta 3001/8080 (Frontend)
sudo kill -9 $(sudo lsof -t -i:3001)
sudo kill -9 $(sudo lsof -t -i:8080)
```

### Windows (PowerShell)

```powershell
# Verificar o que está usando a porta
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 3001
Get-NetTCPConnection -LocalPort 8080

# Parar processo na porta 3000 (Backend)
$proc = (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id $proc -Force

# Parar processo na porta 3001/8080 (Frontend)
$proc = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $proc -Force
```

---

## 🔍 **VERIFICAR SE PAROU**

### Linux

```bash
# Verificar processos
ps aux | grep node
ps aux | grep "smart-signage"

# Verificar portas
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :8080

# Verificar Docker
docker compose ps
```

### Windows

```powershell
# Verificar processos
Get-Process node -ErrorAction SilentlyContinue

# Verificar portas
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# Verificar Docker
docker compose ps
```

---

## 📋 **RESUMO RÁPIDO**

### Parar Tudo (Recomendado)

**Linux:**
```bash
docker compose down
# ou
sudo systemctl stop smart-signage
```

**Windows:**
```powershell
docker compose down
```

### Parar Apenas Backend

**Linux:**
```bash
docker compose stop backend
# ou
sudo systemctl stop smart-signage
# ou
sudo kill -9 $(sudo lsof -t -i:3000)
```

**Windows:**
```powershell
docker compose stop backend
# ou
$proc = (Get-NetTCPConnection -LocalPort 3000).OwningProcess
Stop-Process -Id $proc -Force
```

### Parar Apenas Frontend

**Linux:**
```bash
docker compose stop frontend
# ou
sudo kill -9 $(sudo lsof -t -i:3001)
sudo kill -9 $(sudo lsof -t -i:8080)
```

**Windows:**
```powershell
docker compose stop frontend
# ou
$proc = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $proc -Force
```

---

## ⚠️ **NOTAS IMPORTANTES**

1. **Docker Compose**: Método mais seguro e recomendado
2. **Systemd**: Use apenas se serviços foram instalados como systemd
3. **Kill -9**: Força parada imediata (pode causar perda de dados)
4. **Verificar antes**: Sempre verifique se processos pararam
5. **Backup**: Faça backup antes de parar serviços em produção

---

## 🚀 **REINICIAR APÓS PARAR**

### Linux

```bash
# Docker
docker compose up -d

# Systemd
sudo systemctl start smart-signage

# Node direto
cd /opt/smart-signage/backend && npm start &
cd /opt/smart-signage/frontend && npm start &
```

### Windows

```powershell
# Docker
docker compose up -d

# Node direto
cd backend; npm start
cd frontend; npm start
```

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
