# 🪟 Instalação no Windows - Smart Signage Pro

## 🚀 Instalação Rápida

### **Pré-requisitos**

Antes de executar o script, certifique-se de ter instalado:

1. **Node.js 18+** 
   - Download: https://nodejs.org/
   - Verificar: `node --version`

2. **PostgreSQL** (opcional, mas recomendado)
   - O script pode criar o banco via Node.js se o psql não estiver no PATH
   - Certifique-se de que o PostgreSQL está rodando
   - Credenciais padrão usadas: postgres:postgres

3. **Git** (opcional)
   - Para clonar o repositório

### **Instalação Automática**

1. **Abra o PowerShell como Administrador** (recomendado)

2. **Navegue até o diretório do projeto:**
   ```powershell
   cd C:\SmartSignage-Pro
   ```

3. **Execute o script de instalação:**
   ```powershell
   .\INSTALAR-SISTEMA.ps1
   ```

4. **Aguarde a conclusão** (pode levar 5-15 minutos dependendo da conexão)

5. **Siga as instruções** exibidas ao final do script

---

## 📋 O que o Script Faz

O script `INSTALAR-SISTEMA.ps1` executa automaticamente:

1. ✅ **Verifica pré-requisitos** (Node.js, npm)
2. ✅ **Configura variáveis de ambiente** (cria `backend/.env`)
3. ✅ **Instala dependências do backend** (`npm install`)
4. ✅ **Cria banco de dados PostgreSQL** (`smartsignage`)
5. ✅ **Aplica schema completo** (tabelas, views, triggers, funções)
6. ✅ **Compila backend TypeScript** (`npm run build`)
7. ✅ **Instala dependências do frontend** (`npm install`)

---

## 🔧 Instalação Manual (Alternativa)

Se preferir instalar manualmente ou se o script falhar:

### **1. Configurar Backend**

```powershell
# Navegar para o backend
cd backend

# Copiar arquivo de exemplo
Copy-Item env.example .env

# Editar .env e configurar:
# - DATABASE_URL
# - DB_USER, DB_PASSWORD
# - JWT_SECRET

# Instalar dependências
npm install

# Compilar
npm run build
```

### **2. Configurar Banco de Dados**

```powershell
# Voltar para a raiz
cd ..

# Executar script de setup
cd backend
node scripts/setup-database.js
```

### **3. Configurar Frontend**

```powershell
# Voltar para a raiz
cd ..

# Navegar para o frontend
cd frontend

# Instalar dependências
npm install
```

---

## ▶️ Iniciar o Sistema

### **Terminal 1 - Backend:**

```powershell
cd backend
npm run dev
```

O backend estará disponível em: **http://localhost:3000**

### **Terminal 2 - Frontend:**

```powershell
cd frontend
npm start
```

O frontend estará disponível em: **http://localhost:3001**

---

## ✅ Verificar Instalação

### **Backend:**
Acesse: http://localhost:3000/api/health

Deve retornar JSON com status do sistema.

### **Frontend:**
Acesse: http://localhost:3001

Deve exibir a tela de login do sistema.

---

## 🐛 Troubleshooting

### **Erro: "Script não pode ser executado"**

Execute no PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Erro: "Node.js não encontrado"**

1. Instale Node.js 18+ de https://nodejs.org/
2. Reinicie o PowerShell
3. Verifique: `node --version`

### **Erro: "PostgreSQL não conecta"**

1. Verifique se o PostgreSQL está rodando:
   ```powershell
   Get-Service postgresql*
   ```

2. Teste conexão manual:
   ```powershell
   psql -U postgres -d postgres
   ```

3. Se não conectar, o script tentará criar via Node.js mesmo assim

### **Erro: "npm install falha"**

1. Limpe o cache:
   ```powershell
   npm cache clean --force
   ```

2. Delete `node_modules` e `package-lock.json`:
   ```powershell
   Remove-Item -Recurse -Force node_modules
   Remove-Item package-lock.json
   ```

3. Reinstale:
   ```powershell
   npm install
   ```

### **Backend não inicia**

1. Verifique se a porta 3000 está livre:
   ```powershell
   netstat -ano | findstr :3000
   ```

2. Verifique logs:
   ```powershell
   Get-Content backend\logs\app.log -Tail 50
   ```

3. Verifique .env:
   ```powershell
   Get-Content backend\.env
   ```

### **Frontend não conecta ao backend**

1. Certifique-se de que o backend está rodando
2. Verifique CORS no `backend/.env`:
   ```
   CORS_ORIGIN=http://localhost:3000,http://localhost:3001
   ```
3. Verifique se a porta 3000 não está bloqueada pelo firewall

---

## 📝 Configurações Importantes

### **Banco de Dados**

Por padrão, o script usa:
- **Host:** localhost
- **Port:** 5432
- **Database:** smartsignage
- **User:** postgres
- **Password:** postgres

**⚠️ IMPORTANTE:** Altere a senha em produção!

### **Portas**

- **Backend:** 3000
- **Frontend:** 3001

Para alterar, edite `backend/.env` e `frontend/package.json`

---

## 🔒 Segurança em Produção

Ao instalar em produção, certifique-se de:

1. ✅ Alterar `JWT_SECRET` no `.env`
2. ✅ Alterar senha do PostgreSQL
3. ✅ Configurar HTTPS
4. ✅ Configurar firewall
5. ✅ Usar variáveis de ambiente seguras
6. ✅ Desabilitar `DEBUG=true` em produção
7. ✅ Configurar logs apropriados

---

## 📚 Documentação Adicional

- `GUIA_INSTALACAO_LOCAL.md` - Guia completo de instalação
- `MODELO_ER_OPERACOES_SUBSCRIBERS_PUBLISHERS_CONTRATOS.md` - Modelo ER
- `DOCUMENTACAO_TABELAS_CONTRATOS.md` - Documentação de tabelas

---

## 💬 Suporte

Se encontrar problemas:

1. Verifique os logs em `backend/logs/app.log`
2. Verifique a documentação
3. Execute o script novamente (é idempotente)

---

**Data de Criação:** 2024-12-19  
**Versão:** 2.1.0
