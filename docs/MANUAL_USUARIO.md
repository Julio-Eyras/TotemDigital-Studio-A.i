# 📚 MANUAL DO USUÁRIO - SMART SIGNAGE PRO v2.0

## 🎯 **VISÃO GERAL**

O Smart Signage Pro v2.0 é um sistema completo de sinalização digital profissional que permite:
- Gestão de clientes e usuários
- Criação e distribuição de campanhas
- Upload e gestão de mídia
- Playlists inteligentes com IA
- Analytics e relatórios detalhados
- Faturamento e cobrança automática
- QR Codes dinâmicos
- Integração com IA (Ollama/OpenAI/Anthropic)

---

## 🚀 **INSTALAÇÃO**

### **Pré-requisitos**
- Ubuntu 20.04+ ou CentOS 8+
- Docker e Docker Compose
- Mínimo 4GB RAM, 20GB disco
- Portas abertas: 80, 443, 3000, 3001, 3002, 9090, 11434

### **Instalação Automática**
```bash
# 1. Baixar e extrair o projeto
wget https://github.com/Julio-Eyras/smartsignage-pro/archive/main.zip
unzip main.zip
cd smartsignage-pro-main

# 2. Executar instalação
chmod +x install-smartsignage.sh
./install-smartsignage.sh
```

### **Instalação Manual**
```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo usermod -aG docker $USER

# 2. Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Configurar variáveis de ambiente
cp env.example .env
nano .env

# 4. Iniciar sistema
docker compose up -d
```

---

## ⚙️ **CONFIGURAÇÃO INICIAL**

### **1. Configuração do Banco de Dados**
```bash
# Arquivo: .env
DB_DRIVER=postgres
DATABASE_URL=postgresql://smartsignage:smartsignage123@postgres:5432/smartsignage
```

### **2. Configuração de Segurança**
```bash
# Arquivo: .env
JWT_SECRET=seu-jwt-secret-super-seguro-aqui
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

### **3. Configuração de IA**
```bash
# Arquivo: .env
AI_PROVIDER=ollama
AI_MODEL=llama3.2:3b
OLLAMA_BASE_URL=http://ollama:11434
```

### **4. Configuração de Upload**
```bash
# Arquivo: .env
UPLOAD_MAX_SIZE=100MB
UPLOAD_PATH=/app/uploads
MEDIA_QUOTA_PER_CLIENT=5GB
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
// Configuração básica do player
const playerConfig = {
    serverUrl: 'http://seu-servidor:3000',
    totemId: 'TOTEM_001',
    updateInterval: 30000, // 30 segundos
    fallbackContent: 'default-playlist'
};

// Inicializar player
const player = new SmartSignagePlayer(playerConfig);
player.start();
```

### **2. Player Android**
```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WAKE_LOCK" />

<!-- Configuração do player -->
<meta-data
    android:name="SMART_SIGNAGE_SERVER_URL"
    android:value="http://seu-servidor:3000" />
<meta-data
    android:name="SMART_SIGNAGE_TOTEM_ID"
    android:value="TOTEM_001" />
```

### **3. Player Windows**
```json
// player-config.json
{
    "serverUrl": "http://seu-servidor:3000",
    "totemId": "TOTEM_001",
    "updateInterval": 30000,
    "fullscreen": true,
    "autoStart": true,
    "fallbackContent": "default-playlist"
}
```

### **4. Player Linux (Raspberry Pi)**
```bash
# Instalar dependências
sudo apt update
sudo apt install chromium-browser unclutter

# Configurar autostart
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart

# Adicionar:
@chromium-browser --kiosk --disable-infobars http://seu-servidor:3000/player?totem=TOTEM_001
@unclutter -idle 0.1 -root
```

---

## 🎮 **USO DO SISTEMA**

### **1. Primeiro Acesso**
1. Acesse `http://seu-servidor:3001`
2. Faça login com:
   - **Email:** admin@smart-signage.com
   - **Senha:** admin
3. Altere a senha padrão
4. Configure suas informações

### **2. Gestão de Clientes**
1. **Criar Cliente:**
   - Nome da empresa
   - Contato e dados
   - Plano de assinatura
   - Quota de mídia

2. **Configurar Totems:**
   - ID único do totem
   - Localização física
   - Especificações técnicas
   - Playlist padrão

### **3. Upload de Mídia**
1. **Formatos Suportados:**
   - **Vídeos:** MP4, AVI, MOV, WebM
   - **Imagens:** JPG, PNG, GIF, WebP
   - **Documentos:** PDF, PPT, PPTX

