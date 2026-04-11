# 🚀 Guia de Execução Local - Smart Signage Pro

## 📋 Pré-requisitos

- **Node.js** 18+ instalado
- **PostgreSQL** 15+ instalado e rodando
- **npm** ou **yarn** instalado
- Variáveis de ambiente configuradas (arquivo `.env`)

## 🔧 Configuração Inicial

### 1. Configurar Banco de Dados

Certifique-se de que o PostgreSQL está rodando e crie o banco de dados:

```sql
CREATE DATABASE smartsignage_pro;
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure:

**Windows:**
```powershell
Copy-Item backend\.env.example backend\.env
```

**Linux/Mac:**
```bash
cp backend/.env.example backend/.env
```

Edite o arquivo `backend/.env` com suas configurações:

```env
# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=smartsignage_pro
DB_USER=postgres
DB_PASSWORD=sua_senha
DB_DRIVER=postgresql

# Servidor
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=seu_jwt_secret_aqui
JWT_REFRESH_SECRET=seu_jwt_refresh_secret_aqui
```

### 3. Instalar Dependências

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 4. Executar Migrações (se necessário)

Se você ainda não inicializou o banco de dados, execute os scripts SQL na ordem:
1. `database/smartchannel-db-v2-refactored-apply-all.sql`
2. `database/carga-inicial-2025.sql`

## 🚀 Iniciar o Sistema

### Opção 1: Script Automático (Recomendado)

**Windows:**
```powershell
.\scripts\start-local-dev.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/start-local-dev.sh
./scripts/start-local-dev.sh
```

### Opção 2: Manual (Duas Janelas)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### Opção 3: PowerShell (Windows)

Abra dois terminais PowerShell:

**Terminal 1:**
```powershell
cd backend
npm run dev
```

**Terminal 2:**
```powershell
cd frontend
npm start
```

## 📍 Acessos

Após iniciar, os serviços estarão disponíveis em:

- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3000/api-docs
- **Health Check**: http://localhost:3000/health

## 🔍 Verificar Status

### Backend

Verifique se o backend está respondendo:
```bash
curl http://localhost:3000/health
```

Ou acesse no navegador: http://localhost:3000/health

### Frontend

Verifique se o frontend está rodando:
- Abra o navegador em http://localhost:3001
- Deve exibir a tela de login

## 🐛 Troubleshooting

### Erro: "Cannot find module"

**Solução:** Instale as dependências:
```bash
cd backend && npm install
cd ../frontend && npm install
```

### Erro: "Port already in use"

**Solução:** 
- Backend: Altere `PORT=3000` no arquivo `.env`
- Frontend: Defina `PORT=3001` no arquivo `.env` do frontend ou use outra porta

### Erro: "Database connection failed"

**Solução:**
1. Verifique se o PostgreSQL está rodando
2. Verifique as credenciais no arquivo `.env`
3. Verifique se o banco de dados existe
4. Teste a conexão:
   ```bash
   psql -h localhost -U postgres -d smartsignage_pro
   ```

### Erro: "EADDRINUSE"

**Solução:** Alguém já está usando a porta. Use outra porta ou pare o processo:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

## 🛑 Parar os Serviços

### Windows (PowerShell)
```powershell
# Se usou o script automático, feche as janelas PowerShell
# Ou use:
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process
```

### Linux/Mac
```bash
# Pressione Ctrl+C nos terminais
# Ou mate os processos:
pkill -f "npm run dev"
pkill -f "npm start"
```

## 📝 Scripts Disponíveis

### Backend
- `npm run dev` - Inicia em modo desenvolvimento (nodemon)
- `npm start` - Inicia em modo produção
- `npm run build` - Compila TypeScript
- `npm test` - Executa testes

### Frontend
- `npm start` - Inicia servidor de desenvolvimento
- `npm run build` - Cria build de produção
- `npm test` - Executa testes

## 🔐 Credenciais Padrão (desenvolvimento)

Após executar `database/carga-inicial-2025.sql`, você pode usar:

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **IMPORTANTE**: Altere essas credenciais em produção!

## 📚 Próximos Passos

1. ✅ Execute o sistema localmente
2. ✅ Acesse o frontend e faça login
3. ✅ Teste a criação de usuários
4. ✅ Teste o CRUD de publishers e subscribers
5. ✅ Valide as regras RBAC implementadas

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs no console
2. Verifique os logs em `logs/backend.log` e `logs/frontend.log` (se usar script)
3. Verifique as variáveis de ambiente
4. Verifique a conexão com o banco de dados

