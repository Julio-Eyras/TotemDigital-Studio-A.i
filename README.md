# 🚀 SmartSignage-Pro

**Sinalização Digital Profissional**  
*Tudo que você precisa para começar*

---

## 📋 **VISÃO GERAL**

O **SmartSignage-Pro** é um sistema completo de sinalização digital desenvolvido para pequenas e médias empresas. Oferece todas as funcionalidades essenciais para criar, gerenciar e exibir conteúdo digital de forma profissional e acessível.

### 🎯 **Mercado-Alvo**
- Pequenas e médias empresas
- Restaurantes e cafés
- Lojas e comércios locais
- Escritórios e consultórios
- Instituições de ensino

### 💰 **Preço**
- **Inicial**: R$ 2.000 - R$ 10.000
- **Licenciamento**: Anual
- **Suporte**: Comunidade + básico

---

## ✨ **FUNCIONALIDADES PRINCIPAIS**

### 🏗️ **Backend Completo**
- ✅ **15 Serviços** implementados
- ✅ **API RESTful** completa
- ✅ **Autenticação JWT** com RBAC
- ✅ **Database Dual** (SQLite + PostgreSQL)
- ✅ **Middleware** completo (auth, validation, logging)
- ✅ **Zero Mocks** - implementação real

### 🎨 **Frontend Moderno**
- ✅ **React 18** + TypeScript
- ✅ **Material-UI** para interface
- ✅ **Redux Toolkit** para estado
- ✅ **Responsive Design**
- ✅ **Dark/Light Theme**

### 📺 **Player HTML5 Otimizado**
- ✅ **Reprodução automática** de mídias
- ✅ **Suporte completo** (imagens, vídeos, áudio)
- ✅ **Transições suaves** entre conteúdos
- ✅ **Controle de duração** personalizado
- ✅ **Modo kiosk** para totens

### 🔧 **Instalação Flexível**
- ✅ **Single-Server** - Instalação tradicional
- ✅ **Docker** - Containerização completa
- ✅ **Desenvolvimento** - Ambiente de dev
- ✅ **Scripts automatizados** de instalação

---

## 🚀 **INSTALAÇÃO RÁPIDA**

### **Modo Docker (Recomendado)**
```bash
# Clone o repositório
git clone https://github.com/SmartSignage-Solutions/SmartSignage-Pro.git
cd SmartSignage-Pro

# Execute a instalação
./scripts/install.sh --mode docker

# Acesse o sistema
http://localhost:80/admin
```

### **Modo Single-Server**
```bash
# Execute a instalação
./scripts/install.sh --mode single-server

# Acesse o sistema
http://localhost:3000/admin
```

### **Modo Desenvolvimento**
```bash
# Instale dependências
npm install

# Execute em modo dev
npm run dev

# Acesse o sistema
http://localhost:3000/admin
```

---

## 📊 **ARQUITETURA TÉCNICA**

### **Stack Tecnológico**
```
Frontend: React + TypeScript + Material-UI
Backend: Node.js + Express + TypeScript
Database: SQLite (dev) / PostgreSQL (prod)
Player: HTML5 + CSS3 + JavaScript
Deployment: Docker + Docker Compose
```

### **Estrutura do Projeto**
```
SmartSignage-Pro/
├── backend/                   # API Node.js
│   ├── src/
│   │   ├── services/         # 15 serviços implementados
│   │   ├── routes/           # Rotas RESTful
│   │   ├── middleware/       # Auth, validation, logging
│   │   └── database/         # Schemas e migrations
├── frontend/                  # Interface React
│   ├── src/
│   │   ├── components/       # Componentes reutilizáveis
│   │   ├── pages/            # Páginas principais
│   │   ├── store/            # Redux store
│   │   └── services/         # API services
├── player/                    # Player HTML5
│   └── index.html            # Player otimizado
├── scripts/                   # Scripts de instalação
│   ├── install.sh            # Instalação automatizada
│   ├── first-boot.sh         # Configuração inicial
│   └── test-installation.sh  # Testes de instalação
└── docs/                      # Documentação
```

---

## 🎯 **MÓDULOS PRINCIPAIS**

### 👥 **Gestão de Usuários**
- Criação e edição de usuários
- Sistema de roles e permissões
- Autenticação segura
- Auditoria de ações

### 🏢 **Gestão de Clientes**
- Cadastro de clientes
- Histórico de atividades
- Estatísticas de uso
- Relatórios personalizados

