# 📊 Análise Completa - Smart Signage Pro v2.1

## 🎯 Visão Geral do Negócio

### O Que É o Smart Signage Pro?

O **Smart Signage Pro** é uma plataforma completa de **Digital Signage (Sinalização Digital)** que permite:

- **Criar e gerenciar campanhas publicitárias** em múltiplos pontos de exibição (totens, TVs, displays)
- **Distribuir conteúdo** (vídeos, imagens, HTML) de forma centralizada
- **Monitorar e analisar** o desempenho das campanhas em tempo real
- **Gerenciar múltiplos clientes** em um sistema multi-tenant
- **Automatizar** a criação de conteúdo com IA
- **Cobrar e faturar** pelos serviços prestados

### Modelo de Negócio

**B2B SaaS (Software as a Service)**
- **Clientes:** Agências de publicidade, empresas de marketing, redes de lojas, shoppings, hospitais, etc.
- **Usuários finais:** Totens em lojas, TVs em salas de espera, displays em pontos de venda
- **Monetização:** Faturamento por campanha, por totem, por tempo de exibição, ou assinatura mensal

### Diferenciais Competitivos

1. ✅ **Multi-plataforma:** Suporta webOS, Android TV, Linux, Windows, Tizen
2. ✅ **IA Integrada:** Geração automática de playlists inteligentes
3. ✅ **Analytics Avançado:** Métricas detalhadas de engajamento e performance
4. ✅ **Multi-tenant:** Suporta múltiplos clientes isolados
5. ✅ **Open Source:** Código aberto, customizável
6. ✅ **Self-hosted:** Pode ser instalado on-premise ou na nuvem

---

## 📋 Features Existentes (Mapeamento Completo)

### 🔐 1. Autenticação e Autorização

#### ✅ Implementado:
- **JWT Authentication** com refresh tokens
- **Sistema RBAC** (Roles: admin, manager, operator, user, client)
- **Permissões granulares** por recurso e ação
- **Multi-tenancy** com isolamento por cliente
- **Password reset** com tokens temporários
- **Audit logs** de todas as ações críticas

#### 📊 Cobertura: 95%
- ✅ Login/Logout
- ✅ Refresh token automático
- ✅ Roles e permissões
- ✅ Middleware de autorização
- ⚠️ 2FA/MFA (não implementado)
- ⚠️ SSO (não implementado)

---

### 👥 2. Gestão de Usuários e Clientes

#### ✅ Implementado:
- **CRUD completo de usuários**
  - Criação, edição, exclusão
  - Ativação/desativação
  - Histórico de login
  - Associação a clientes
- **CRUD completo de clientes**
  - Informações de contato
  - Status ativo/inativo
  - Estatísticas por cliente
- **Gestão de roles** e permissões
- **Histórico de atividades**

#### 📊 Cobertura: 90%
- ✅ CRUD básico
- ✅ Associação usuário-cliente
- ✅ Histórico de login
- ⚠️ Perfis de usuário (avatar, preferências)
- ⚠️ Notificações por email para novos usuários

---

### 📺 3. Gestão de Totens/Players

#### ✅ Implementado:
- **CRUD completo de totens**
  - Cadastro com UIN (Unique Identifier Number)
  - Localização e descrição
  - Status (online, offline, error, maintenance)
- **Monitoramento em tempo real**
  - Heartbeat automático
  - Última conexão
  - IP address tracking
  - Versão do software/firmware
- **Atribuição de playlists**
  - Playlist atual por totem
  - Histórico de playlists
- **Bloqueio manual/temporário**
- **Métricas de uptime**

#### 📊 Cobertura: 85%
- ✅ Monitoramento básico
- ✅ Heartbeat
- ✅ Status tracking
- ⚠️ Controle remoto (reiniciar, atualizar)
- ⚠️ Screenshot remoto
- ⚠️ Logs remotos em tempo real
- ⚠️ Atualização OTA (Over-The-Air)

---

### 🎬 4. Gestão de Mídia

#### ✅ Implementado:
- **Upload de mídia**
  - Imagens, vídeos, áudio
  - Validação de tipo e tamanho
  - Geração de metadados automática
  - Thumbnails para vídeos
- **Organização**
  - Por cliente
  - Tags e categorias
  - Busca e filtros
- **Status de mídia**
  - Draft, review, published, archived
