# Índice da Documentação - SmartSignage Pro v2.1

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 📚 Documentação Principal

### Para Vendas e Marketing

1. **[MANUAL_COMERCIAL.md](MANUAL_COMERCIAL.md)**
   - Features e qualidades do sistema
   - Diferenciais competitivos
   - Segmentos de mercado
   - Casos de uso e ROI
   - Planos e preços
   - Proposta de valor
   - Comparativo de soluções
   - Benefícios por perfil de cliente

### Para Usuários Finais

2. **[MANUAL_DO_USUARIO.md](MANUAL_DO_USUARIO.md)**
   - Guia completo para usuários finais
   - Como usar todas as funcionalidades
   - Gerenciamento de campanhas, mídias, totens
   - Analytics e relatórios
   - Billing e cobranças
   - FAQ

### Para Desenvolvedores e Administradores

3. **[MANUAL_TECNICO.md](MANUAL_TECNICO.md)**
   - Arquitetura do sistema
   - Requisitos e instalação
   - Configuração
   - Estrutura do projeto
   - APIs e endpoints
   - Autenticação e autorização
   - Desenvolvimento
   - Deploy e produção
   - Monitoramento e logs
   - Troubleshooting

4. **[ESQUEMA_BANCO_DADOS.md](ESQUEMA_BANCO_DADOS.md)**
   - Documentação completa do schema v2.0
   - Todas as tabelas e relacionamentos
   - Billing e contratos
   - Analytics e logs
   - Views e materialized views
   - Índices e performance
   - Triggers e functions
   - Diagrama ER
   - Como aplicar o schema

---

## 📋 Documentação por Categoria

### Instalação e Configuração

- **Manual Técnico** > Seção "Instalação"
- **Manual Técnico** > Seção "Configuração"
- `install-windows.ps1` - Script de instalação Windows
- `install-smartsignage.sh` - Script de instalação Linux
- `backend/scripts/setup-database.js` - Script de configuração do banco

### Banco de Dados

- **ESQUEMA_BANCO_DADOS.md** - Documentação completa
- `database/README-V2-REFACTORED.md` - Visão geral do schema v2.0
- `database/smartchannel-db-v2-refactored-part*.sql` - Scripts SQL
- `database/scripts/setup-database.js` - Script de setup

### APIs e Endpoints

- **Manual Técnico** > Seção "APIs e Endpoints"
- `backend/src/routes/` - Código das rotas
- Swagger/OpenAPI (se disponível)

### Frontend

- **Manual Técnico** > Seção "Estrutura do Projeto" > Frontend
- `frontend/src/` - Código fonte
- `frontend/package.json` - Dependências

### Backend

- **Manual Técnico** > Seção "Estrutura do Projeto" > Backend
- `backend/src/` - Código fonte
- `backend/package.json` - Dependências

### Deploy e Produção

- **Manual Técnico** > Seção "Deploy e Produção"
- `docker/` - Arquivos Docker
- `docker-compose.yml` - Orquestração Docker
- `nginx/` - Configurações Nginx

---

## 🔍 Documentação por Funcionalidade

### Campanhas

- **Manual do Usuário** > "Gerenciando Campanhas"
- **Manual Técnico** > "APIs e Endpoints" > Campanhas
- **Esquema BD** > "Tabelas Dependentes" > campaigns

### Mídias

- **Manual do Usuário** > "Gerenciando Mídias"
- **Manual Técnico** > "APIs e Endpoints" > Mídias
- **Esquema BD** > "Tabelas Dependentes" > medias

### Totens e Smart TVs

- **Manual do Usuário** > "Gerenciando Totens e Smart TVs"
- **Manual Técnico** > "APIs e Endpoints" > Totens
- **Esquema BD** > "Tabelas Dependentes" > totems, smart_tvs

### Analytics e Relatórios

- **Manual do Usuário** > "Analytics e Relatórios"
- **Manual Técnico** > "APIs e Endpoints" > Analytics
- **Esquema BD** > "Analytics e Logs"

### Billing e Cobranças

- **Manual do Usuário** > "Billing e Cobranças"
- **Esquema BD** > "Billing e Contratos"
- subscriber_billing, publisher_billing

### Autenticação e Autorização

- **Manual Técnico** > "Autenticação e Autorização"
- **Esquema BD** > users, roles, permissions, user_roles

---

## 📁 Documentação Adicional

### Scripts e Ferramentas

- `test-sistema-completo.ps1` - Script de teste completo
- `criar-zip-distribuicao.ps1` - Script de criação de distribuição
- `RESUMO_TESTES_SISTEMA.md` - Resultado dos testes

### Documentação de Desenvolvimento

- `docs/` - Documentação adicional do projeto
- `CHANGELOG.md` - Histórico de mudanças
- `README.md` - Visão geral do projeto

---

## 🚀 Início Rápido

### Para Vendas e Marketing

1. Leia: **[MANUAL_COMERCIAL.md](MANUAL_COMERCIAL.md)**
2. Use como material de vendas
3. Adapte para apresentações personalizadas
4. Consulte casos de uso e ROI para argumentação

### Para Usuários Finais

1. Leia: **[MANUAL_DO_USUARIO.md](MANUAL_DO_USUARIO.md)**
2. Acesse o sistema e faça login
3. Comece criando sua primeira campanha

### Para Desenvolvedores

1. Leia: **[MANUAL_TECNICO.md](MANUAL_TECNICO.md)** > "Instalação"
2. Execute o script de instalação apropriado
3. Configure o ambiente de desenvolvimento
4. Consulte: **ESQUEMA_BANCO_DADOS.md** para entender o banco de dados

### Para Administradores de Sistema

1. Leia: **[MANUAL_TECNICO.md](MANUAL_TECNICO.md)** > "Instalação" e "Deploy"
2. Configure o servidor de produção
3. Configure Nginx e systemd
4. Configure monitoramento e logs

---

## 📞 Suporte

Para questões ou problemas:

1. Consulte a documentação relevante acima
2. Verifique o FAQ no Manual do Usuário
3. Consulte a seção Troubleshooting no Manual Técnico
4. Entre em contato com o suporte técnico

---

**Última Atualização:** Dezembro 2025  
**Versão:** 2.1.0

