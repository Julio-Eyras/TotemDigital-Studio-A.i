@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0.."

where adb >nul 2>&1
if errorlevel 1 (
  echo ERRO: adb nao encontrado no PATH. Instale Android Platform Tools.
  exit /b 1
)

set APK=
for %%f in (apk\Player-AD-Vs*-build-*.apk) do set "APK=%%f"
if not defined APK (
  for %%f in (apk\Player-AD*.apk) do (
    echo %%f | findstr /i /c:"Instala-Player" >nul
    if errorlevel 1 set "APK=%%f"
  )
)

if not defined APK (
  echo ERRO: Nenhum Player-AD-Vs*-build-*.apk em apk\
  exit /b 1
)

echo APK: !APK!
adb devices
echo.
adb install -r -d -g "!APK!"
if errorlevel 1 exit /b 1

if exist "config\exemplo-player-config.json" (
  echo Enviando config\exemplo-player-config.json ...
  adb shell mkdir -p /sdcard/smartsignage 2>nul
  adb push "config\exemplo-player-config.json" /sdcard/smartsignage/player-config.json
)

echo Concluido.
endlocal
