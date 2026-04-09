@echo off
REM Build + install via adb da PATH (mais fiavel que gradlew installDebug no Windows)
cd /d "%~dp0.."
call gradlew.bat :app:assembleDebug
if errorlevel 1 exit /b 1
adb devices
adb install -r app\build\outputs\apk\debug\app-debug.apk
if errorlevel 1 (
  echo.
  echo Se falhar: confirma adb devices. Varias caixas: set ANDROID_SERIAL=SERIAL
  exit /b 1
)
echo OK. adb shell am start -n br.com.smartchannel.smartsignagead/.ui.MainActivity