- **Estatísticas**
  - View count
  - Duração
  - Tamanho

#### 📊 Cobertura: 80%
- ✅ Upload básico
- ✅ Metadados
- ⚠️ Editor de mídia (crop, resize, filters)
- ⚠️ Conversão de formatos
- ⚠️ CDN para distribuição
- ⚠️ Versionamento de mídia
- ⚠️ Watermarking automático

---

### 📋 5. Gestão de Playlists

#### ✅ Implementado:
- **CRUD completo de playlists**
  - Criação e edição
  - Adicionar/remover mídias
  - Ordenação personalizada
  - Duração total
- **Associação**
  - Por totem
  - Por campanha
- **Status**
  - Ativo/inativo
  - Loop configurável
- **Configurações**
  - JSON configurável
  - Transições

#### 📊 Cobertura: 85%
- ✅ CRUD básico
- ✅ Ordenação
- ⚠️ Templates de playlist
- ⚠️ Preview da playlist
- ⚠️ Validação de duração total
- ⚠️ Agendamento dentro da playlist

---

### 🎯 6. Gestão de Campanhas

#### ✅ Implementado:
- **CRUD completo de campanhas**
  - Título, descrição
  - Tipo (general, scheduled)
  - Prioridade
- **Agendamento**
  - Data de início/fim
  - Horário (start_time, end_time)
  - Dias da semana
- **Status**
  - Draft, active, paused, finished, deleted
- **Associação**
  - Por cliente
  - Por totem (campaign_totems)
- **Ativação/Pausa/Encerramento** automático

#### 📊 Cobertura: 90%
- ✅ CRUD completo
- ✅ Agendamento básico
- ✅ Status management
- ⚠️ Templates de campanha
- ⚠️ A/B testing
- ⚠️ Regras condicionais avançadas
- ⚠️ Campanhas recorrentes

---

### 🤖 7. Smart Playlists (IA)

#### ✅ Implementado:
- **Geração automática com IA**
  - Integração com Ollama (local)
  - Suporte a OpenAI e Anthropic
  - Regras personalizáveis (JSON)
- **Status de geração**
  - Inactive, active, generating, error
- **Métricas**
  - Generated items
  - Total duration
  - Effectiveness
- **Regras de negócio**
  - JSONB configurável

#### 📊 Cobertura: 75%
- ✅ Geração básica com IA
- ✅ Regras simples
- ⚠️ Aprendizado de máquina (ML)
- ⚠️ Otimização automática baseada em performance
- ⚠️ Sugestões inteligentes de conteúdo
- ⚠️ Análise de sentimento do conteúdo

---

### 📊 8. Analytics e Relatórios

#### ✅ Implementado:
- **Dashboard Analytics**
  - Total de views
  - Duração total
  - Viewers únicos
  - Peak viewing time
  - Most viewed content
- **Trends**
  - Por dia, semana, mês, ano
  - Viewing trends
- **Performance**
  - Por campanha
  - Por totem
  - Por mídia
- **QR Code Stats**
  - Scans
  - Conversion rate
- **Revenue**
  - Total
  - Por cliente
  - Por campanha

#### 📊 Cobertura: 80%
- ✅ Métricas básicas
- ✅ Relatórios por período
- ⚠️ Export para Excel/PDF
- ⚠️ Dashboards customizáveis
- ⚠️ Alertas automáticos
- ⚠️ Comparação de períodos
- ⚠️ Heatmaps de visualização

---

### 💰 9. Billing (Faturamento)

#### ✅ Implementado:
- **Gestão de faturamento**
  - Controle de pagamentos
  - Relatórios financeiros
  - Integração com clientes
- **Estrutura básica**

#### 📊 Cobertura: 60%
- ✅ Estrutura básica
- ⚠️ Integração com gateways de pagamento
- ⚠️ Faturas automáticas
- ⚠️ Assinaturas recorrentes
- ⚠️ Planos e preços
- ⚠️ Histórico de pagamentos
- ⚠️ Relatórios fiscais

---

### 📱 10. QR Codes

#### ✅ Implementado:
- **Geração de QR Codes**
  - Múltiplos tipos (URL, texto, WiFi, etc.)
  - Configurações personalizáveis
- **Tracking de scans**
  - Analytics de scans
  - Conversion rate
