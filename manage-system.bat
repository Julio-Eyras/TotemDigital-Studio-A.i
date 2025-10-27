@echo off
REM Smart Signage Pro v2.0 - Script de Gerenciamento para Windows
REM Este script permite controlar todos os serviços do sistema

setlocal enabledelayedexpansion

REM Cores (limitadas no Windows)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "NC=[0m"

if "%1"=="" goto :help
if "%1"=="help" goto :help
if "%1"=="--help" goto :help
if "%1"=="-h" goto :help

if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="status" goto :status
if "%1"=="logs" goto :logs
if "%1"=="backup" goto :backup
if "%1"=="restore" goto :restore
if "%1"=="update" goto :update
if "%1"=="rebuild" goto :rebuild
if "%1"=="clean" goto :clean
if "%1"=="health" goto :health
if "%1"=="reset" goto :reset

echo %RED%Comando inválido: %1%NC%
echo.
goto :help

:help
echo %BLUE%Smart Signage Pro v2.0 - Gerenciador do Sistema%NC%
echo.
echo Uso: %~nx0 [COMANDO]
echo.
echo Comandos disponíveis:
echo   start       - Iniciar todos os serviços
echo   stop        - Parar todos os serviços
echo   restart     - Reiniciar todos os serviços
echo   status      - Mostrar status dos serviços
echo   logs        - Mostrar logs dos serviços
echo   backup      - Fazer backup do sistema
echo   restore     - Restaurar backup
echo   update      - Atualizar sistema
echo   rebuild     - Rebuild completo
echo   clean       - Limpar containers e volumes
echo   health      - Verificar saúde do sistema
echo   reset       - Reset completo (CUIDADO!)
echo.
echo Exemplos:
echo   %~nx0 start
echo   %~nx0 status
echo   %~nx0 logs backend
echo   %~nx0 backup
goto :end

:check_docker
docker info >nul 2>&1
if errorlevel 1 (
    echo %RED%Docker não está rodando!%NC%
    echo Por favor, inicie o Docker Desktop e tente novamente.
    exit /b 1
)
goto :eof

:start
echo %BLUE%Iniciando Smart Signage Pro v2.0...%NC%
call :check_docker
if errorlevel 1 goto :end

docker compose ps | findstr "Up" >nul
if not errorlevel 1 (
    echo %YELLOW%Alguns serviços já estão rodando.%NC%
    echo Use 'restart' para reiniciar ou 'stop' para parar primeiro.
    goto :end
)

docker compose up -d
if errorlevel 1 (
    echo %RED%Erro ao iniciar serviços!%NC%
    goto :end
)

echo %GREEN%Serviços iniciados com sucesso!%NC%
echo.
echo Acesse:
echo   Frontend: http://localhost:3001
echo   Backend:  http://localhost:3000
echo   Grafana:  http://localhost:3002
echo   Prometheus: http://localhost:9090

timeout /t 10 /nobreak >nul
call :health
goto :end

:stop
echo %YELLOW%Parando Smart Signage Pro v2.0...%NC%
call :check_docker
if errorlevel 1 goto :end

docker compose down
echo %GREEN%Serviços parados com sucesso!%NC%
goto :end

:restart
echo %BLUE%Reiniciando Smart Signage Pro v2.0...%NC%
call :check_docker
if errorlevel 1 goto :end

docker compose restart
echo %GREEN%Serviços reiniciados com sucesso!%NC%

timeout /t 10 /nobreak >nul
call :health
goto :end

:status
echo %BLUE%Status dos Serviços%NC%
echo.
call :check_docker
if errorlevel 1 goto :end

docker compose ps
echo.
echo %BLUE%Verificando conectividade...%NC%

curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo %RED%Backend API: Indisponível%NC%
) else (
    echo %GREEN%Backend API: Funcionando%NC%
)

curl -s http://localhost:3001 >nul 2>&1
if errorlevel 1 (
    echo %RED%Frontend: Indisponível%NC%
) else (
    echo %GREEN%Frontend: Funcionando%NC%
)

curl -s http://localhost:3002 >nul 2>&1
if errorlevel 1 (
    echo %RED%Grafana: Indisponível%NC%
) else (
    echo %GREEN%Grafana: Funcionando%NC%
)
goto :end

:logs
if "%2"=="" (
    echo %BLUE%Logs de Todos os Serviços%NC%
    docker compose logs --tail=50
) else (
    echo %BLUE%Logs do Serviço: %2%NC%
    docker compose logs --tail=50 %2
)
goto :end

:backup
echo %BLUE%Fazendo backup do sistema...%NC%

set "backup_file=backup-smartsignage-%date:~6,4%%date:~3,2%%date:~0,2%-%time:~0,2%%time:~3,2%%time:~6,2%.tar.gz"
set "backup_file=!backup_file: =0!"

if not exist backups mkdir backups

