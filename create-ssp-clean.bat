@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "DEST=%ROOT%\ssp-clean"

echo.
echo [SSP-CLEAN] Origem : %ROOT%
echo [SSP-CLEAN] Destino: %DEST%
echo.

if exist "%DEST%" rmdir /S /Q "%DEST%"
mkdir "%DEST%" >nul 2>&1

if exist "%ROOT%\.gitignore" copy /Y "%ROOT%\.gitignore" "%DEST%\.gitignore" >nul
if exist "%ROOT%\.gitattributes" copy /Y "%ROOT%\.gitattributes" "%DEST%\.gitattributes" >nul
if exist "%ROOT%\.editorconfig" copy /Y "%ROOT%\.editorconfig" "%DEST%\.editorconfig" >nul
if exist "%ROOT%\.npmrc" copy /Y "%ROOT%\.npmrc" "%DEST%\.npmrc" >nul
if exist "%ROOT%\env.example" copy /Y "%ROOT%\env.example" "%DEST%\env.example" >nul
if exist "%ROOT%\package.json" copy /Y "%ROOT%\package.json" "%DEST%\package.json" >nul
if exist "%ROOT%\docker-compose.yml" copy /Y "%ROOT%\docker-compose.yml" "%DEST%\docker-compose.yml" >nul
if exist "%ROOT%\docker-compose.separated.yml" copy /Y "%ROOT%\docker-compose.separated.yml" "%DEST%\docker-compose.separated.yml" >nul
if exist "%ROOT%\Dockerfile" copy /Y "%ROOT%\Dockerfile" "%DEST%\Dockerfile" >nul
if exist "%ROOT%\Dockerfile.app" copy /Y "%ROOT%\Dockerfile.app" "%DEST%\Dockerfile.app" >nul
if exist "%ROOT%\Dockerfile.backend" copy /Y "%ROOT%\Dockerfile.backend" "%DEST%\Dockerfile.backend" >nul
if exist "%ROOT%\Dockerfile.frontend" copy /Y "%ROOT%\Dockerfile.frontend" "%DEST%\Dockerfile.frontend" >nul
if exist "%ROOT%\Dockerfile.workers" copy /Y "%ROOT%\Dockerfile.workers" "%DEST%\Dockerfile.workers" >nul
if exist "%ROOT%\README-DISTRIBUICAO.md" copy /Y "%ROOT%\README-DISTRIBUICAO.md" "%DEST%\README-DISTRIBUICAO.md" >nul

call :copyDir "backend"
call :copyDir "frontend"
call :copyDir "database"
call :copyDir "scripts"
call :copyDir "nginx"
call :copyDir "docker"
call :copyDir "shared"
call :copyDir "public"
call :copyDir "docs"
call :copyDir "player-web"
call :copyDir "player-agent"
call :copyDir "player-fx"
call :copyDir "install-pendrive"
call :copyDir "Player-AD"
call :copyDir "Player-WOS"
call :copyDir "Player-LXN"
call :copyDir "SmartSignage-AD"

echo.
echo [SSP-CLEAN] Copia enxuta concluida em "%DEST%".
exit /b 0

:copyDir
if not exist "%ROOT%\%~1" goto :eof
echo [COPIANDO] %~1
robocopy "%ROOT%\%~1" "%DEST%\%~1" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD .git .github .cursor node_modules dist build coverage logs backups .next .cache .gradle /XF *.log *.tmp *.cache *.bak *.swp *.swo local.properties >nul
goto :eof
