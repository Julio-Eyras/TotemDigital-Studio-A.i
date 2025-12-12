# Smart Signage Pro - Instalação no Windows

Este guia explica como instalar o Smart Signage Pro em sistemas Windows usando o script PowerShell `install-smartsignage.ps1`.

## 📋 Pré-requisitos

- **Windows 10 ou superior**
- **PowerShell 5.1 ou superior** (já incluído no Windows 10+)
- **Privilégios de Administrador**
- **Conexão com a Internet** (para download de dependências)

## 🚀 Instalação Rápida

### 1. Abrir PowerShell como Administrador

1. Pressione `Win + X`
2. Selecione **"Windows PowerShell (Admin)"** ou **"Terminal (Admin)"**
3. Navegue até o diretório do projeto:
   ```powershell
   cd C:\SmartSignage-Pro
   ```

### 2. Executar o Script de Instalação

```powershell
.\install-smartsignage.ps1
```

O script irá:
- ✅ Verificar e instalar dependências (Node.js, PostgreSQL, Docker, Git)
- ✅ Configurar o banco de dados PostgreSQL
- ✅ Instalar dependências do projeto (npm install)
- ✅ Compilar backend (TypeScript) e frontend (React)
- ✅ Configurar firewall do Windows
- ✅ Configurar serviços e containers Docker

## 📖 Opções de Instalação

### Modos de Instalação

O script oferece dois modos:

1. **Single-Server** (Recomendado para desenvolvimento)
   - Instala tudo diretamente no Windows
   - Usa serviços Windows nativos
   - Mais fácil para desenvolvimento e debug

2. **Docker** (Recomendado para produção)
   - Usa Docker Desktop
   - Containers isolados
   - Mais fácil de gerenciar e atualizar

### Opções de Linha de Comando

```powershell
# Instalação completa do zero
.\install-smartsignage.ps1 --fresh

# Rebuild preservando dados
.\install-smartsignage.ps1 --rebuild

# Rebuild sem cache Docker
.\install-smartsignage.ps1 --rebuild-cache

# Apenas rebuild, não inicia serviços
.\install-smartsignage.ps1 --rebuild-only

# Forçar rebuild sempre
.\install-smartsignage.ps1 --force

# Pular menu interativo (usa Docker)
.\install-smartsignage.ps1 --skip-menu

# Habilitar HTTPS com certificado autoassinado
.\install-smartsignage.ps1 --https-self-signed

# Resetar banco de dados
.\install-smartsignage.ps1 --reset-db

# Carregar dados de demonstração
.\install-smartsignage.ps1 --load-seeds

# Mostrar ajuda
.\install-smartsignage.ps1 --help
```

## 🔧 Dependências Instaladas Automaticamente

O script instala automaticamente via Chocolatey:

- **Node.js 18.x LTS** - Runtime JavaScript
- **PostgreSQL 16** - Banco de dados
- **Docker Desktop** - Containerização
- **Git** - Controle de versão
- **Chocolatey** - Gerenciador de pacotes (se não estiver instalado)

## 🌐 Portas Utilizadas

O script configura automaticamente o firewall do Windows para as seguintes portas:

- **80** - Player (HTTP)
- **3000** - Backend API
- **8080** - Painel Administrativo
- **5432** - PostgreSQL
- **6379** - Redis
- **1883** - MQTT
- **9090** - Prometheus
- **3002** - Grafana

## 📍 Acessos Após Instalação

Após a instalação bem-sucedida, você terá acesso a:

- **Painel Administrativo**: `http://localhost:8080`
- **Player**: `http://localhost:80/player?uin=TOTEM_UIN`
- **API Backend**: `http://localhost:3000`

### Credenciais Padrão

- **Usuário**: `admin`
- **Senha**: `admin123`

⚠️ **IMPORTANTE**: Altere a senha após o primeiro login!

## 🐳 Modo Docker

Se você escolher o modo Docker:

### Gerenciar Containers

```powershell
# Iniciar
docker-compose up -d

# Parar
docker-compose down

# Ver logs
docker-compose logs -f

# Rebuild
docker-compose up -d --build
```

### Verificar Status

```powershell
docker-compose ps
```

## 🖥️ Modo Single-Server

Se você escolher o modo Single-Server:

### Gerenciar Serviços

O script instala o PM2 para gerenciar os processos Node.js:

```powershell
# Iniciar backend
cd backend
pm2 start dist/index.js --name smartsignage-backend

# Iniciar frontend (se necessário)
cd frontend
pm2 start npm --name smartsignage-frontend -- start

# Ver status
pm2 status

# Ver logs
pm2 logs

# Parar
pm2 stop all

# Reiniciar
pm2 restart all
```

## 🔍 Troubleshooting

### Erro: "Script não pode ser executado"

Se você receber um erro sobre política de execução:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro: "Chocolatey não encontrado"

O script tenta instalar o Chocolatey automaticamente. Se falhar:

1. Abra PowerShell como Administrador
2. Execute:
   ```powershell
   Set-ExecutionPolicy Bypass -Scope Process -Force
   [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
   iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

### Erro: "Docker não está rodando"

1. Abra o Docker Desktop
2. Aguarde até que o ícone do Docker na bandeja do sistema fique verde
3. Execute o script novamente

### Erro: "PostgreSQL não encontrado"

O script tenta instalar o PostgreSQL via Chocolatey. Se falhar:

1. Instale manualmente: `choco install postgresql -y`
2. Ou baixe do site oficial: https://www.postgresql.org/download/windows/

### Erro: "Node.js não encontrado"

Após instalar o Node.js, você pode precisar:

1. Fechar e reabrir o PowerShell
2. Ou executar: `refreshenv` (se Chocolatey estiver instalado)

## 📝 Logs e Debug

### Ver Logs do Backend

```powershell
# Modo Docker
docker-compose logs -f backend

# Modo Single-Server
pm2 logs smartsignage-backend
```

### Ver Logs do Frontend

```powershell
# Modo Docker
docker-compose logs -f frontend

# Modo Single-Server
pm2 logs smartsignage-frontend
```

## 🔄 Atualização

Para atualizar o sistema:

```powershell
# Modo Docker
cd C:\SmartSignage-Pro
git pull
.\install-smartsignage.ps1 --rebuild

# Modo Single-Server
cd C:\SmartSignage-Pro
git pull
cd backend
npm install
npm run build
pm2 restart smartsignage-backend
```

## 📞 Suporte

Para problemas ou dúvidas:

1. Verifique os logs: `docker-compose logs` ou `pm2 logs`
2. Verifique o status dos serviços: `docker-compose ps` ou `pm2 status`
3. Consulte a documentação completa do projeto

## 📚 Próximos Passos

Após a instalação:

1. ✅ Acesse o painel administrativo: `http://localhost:8080`
2. ✅ Faça login com as credenciais padrão
3. ✅ Altere a senha do administrador
4. ✅ Configure seus totens e campanhas
5. ✅ Instale os players conforme necessário

---

**Versão do Script**: 1.0.0  
**Versão do Sistema**: 2.1.0  
**Última Atualização**: Dezembro 2024

