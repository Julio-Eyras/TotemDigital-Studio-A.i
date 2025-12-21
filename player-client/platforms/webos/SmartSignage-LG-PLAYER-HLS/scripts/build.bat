@echo off
REM Script de build para Windows (PowerShell/Batch)

echo 📦 Building SmartSignage LG Player HLS...

cd /d "%~dp0.."

REM Verificar se ares está disponível
where ares-package >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Erro: webOS CLI tools não encontradas
    echo    Instale o webOS SDK: https://webostv.developer.lge.com/
    pause
    exit /b 1
)

REM Verificar se appinfo.json existe
if not exist "appinfo.json" (
    echo ❌ Erro: appinfo.json não encontrado
    pause
    exit /b 1
)

REM Criar .ipk
echo 📦 Criando pacote .ipk...
ares-package .

if %ERRORLEVEL% EQU 0 (
    echo ✅ Build concluído com sucesso!
    echo 📦 Arquivo .ipk criado no diretório atual
) else (
    echo ❌ Erro ao criar pacote
    pause
    exit /b 1
)

pause