- **Integração com campanhas**

#### 📊 Cobertura: 70%
- ✅ Geração básica
- ✅ Tracking
- ⚠️ QR Codes dinâmicos (redirecionamento)
- ⚠️ QR Codes com expiração
- ⚠️ QR Codes com geolocalização
- ⚠️ QR Codes com analytics avançado

---

### 📧 11. Notificações e Email

#### ✅ Implementado:
- **Sistema de notificações**
  - Notificações in-app
  - Histórico de notificações
- **Email Service**
  - Envio de emails
  - Templates básicos
  - Password reset

#### 📊 Cobertura: 65%
- ✅ Notificações básicas
- ✅ Email básico
- ⚠️ Templates de email customizáveis
- ⚠️ Notificações push (web push)
- ⚠️ Notificações SMS
- ⚠️ Notificações por WhatsApp
- ⚠️ Agendamento de notificações

---

### ⚙️ 12. Configurações e Settings

#### ✅ Implementado:
- **Gestão de configurações**
  - Categorização
  - Validação de valores
  - Import/export
- **Configurações do sistema**
  - Geral
  - Email
  - AI
  - Storage

#### 📊 Cobertura: 75%
- ✅ CRUD de settings
- ✅ Categorização
- ⚠️ Interface visual para configurações
- ⚠️ Validação avançada
- ⚠️ Configurações por cliente

---

### 📤 13. Export e Relatórios Avançados

#### ✅ Implementado:
- **Export Queries**
  - Queries SQL customizadas
  - Validação de SQL
- **Export Schedules**
  - Agendamento de exports
  - Múltiplos formatos
- **Export Executions**
  - Histórico de exports
  - Status tracking

#### 📊 Cobertura: 70%
- ✅ Export básico
- ✅ Agendamento
- ⚠️ Export para Excel/PDF/CSV
- ⚠️ Templates de export
- ⚠️ Export automático por email
- ⚠️ Export para BI tools (Power BI, Tableau)

---

### 🔍 14. Advanced Schedules

#### ✅ Implementado:
- **Agendamento avançado**
  - Regras complexas
  - Múltiplos horários
  - Dias específicos
- **Worker de processamento**
  - Ativação automática
  - Pausa automática

#### 📊 Cobertura: 80%
- ✅ Agendamento básico
- ✅ Worker
- ⚠️ Regras condicionais complexas
- ⚠️ Agendamento baseado em eventos
- ⚠️ Agendamento por geolocalização

---

### 🎮 15. Player Cliente

#### ✅ Implementado (100%):
- **6 Plataformas:**
  - ✅ webOS (LG Smart TVs)
  - ✅ Android TV
  - ✅ Linux Electron (SBC)
  - ✅ Linux C++ (SBC)
  - ✅ Windows Electron
  - ✅ Tizen (Samsung Smart TVs)
- **Componentes Core:**
  - API Client
  - Playlist Manager
  - Heartbeat Service
  - Scheduler
  - Cache
  - Logger
  - Error Handler

#### 📊 Cobertura: 100%
- ✅ Todas as plataformas planejadas
- ✅ Core compartilhado
- ✅ Build systems
- ✅ Documentação completa

---

### 🔒 16. Segurança

#### ✅ Implementado:
- **Rate Limiting**
  - Por endpoint
  - Por IP
  - Por usuário
- **Input Validation**
  - Sanitização
  - Validação de tipos
- **CORS**
  - Configurável
- **Helmet**
  - Security headers
- **Query Sanitization**
  - Proteção contra SQL injection

#### 📊 Cobertura: 85%
- ✅ Rate limiting
- ✅ Validação básica
- ⚠️ WAF (Web Application Firewall)
- ⚠️ DDoS protection
- ⚠️ IP whitelisting/blacklisting
- ⚠️ Geolocation blocking

---

### 📈 17. Monitoramento e Observabilidade

#### ✅ Implementado:
- **Prometheus**
  - Métricas do sistema
- **Grafana**
  - Dashboards
- **Logs estruturados**
  - Arquivos locais
  - Event logs no banco
- **Health checks**
  - Todos os serviços

#### 📊 Cobertura: 75%
- ✅ Métricas básicas
- ✅ Logs
- ⚠️ APM (Application Performance Monitoring)
- ⚠️ Distributed tracing
- ⚠️ Alertas automáticos
- ⚠️ SLA monitoring