docker compose down
docker run --rm -v smartsignage-pro_postgres_data:/data -v smartsignage-pro_backend_uploads:/uploads -v smartsignage-pro_backend_logs:/logs -v smartsignage-pro_backend_backups:/backups -v smartsignage-pro_backend_data:/appdata -v smartsignage-pro_frontend_assets:/assets -v smartsignage-pro_ollama_data:/ollama -v smartsignage-pro_redis_data:/redis -v smartsignage-pro_prometheus_data:/prometheus -v smartsignage-pro_grafana_data:/grafana -v "%cd%":/backup alpine tar czf /backup/backups/"!backup_file!" /data /uploads /logs /backups /appdata /assets /ollama /redis /prometheus /grafana

tar czf "backups/config-!backup_file!" .env docker-compose.yml nginx\ monitoring\

docker compose up -d

echo %GREEN%Backup criado: backups/!backup_file!%NC%
echo %GREEN%Configuração: backups/config-!backup_file!%NC%
goto :end

:restore
if "%2"=="" (
    echo %RED%Especifique o arquivo de backup!%NC%
    echo Uso: %~nx0 restore ^<arquivo-backup^>
    echo.
    echo Backups disponíveis:
    dir backups\*.tar.gz 2>nul || echo Nenhum backup encontrado.
    goto :end
)

if not exist "%2" (
    echo %RED%Arquivo de backup não encontrado: %2%NC%
    goto :end
)

echo %YELLOW%ATENÇÃO: Esta operação irá substituir todos os dados!%NC%
set /p confirm="Tem certeza? (digite 'SIM' para confirmar): "

if not "%confirm%"=="SIM" (
    echo %YELLOW%Operação cancelada.%NC%
    goto :end
)

echo %BLUE%Restaurando backup: %2%NC%

docker compose down
docker run --rm -v smartsignage-pro_postgres_data:/data -v smartsignage-pro_backend_uploads:/uploads -v smartsignage-pro_backend_logs:/logs -v smartsignage-pro_backend_backups:/backups -v smartsignage-pro_backend_data:/appdata -v smartsignage-pro_frontend_assets:/assets -v smartsignage-pro_ollama_data:/ollama -v smartsignage-pro_redis_data:/redis -v smartsignage-pro_prometheus_data:/prometheus -v smartsignage-pro_grafana_data:/grafana -v "%cd%":/backup alpine tar xzf /backup/"%2"

docker compose up -d

echo %GREEN%Backup restaurado com sucesso!%NC%
goto :end

:update
echo %BLUE%Atualizando Smart Signage Pro v2.0...%NC%

call :backup
docker compose pull
docker compose build --no-cache
docker compose up -d

echo %GREEN%Sistema atualizado com sucesso!%NC%
goto :end

:rebuild
echo %BLUE%Fazendo rebuild completo do sistema...%NC%

call :backup
docker compose down
docker compose down --rmi all
docker compose build --no-cache
docker compose up -d

echo %GREEN%Rebuild completo realizado!%NC%
goto :end

:clean
echo %YELLOW%Limpando sistema...%NC%

docker compose down
docker container prune -f
docker image prune -f
docker volume prune -f
docker network prune -f

echo %GREEN%Limpeza concluída!%NC%
goto :end

:health
echo %BLUE%Verificando saúde do sistema...%NC%

set "all_healthy=true"

docker compose ps | findstr "healthy" >nul
if errorlevel 1 (
    echo %RED%Alguns containers não estão saudáveis%NC%
    set "all_healthy=false"
)

curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo %RED%Backend API: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%Backend API: OK%NC%
)

curl -s http://localhost:3000/api/health >nul 2>&1
if errorlevel 1 (
    echo %RED%API Health: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%API Health: OK%NC%
)

curl -s http://localhost:3001 >nul 2>&1
if errorlevel 1 (
    echo %RED%Frontend: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%Frontend: OK%NC%
)

curl -s http://localhost:3002 >nul 2>&1
if errorlevel 1 (
    echo %RED%Grafana: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%Grafana: OK%NC%
)

curl -s http://localhost:9090 >nul 2>&1
if errorlevel 1 (
    echo %RED%Prometheus: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%Prometheus: OK%NC%
)

curl -s http://localhost:11434/api/tags >nul 2>&1
if errorlevel 1 (
    echo %RED%Ollama IA: FALHA%NC%
    set "all_healthy=false"
) else (
    echo %GREEN%Ollama IA: OK%NC%
)

if "%all_healthy%"=="true" (
    echo %GREEN%Sistema totalmente saudável!%NC%
) else (
    echo %YELLOW%Sistema com problemas detectados%NC%
    echo Execute '%~nx0 logs' para mais detalhes.
)
goto :end

:reset
echo %RED%ATENÇÃO: RESET COMPLETO DO SISTEMA!%NC%
echo Esta operação irá:
echo   - Parar todos os serviços
echo   - Remover todos os containers
echo   - Remover todos os volumes (DADOS PERDIDOS!)
echo   - Remover todas as imagens
echo   - Limpar completamente o sistema
echo.
set /p confirm="Digite 'RESETAR' para confirmar: "

if not "%confirm%"=="RESETAR" (
    echo %YELLOW%Operação cancelada.%NC%
    goto :end
)

echo %RED%Resetando sistema...%NC%

docker compose down -v --rmi all
docker system prune -af

echo %GREEN%Sistema resetado completamente!%NC%
echo Execute '%~nx0 start' para reinstalar.
goto :end

:end
