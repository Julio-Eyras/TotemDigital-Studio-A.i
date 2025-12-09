# 📚 DOCUMENTAÇÃO COMPLETA - SMART SIGNAGE PRO v2.0

## 🎯 **RESUMO DO QUE FOI CRIADO**

### **1. 📖 MANUAL DO USUÁRIO**
- **Arquivo:** `MANUAL_USUARIO.md`
- **Conteúdo:** Manual completo com instalação, configuração, uso e solução de problemas
- **Inclui:** 
  - Instalação automática e manual
  - Configuração de players (Web, Android, Windows, Linux)
  - Uso do sistema (clientes, campanhas, mídia)
  - Analytics e relatórios
  - Solução de problemas

### **2. 🔧 SCRIPTS DE GERENCIAMENTO**

#### **Script Principal (Linux/macOS):**
- **Arquivo:** `manage-system.sh`
- **Funções:** start, stop, restart, status, logs, backup, restore, update, rebuild, clean, health, reset

#### **Script Principal (Windows):**
- **Arquivo:** `manage-system.bat`
- **Funções:** Mesmas do script Linux, adaptadas para Windows

#### **Scripts Específicos:**
- **`scripts/backup-system.sh`** - Backup automático completo
- **`scripts/restore-backup.sh`** - Restore de backup com verificações
- **`scripts/reset-system.sh`** - Reset completo com confirmações múltiplas
- **`scripts/monitor-system.sh`** - Monitor em tempo real

### **3. 📋 DOCUMENTAÇÃO DOS SCRIPTS**
- **Arquivo:** `scripts/README.md`
- **Conteúdo:** Instruções detalhadas de uso, exemplos, solução de problemas

### **4. 🚀 SCRIPT DE INSTALAÇÃO ATUALIZADO**
- **Arquivo:** `install-smartsignage.sh`
- **Novidades:** 
  - Configuração automática dos scripts de gerenciamento
  - Backup automático via crontab
  - Comando global `smartsignage`
  - Limpeza automática semanal

---

## 🎮 **COMANDOS PRINCIPAIS**

### **Gerenciamento Básico**
```bash
# Linux/macOS
./manage-system.sh start      # Iniciar sistema
./manage-system.sh stop       # Parar sistema
./manage-system.sh restart    # Reiniciar sistema
./manage-system.sh status     # Ver status
./manage-system.sh health     # Verificar saúde

# Windows
manage-system.bat start
manage-system.bat stop
manage-system.bat restart
manage-system.bat status
manage-system.bat health
```

### **Backup e Restore**
```bash
# Fazer backup
./manage-system.sh backup
# ou
./scripts/backup-system.sh

# Restaurar backup
./manage-system.sh restore backups/backup-smartsignage-20241027-143022.tar.gz
# ou
./scripts/restore-backup.sh backups/backup-smartsignage-20241027-143022.tar.gz
```

### **Monitoramento**
```bash
# Monitor em tempo real
./scripts/monitor-system.sh

# Monitor com intervalo personalizado
./scripts/monitor-system.sh -i 10
```

### **Reset Completo**
```bash
# ATENÇÃO: Remove todos os dados!
./scripts/reset-system.sh
```

### **Comando Global (após instalação)**
```bash
smartsignage start
smartsignage status
smartsignage backup
smartsignage health
```

---

## 🌐 **PONTOS DE ENTRADA**

### **Interfaces Web**
- **Frontend Admin:** `http://seu-servidor:3001`
- **API Backend:** `http://seu-servidor:3000`
- **Grafana:** `http://seu-servidor:3002` (admin/admin)
- **Prometheus:** `http://seu-servidor:9090`

### **APIs Principais**
- **Health Check:** `GET /health`
- **API Health:** `GET /api/health`
- **Autenticação:** `POST /api/auth/login`
- **Usuários:** `GET /api/users`
- **Clientes:** `GET /api/clients`
- **Totems:** `GET /api/totems`
- **Mídia:** `GET /api/media`
- **Playlists:** `GET /api/playlists`
- **Campanhas:** `GET /api/campaigns`
- **Analytics:** `GET /api/analytics`

