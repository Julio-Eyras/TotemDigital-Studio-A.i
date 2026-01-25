# SmartSignage Pro - DistribuiÃ§Ã£o de InstalaÃ§Ã£o

Esta Ã© uma distribuiÃ§Ã£o limpa do SmartSignage Pro contendo apenas os arquivos necessÃ¡rios para instalaÃ§Ã£o e execuÃ§Ã£o.

**Gerado em:** 2026-01-25 03:19:04

## Estrutura

- **backend/** - CÃ³digo fonte do backend (TypeScript)
- **frontend/** - CÃ³digo fonte do frontend (React/TypeScript)
- **database/** - Scripts SQL e esquema do banco de dados
- **docs/** - DocumentaÃ§Ã£o completa do sistema
- **scripts/** - Scripts auxiliares de instalaÃ§Ã£o e manutenÃ§Ã£o
- **nginx/** - ConfiguraÃ§Ãµes do Nginx
- **systemd/** - Arquivos de serviÃ§o systemd
- **docker/** - Arquivos Docker (Dockerfile, docker-compose)
- **player-web-cache/** - Player web HTML5 com cache implementado
- **player-client/** - Players para Smart TVs (Android, Tizen, webOS)
- **player-agent/** - Agente de sincronizaÃ§Ã£o
- **player-fx/** - Player de efeitos visuais

## InstalaÃ§Ã£o

### Linux/Ubuntu

**InstalaÃ§Ã£o completa com validaÃ§Ã£o automÃ¡tica:**
\\\ash
chmod +x install-smartsignage.sh
sudo ./scripts/install-smartsignage.sh
\\\

**InstalaÃ§Ã£o e validaÃ§Ã£o em um Ãºnico comando:**
\\\ash
chmod +x EXECUTAR-E-VALIDAR.sh
./scripts/EXECUTAR-E-VALIDAR.sh
\\\

**Apenas validar sistema (se jÃ¡ estiver instalado):**
\\\ash
chmod +x VALIDAR-SISTEMA.sh
./scripts/VALIDAR-SISTEMA.sh
\\\

### Windows

**InstalaÃ§Ã£o completa com validaÃ§Ã£o automÃ¡tica:**
\\\powershell
.\scripts\EXECUTAR-E-VALIDAR.ps1
\\\

**Apenas instalar e iniciar:**
\\\powershell
.\scripts\LEVANTAR-SISTEMA.ps1
\\\

**Apenas validar sistema (se jÃ¡ estiver instalado):**
\\\powershell
.\scripts\VALIDAR-SISTEMA.ps1
\\\

**Parar serviÃ§os:**
\\\powershell
.\scripts\PARAR-SERVICOS.ps1
\\\

O script de instalaÃ§Ã£o do Windows irÃ¡:
- Verificar e instalar automaticamente Node.js, npm, PostgreSQL e Redis (via Chocolatey)
- Instalar todas as dependÃªncias do backend e frontend
- Compilar o backend TypeScript
- Configurar o banco de dados automaticamente
- Corrigir problemas comuns (como o mÃ³dulo ajv no frontend)
- Executar validaÃ§Ã£o automÃ¡tica completa do sistema

## PrÃ©-requisitos

- Node.js 18+ e npm
- PostgreSQL 15+
- Nginx (instalado automaticamente no Linux)
- Redis (opcional, mas recomendado)

## Notas Importantes

- Esta distribuiÃ§Ã£o **NÃƒO inclui** \
ode_modules\ - os scripts de instalaÃ§Ã£o executarÃ£o \
pm install\ automaticamente
- Arquivos de configuraÃ§Ã£o (.env) devem ser criados a partir dos exemplos (.env.example)
- Builds de produÃ§Ã£o serÃ£o gerados automaticamente pelos scripts de instalaÃ§Ã£o
- O script \install-windows.ps1\ configura tudo automaticamente, incluindo o banco de dados
- Consulte a pasta \docs/\ para documentaÃ§Ã£o completa do sistema
- Scripts SQL do banco de dados estÃ£o em \database/smartchannel-db-v2-refactored-part*.sql\
- O script \ackend/scripts/setup-database.js\ Ã© usado para configurar o banco de dados automaticamente

## DocumentaÃ§Ã£o

- README.md - VisÃ£o geral do projeto
- docs/README.md - Ãndice da documentaÃ§Ã£o completa
- docs/GUIA_INSTALACAO_PLAYERS.md - Guia de instalaÃ§Ã£o de players
- docs/CONFIGURACAO_BANCO_DADOS.md - ConfiguraÃ§Ã£o do banco de dados
- README-VALIDACAO.md - Guia de validaÃ§Ã£o automÃ¡tica do sistema
- README-INSTALACAO-WINDOWS.md - Guia completo de instalaÃ§Ã£o no Windows
- README-INSTALACAO-LINUX.md - Guia completo de instalaÃ§Ã£o no Linux/macOS
- CHANGELOG-VALIDACAO-INSTALL-SH.md - Changelog das melhorias de validaÃ§Ã£o

---

**VersÃ£o:** 2026-01-25
