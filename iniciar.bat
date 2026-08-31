@echo off
REM ---------------------------------------------------------------------
REM  Sobe o servidor do sistema. Esta janela E o servidor:
REM  fecha-la encerra o sistema.
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"
title Sistema Menegatti

if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js nao encontrado neste computador.
  echo       Rode instalar.bat primeiro.
  echo.
  pause
  exit /b 1
)

if not exist ".next" (
  echo.
  echo   [X] O sistema ainda nao foi instalado nesta pasta.
  echo       Rode instalar.bat primeiro.
  echo.
  pause
  exit /b 1
)

REM  A porta 3000 e o padrao. Se estiver ocupada por outro programa,
REM  troque o numero na linha abaixo.
if "%PORT%"=="" set PORT=3000

call node scripts\rede.mjs %PORT%

REM  start:rede escuta em 0.0.0.0, para que o sistema possa ser aberto de
REM  outro computador da oficina. O login continua sendo exigido.
call npm run start:rede

echo.
echo   O sistema foi encerrado.
pause
