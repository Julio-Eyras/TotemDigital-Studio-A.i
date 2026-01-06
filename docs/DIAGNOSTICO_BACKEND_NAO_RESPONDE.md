# Diagnóstico: Backend Não Responde

**Problema:** `ERR_CONNECTION_REFUSED` ao acessar backend

---

## 🔍 DIAGNÓSTICO RÁPIDO

### 1. Verificar Porta Correta

**Backend usa porta 3000 (não 3001)**

- ✅ Correto: `http://192.168.1.110:3000`
- ❌ Errado: `http://192.168.1.110:3001` (essa é a porta do frontend)

---

### 2. Verificar se Backend Está Rodando

```bash
# Verificar processos Node.js
ps aux | grep node

# Verificar se porta 3000 está em uso
sudo netstat -tlnp | grep :3000
# Ou
sudo ss -tlnp | grep :3000

# Verificar logs do backend
tail -f /home/smartchannel/smartchannel/SmartSignage-Pro-install/backend/logs/*.log
```

---

### 3. Verificar Status do Serviço (se instalado como serviço)

```bash
# Verificar se há serviço systemd
sudo systemctl status smartsignage-backend

# Ou verificar processos manualmente
ps aux | grep "node.*backend"
```

---

### 4. Verificar Firewall

```bash
# Verificar regras do UFW
sudo ufw status

# Verificar se porta 3000 está permitida
sudo ufw status | grep 3000

# Se não estiver, permitir:
sudo ufw allow 3000/tcp
```

---

### 5. Verificar Erros de Compilação

O backend pode não ter iniciado devido a erros de compilação TypeScript.

```bash
# Navegar para o diretório do backend
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/backend

# Tentar compilar manualmente
npm run build

# Se houver erros, corrigir e tentar novamente
```

---

### 6. Verificar Configuração do Banco de Dados

O backend pode não estar iniciando porque não consegue conectar ao banco.

```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql

# Verificar conexão
psql -U smartsignage -d smartsignage -h localhost

# Verificar arquivo .env do backend
cat /home/smartchannel/smartchannel/SmartSignage-Pro-install/backend/.env
```

---

## 🚀 SOLUÇÕES

### Solução 1: Iniciar Backend Manualmente

```bash
# Navegar para o diretório
cd /home/smartchannel/smartchannel/SmartSignage-Pro-install/backend

# Verificar se .env existe
ls -la .env

# Se não existir, copiar do exemplo
cp env.example .env

# Editar .env com credenciais corretas
nano .env

# Compilar TypeScript
npm run build

# Iniciar backend
npm start

# Ou em modo desenvolvimento
npm run dev
```

---

### Solução 2: Verificar Logs de Erro

```bash
# Ver logs do sistema
journalctl -u smartsignage-backend -n 50

# Ver logs do Node.js (se rodando manualmente)
# Os logs aparecerão no terminal onde o processo está rodando
```

---

### Solução 3: Verificar Porta e Host

O backend pode estar escutando apenas em `localhost` em vez de `0.0.0.0`.

```bash
# Verificar arquivo .env
cat backend/.env | grep -E "PORT|HOST"

# Deve ter:
# PORT=3000
# HOST=0.0.0.0  (não localhost)
```

---

### Solução 4: Testar Conexão Local Primeiro

```bash
# No servidor, testar localmente
curl http://localhost:3000/health

# Se funcionar localmente, o problema é firewall ou rede
# Se não funcionar, o problema é o backend não estar rodando
```

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Backend está rodando? (`ps aux | grep node`)
- [ ] Porta 3000 está em uso? (`netstat -tlnp | grep :3000`)
- [ ] Firewall permite porta 3000? (`ufw status`)
- [ ] Backend compilou sem erros? (`npm run build`)
- [ ] Banco de dados está acessível? (`systemctl status postgresql`)
- [ ] Arquivo .env existe e está configurado? (`cat backend/.env`)
- [ ] Teste local funciona? (`curl http://localhost:3000/health`)

---

## 🔧 COMANDOS ÚTEIS

### Verificar Processos Node

```bash
ps aux | grep node | grep -v grep
```

### Verificar Portas em Uso

```bash
sudo netstat -tlnp | grep -E ":(3000|3001)"
```

### Verificar Logs do Backend

```bash
# Se houver logs em arquivo
tail -f backend/logs/*.log

# Se rodando via npm
# Logs aparecem no terminal onde foi iniciado
```

### Reiniciar Backend

```bash
# Se rodando como serviço
sudo systemctl restart smartsignage-backend

# Se rodando manualmente
# 1. Encontrar PID
ps aux | grep "node.*backend"

# 2. Matar processo
kill <PID>

# 3. Reiniciar
cd backend && npm start
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Verificar se backend está rodando**
2. **Verificar porta correta (3000, não 3001)**
3. **Verificar firewall**
4. **Verificar logs de erro**
5. **Testar localmente primeiro**

---

**Última atualização:** 2026-01-03
