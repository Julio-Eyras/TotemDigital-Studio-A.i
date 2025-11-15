# 🚀 COMANDOS PARA EXECUTAR NO SERVIDOR DE TESTE

**Copie e cole estes comandos no servidor de teste**

---

## 📋 COMANDOS COMPLETOS

### **1. Conectar ao Servidor**

```bash
ssh usuario@ip-do-servidor
# Exemplo: ssh root@192.168.1.100
```

---

### **2. Preparar Ambiente**

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependências básicas
sudo apt install -y curl wget git unzip

# Verificar/Instalar Docker
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "⚠️  Faça logout e login novamente"
    exit
fi

# Verificar/Instalar Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    sudo apt install -y docker-compose
fi
```

---

### **3. Preparar Projeto**

#### **Opção A: Clonar Repositório**

```bash
cd /opt
git clone <URL_DO_REPOSITORIO> SmartSignage-Pro
cd SmartSignage-Pro
```

#### **Opção B: Copiar Arquivos**

```bash
# Do seu computador local, copiar via SCP:
# scp -r C:\SmartSignage-Pro usuario@servidor:/opt/

# No servidor:
cd /opt/SmartSignage-Pro
```

---

### **4. Verificar Arquivos**

```bash
# Verificar arquivos essenciais
ls -la docker-compose.yml Dockerfile.app install-smartsignage.sh
ls -la database/smartchannel-db.sql database/init-data.sql
ls -la docker/app-entrypoint.sh nginx/nginx-complete.conf

# Tornar script executável
chmod +x install-smartsignage.sh
```

---

### **5. Executar Instalação**

```bash
# Executar instalação (modo Docker automático)
./install-smartsignage.sh --skip-menu

# OU executar com menu interativo
./install-smartsignage.sh
# Escolher: 2) Docker (Produção - PostgreSQL)
```

---

### **6. Validação Rápida**

```bash
# Aguardar containers iniciarem (30 segundos)
sleep 30

# Verificar containers
docker compose ps

# Testar frontend
curl -I http://localhost/

# Testar backend
curl http://localhost:3000/health

# Testar login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'

# Verificar banco
docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"
```

---

### **7. Ver Logs (se necessário)**

```bash
# Logs do container app
docker compose logs app --tail 100

# Logs de todos os serviços
docker compose logs --tail 50

# Logs em tempo real
docker compose logs -f
```

---

## 🎯 COMANDO ÚNICO (Script Auxiliar)

```bash
# Usar script auxiliar (mais simples)
cd /opt/SmartSignage-Pro
chmod +x scripts/install-server-teste.sh
./scripts/install-server-teste.sh
```

---

## 🌐 ACESSO APÓS INSTALAÇÃO

**Obter IP do servidor:**
```bash
hostname -I | awk '{print $1}'
```

**URLs de acesso:**
- Frontend: `http://<IP>/`
- Backend: `http://<IP>:3000/api`
- Player: `http://<IP>/player/`
- Grafana: `http://<IP>:3002` (admin/admin)

**Credenciais:**
- Usuário: `admin`
- Senha: `admin`

---

## 🚨 SE ALGO DER ERRADO

```bash
# Ver logs detalhados
docker compose logs app --tail 200

# Rebuild sem cache
docker compose build --no-cache app
docker compose up -d

# Reiniciar tudo
docker compose down
docker compose up -d

# Verificar recursos
docker stats --no-stream
```

---

**✅ Pronto para executar!**

