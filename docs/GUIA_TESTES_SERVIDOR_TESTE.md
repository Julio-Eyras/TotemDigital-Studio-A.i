# 🧪 GUIA RÁPIDO: TESTES NO SERVIDOR DE TESTE

**Data:** 2025-11-03  
**Modo:** Docker Monolítico v2.1  
**Status:** ✅ Pronto para Testes

---

## 🚀 INSTALAÇÃO RÁPIDA

### **1. Preparar Servidor**

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker (se não tiver)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose (se não tiver)
sudo apt install docker-compose -y

# Reiniciar sessão (ou fazer logout/login)
```

---

### **2. Baixar e Preparar Projeto**

```bash
# Clonar ou copiar projeto para o servidor
cd /opt  # ou outro diretório de sua escolha
git clone <repo> SmartSignage-Pro
# ou copiar arquivos via SCP/SFTP

cd SmartSignage-Pro

# Tornar script executável
chmod +x install-smartsignage.sh
```

---

### **3. Executar Instalação**

```bash
# Executar script de instalação
./install-smartsignage.sh

# Quando perguntar, escolher:
# 2) Docker (Produção - PostgreSQL)
```

**O script fará:**
- ✅ Verificação de dependências
- ✅ Build das imagens Docker
- ✅ Criação dos containers
- ✅ Inicialização dos serviços
- ✅ Configuração do banco de dados

---

## ✅ VALIDAÇÃO RÁPIDA

### **Teste 1: Verificar Containers**

```bash
docker compose ps
```

**Esperado:** Todos os containers com status "Up"

---

### **Teste 2: Verificar Frontend**

```bash
curl -I http://localhost/
```

**Esperado:** `HTTP/1.1 200 OK`

---

### **Teste 3: Verificar Backend**

```bash
curl http://localhost:3000/health
```

**Esperado:** JSON com `"status": "healthy"`

---

### **Teste 4: Verificar Banco de Dados**

```bash
docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"
```

**Esperado:** Pelo menos `1` (usuário admin)

---

### **Teste 5: Login no Sistema**

1. Abrir navegador: `http://<IP_DO_SERVIDOR>/`
2. Login: `admin` / `admin`
3. **Esperado:** Dashboard carrega

---

## 🔍 VERIFICAÇÕES DETALHADAS

### **Ver Logs**

```bash
# Logs do container app (frontend + backend)
docker compose logs app --tail 100 -f

# Logs do PostgreSQL
docker compose logs postgres --tail 50

# Logs do Redis
docker compose logs redis --tail 50

# Logs de todos os serviços
docker compose logs --tail 50
```

---

### **Verificar Erros**

```bash
# Procurar erros relacionados ao Prisma
docker compose logs app | grep -i prisma

# Procurar erros gerais
docker compose logs app | grep -i error

# Verificar se há containers reiniciando
docker compose ps | grep -i restarting
```

---

### **Testar API Diretamente**

```bash
# Obter token JWT
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq -r '.accessToken')

# Testar endpoint protegido
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users | jq .
```

---

## 🚨 PROBLEMAS COMUNS

### **Container não inicia**

```bash
# Ver logs detalhados
docker compose logs app --tail 200

# Rebuild sem cache
docker compose build --no-cache app
docker compose up -d app
```

---

### **Erro de conexão com banco**

```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Verificar conexão
docker exec smartsignage-postgres pg_isready -U smartsignage

# Verificar variáveis de ambiente
docker exec smartsignage-app env | grep DATABASE_URL
```

---

### **Frontend não carrega**

```bash
# Verificar se build existe
docker exec smartsignage-app ls -la /usr/share/nginx/html/

# Verificar configuração do Nginx
docker exec smartsignage-app nginx -t

# Reiniciar container
docker compose restart app
```

---

## 📊 CHECKLIST MÍNIMO

- [ ] Containers iniciados (`docker compose ps`)
- [ ] Frontend acessível (`curl http://localhost/`)
- [ ] Backend responde (`curl http://localhost:3000/health`)
- [ ] Login funciona (navegador)
- [ ] Dashboard carrega
- [ ] Sem erros críticos nos logs

---

## 📝 RELATÓRIO DE TESTES

**Servidor:** _______________  
**Data:** _______________  
**IP:** _______________  

**Status:**
- [ ] ✅ Funcionando
- [ ] ⚠️ Problemas encontrados: _______________

**Observações:**
_______________
_______________

---

**📅 Criado em:** 2025-11-03  
**👤 Por:** AI Assistant  
**✅ Status:** Pronto para Testes

