@echo off
cd /d "%~dp0"

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\iniciar-alento.ps1" -Build
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Falha ao iniciar o Alento.
) else (
  echo Alento iniciado com sucesso.
)

pause
exit /b %EXIT_CODE%