---

## 📱 **CONFIGURAÇÃO DE PLAYERS**

### **1. Player Web (Navegador)**
```javascript
const playerConfig = {
    serverUrl: 'http://seu-servidor:3000',
    totemId: 'TOTEM_001',
    updateInterval: 30000,
    fallbackContent: 'default-playlist'
};
const player = new SmartSignagePlayer(playerConfig);
player.start();
```

### **2. Player Android**
```xml
<meta-data
    android:name="SMART_SIGNAGE_SERVER_URL"
    android:value="http://seu-servidor:3000" />
<meta-data
    android:name="SMART_SIGNAGE_TOTEM_ID"
    android:value="TOTEM_001" />
```

### **3. Player Windows**
```json
{
    "serverUrl": "http://seu-servidor:3000",
    "totemId": "TOTEM_001",
    "updateInterval": 30000,
    "fullscreen": true,
    "autoStart": true
}
```

### **4. Player Linux (Raspberry Pi)**
```bash
# Autostart
@chromium-browser --kiosk --disable-infobars http://seu-servidor:3000/player?totem=TOTEM_001
@unclutter -idle 0.1 -root
```

---

## 🔧 **MANUTENÇÃO AUTOMÁTICA**

### **Backup Automático**
- **Frequência:** Diário às 2:00
- **Localização:** `backups/`
- **Retenção:** 7 dias
- **Comando:** `crontab -l` para verificar

### **Limpeza Automática**
- **Frequência:** Semanal aos domingos às 3:00
- **Ação:** Remove containers e volumes não utilizados
- **Comando:** `crontab -l` para verificar

### **Monitoramento**
- **Tempo Real:** `./scripts/monitor-system.sh`
- **Logs:** `./manage-system.sh logs`
- **Health Check:** `./manage-system.sh health`

---

## 🚨 **SOLUÇÃO DE PROBLEMAS**

### **Problemas Comuns**

#### **1. Sistema não inicia**
```bash
# Verificar Docker
docker info

# Verificar logs
./manage-system.sh logs

# Rebuild completo
./manage-system.sh rebuild
```

#### **2. Player não conecta**
```bash
# Verificar conectividade
curl http://localhost:3000/health

# Verificar firewall
sudo ufw status

# Testar endpoint
curl http://localhost:3000/api/health
```

#### **3. Backup falha**
```bash
# Verificar espaço em disco
df -h

# Verificar permissões
ls -la backups/

# Backup manual
./scripts/backup-system.sh
```

#### **4. Sistema lento**
```bash
# Verificar recursos
./scripts/monitor-system.sh

# Limpar sistema
./manage-system.sh clean

# Verificar logs de erro
./manage-system.sh logs | grep -i error
```

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

# Informações do sistema
docker --version
docker compose version
uname -a
df -h
free -h
```

---

## 📞 **SUPORTE E CONTATO**

### **Recursos de Suporte**
- **Manual:** `MANUAL_USUARIO.md`
- **Scripts:** `scripts/README.md`
- **API Docs:** `http://seu-servidor:3000/api-docs`
- **Logs:** `./manage-system.sh logs`

### **Contato Técnico**
- **Email:** suporte@smart-signage.com
- **Documentação:** docs.smart-signage.com
- **GitHub:** github.com/smart-signage/pro

---

## 🎉 **CONCLUSÃO**

O Smart Signage Pro v2.0 agora possui:

✅ **Manual completo do usuário** com todas as instruções
✅ **Scripts de gerenciamento completos** para Linux, macOS e Windows
✅ **Sistema de backup automático** com retenção configurável
✅ **Monitor em tempo real** com alertas automáticos
✅ **Scripts de restore e reset** com verificações de segurança
✅ **Instalação automatizada** com configuração de scripts
✅ **Comando global** para facilitar o uso
✅ **Documentação técnica** completa

**O sistema está pronto para produção com ferramentas profissionais de gerenciamento!** 🚀
