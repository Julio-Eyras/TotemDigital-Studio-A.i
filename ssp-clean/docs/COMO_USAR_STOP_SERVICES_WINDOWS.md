# Como Usar stop-services.ps1 no Windows

## 🚀 Execução do Script

### Método 1: Executar Diretamente (Recomendado)

```powershell
# Navegar para o diretório do projeto
cd C:\SmartSignage-Pro

# Executar o script
.\scripts\stop-services.ps1

# Ou especificar o serviço
.\scripts\stop-services.ps1 all
.\scripts\stop-services.ps1 backend
.\scripts\stop-services.ps1 frontend
```

### Método 2: Executar com Caminho Completo

```powershell
# Executar com caminho absoluto
& "C:\SmartSignage-Pro\scripts\stop-services.ps1" all
```

### Método 3: Executar com PowerShell Explicitamente

```powershell
# Se o script não executar, use:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\stop-services.ps1
```

---

## ⚠️ Problemas Comuns

### Erro: "não é reconhecido como nome de cmdlet"

**Causa:** PowerShell não está encontrando o arquivo.

**Solução:**
```powershell
# 1. Verificar se o arquivo existe
Test-Path .\scripts\stop-services.ps1

# 2. Verificar se está no diretório correto
Get-Location

# 3. Executar com caminho completo
& "$PWD\scripts\stop-services.ps1"
```

### Erro: "execução de scripts está desabilitada"

**Causa:** Política de execução do PowerShell.

**Solução:**
```powershell
# Verificar política atual
Get-ExecutionPolicy

# Se for "Restricted", alterar temporariamente:
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# Ou executar com bypass:
powershell.exe -ExecutionPolicy Bypass -File .\scripts\stop-services.ps1
```

### Erro: "arquivo não encontrado"

**Causa:** Caminho incorreto ou arquivo não existe.

**Solução:**
```powershell
# Verificar se está no diretório raiz do projeto
Get-ChildItem docker-compose.yml
Get-ChildItem package.json

# Se não estiver, navegar para o diretório correto
cd C:\SmartSignage-Pro
```

---

## 🔧 Alternativas Rápidas (Sem Script)

### Parar via Docker Compose

```powershell
# Parar tudo
docker compose down

# Parar apenas backend
docker compose stop backend

# Parar apenas frontend
docker compose stop frontend
```

### Parar por Porta

```powershell
# Parar backend (porta 3000)
$proc = (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess
if ($proc) { Stop-Process -Id $proc -Force }

# Parar frontend (porta 3001)
$proc = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess
if ($proc) { Stop-Process -Id $proc -Force }
```

### Parar Todos os Processos Node

```powershell
# Parar todos os processos Node.js
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## ✅ Verificar se Parou

```powershell
# Verificar processos Node
Get-Process node -ErrorAction SilentlyContinue

# Verificar portas
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue

# Verificar Docker
docker compose ps
```

---

## 📝 Exemplo Completo

```powershell
# 1. Navegar para o diretório do projeto
cd C:\SmartSignage-Pro

# 2. Verificar se está no lugar certo
Get-ChildItem docker-compose.yml, package.json

# 3. Executar o script
.\scripts\stop-services.ps1 all

# 4. Verificar se parou
docker compose ps
Get-Process node -ErrorAction SilentlyContinue
```

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