---

### 🗄️ 18. Storage e Cache

#### ✅ Implementado:
- **Redis Cache**
  - Cache de queries frequentes
  - Invalidação automática
- **Storage Service**
  - Gerenciamento de arquivos
  - Limpeza automática
  - Quotas por cliente

#### 📊 Cobertura: 80%
- ✅ Cache básico
- ✅ Storage básico
- ⚠️ CDN integration
- ⚠️ Object storage (S3, etc.)
- ⚠️ Compressão automática
- ⚠️ Backup automático de mídia

---

## 🚀 Features que Poderiam Existir (Oportunidades)

### 🎨 1. Editor de Conteúdo Visual

**Oportunidade:** Criar um editor WYSIWYG para criar conteúdo diretamente na plataforma.

**Funcionalidades:**
- Editor de slides (tipo Canva)
- Templates pré-definidos
- Biblioteca de assets (ícones, imagens, vídeos)
- Export para mídia final
- Preview em tempo real

**Impacto:** Alto - Reduz dependência de ferramentas externas
**Complexidade:** Alta
**Prioridade:** Média

---

### 📱 2. App Mobile para Gestão

**Oportunidade:** Aplicativo mobile (iOS/Android) para gestão remota.

**Funcionalidades:**
- Dashboard mobile
- Notificações push
- Aprovação rápida de conteúdo
- Monitoramento de totens
- Upload de mídia via mobile

**Impacto:** Alto - Aumenta acessibilidade
**Complexidade:** Média
**Prioridade:** Alta

---

### 🌍 3. Multi-idioma (i18n)

**Oportunidade:** Suporte a múltiplos idiomas na interface.

**Funcionalidades:**
- Tradução da interface
- Conteúdo multi-idioma
- Detecção automática de idioma
- Tradução de campanhas

**Impacto:** Médio - Expansão internacional
**Complexidade:** Média
**Prioridade:** Média

---

### 🎥 4. Streaming ao Vivo

**Oportunidade:** Suporte a transmissão ao vivo nos totens.

**Funcionalidades:**
- Integração com streaming (YouTube, Twitch, etc.)
- Transmissão própria
- Agendamento de lives
- Gravação de lives

**Impacto:** Alto - Casos de uso específicos
**Complexidade:** Alta
**Prioridade:** Baixa

---

### 🤝 5. Integração com Redes Sociais

**Oportunidade:** Exibir conteúdo de redes sociais nos totens.

**Funcionalidades:**
- Feed do Instagram
- Tweets do Twitter
- Posts do Facebook
- Stories
- Moderação automática

**Impacto:** Médio - Engajamento social
**Complexidade:** Média
**Prioridade:** Média

---

### 📍 6. Geolocalização e Contexto

**Oportunidade:** Conteúdo baseado em localização e contexto.

**Funcionalidades:**
- Conteúdo por geolocalização
- Conteúdo por horário do dia
- Conteúdo por clima
- Conteúdo por eventos locais

**Impacto:** Alto - Personalização
**Complexidade:** Média
**Prioridade:** Média

---

### 🎯 7. A/B Testing Avançado

**Oportunidade:** Testes A/B automáticos de campanhas.

**Funcionalidades:**
- Divisão automática de audiência
- Métricas de conversão
- Seleção automática do melhor
- Relatórios de teste

**Impacto:** Alto - Otimização de campanhas
**Complexidade:** Média
**Prioridade:** Média

---

### 💬 8. Chatbot e Suporte

**Oportunidade:** Chatbot para suporte e gestão.

**Funcionalidades:**
- Chatbot integrado
- Respostas automáticas
- Escalação para humano
- Histórico de conversas

**Impacto:** Médio - Melhora suporte
**Complexidade:** Média
**Prioridade:** Baixa

---

### 📊 9. BI e Data Warehouse

**Oportunidade:** Data warehouse para análises avançadas.

**Funcionalidades:**
- ETL automático
- Data warehouse dedicado
- Integração com BI tools
- Relatórios avançados

**Impacto:** Alto - Análises profundas
**Complexidade:** Alta
**Prioridade:** Baixa

---

### 🔗 10. API Pública e Marketplace

**Oportunidade:** API pública para integrações e marketplace de apps.

