@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

where adb >nul 2>&1
if errorlevel 1 (
  echo ERRO: adb nao encontrado no PATH.
  exit /b 1
)

set APK=
for %%f in (apk\*.apk) do set "APK=%%f"
if not defined APK (
  echo ERRO: Nenhum APK em apk\
  exit /b 1
)

echo Instalando !APK!
adb install -r -d -g "!APK!"
if errorlevel 1 (
  adb uninstall br.com.smartchannel.smartsignagead
  adb install -r -d -g "!APK!"
)

if exist "config\app-config.example.json" (
  adb shell mkdir -p /sdcard/smartsignage-ad 2>nul
  adb push "config\app-config.example.json" /sdcard/smartsignage-ad/app-config.json
)

echo Concluido.
endlocal