### 📺 **Gestão de Totens**
- Configuração de totens
- Monitoramento em tempo real
- Heartbeat automático
- Métricas de performance

### 🎬 **Gestão de Mídia**
- Upload de arquivos
- Processamento automático
- Geração de thumbnails
- Streaming otimizado

### 📋 **Gestão de Playlists**
- Criação de playlists
- Agendamento de conteúdo
- Controle de duração
- Ativação/desativação

### 📊 **Analytics**
- Métricas de uso
- Relatórios detalhados
- Exportação de dados
- Dashboards personalizados

---

## 🔧 **CONFIGURAÇÃO**

### **Variáveis de Ambiente**
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/smartsignage
DATABASE_TYPE=postgresql  # ou sqlite

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Server
PORT=3000
NODE_ENV=production

# Storage
UPLOAD_PATH=/var/uploads
MAX_FILE_SIZE=100MB
```

### **Configuração do Player**
```javascript
// Configurações do totem
const PLAYER_CONFIG = {
  apiUrl: 'http://localhost:3000/api',
  heartbeatInterval: 30000,
  playlistUpdateInterval: 300000,
  defaultDuration: 10000
};
```

---

## 📈 **MÉTRICAS E PERFORMANCE**

### **Especificações Técnicas**
- **RAM Mínima**: 2GB
- **CPU**: 2 cores
- **Armazenamento**: 10GB
- **Rede**: 10 Mbps

### **Performance**
- **Tempo de Boot**: < 30 segundos
- **Latência API**: < 100ms
- **Uso de RAM**: < 200MB
- **Throughput**: 100+ requests/min

### **Escalabilidade**
- **Totens Suportados**: 1000+
- **Usuários Simultâneos**: 100+
- **Mídias**: Ilimitadas
- **Playlists**: Ilimitadas

---

## 🛠️ **DESENVOLVIMENTO**

### **Pré-requisitos**
- Node.js 18+
- npm 9+
- Docker (opcional)
- PostgreSQL (produção)

### **Scripts Disponíveis**
```bash
# Desenvolvimento
npm run dev              # Executa em modo dev
npm run build            # Build de produção
npm run test             # Executa testes
npm run lint             # Verifica código

# Instalação
./scripts/install.sh     # Instalação completa
./scripts/test-installation.sh  # Testa instalação
```

### **Testes**
```bash
# Testes unitários
npm run test:unit

# Testes de integração
npm run test:integration

# Testes end-to-end
npm run test:e2e

# Cobertura
npm run test:coverage
```

---

## 📚 **DOCUMENTAÇÃO**

### **Guias Disponíveis**
- [Guia de Instalação](docs/installation.md)
- [Manual do Usuário](docs/user-guide.md)
- [API Reference](docs/api.md)
- [Troubleshooting](docs/troubleshooting.md)
- [FAQ](docs/faq.md)

### **Exemplos**
- [Configuração Básica](examples/basic-setup.md)
- [Deploy em Produção](examples/production-deploy.md)
- [Integração Personalizada](examples/custom-integration.md)

---

## 🤝 **SUPORTE**

### **Comunidade**
- **GitHub Issues**: [Reportar bugs](https://github.com/SmartSignage-Solutions/SmartSignage-Pro/issues)
- **Discord**: [Comunidade](https://discord.gg/smartsignage)
- **Documentação**: [Wiki](https://github.com/SmartSignage-Solutions/SmartSignage-Pro/wiki)

### **Suporte Comercial**
- **Email**: support@smartsignage.com
- **Telefone**: +55 11 9999-9999
- **Horário**: Segunda a Sexta, 9h às 18h

---

## 📄 **LICENÇA**

Este projeto está licenciado sob a [MIT License](LICENSE).

---

## 🚀 **ROADMAP**

### **v2.1.0 (Q1 2025)**
- [ ] Integração com redes sociais
- [ ] Templates de playlist
- [ ] Backup automático
- [ ] API webhooks

### **v2.2.0 (Q2 2025)**
- [ ] App mobile para gerenciamento
- [ ] Integração com sistemas de pagamento
- [ ] Analytics avançados
- [ ] Multi-idioma

### **v2.3.0 (Q3 2025)**
- [ ] Integração IoT
- [ ] Machine Learning básico
- [ ] Cloud sync
- [ ] Marketplace de conteúdo

---

**📅 Última Atualização**: 25 de Janeiro de 2025  
**👥 Equipe**: Smart Signage Solutions  
**🌐 Website**: [smartsignage.com](https://smartsignage.com)  
**📧 Contato**: contato@smartsignage.com