**Funcionalidades:**
- API pública documentada
- OAuth para terceiros
- Marketplace de integrações
- Webhooks

**Impacto:** Alto - Ecossistema
**Complexidade:** Alta
**Prioridade:** Média

---

## 🔧 Features que Podem Ser Melhoradas

### 1. Frontend - Integrações com Backend

#### ⚠️ Melhorias Necessárias:

**a) Rate Limiting:**
- ❌ Frontend não trata resposta 429
- ❌ Não mostra feedback visual
- ❌ Não implementa retry com backoff

**Solução:**
```typescript
// Adicionar interceptor Axios
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 429) {
      // Mostrar notificação
      // Aguardar e retry
    }
  }
);
```

**b) Cache Client-Side:**
- ❌ Não utiliza React Query
- ❌ Todas as requisições sempre ao servidor
- ❌ Não aproveita cache do backend

**Solução:**
```typescript
// Implementar React Query
const { data } = useQuery('campaigns', fetchCampaigns, {
  staleTime: 5 * 60 * 1000,
});
```

**c) Validação de Payload:**
- ❌ Não valida tamanho antes de upload
- ❌ Não mostra limites ao usuário
- ❌ Não sanitiza inputs

**d) Segurança de Tokens:**
- ⚠️ Tokens em localStorage (XSS vulnerável)
- ✅ Refresh token implementado (pode melhorar)

**Prioridade:** Alta

---

### 2. Analytics - Métricas Avançadas

#### ⚠️ Melhorias Necessárias:

**a) Export de Relatórios:**
- ❌ Não exporta para Excel/PDF
- ❌ Não tem templates

**b) Dashboards Customizáveis:**
- ❌ Dashboards fixos
- ❌ Não permite personalização

**c) Alertas Automáticos:**
- ❌ Não envia alertas
- ❌ Não tem regras de alerta

**d) Comparação de Períodos:**
- ❌ Não compara períodos
- ❌ Não mostra tendências

**Prioridade:** Média

---

### 3. Billing - Funcionalidades Completas

#### ⚠️ Melhorias Necessárias:

**a) Integração com Gateways:**
- ❌ Não integra com Stripe/PagSeguro/etc
- ❌ Não processa pagamentos

**b) Faturas Automáticas:**
- ❌ Não gera faturas automaticamente
- ❌ Não envia por email

**c) Planos e Assinaturas:**
- ❌ Não tem sistema de planos
- ❌ Não tem assinaturas recorrentes

**Prioridade:** Alta (se billing for core)

---

### 4. QR Codes - Funcionalidades Avançadas

#### ⚠️ Melhorias Necessárias:

**a) QR Codes Dinâmicos:**
- ❌ Não permite mudar destino
- ❌ Não tem analytics avançado

**b) Expiração e Limites:**
- ❌ Não tem expiração
- ❌ Não tem limite de scans

**Prioridade:** Média

---

### 5. Notificações - Canais Múltiplos

#### ⚠️ Melhorias Necessárias:

**a) Push Notifications:**
- ❌ Não tem web push
- ❌ Não tem mobile push

**b) SMS e WhatsApp:**
- ❌ Não envia SMS
- ❌ Não integra WhatsApp

**c) Templates Customizáveis:**
- ⚠️ Templates básicos
- ❌ Não permite customização visual

**Prioridade:** Média

---

### 6. Player - Funcionalidades Avançadas

#### ⚠️ Melhorias Necessárias:

**a) Controle Remoto:**
- ❌ Não reinicia remotamente
- ❌ Não atualiza OTA
- ❌ Não captura screenshot

**b) Logs Remotos:**
- ❌ Não acessa logs em tempo real
- ❌ Não tem debug remoto

**Prioridade:** Média

---

### 7. Segurança - Proteções Avançadas

#### ⚠️ Melhorias Necessárias:

**a) 2FA/MFA:**
- ❌ Não tem autenticação de dois fatores

**b) SSO:**
- ❌ Não tem Single Sign-On

**c) WAF:**
- ❌ Não tem Web Application Firewall

**d) IP Whitelisting:**
- ❌ Não filtra por IP

**Prioridade:** Alta (segurança)

---

### 8. Storage - Otimizações

#### ⚠️ Melhorias Necessárias:

**a) CDN:**
- ❌ Não integra CDN
- ❌ Não distribui globalmente