2. **Limites:**
   - Tamanho máximo: 100MB por arquivo
   - Quota por cliente: 5GB (configurável)
   - Resolução recomendada: 1920x1080

### **4. Criação de Campanhas**
1. **Campanha Simples:**
   - Selecionar mídia
   - Definir duração
   - Escolher totems
   - Agendar publicação

2. **Campanha Inteligente:**
   - Usar IA para otimização
   - Segmentação automática
   - A/B testing
   - Analytics em tempo real

### **5. Playlists Inteligentes**
1. **Criação Automática:**
   - IA analisa conteúdo
   - Sugere ordem otimizada
   - Considera horários
   - Adapta ao público

2. **Personalização:**
   - Horários específicos
   - Dias da semana
   - Eventos especiais
   - Conteúdo sazonal

---

## 📊 **ANALYTICS E RELATÓRIOS**

### **1. Dashboard Principal**
- Visualizações por totem
- Tempo de exibição
- Interações do usuário
- Performance por campanha

### **2. Relatórios Disponíveis**
- **Relatório Diário:** Resumo do dia
- **Relatório Semanal:** Tendências semanais
- **Relatório Mensal:** Análise completa
- **Relatório por Cliente:** Performance individual

### **3. Métricas Importantes**
- **Impressões:** Quantas vezes foi exibido
- **Engajamento:** Interações do usuário
- **Conversão:** Ações desejadas
- **ROI:** Retorno sobre investimento

---

## 🔧 **MANUTENÇÃO E MONITORAMENTO**

### **1. Monitoramento do Sistema**
- **Grafana:** Dashboards visuais
- **Prometheus:** Métricas técnicas
- **Logs:** Análise de problemas
- **Alertas:** Notificações automáticas

### **2. Backup e Restore**
```bash
# Backup automático
./scripts/backup-system.sh

# Restore
./scripts/restore-system.sh backup-2024-01-15.tar.gz
```

### **3. Atualizações**
```bash
# Atualizar sistema
./scripts/update-system.sh

# Rebuild completo
./scripts/rebuild-architecture.sh
```

---

## 🚨 **SOLUÇÃO DE PROBLEMAS**

### **Problemas Comuns**

#### **1. Player não conecta**
- Verificar conectividade de rede
- Confirmar URL do servidor
- Verificar firewall
- Testar endpoint `/health`

#### **2. Mídia não carrega**
- Verificar formato suportado
- Confirmar tamanho do arquivo
- Verificar quota do cliente
- Testar upload manual

#### **3. Sistema lento**
- Verificar recursos do servidor
- Analisar logs de erro
- Verificar conexão com banco
- Monitorar uso de CPU/RAM

#### **4. Erro de autenticação**
- Verificar JWT_SECRET
- Confirmar expiração do token
- Verificar permissões do usuário
- Testar login manual

### **Logs Importantes**
```bash
# Logs do sistema
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# Logs específicos
tail -f logs/app.log
tail -f logs/error.log
```

---

## 📞 **SUPORTE E CONTATO**

### **Documentação Técnica**
- **API Docs:** `http://seu-servidor:3000/api-docs`
- **Swagger UI:** Interface interativa
- **Postman Collection:** Importar para testes

### **Contato Técnico**
- **Email:** suporte@smart-signage.com
- **Telefone:** +55 11 99999-9999
- **Chat:** Disponível no sistema
- **Ticket:** Sistema de tickets integrado

### **Recursos Adicionais**
- **Tutoriais em vídeo:** Canal YouTube
- **Fórum da comunidade:** community.smart-signage.com
- **GitHub:** github.com/smart-signage/pro
- **Documentação:** docs.smart-signage.com

---

## 📋 **CHECKLIST DE IMPLANTAÇÃO**

### **Antes da Instalação**
- [ ] Servidor com requisitos mínimos
- [ ] Docker e Docker Compose instalados
- [ ] Portas de rede abertas
- [ ] Backup do sistema anterior (se houver)

### **Durante a Instalação**
- [ ] Executar script de instalação
- [ ] Configurar variáveis de ambiente
- [ ] Testar conectividade
- [ ] Verificar health checks

### **Após a Instalação**
- [ ] Login inicial funcionando
- [ ] Upload de mídia testado
- [ ] Player conectando
- [ ] Relatórios gerando
- [ ] Backup configurado

### **Configuração de Produção**
- [ ] SSL/HTTPS configurado
- [ ] Firewall ajustado
- [ ] Monitoramento ativo
- [ ] Alertas configurados
- [ ] Backup automático
- [ ] Documentação atualizada

---

**🎉 Parabéns! Seu sistema Smart Signage Pro v2.0 está pronto para uso!**
