# ✅ CHECKLIST DE TESTES - SERVIDOR DE TESTE

**Data:** 2025-11-03  
**Modo:** Docker Monolítico (v2.1 - Prisma removido)  
**Objetivo:** Validar instalação e funcionamento completo antes de migrar para arquitetura separada

---

## 🎯 PRÉ-REQUISITOS DO SERVIDOR DE TESTE

### **Requisitos Mínimos**
- [ ] Ubuntu 20.04+ ou similar
- [ ] Docker e Docker Compose instalados
- [ ] 4GB RAM mínimo (8GB recomendado)
- [ ] 20GB espaço em disco
- [ ] Acesso à internet
- [ ] Porta 80 disponível (ou configurar FRONTEND_PORT)
- [ ] Porta 3000 disponível (ou configurar BACKEND_PORT)

### **Verificação Rápida**
```bash
# Verificar Docker
docker --version
docker compose version

# Verificar recursos
free -h
df -h

# Verificar portas
sudo netstat -tulpn | grep -E ':(80|3000|5432|6379)'
```

---

## 📋 CHECKLIST DE INSTALAÇÃO

### **Fase 1: Preparação**

- [ ] **Clonar/Baixar projeto**
  ```bash
  git clone <repo> ou baixar arquivos
  cd SmartSignage-Pro
  ```

- [ ] **Verificar arquivos essenciais**
  ```bash
  ls -la docker-compose.yml
  ls -la Dockerfile.app
  ls -la docker/app-entrypoint.sh
  ls -la nginx/nginx-complete.conf
  ls -la database/schema-postgresql.sql
  ls -la database/init-data.sql
  ```

- [ ] **Verificar que Prisma foi removido**
  ```bash
  grep -r "prisma" Dockerfile.app || echo "✅ Prisma removido"
  grep -r "@prisma" backend/src || echo "✅ Sem referências ao Prisma"
  ```

---

### **Fase 2: Instalação Docker**

- [ ] **Executar script de instalação**
  ```bash
  chmod +x install-smartsignage.sh
  ./install-smartsignage.sh
  ```

- [ ] **Selecionar modo Docker**
  - Escolher opção "2) Docker (Produção - PostgreSQL)"

- [ ] **Aguardar instalação completa**
  - Build das imagens Docker
  - Criação dos containers
  - Inicialização dos serviços

---

### **Fase 3: Validação de Containers**

- [ ] **Verificar status dos containers**
  ```bash
  docker compose ps
  ```
  **Esperado:** Todos os containers com status "Up"

- [ ] **Verificar logs de inicialização**
  ```bash
  docker compose logs app --tail 50
  docker compose logs postgres --tail 20
  docker compose logs redis --tail 20
  ```

- [ ] **Verificar health checks**
  ```bash
  docker compose ps
  ```
  **Esperado:** Health checks "healthy" ou "starting"

---

### **Fase 4: Validação de Conectividade**

- [ ] **Testar acesso ao Frontend**
  ```bash
  curl -I http://localhost/
  # ou
  curl -I http://<IP_DO_SERVIDOR>/
  ```
  **Esperado:** HTTP 200 OK

- [ ] **Testar acesso à API Backend**
  ```bash
  curl http://localhost:3000/health
  # ou
  curl http://<IP_DO_SERVIDOR>:3000/health
  ```
  **Esperado:** JSON com status "healthy"

- [ ] **Testar acesso ao Player**
  ```bash
  curl -I http://localhost/player/
  ```
  **Esperado:** HTTP 200 OK

- [ ] **Testar conexão com PostgreSQL**
  ```bash
  docker exec smartsignage-postgres pg_isready -U smartsignage
  ```
  **Esperado:** "accepting connections"

- [ ] **Testar conexão com Redis**
  ```bash
  docker exec smartsignage-redis redis-cli ping
  ```
  **Esperado:** "PONG"

---

### **Fase 5: Validação de Funcionalidades Básicas**

- [ ] **Login no sistema**
  - Acessar: `http://<IP_DO_SERVIDOR>/`
  - Usuário: `admin`
  - Senha: `admin`
  - **Esperado:** Login bem-sucedido

