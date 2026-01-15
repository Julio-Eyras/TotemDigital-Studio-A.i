# Scripts de Gerenciamento - Smart Signage Pro

Este diretório contém todos os scripts de gerenciamento do sistema organizados por categoria.

## 📁 Estrutura de Diretórios

### 🔍 status/
Scripts para visualizar o status do sistema:
- `status-system.sh` - Status geral do sistema
- `check-backend-status.sh` - Verificar status do backend
- `check-frontend-status.sh` - Verificar status do frontend
- `check-services.sh` - Verificar serviços
- `check-chromium-instances.sh` - Verificar instâncias do Chromium
- `check-player-redirect.sh` - Verificar redirecionamento do player
- `check-postgresql-conf.sh` - Verificar configuração do PostgreSQL
- `test-backend-connection.sh` - Testar conexão com backend
- `test-postgresql-start.sh` - Testar inicialização do PostgreSQL
- `verify-architecture.sh` - Verificar arquitetura do sistema

### ▶️ start/
Scripts para iniciar o sistema:
- `start-system.sh` - Iniciar sistema completo
- `start-local-dev.sh` - Iniciar ambiente de desenvolvimento local
- `start-local-dev.ps1` - Iniciar ambiente de desenvolvimento (Windows)
- `autostart-system.sh` - Configurar autostart do sistema

### ⏹️ stop/
Scripts para parar o sistema:
- `stop-all.sh` - Parar todos os serviços
- `stop-system.sh` - Parar sistema completo
- `stop-services.sh` - Parar serviços (Linux)
- `stop-services.ps1` - Parar serviços (Windows)
- `PARAR-SERVICOS.sh` - Parar serviços (alternativo)

### 🔄 restart/
Scripts para reiniciar o sistema:
- `restart-system.sh` - Reiniciar sistema completo
- `dev-build-restart.sh` - Build e reiniciar para desenvolvimento

### 📊 monitor/
Scripts de monitoramento e diagnóstico:
- `monitor-system.sh` - Monitorar sistema
- `diagnose-system.sh` - Diagnosticar sistema (Linux)
- `diagnose-system.ps1` - Diagnosticar sistema (Windows)
- `diagnose-player-registration.sh` - Diagnosticar registro de players
- `diagnose-api-frontend.sh` - Diagnosticar API e frontend
- `diagnose-installation.sh` - Diagnosticar instalação
- `diagnose-nginx.sh` - Diagnosticar Nginx
- `diagnostico-docker.sh` - Diagnosticar Docker

### 💀 kill/
Scripts para matar processos:
- `clean-all.sh` - Limpar processos mortos e recursos

### 📝 logs/
Scripts para visualizar logs:
- `logs-system.sh` - Visualizar logs do sistema
- `verificar-logs-campanha.sh` - Verificar logs de campanhas
- `apply-logs-config.sh` - Aplicar configuração de logs

### ❤️ health/
Scripts de health check:
- `health-check.sh` - Verificar saúde do sistema

### 🔧 fix/
Scripts de correção e reparo:
- `fix-backend.sh` - Corrigir backend
- `fix-frontend-dependencies.sh` - Corrigir dependências do frontend
- `fix-nginx-config.sh` - Corrigir configuração do Nginx
- `fix-nginx-500-error.sh` - Corrigir erro 500 do Nginx
- `fix-permissions-all.sh` - Corrigir permissões (completo)
- `fix-permissions-quick.sh` - Corrigir permissões (rápido)
- `fix-ownership-permissions.sh` - Corrigir propriedade e permissões
- `fix-line-endings.sh` - Corrigir terminações de linha
- `fix-media-paths.sh` - Corrigir caminhos de mídia
- `fix-network-boot-delay.sh` - Corrigir delay de boot de rede
- `fix-network-wait.sh` - Corrigir espera de rede
- `fix-kiosk-url.sh` - Corrigir URL do kiosk
- `fix-clients-tsx.sh` - Corrigir arquivos Clients.tsx
- `fix-database-permissions.sh` - Corrigir permissões do banco
- `fix-postgresql-conf.sh` - Corrigir configuração do PostgreSQL
- `fix-pg-hba-conf.sh` - Corrigir pg_hba.conf
- `fix-pg-hba-duplicates.sh` - Corrigir duplicatas no pg_hba.conf
- `fix-backend-prisma.sh` - Corrigir Prisma do backend
- `fix-backend-prisma-definitive.sh` - Corrigir Prisma (definitivo)
- `fix-frontend-build.sh` - Corrigir build do frontend
- `fix-dockerfiles.sh` - Corrigir Dockerfiles
- `fix-monitoring.sh` - Corrigir monitoramento
- `fix-monitoring-simple.sh` - Corrigir monitoramento (simples)
- `fix-nginx-command.sh` - Corrigir comando do Nginx
- `fix-services.sh` - Corrigir serviços
- `fix-syntax.sh` - Corrigir sintaxe
- `fix-schema-tables.sh` - Corrigir schema e tabelas
- `fix-database-copy.sh` - Corrigir cópia do banco
- `fix-git-repository.sh` - Corrigir repositório Git
- `fix-prisma-methods.sh` - Corrigir métodos Prisma

