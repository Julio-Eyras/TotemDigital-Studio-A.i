# Validação Automática do Sistema - Smart Signage Pro

## 📋 **Descrição**

Scripts PowerShell para executar e validar automaticamente todo o sistema Smart Signage Pro localmente, incluindo:

- ✅ Verificação de pré-requisitos (Node.js, npm, PostgreSQL)
- ✅ Instalação de dependências
- ✅ Configuração do banco de dados
- ✅ Inicialização de serviços (Backend e Frontend)
- ✅ Validação de conectividade
- ✅ Testes de APIs
- ✅ Verificação de logs de erros
- ✅ Geração de relatório completo

---

## 🚀 **Como Usar**

### **Opção 1: Executar e Validar (Recomendado)**

Execute o script principal que faz tudo automaticamente:

```powershell
.\EXECUTAR-E-VALIDAR.ps1
```

Este script:
1. Instala todas as dependências
2. Configura o banco de dados
3. Inicia backend e frontend
4. Valida todos os componentes
5. Gera relatório de validação

### **Opção 2: Apenas Validar (Sistema Já Rodando)**

Se o sistema já está rodando, você pode apenas validar:

```powershell
.\VALIDAR-SISTEMA.ps1
```

---

## 📊 **O Que é Validado**

### **1. Pré-requisitos**
- ✅ Node.js 18+ instalado
- ✅ npm instalado
- ✅ PostgreSQL acessível
- ✅ Diretórios do projeto existem
- ✅ Arquivo .env configurado

### **2. Instalação**
- ✅ Dependências do backend instaladas
- ✅ Dependências do frontend instaladas
- ✅ Backend compilado com sucesso
- ✅ Banco de dados configurado

### **3. Serviços**
- ✅ Backend iniciado e respondendo
- ✅ Frontend iniciado e respondendo
- ✅ Portas 3000 e 3001 em uso

### **4. APIs**
- ✅ Health Check API funcionando
- ✅ API Docs acessível
- ✅ Banco de dados conectado

### **5. Logs**
- ✅ Sem erros críticos nos logs
- ✅ Jobs do PowerShell rodando

---

## 📄 **Relatório de Validação**

Após a execução, um relatório é gerado automaticamente em:

```
validacao-sistema-YYYYMMDD-HHMMSS.txt
```

O relatório contém:
- Resumo de testes (total, aprovados, falhados)
- Taxa de sucesso
- Lista de erros encontrados
- URLs dos serviços

---

## 🔍 **Exemplo de Saída**

```
========================================
VALIDACAO DO SISTEMA SMART SIGNAGE PRO
========================================
Data: 2026-01-02 17:10:00
Versao: 2.1.0

RESUMO:
- Total de testes: 15
- Aprovados: 14
- Falhados: 1
- Taxa de sucesso: 93.33%

SERVICOS:
- Backend: http://localhost:3000
- Frontend: http://localhost:3001
- Banco de Dados: localhost:5432/smartsignage

ERROS ENCONTRADOS:
Logs sem erros criticos: Encontrados 2 erros criticos
```

---

## ⚙️ **Configuração**

As configurações padrão estão no script. Para alterar, edite as variáveis no início do arquivo `VALIDAR-SISTEMA.ps1`:

```powershell
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_NAME = "smartsignage"
$BACKEND_PORT = "3000"
$FRONTEND_PORT = "3001"
```

---

## 🛠️ **Troubleshooting**

### **Erro: "Node.js não encontrado"**
- Instale Node.js 18+ de https://nodejs.org/

### **Erro: "PostgreSQL não acessível"**
- Verifique se o PostgreSQL está rodando
- Verifique se as credenciais estão corretas
- Teste manualmente: `psql -h localhost -U postgres -d postgres`

### **Erro: "Backend não está acessível"**
- Aguarde mais tempo (o script aguarda até 30 segundos)
- Verifique os logs em `backend/logs/app.log`
- Verifique se a porta 3000 está livre

### **Erro: "Frontend não está acessível"**
- Aguarde mais tempo (o frontend demora mais para iniciar)
- Verifique se a porta 3001 está livre
- Verifique se há erros de compilação no frontend

### **Muitos erros nos logs**
- Verifique se o Redis está desabilitado (`CACHE_ENABLED=false` no .env)
- Verifique se o banco de dados está configurado corretamente
- Verifique se todas as dependências foram instaladas

---

## 📝 **Notas**

- O script para serviços existentes antes de iniciar novos
- O script aguarda até 30 segundos para os serviços iniciarem
- Logs são analisados para encontrar erros críticos
- Um relatório detalhado é gerado após cada execução

---

## 🔗 **Scripts Relacionados**

- `LEVANTAR-SISTEMA.ps1` - Apenas instala e inicia (sem validação)
- `PARAR-SERVICOS.ps1` - Para todos os serviços
- `INSTALAR-SISTEMA.ps1` - Apenas instala (sem iniciar)

---

**Última atualização:** 2026-01-02  
**Versão:** 1.0.0