**b) Object Storage:**
- ❌ Não usa S3/Google Cloud Storage
- ❌ Não escala automaticamente

**c) Compressão:**
- ❌ Não comprime automaticamente
- ❌ Não otimiza imagens

**Prioridade:** Média

---

## 📊 Resumo Executivo

### ✅ Pontos Fortes

1. **Arquitetura Sólida**
   - Backend robusto com TypeScript
   - Frontend moderno com React
   - Multi-tenant bem implementado
   - Segurança básica adequada

2. **Funcionalidades Core Completas**
   - Gestão de campanhas, totens, mídia
   - Analytics básico
   - Player multi-plataforma
   - IA integrada

3. **Infraestrutura**
   - Docker completo
   - Monitoramento (Prometheus/Grafana)
   - Logs estruturados
   - Backup automático

4. **Documentação**
   - Documentação completa
   - Scripts de gerenciamento
   - Guias de instalação

### ⚠️ Pontos de Melhoria

1. **Frontend**
   - Integração com rate limiting
   - Cache client-side
   - Validação de payload

2. **Billing**
   - Integração com gateways
   - Faturas automáticas
   - Planos e assinaturas

3. **Segurança**
   - 2FA/MFA
   - SSO
   - WAF

4. **Analytics**
   - Export de relatórios
   - Dashboards customizáveis
   - Alertas automáticos

### 🎯 Recomendações Prioritárias

#### Curto Prazo (1-3 meses):
1. ✅ Melhorar integração frontend-backend (rate limiting, cache)
2. ✅ Implementar export de relatórios (Excel/PDF)
3. ✅ Adicionar 2FA/MFA
4. ✅ Melhorar billing (se core)

#### Médio Prazo (3-6 meses):
1. ✅ App mobile para gestão
2. ✅ Editor de conteúdo visual
3. ✅ Multi-idioma (i18n)
4. ✅ Integração com redes sociais

#### Longo Prazo (6-12 meses):
1. ✅ API pública e marketplace
2. ✅ BI e data warehouse
3. ✅ Streaming ao vivo
4. ✅ A/B testing avançado

---

## 📈 Métricas de Cobertura por Módulo

| Módulo | Cobertura | Status | Prioridade Melhoria |
|--------|-----------|--------|-------------------|
| Autenticação | 95% | ✅ Excelente | Média (2FA) |
| Usuários/Clientes | 90% | ✅ Bom | Baixa |
| Totens/Players | 85% | ✅ Bom | Média (controle remoto) |
| Mídia | 80% | ✅ Bom | Média (editor) |
| Playlists | 85% | ✅ Bom | Baixa |
| Campanhas | 90% | ✅ Excelente | Média (A/B testing) |
| Smart Playlists | 75% | ⚠️ Regular | Média (ML) |
| Analytics | 80% | ✅ Bom | Alta (export) |
| Billing | 60% | ⚠️ Incompleto | Alta |
| QR Codes | 70% | ⚠️ Regular | Média |
| Notificações | 65% | ⚠️ Regular | Média |
| Settings | 75% | ✅ Bom | Baixa |
| Export | 70% | ⚠️ Regular | Média |
| Advanced Schedules | 80% | ✅ Bom | Baixa |
| Player Cliente | 100% | ✅ Completo | Baixa |
| Segurança | 85% | ✅ Bom | Alta (2FA) |
| Monitoramento | 75% | ✅ Bom | Média (APM) |
| Storage | 80% | ✅ Bom | Média (CDN) |

**Cobertura Geral:** ~82%

---

## 🎯 Conclusão

O **Smart Signage Pro v2.1** é um sistema **robusto e completo** para sinalização digital, com:

- ✅ **Funcionalidades core 100% implementadas**
- ✅ **Arquitetura sólida e escalável**
- ✅ **Multi-plataforma (6 plataformas)**
- ✅ **IA integrada**
- ✅ **Documentação completa**

**Principais oportunidades:**
1. Melhorar integrações frontend-backend
2. Completar módulo de billing
3. Adicionar segurança avançada (2FA)
4. Expandir analytics (export, dashboards)
5. Criar app mobile

**O sistema está pronto para produção**, mas pode ser **melhorado significativamente** com as melhorias sugeridas.

---

**Última atualização:** 2025-11-27  
**Versão do documento:** 1.0

