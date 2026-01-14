# 🚀 EXECUTAR INSTALAÇÃO NO SERVIDOR DE TESTE

**Data:** 2025-11-03  
**Modo:** Docker Monolítico v2.1  
**Status:** ✅ Pronto para Execução

---

## 📋 PRÉ-REQUISITOS

### **No Servidor de Teste:**
- ✅ Ubuntu 20.04+ ou similar
- ✅ Acesso SSH
- ✅ Acesso root ou sudo
- ✅ Internet disponível
- ✅ Portas 80, 3000, 5432, 6379 disponíveis (ou configurar variáveis)

---

## 🚀 PASSO A PASSO

### **PASSO 1: Conectar ao Servidor**

```bash
# Do seu computador local
ssh usuario@ip-do-servidor-teste

# Exemplo:
# ssh root@192.168.1.100
# ou
# ssh ubuntu@servidor-teste.exemplo.com
```

---

### **PASSO 2: Preparar Ambiente no Servidor**

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git unzip

# Verificar Docker
docker --version
docker compose version

# Se não tiver Docker, instalar:
if ! command -v docker &> /dev/null; then
    echo "Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker instalado"
    echo "⚠️  Faça logout e login novamente para aplicar grupo docker"
fi

# Se não tiver Docker Compose, instalar:
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Instalando Docker Compose..."
    sudo apt install -y docker-compose
    echo "✅ Docker Compose instalado"
fi

# Verificar recursos disponíveis
echo "=== RECURSOS DO SERVIDOR ==="
free -h
df -h
echo "============================"
```

---

### **PASSO 3: Preparar Projeto no Servidor**

#### **Opção A: Clonar do Repositório (Recomendado)**

```bash
# Ir para diretório de instalação
cd /opt

# Clonar repositório
git clone <URL_DO_REPOSITORIO> SmartSignage-Pro
cd SmartSignage-Pro

# Verificar que está na branch correta
git branch
git status
```

#### **Opção B: Copiar Arquivos via SCP/SFTP**

**Do seu computador local (Windows):**

```powershell
# Usando PowerShell ou WinSCP
# Copiar toda a pasta SmartSignage-Pro para o servidor

# Via SCP (do terminal local):
scp -r C:\SmartSignage-Pro usuario@servidor:/opt/

# Depois conectar ao servidor e verificar:
ssh usuario@servidor
cd /opt/SmartSignage-Pro
ls -la
```

#### **Opção C: Baixar ZIP**

```bash
# No servidor
cd /opt
wget <URL_DO_ZIP>
unzip SmartSignage-Pro.zip
cd SmartSignage-Pro
```

---

### **PASSO 4: Verificar Arquivos Essenciais**

```bash
# No servidor, verificar arquivos críticos
cd /opt/SmartSignage-Pro  # ou diretório onde está o projeto

echo "=== VERIFICANDO ARQUIVOS ==="
ls -la docker-compose.yml
ls -la Dockerfile.app
ls -la install-smartsignage.sh
ls -la database/smartchannel-db.sql
ls -la database/carga-inicial-db-smarsignage-v4.sql
ls -la docker/app-entrypoint.sh
ls -la nginx/nginx-complete.conf
echo "============================="

# Tornar script executável
chmod +x install-smartsignage.sh
```

---

### **PASSO 5: Executar Instalação**

```bash
# Executar script de instalação
./install-smartsignage.sh

# Quando aparecer o menu:
# Escolher: 2) Docker (Produção - PostgreSQL)

# Aguardar instalação completa
# Tempo estimado: 10-20 minutos
```

**O que acontecerá:**
1. ✅ Verificação de dependências
2. ✅ Build das imagens Docker
3. ✅ Criação dos containers
4. ✅ Inicialização do PostgreSQL
5. ✅ Criação do schema (smartchannel-db.sql)
6. ✅ População de seeds (carga-inicial-db-smarsignage-v4.sql)
7. ✅ Inicialização de todos os serviços

---

### **PASSO 6: Validação Rápida**

```bash
# 1. Verificar containers
docker compose ps

# Esperado: Todos com status "Up"

# 2. Verificar frontend
curl -I http://localhost/

# Esperado: HTTP/1.1 200 OK

# 3. Verificar backend
curl http://localhost:3000/health

# Esperado: {"status":"healthy",...}

# 4. Verificar banco de dados
docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"

# Esperado: Pelo menos 1

# 5. Testar login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq .

# Esperado: JSON com accessToken
```

---

## 🔍 VALIDAÇÃO DETALHADA

### **Ver Logs**

```bash
# Logs do container app (frontend + backend)
docker compose logs app --tail 100 -f

