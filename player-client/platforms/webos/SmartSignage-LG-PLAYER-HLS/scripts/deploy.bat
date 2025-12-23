@echo off
REM Script para deploy do app na TV LG (Windows)

if "%~1"=="" (
    echo ❌ Erro: Nome do dispositivo não fornecido
    echo Uso: deploy.bat ^<device-name^>
    echo.
    echo Para listar dispositivos: ares-setup-device
    pause
    exit /b 1
)

set DEVICE_NAME=%~1
cd /d "%~dp0.."

REM Buscar arquivo .ipk mais recente
for /f "delims=" %%i in ('dir /b /o-d *.ipk 2^>nul') do (
    set IPK_FILE=%%i
    goto :found
)

:found
if "%IPK_FILE%"=="" (
    echo ❌ Erro: Nenhum arquivo .ipk encontrado
    echo    Execute build.bat primeiro
    pause
    exit /b 1
)

echo 📦 Instalando %IPK_FILE% no dispositivo %DEVICE_NAME%...

REM Instalar
ares-install "%IPK_FILE%" -d "%DEVICE_NAME%"

if %ERRORLEVEL% EQU 0 (
    echo ✅ Instalação concluída!
    echo 🚀 Para executar: ares-launch com.smartsignage.lgplayer.hls -d %DEVICE_NAME%
) else (
    echo ❌ Erro na instalação
    pause
    exit /b 1
)

pause