- [ ] **Dashboard carrega**
  - Após login, verificar dashboard
  - **Esperado:** Estatísticas e gráficos carregam

- [ ] **Listar usuários**
  - Navegar para "Usuários"
  - **Esperado:** Lista de usuários carrega

- [ ] **Listar clientes**
  - Navegar para "Clientes"
  - **Esperado:** Lista de clientes carrega

- [ ] **Listar totems**
  - Navegar para "Totems"
  - **Esperado:** Lista de totems carrega

- [ ] **Listar mídia**
  - Navegar para "Mídia"
  - **Esperado:** Lista de mídia carrega

- [ ] **Listar playlists**
  - Navegar para "Playlists"
  - **Esperado:** Lista de playlists carrega

---

### **Fase 6: Validação de Funcionalidades Avançadas**

- [ ] **Upload de mídia**
  - Tentar fazer upload de uma imagem
  - **Esperado:** Upload bem-sucedido

- [ ] **Criar playlist**
  - Criar uma nova playlist
  - Adicionar mídia à playlist
  - **Esperado:** Playlist criada com sucesso

- [ ] **Criar campanha**
  - Criar uma nova campanha
  - Associar playlist
  - **Esperado:** Campanha criada com sucesso

- [ ] **Player funciona**
  - Acessar: `http://<IP_DO_SERVIDOR>/player/`
  - **Esperado:** Player carrega e tenta conectar

- [ ] **API REST funciona**
  ```bash
  # Obter token
  TOKEN=$(curl -s -X POST http://<IP_DO_SERVIDOR>:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin"}' | jq -r '.accessToken')
  
  # Testar endpoint protegido
  curl -H "Authorization: Bearer $TOKEN" \
    http://<IP_DO_SERVIDOR>:3000/api/users
  ```
  **Esperado:** Lista de usuários em JSON

---

### **Fase 7: Validação de Banco de Dados**

- [ ] **Verificar tabelas criadas**
  ```bash
  docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "\dt"
  ```
  **Esperado:** Lista de 40 tabelas

- [ ] **Verificar seeds populados**
  ```bash
  docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM users;"
  ```
  **Esperado:** Pelo menos 1 usuário (admin)

- [ ] **Verificar dados de exemplo**
  ```bash
  docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM clients;"
  docker exec smartsignage-postgres psql -U smartsignage -d smartsignage -c "SELECT COUNT(*) FROM totems;"
  ```
  **Esperado:** Dados de exemplo presentes

---

### **Fase 8: Validação de Monitoramento**

- [ ] **Prometheus acessível**
  ```bash
  curl http://localhost:9090/-/healthy
  ```
  **Esperado:** HTTP 200 OK

- [ ] **Grafana acessível**
  ```bash
  curl -I http://localhost:3002
  ```
  **Esperado:** HTTP 200 OK

- [ ] **Métricas sendo coletadas**
  - Acessar Grafana: `http://<IP_DO_SERVIDOR>:3002`
  - Login: `admin/admin`
  - Verificar dashboards
  - **Esperado:** Métricas sendo coletadas

---

### **Fase 9: Validação de Performance**

- [ ] **Tempo de resposta da API**
  ```bash
  time curl http://localhost:3000/health
  ```
  **Esperado:** < 1 segundo

- [ ] **Tempo de carregamento do frontend**
  - Abrir navegador
  - Medir tempo até página carregar
  - **Esperado:** < 3 segundos

- [ ] **Uso de recursos**
  ```bash
  docker stats --no-stream
  ```
  **Esperado:** Uso razoável de CPU e memória

---

### **Fase 10: Validação de Logs**

- [ ] **Logs do backend**
  ```bash
  docker compose logs backend --tail 100
  ```
  **Esperado:** Sem erros críticos

- [ ] **Logs do frontend**
  ```bash
  docker compose logs app --tail 100 | grep -i error
  ```
  **Esperado:** Sem erros críticos