# Para parar: Ctrl+C

# Logs do PostgreSQL
docker compose logs postgres --tail 50

# Logs de todos os serviços
docker compose logs --tail 50
```

---

### **Verificar Erros**

```bash
# Procurar erros relacionados ao Prisma (não deve aparecer nada)
docker compose logs app | grep -i prisma

# Procurar erros gerais
docker compose logs app | grep -i error

# Verificar containers reiniciando
docker compose ps | grep -i restarting
```

---

### **Testar Funcionalidades**

```bash
# Obter token JWT
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.accessToken')

# Testar endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users | jq .

# Testar outros endpoints
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/clients | jq .

curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/totems | jq .
```

---

## 🌐 ACESSO VIA NAVEGADOR

### **URLs de Acesso:**

- **Frontend/Interface:** `http://<IP_DO_SERVIDOR>/`
- **API Backend:** `http://<IP_DO_SERVIDOR>:3000/api`
- **Player:** `http://<IP_DO_SERVIDOR>/player/`
- **Grafana:** `http://<IP_DO_SERVIDOR>:3002` (admin/admin)
- **Prometheus:** `http://<IP_DO_SERVIDOR>:9090`

### **Credenciais Padrão:**
- **Usuário:** `admin`
- **Senha:** `admin`
- ⚠️ **IMPORTANTE:** Alterar senha após primeiro login!

---

## 🚨 TROUBLESHOOTING

### **Problema: Container não inicia**

```bash
# Ver logs detalhados
docker compose logs app --tail 200

# Rebuild sem cache
docker compose build --no-cache app
docker compose up -d app
```

---

### **Problema: Erro de conexão com banco**

```bash
# Verificar PostgreSQL
docker compose ps postgres
docker exec smartsignage-postgres pg_isready -U smartsignage

# Verificar variáveis de ambiente
docker exec smartsignage-app env | grep DATABASE_URL

# Verificar logs do PostgreSQL
docker compose logs postgres --tail 50
```

---

### **Problema: Frontend não carrega**

```bash
# Verificar se build existe
docker exec smartsignage-app ls -la /usr/share/nginx/html/

# Verificar configuração do Nginx
docker exec smartsignage-app nginx -t

# Reiniciar container
docker compose restart app
```

---

### **Problema: Porta já em uso**

```bash
# Verificar portas em uso
sudo netstat -tulpn | grep -E ':(80|3000|5432)'

# Se necessário, configurar portas diferentes via .env
echo "FRONTEND_PORT=8080" >> .env
echo "BACKEND_PORT=3001" >> .env
docker compose down
docker compose up -d
```

---

## 📊 CHECKLIST DE VALIDAÇÃO

### **Instalação:**
- [ ] Script executado sem erros
- [ ] Todos os containers iniciados
- [ ] Sem erros críticos nos logs

### **Conectividade:**
- [ ] Frontend acessível (porta 80)
- [ ] Backend responde (porta 3000)
- [ ] Player acessível (/player/)
- [ ] PostgreSQL conecta
- [ ] Redis conecta

### **Funcionalidades:**
- [ ] Login funciona (admin/admin)
- [ ] Dashboard carrega
- [ ] CRUDs funcionam (usuários, clientes, totems)
- [ ] Upload de mídia funciona
- [ ] Player carrega

### **Banco de Dados:**
- [ ] Tabelas criadas (52 tabelas)
- [ ] Seeds populados
- [ ] Usuário admin existe

---

## 📝 RELATÓRIO DE INSTALAÇÃO

**Servidor:** _______________  
**IP:** _______________  
**Data:** _______________  
**Hora Início:** _______________  
**Hora Fim:** _______________  

**Resultado:**
- [ ] ✅ Instalação bem-sucedida
- [ ] ⚠️ Problemas encontrados: _______________

**Containers:**
- [ ] ✅ Todos iniciados
- [ ] ⚠️ Problemas: _______________

**Funcionalidades:**
- [ ] ✅ Todas funcionando
- [ ] ⚠️ Problemas: _______________

**Observações:**
_______________
_______________

---

## ✅ PRÓXIMOS PASSOS APÓS INSTALAÇÃO

1. ✅ Validar funcionamento completo
2. ✅ Testar todas as funcionalidades
3. ✅ Documentar problemas encontrados
4. ✅ Corrigir problemas se necessário
5. ✅ Aprovar para produção ou retestar

---

**📅 Criado em:** 2025-11-03  
**✅ Status:** Pronto para Execução

