@echo off
setlocal
cd /d "%~dp0"
set "PS1=%~dp0scripts\install-player-adb.ps1"
if /i "%~1"=="clean" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -Clean
) else if /i "%~1"=="skip" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -SkipBuild
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
)
set "EC=%ERRORLEVEL%"
endlocal & exit /b %EC%
