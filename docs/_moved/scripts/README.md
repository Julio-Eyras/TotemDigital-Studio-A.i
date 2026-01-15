# 🔧 SCRIPTS DE GERENCIAMENTO - SMART SIGNAGE PRO v2.0

Este diretório contém scripts para gerenciar completamente o sistema Smart Signage Pro v2.0.

## 📋 **SCRIPTS DISPONÍVEIS**

### **1. Script Principal de Gerenciamento**

#### **Linux/macOS:**
```bash
./manage-system.sh [COMANDO]
```

#### **Windows:**
```cmd
manage-system.bat [COMANDO]
```

**Comandos disponíveis:**
- `start` - Iniciar todos os serviços
- `stop` - Parar todos os serviços  
- `restart` - Reiniciar todos os serviços
- `status` - Mostrar status dos serviços
- `logs` - Mostrar logs dos serviços
- `backup` - Fazer backup do sistema
- `restore` - Restaurar backup
- `update` - Atualizar sistema
- `rebuild` - Rebuild completo
- `clean` - Limpar containers e volumes
- `health` - Verificar saúde do sistema
- `reset` - Reset completo (CUIDADO!)

### **2. Scripts Específicos**

#### **Backup do Sistema**
```bash
./scripts/backup-system.sh
```
- Faz backup completo dos dados e configuração
- Cria arquivos `.tar.gz` com timestamp
- Limpa backups antigos automaticamente

#### **Restore de Backup**
```bash
./scripts/restore-backup.sh <arquivo-backup>
```
- Restaura backup completo do sistema
- Requer confirmação múltipla
- Verifica saúde após restore

#### **Reset Completo**
```bash
./scripts/reset-system.sh
```
- Remove completamente o sistema
- Requer confirmação tripla
- Remove todos os dados permanentemente

#### **Monitor em Tempo Real**
```bash
./scripts/monitor-system.sh [-i SECONDS]
```
- Monitora sistema em tempo real
- Mostra status de containers, endpoints, recursos
- Atualiza automaticamente

---

## 🚀 **EXEMPLOS DE USO**

### **Iniciar o Sistema**
```bash
# Linux/macOS
./manage-system.sh start

# Windows
manage-system.bat start
```

### **Verificar Status**
```bash
# Linux/macOS
./manage-system.sh status

# Windows
manage-system.bat status
```

### **Fazer Backup**
```bash
# Linux/macOS
./manage-system.sh backup

# Windows
manage-system.bat backup
```

### **Monitorar Sistema**
```bash
# Monitor com intervalo padrão (5s)
./scripts/monitor-system.sh

# Monitor com intervalo personalizado (10s)
./scripts/monitor-system.sh -i 10
```

### **Reset Completo**
```bash
# ATENÇÃO: Remove todos os dados!
./scripts/reset-system.sh
```

---

## 📊 **MONITORAMENTO**

### **Status dos Serviços**
O script de status verifica:
- ✅ Containers Docker rodando
- ✅ Endpoints respondendo
- ✅ Health checks funcionando
- ✅ Conectividade de rede

### **Monitor em Tempo Real**
O monitor mostra:
- 📦 Status dos containers
- 🌐 Status dos endpoints
- 📊 Uso de recursos (CPU, RAM, Disco)
- 🌐 Estatísticas de rede
- 🚨 Alertas do sistema
- 📋 Logs recentes

### **Alertas Automáticos**
O sistema detecta:
- Containers não saudáveis
- Endpoints indisponíveis
- Uso crítico de disco (>90%)
- Uso crítico de memória (>90%)

---

## 🔧 **MANUTENÇÃO**

### **Backup Automático**
```bash
# Adicionar ao crontab para backup diário
0 2 * * * /caminho/para/scripts/backup-system.sh
```

### **Limpeza Automática**
```bash
# Limpar sistema semanalmente
0 3 * * 0 /caminho/para/manage-system.sh clean
```

### **Monitoramento Contínuo**
```bash
# Executar monitor em background
nohup ./scripts/monitor-system.sh > monitor.log 2>&1 &
```

---

## 🚨 **SOLUÇÃO DE PROBLEMAS**

### **Problemas Comuns**

#### **1. Docker não está rodando**
```bash
# Linux
sudo systemctl start docker

# macOS
open -a Docker

# Windows
# Iniciar Docker Desktop
```

#### **2. Portas ocupadas**
```bash
# Verificar portas em uso
netstat -tlnp | grep -E ":(80|3000|3001|3002|9090|11434)"

# Parar serviços conflitantes
sudo systemctl stop apache2  # Se necessário
```

#### **3. Permissões insuficientes**
```bash
# Dar permissão de execução
chmod +x *.sh scripts/*.sh

# Adicionar usuário ao grupo docker
sudo usermod -aG docker $USER
```

#### **4. Espaço em disco insuficiente**
```bash
# Verificar espaço
df -h

# Limpar sistema Docker
docker system prune -af

# Limpar logs antigos
sudo journalctl --vacuum-time=7d
```

### **Logs Importantes**
```bash
# Logs do sistema
./manage-system.sh logs

# Logs específicos
./manage-system.sh logs backend
./manage-system.sh logs frontend
./manage-system.sh logs postgres
```

### **Recuperação de Emergência**
```bash
# 1. Parar tudo
./manage-system.sh stop

# 2. Limpar sistema
./manage-system.sh clean

# 3. Rebuild completo
./manage-system.sh rebuild

# 4. Verificar saúde
./manage-system.sh health
```

---

## 📞 **SUPORTE**

### **Comandos de Diagnóstico**
```bash
# Status completo
./manage-system.sh status

# Saúde do sistema
./manage-system.sh health

# Logs detalhados
./manage-system.sh logs

# Monitor em tempo real
./scripts/monitor-system.sh
```

### **Informações do Sistema**
```bash
# Versão do Docker
docker --version

# Versão do Compose
docker compose version

# Informações do sistema
uname -a
df -h
free -h
```

### **Contato**
- **Email:** suporte@smart-signage.com
- **Documentação:** docs.smart-signage.com
- **GitHub:** github.com/smart-signage/pro

---

## 📋 **CHECKLIST DE MANUTENÇÃO**

### **Diário**
- [ ] Verificar status dos serviços
- [ ] Monitorar logs de erro
- [ ] Verificar uso de recursos

### **Semanal**
- [ ] Fazer backup completo
- [ ] Limpar logs antigos
- [ ] Verificar atualizações
- [ ] Testar restore de backup

### **Mensal**
- [ ] Atualizar sistema
- [ ] Revisar configurações
- [ ] Verificar segurança
- [ ] Documentar mudanças

---

**🎉 Com esses scripts, você tem controle total sobre o Smart Signage Pro v2.0!**