- [ ] **Logs do PostgreSQL**
  ```bash
  docker compose logs postgres --tail 50
  ```
  **Esperado:** Sem erros de conexão

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### **Problema 1: Container não inicia**

**Sintomas:**
- Container com status "Restarting" ou "Exited"

**Solução:**
```bash
# Ver logs detalhados
docker compose logs app --tail 100

# Verificar se há erros de Prisma
docker compose logs app | grep -i prisma

# Rebuild sem cache
docker compose build --no-cache app
docker compose up -d app
```

---

### **Problema 2: Frontend não carrega**

**Sintomas:**
- Erro 502 ou página em branco

**Solução:**
```bash
# Verificar se Nginx está rodando
docker exec smartsignage-app nginx -t

# Verificar se frontend build existe
docker exec smartsignage-app ls -la /usr/share/nginx/html/

# Verificar logs do Nginx
docker compose logs app | grep nginx
```

---

### **Problema 3: Backend não responde**

**Sintomas:**
- API retorna erro 500 ou timeout

**Solução:**
```bash
# Verificar se Node.js está rodando
docker exec smartsignage-app ps aux | grep node

# Verificar conexão com PostgreSQL
docker exec smartsignage-app curl http://localhost:3000/health

# Verificar logs do backend
docker compose logs app | grep -i error
```

---

### **Problema 4: Banco de dados não conecta**

**Sintomas:**
- Erro de conexão com PostgreSQL

**Solução:**
```bash
# Verificar se PostgreSQL está rodando
docker compose ps postgres

# Verificar conexão
docker exec smartsignage-postgres pg_isready -U smartsignage

# Verificar variáveis de ambiente
docker exec smartsignage-app env | grep DATABASE_URL
```

---

## 📊 RELATÓRIO DE TESTES

### **Template de Relatório**

```
DATA: _______________
SERVIDOR: _______________
VERSÃO: v2.1 (Docker Monolítico)

INSTALAÇÃO:
[ ] Concluída com sucesso
[ ] Problemas encontrados: _______________

CONTAINERS:
[ ] Todos iniciados corretamente
[ ] Problemas: _______________

FUNCIONALIDADES BÁSICAS:
[ ] Login funciona
[ ] Dashboard carrega
[ ] CRUDs funcionam
[ ] Problemas: _______________

FUNCIONALIDADES AVANÇADAS:
[ ] Upload de mídia funciona
[ ] Playlists funcionam
[ ] Player funciona
[ ] Problemas: _______________

BANCO DE DADOS:
[ ] Tabelas criadas corretamente
[ ] Seeds populados
[ ] Problemas: _______________

PERFORMANCE:
[ ] Tempo de resposta aceitável
[ ] Uso de recursos razoável
[ ] Problemas: _______________

OBSERVAÇÕES:
_______________
_______________

CONCLUSÃO:
[ ] Pronto para produção
[ ] Precisa correções: _______________
```

---

## ✅ CRITÉRIOS DE APROVAÇÃO

### **Para Aprovar os Testes:**

1. ✅ Todos os containers iniciados e saudáveis
2. ✅ Frontend acessível e funcional
3. ✅ Backend API respondendo corretamente
4. ✅ Login funcionando
5. ✅ CRUDs básicos funcionando
6. ✅ Upload de mídia funcionando
7. ✅ Player acessível
8. ✅ Banco de dados com dados corretos
9. ✅ Sem erros críticos nos logs
10. ✅ Performance aceitável

---

## 🚀 PRÓXIMOS PASSOS APÓS TESTES

### **Se Testes Passarem:**

1. ✅ Documentar resultados
2. ✅ Preparar para migração para arquitetura separada
3. ✅ Implementar melhorias identificadas

### **Se Problemas Forem Encontrados:**

1. ⚠️ Documentar problemas encontrados
2. ⚠️ Corrigir problemas
3. ⚠️ Retestar
4. ⚠️ Repetir até aprovação

---

**📅 Criado em:** 2025-11-03  
**👤 Por:** AI Assistant  
**✅ Status:** Checklist Completo - Pronto para Testes

