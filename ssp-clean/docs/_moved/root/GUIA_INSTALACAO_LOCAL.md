# 📋 Guia de Instalação Local - Smart Signage Pro

## ✅ Instalação Concluída!

Todos os componentes foram instalados e configurados com sucesso.

---

## 📦 O que foi instalado:

### 1. **Backend**
- ✅ Dependências instaladas (`npm install`)
- ✅ Arquivo `.env` configurado
- ✅ Backend compilado (`npm run build`)

### 2. **Frontend**
- ✅ Dependências instaladas (`npm install`)

### 3. **Banco de Dados PostgreSQL**
- ✅ Banco `smartsignage` criado
- ✅ Schema v2.0 aplicado com sucesso
- ✅ Todas as tabelas, views, triggers e funções criadas

---

## 🚀 Como Iniciar o Sistema

### **1. Iniciar o Backend**

Abra um terminal e execute:

```bash
cd backend
npm run dev    # Modo desenvolvimento (com hot-reload)
# OU
npm start      # Modo produção
```

O backend estará disponível em: **http://localhost:3000**

### **2. Iniciar o Frontend**

Abra **outro terminal** e execute:

```bash
cd frontend
npm start
```

O frontend estará disponível em: **http://localhost:3001**

---

## 🔧 Configurações

### **Banco de Dados**
- **Host:** localhost
- **Port:** 5432
- **Database:** smartsignage
- **User:** postgres
- **Password:** postgres

### **Backend**
- **Port:** 3000
- **Arquivo de Config:** `backend/.env`

### **Frontend**
- **Port:** 3001
- **API Backend:** http://localhost:3000

---

## 🔍 Verificar se está funcionando

### **Backend**
Acesse: http://localhost:3000/api/health

Você deve ver uma resposta JSON com o status do sistema.

### **Frontend**
Abra o navegador em: http://localhost:3001

Você verá a tela de login do sistema.

---

## 📝 Próximos Passos

1. **Criar usuário admin** (se necessário):
   - O sistema pode ter um script de seed ou você pode criar via API
   - Verifique `database/seeds-default-settings.sql` para dados iniciais

2. **Configurar email** (opcional):
   - Edite `backend/.env` e configure SMTP se quiser enviar emails

3. **Configurar Redis** (opcional):
   - Se quiser usar cache, instale e configure Redis
   - Ou deixe `CACHE_ENABLED=false` no `.env`

---

## 🐛 Troubleshooting

### **Backend não inicia:**
- Verifique se o PostgreSQL está rodando
- Verifique as credenciais no `backend/.env`
- Veja os logs em `backend/logs/app.log`

### **Frontend não conecta ao backend:**
- Verifique se o backend está rodando na porta 3000
- Verifique o CORS no `backend/.env` (deve incluir http://localhost:3001)

### **Erro de conexão com banco:**
- Verifique se o PostgreSQL está rodando: `pg_isready`
- Teste conexão: `psql -U postgres -d smartsignage`
- Verifique credenciais no `backend/.env`

---

## 📚 Scripts Úteis

### **Aplicar schema novamente:**
```bash
cd backend
node scripts/setup-database.js
```

### **Criar banco do zero:**
```bash
# Via psql
psql -U postgres -c "DROP DATABASE IF EXISTS smartsignage;"
psql -U postgres -c "CREATE DATABASE smartsignage;"

# Aplicar schema
cd backend
node scripts/setup-database.js
```

---

## ✨ Pronto!

O sistema está instalado e pronto para uso. Basta iniciar backend e frontend conforme descrito acima.

**Data da Instalação:** 2024-12-19

