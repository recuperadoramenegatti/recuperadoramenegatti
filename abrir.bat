@echo off
REM ---------------------------------------------------------------------
REM  Unico icone que o dono usa no dia a dia.
REM
REM  Se o servidor ja estiver no ar, apenas abre o navegador.
REM  Se nao estiver, sobe o servidor, espera ficar pronto e entao abre.
REM  Assim o atalho funciona sempre, sem o dono precisar saber se o
REM  servidor esta ligado.
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

if "%PORT%"=="" set PORT=3000
set ENDERECO=http://localhost:%PORT%

REM  Ja esta no ar?
call :servidorNoAr
if "%NOAR%"=="1" goto :abrirNavegador

if not exist ".next" (
  echo.
  echo   O sistema ainda nao foi instalado nesta pasta.
  echo   Rode instalar.bat primeiro.
  echo.
  pause
  exit /b 1
)

echo.
echo   Iniciando o sistema, aguarde...
start "Sistema Menegatti" /min "%~dp0iniciar.bat"

REM  Espera ate 60 segundos. Laco por goto: `call` dentro de bloco entre
REM  parenteses e um padrao conhecido por falhar de formas silenciosas.
set TENTATIVA=0

:aguardar
set /a TENTATIVA+=1
timeout /t 2 /nobreak >nul
call :servidorNoAr
if "%NOAR%"=="1" goto :abrirNavegador
if %TENTATIVA% LSS 30 goto :aguardar

echo.
echo   O sistema demorou mais que o esperado para iniciar.
echo   Procure a janela "Sistema Menegatti" na barra de tarefas
echo   para ver se apareceu alguma mensagem de erro.
echo.
pause
exit /b 1

:abrirNavegador
start "" "%ENDERECO%"
exit /b 0

REM ---------------------------------------------------------------------
REM  Define NOAR=1 quando o servidor responde na porta.
REM ---------------------------------------------------------------------
:servidorNoAr
set NOAR=0
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri '%ENDERECO%/login' -TimeoutSec 3 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 set NOAR=1
exit /b 0
