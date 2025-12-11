# ⚡ EXECUTAR INSTALAÇÃO AGORA - SERVIDOR DE TESTE

**Copie e cole estes comandos no servidor de teste**

---

## 🚀 COMANDOS RÁPIDOS (Copiar e Colar)

### **1. Conectar ao Servidor**

```bash
ssh usuario@ip-do-servidor
```

---

### **2. Preparar e Instalar (Tudo em Um)**

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker (se não tiver)
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "⚠️  Faça logout/login e execute novamente"
    exit
fi

# Instalar Docker Compose (se não tiver)
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    sudo apt install -y docker-compose
fi

# Ir para diretório de instalação
cd /opt

# Clonar ou copiar projeto (escolher uma opção):

# OPÇÃO A: Clonar do repositório
git clone <URL_DO_REPOSITORIO> SmartSignage-Pro
cd SmartSignage-Pro

# OPÇÃO B: Se já copiou os arquivos via SCP/SFTP
# cd SmartSignage-Pro

# Tornar script executável
chmod +x install-smartsignage.sh

# Executar instalação (modo Docker automático)
./install-smartsignage.sh --skip-menu
```

---

### **3. Aguardar e Validar**

```bash
# Aguardar containers iniciarem (30-60 segundos)
echo "Aguardando containers iniciarem..."
sleep 30

# Verificar status
docker compose ps

# Testar acesso
curl -I http://localhost/
curl http://localhost:3000/health
```

---

## 📋 COMANDOS ALTERNATIVOS

### **Se Preferir Menu Interativo:**

```bash
cd /opt/SmartSignage-Pro
chmod +x install-smartsignage.sh
./install-smartsignage.sh

# Quando aparecer menu, escolher:
# 2) Docker (Produção - PostgreSQL)
```

---

### **Se Usar Script Auxiliar:**

```bash
cd /opt/SmartSignage-Pro
chmod +x scripts/install-server-teste.sh
./scripts/install-server-teste.sh
```

---

## ✅ VALIDAÇÃO RÁPIDA (Após Instalação)

```bash
# 1. Containers
docker compose ps

# 2. Frontend
curl -I http://localhost/

# 3. Backend
curl http://localhost:3000/health

# 4. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq .

# 5. Banco
docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"
```

---

## 🌐 ACESSO VIA NAVEGADOR

**Obter IP:**
```bash
hostname -I | awk '{print $1}'
```

**Acessar:**
- Frontend: `http://<IP>/`
- Login: `admin` / `admin`

---

## 🚨 SE DER ERRO

```bash
# Ver logs
docker compose logs app --tail 200

# Rebuild
docker compose build --no-cache app
docker compose up -d
```

---

**✅ Pronto para executar!**

