# 🚀 INSTRUÇÕES PARA TESTES NO SERVIDOR DE TESTE

**Data:** 2025-11-03  
**Modo:** Docker Monolítico v2.1  
**Status:** ✅ Pronto para Testes

---

## 📋 RESUMO DO QUE FOI FEITO

### ✅ **Migração Prisma → PostgreSQL**
- ✅ Prisma completamente removido
- ✅ PostgreSQL direto via `pg` implementado
- ✅ Código validado e funcionando

### ✅ **Correções no Docker**
- ✅ `docker-compose.yml` atualizado para usar `schema-postgresql.sql`
- ✅ `Dockerfile.app` atualizado para v2.1
- ✅ Arquivos essenciais validados

---

## 🚀 INSTALAÇÃO NO SERVIDOR DE TESTE

### **Passo 1: Preparar Servidor**

```bash
# Conectar ao servidor de teste
ssh usuario@servidor-teste

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Verificar Docker
docker --version
docker compose version

# Se não tiver Docker, instalar:
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo apt install docker-compose -y

# Fazer logout e login novamente (para aplicar grupo docker)
```

---

### **Passo 2: Preparar Projeto**

```bash
# Ir para diretório de instalação
cd /opt  # ou outro diretório

# Opção A: Clonar do repositório
git clone <repo-url> SmartSignage-Pro
cd SmartSignage-Pro

# Opção B: Copiar arquivos via SCP/SFTP
# (copiar toda a pasta SmartSignage-Pro)

# Tornar script executável
chmod +x install-smartsignage.sh
```

---

### **Passo 3: Executar Instalação**

```bash
# Executar script de instalação
./scripts/install-smartsignage.sh

# Quando aparecer o menu, escolher:
# 2) Docker (Produção - PostgreSQL)

# Aguardar instalação completa
# Tempo estimado: 10-20 minutos
```

**O que o script fará:**
1. ✅ Verificar dependências
2. ✅ Build das imagens Docker
3. ✅ Criar containers
4. ✅ Inicializar PostgreSQL
5. ✅ Criar schema do banco
6. ✅ Popular seeds
7. ✅ Iniciar todos os serviços

---

## ✅ VALIDAÇÃO RÁPIDA (5 minutos)

### **1. Verificar Containers**

```bash
docker compose ps
```

**Esperado:**
```
NAME                      STATUS
smartsignage-postgres     Up (healthy)
smartsignage-redis        Up (healthy)
smartsignage-app          Up (healthy)
smartsignage-ollama       Up
smartsignage-prometheus   Up
smartsignage-grafana      Up
```

---

### **2. Testar Frontend**

```bash
curl -I http://localhost/
```

**Esperado:** `HTTP/1.1 200 OK`

---

### **3. Testar Backend**

```bash
curl http://localhost:3000/health
```

**Esperado:** JSON com `"status": "healthy"`

---

### **4. Testar Login**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' | jq .
```

**Esperado:** JSON com `accessToken`

---

### **5. Verificar Banco de Dados**

```bash
docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"
```

**Esperado:** Pelo menos `1` (usuário admin)

---

## 🔍 VALIDAÇÃO DETALHADA (15 minutos)

### **Testes Funcionais:**

1. **Login no Sistema**
   - Abrir: `http://<IP_DO_SERVIDOR>/`
   - Login: `admin` / `admin`
   - ✅ Dashboard deve carregar

2. **Navegar pelas Páginas**
   - ✅ Usuários
   - ✅ Clientes
   - ✅ Totems
   - ✅ Mídia
   - ✅ Playlists
   - ✅ Campanhas

3. **Testar Upload**
   - Upload de uma imagem
   - ✅ Upload deve funcionar

4. **Testar Player**
   - Acessar: `http://<IP_DO_SERVIDOR>/player/`
   - ✅ Player deve carregar

---

## 🚨 TROUBLESHOOTING

### **Container não inicia**

```bash
# Ver logs detalhados
docker compose logs app --tail 200

# Verificar erros específicos
docker compose logs app | grep -i error
docker compose logs app | grep -i prisma  # Não deve aparecer nada
```

---

### **Frontend não carrega**

```bash
# Verificar se build existe
docker exec smartsignage-app ls -la /usr/share/nginx/html/

# Verificar Nginx
docker exec smartsignage-app nginx -t

# Reiniciar
docker compose restart app
```

---

### **Backend não responde**

```bash
# Verificar se Node está rodando
docker exec smartsignage-app ps aux | grep node

# Verificar health
docker exec smartsignage-app curl http://localhost:3000/health

# Ver logs
docker compose logs app | tail -100
```

---

### **Banco de dados não conecta**

```bash
# Verificar PostgreSQL
docker compose ps postgres
docker exec smartsignage-postgres pg_isready -U smartsignage

# Verificar variáveis
docker exec smartsignage-app env | grep DATABASE_URL
```

---

## 📊 CHECKLIST COMPLETO

### **Instalação:**
- [ ] Script executado com sucesso
- [ ] Todos os containers iniciados
- [ ] Sem erros críticos nos logs

### **Conectividade:**
- [ ] Frontend acessível
- [ ] Backend responde
- [ ] Player acessível
- [ ] PostgreSQL conecta
- [ ] Redis conecta

### **Funcionalidades:**
- [ ] Login funciona
- [ ] Dashboard carrega
- [ ] CRUDs funcionam
- [ ] Upload funciona
- [ ] Player funciona

### **Banco de Dados:**
- [ ] Tabelas criadas (40 tabelas)
- [ ] Seeds populados
- [ ] Usuário admin existe

---

## 📝 RELATÓRIO DE TESTES

**Servidor:** _______________  
**IP:** _______________  
**Data:** _______________  
**Hora Início:** _______________  
**Hora Fim:** _______________  

**Resultado:**
- [ ] ✅ Todos os testes passaram
- [ ] ⚠️ Problemas encontrados: _______________

**Observações:**
_______________
_______________

**Aprovação:**
- [ ] ✅ Aprovado para produção
- [ ] ⚠️ Precisa correções antes de aprovar

---

## 🎯 PRÓXIMOS PASSOS

### **Se Testes Passarem:**
1. ✅ Documentar resultados
2. ✅ Preparar para migração arquitetura separada
3. ✅ Implementar melhorias

### **Se Problemas Forem Encontrados:**
1. ⚠️ Documentar problemas
2. ⚠️ Corrigir problemas
3. ⚠️ Retestar
4. ⚠️ Repetir até aprovação

---

**📅 Criado em:** 2025-11-03  
**✅ Status:** Pronto para Testes no Servidor

