@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-smartsignage-adb.ps1" %*
set "EC=%ERRORLEVEL%"
endlocal & exit /b %EC%
