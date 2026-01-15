# Instalação e Validação - Smart Signage Pro (Linux/macOS)

## 📋 **Descrição**

Scripts bash para instalar, executar e validar automaticamente todo o sistema Smart Signage Pro em Linux/macOS, incluindo:

- ✅ Verificação de pré-requisitos (Node.js, npm, PostgreSQL)
- ✅ Instalação de dependências
- ✅ Configuração do banco de dados
- ✅ Inicialização de serviços (Backend e Frontend)
- ✅ Validação de conectividade
- ✅ Testes de APIs
- ✅ Verificação de logs de erros
- ✅ Geração de relatório completo

---

## 🚀 **Scripts Disponíveis**

### **1. EXECUTAR-E-VALIDAR.sh** (Recomendado)
Script principal que executa e valida tudo automaticamente:

```bash
chmod +x EXECUTAR-E-VALIDAR.sh
./EXECUTAR-E-VALIDAR.sh
```

Este script:
1. Instala todas as dependências
2. Configura o banco de dados
3. Inicia backend e frontend
4. Valida todos os componentes
5. Gera relatório de validação

### **2. LEVANTAR-SISTEMA.sh**
Apenas instala e inicia o sistema (sem validação):

```bash
chmod +x LEVANTAR-SISTEMA.sh
./LEVANTAR-SISTEMA.sh
```

### **3. VALIDAR-SISTEMA.sh**
Apenas valida o sistema (se já está rodando):

```bash
chmod +x VALIDAR-SISTEMA.sh
./VALIDAR-SISTEMA.sh
```

### **4. PARAR-SERVICOS.sh**
Para todos os serviços:

```bash
chmod +x PARAR-SERVICOS.sh
./PARAR-SERVICOS.sh
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
- ✅ Health Check API funcionando (`/api/health/check`)
- ✅ API Docs acessível (`/api-docs`)
- ✅ Banco de dados conectado

### **5. Logs**
- ✅ Sem erros críticos nos logs
- ✅ Processos rodando corretamente

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
RESUMO DA VALIDACAO
========================================

Total de testes: 15
Testes aprovados: 14
Testes falhados: 1
Taxa de sucesso: 93.33%

SERVICOS:
- Backend: http://localhost:3000
- Frontend: http://localhost:3001
- Banco de Dados: localhost:5432/smartsignage
```

---

## ⚙️ **Configuração**

As configurações padrão estão no script. Para alterar, edite as variáveis no início dos arquivos `.sh`:

```bash
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_NAME="smartsignage"
BACKEND_PORT="3000"
FRONTEND_PORT="3001"
```

---

## 🛠️ **Troubleshooting**

### **Erro: "Node.js não encontrado"**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS (com Homebrew)
brew install node@18
```

### **Erro: "PostgreSQL não acessível"**
```bash
# Verificar se está rodando
sudo systemctl status postgresql

# Iniciar se necessário
sudo systemctl start postgresql

# Testar conexão
psql -h localhost -U postgres -d postgres
```

### **Erro: "Backend não está acessível"**
- Aguarde mais tempo (o script aguarda até 30 segundos)
- Verifique os logs: `tail -f backend/logs/app.log`
- Verifique se a porta 3000 está livre: `lsof -i:3000`

### **Erro: "Frontend não está acessível"**
- Aguarde mais tempo (o frontend demora mais para iniciar)
- Verifique se a porta 3001 está livre: `lsof -i:3001`
- Verifique se há erros de compilação: `tail -f frontend/logs/frontend.log`

### **Muitos erros nos logs**
- Verifique se o Redis está desabilitado (`CACHE_ENABLED=false` no .env)
- Verifique se o banco de dados está configurado corretamente
- Verifique se todas as dependências foram instaladas

### **Permissão negada ao executar scripts**
```bash
chmod +x *.sh
```

---

## 📝 **Notas**

- Os scripts param serviços existentes antes de iniciar novos
- Os scripts aguardam até 30 segundos para os serviços iniciarem
- Logs são analisados para encontrar erros críticos
- Um relatório detalhado é gerado após cada execução
- PIDs são salvos em `.backend.pid` e `.frontend.pid` para controle

---

## 🔗 **Scripts Relacionados**

- `INSTALACAO_LOCAL.sh` - Script de instalação local original
- `install-smartsignage.sh` - Script de instalação completo (Docker/Single-Server)

---

## 📚 **Documentação Adicional**

- `README-INSTALACAO-WINDOWS.md` - Instalação para Windows
- `README-VALIDACAO.md` - Documentação de validação
- `GUIA_INSTALACAO_LOCAL.md` - Guia detalhado de instalação

---

**Última atualização:** 2026-01-02  
**Versão:** 1.0.0  
**Sistema:** Smart Signage Pro v2.1.0