### 📦 install/
Scripts de instalação:
- `install-smartsignage.sh` - Instalar Smart Signage Pro
- `install-frontend-dependencies.sh` - Instalar dependências do frontend
- `install-server-teste.sh` - Instalar servidor de teste
- `install-windows.ps1` - Instalar no Windows
- `INSTALACAO_LOCAL.sh` - Instalação local
- `post-install-check.ps1` - Verificação pós-instalação

### 🚀 deploy/
Scripts de deploy:
- `deploy-production.sh` - Deploy em produção
- `deploy-test-server.sh` - Deploy em servidor de teste
- `LEVANTAR-SISTEMA.sh` - Levantar sistema

### 💾 backup/
Scripts de backup e restore:
- `backup-system.sh` - Backup do sistema (Linux)
- `backup-system.ps1` - Backup do sistema (Windows)
- `restore-backup.sh` - Restaurar backup

### 🧪 test/
Scripts de teste:
- `test-nginx-subdomains.sh` - Testar subdomínios do Nginx
- `test-builds.sh` - Testar builds
- `test-docker-build.sh` - Testar build Docker
- `test-docker-build-safe.sh` - Testar build Docker (seguro)
- `test-docker-build-player-web.sh` - Testar build Docker do player web
- `test-docker-compose.sh` - Testar Docker Compose
- `test-dockerfile.sh` - Testar Dockerfile
- `VALIDAR-SISTEMA.sh` - Validar sistema
- `EXECUTAR-E-VALIDAR.sh` - Executar e validar

### 💻 dev/
Scripts de desenvolvimento:
- `dev-build-restart.sh` - Build e reiniciar para desenvolvimento
- `rebuild-backend.sh` - Rebuild do backend
- `rebuild-architecture.sh` - Rebuild da arquitetura
- `update-all-references.sh` - Atualizar todas as referências
- `update-references.sh` - Atualizar referências
- `update-system.sh` - Atualizar sistema
- `force-update-package-json.sh` - Forçar atualização do package.json
- `verify-and-fix-package-json.sh` - Verificar e corrigir package.json
- `prepare-v2.1-migration.sh` - Preparar migração v2.1

### 🌐 dns/
Scripts de configuração DNS:
- `add-publisher-dns.sh` - Adicionar DNS de publisher
- `add-subscriber-dns.sh` - Adicionar DNS de subscriber

### 🗄️ database/
Scripts de banco de dados:
- `create-totem-uin.sh` - Criar UIN de totem
- `generate-player-config.sh` - Gerar configuração do player
- `reset-system.sh` - Resetar sistema
- `clean-all.sh` - Limpar tudo
- `apply-all-schema-v2.sh` - Aplicar todo o schema v2
- `apply-schema-v2.sh` - Aplicar schema v2
- `test-database-install.sh` - Testar instalação do banco
- `apply-schema.sh` - Aplicar schema
- `fix-all-constraints.sh` - Corrigir todas as constraints
- `validate-schema.sh` - Validar schema

### 📚 misc/
Scripts diversos:
- `manage-system.sh` - Gerenciar sistema
- `manage-system.ps1` - Gerenciar sistema (Windows)
- `disable-autostart.sh` - Desabilitar autostart
- `debug-backend.sh` - Debug do backend
- `debug-dockerfiles.sh` - Debug de Dockerfiles
- `debug-entrypoint.sh` - Debug de entrypoint
- `connect-firebird.ps1` - Conectar Firebird
- `connect-firebird-quick.ps1` - Conectar Firebird (rápido)
- `download-dependencies.sh` - Baixar dependências
- `download-without-git.sh` - Baixar sem Git
- `getsmart-signage.sh` - Obter Smart Signage
- `git-clone-with-token.sh` - Clone Git com token
- `convert-to-git.sh` - Converter para Git
- `reset-git-local.sh` - Resetar Git local
- `corrigir-arquivos-faltantes.sh` - Corrigir arquivos faltantes
- `criar-pacote-distribuicao.sh` - Criar pacote de distribuição
- `criar-zip-distribuicao.sh` - Criar ZIP de distribuição
- `verify-local-files.sh` - Verificar arquivos locais
- `SmartDisplayFX_package.sh` - Pacote SmartDisplayFX

## 🚀 Uso Rápido

### Visualizar Status
```bash
./scripts/status/status-system.sh
./scripts/status/check-backend-status.sh
./scripts/status/check-frontend-status.sh
```

### Parar Sistema
```bash
./scripts/stop/stop-all.sh
```

### Iniciar Sistema
```bash
./scripts/start/start-system.sh
```

### Reiniciar Sistema
```bash
./scripts/restart/restart-system.sh
```

### Matar Processos Mortos
```bash
./scripts/kill/clean-all.sh
```

### Visualizar Logs
```bash
./scripts/logs/logs-system.sh
```

### Health Check
```bash
./scripts/health/health-check.sh
```

### Monitoramento
```bash
./scripts/monitor/monitor-system.sh
./scripts/monitor/diagnose-system.sh
```

## 📝 Notas

- Scripts `.sh` são para Linux/Unix
- Scripts `.ps1` são para Windows PowerShell
- Sempre execute scripts com permissões adequadas
- Alguns scripts podem requerer `sudo` ou privilégios de administrador

## 🔗 Links Úteis

- Documentação principal: `docs/`
- Scripts de instalação: `scripts/install/`
- Scripts de deploy: `scripts/deploy/`
