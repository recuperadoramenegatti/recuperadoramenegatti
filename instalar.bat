@echo off
setlocal
cd /d "%~dp0"

echo.
echo  ============================================================
echo    RECUPERADORA MENEGATTI
echo    Instalacao do sistema de gestao financeira
echo  ============================================================
echo.

REM ---------------------------------------------------------------
REM  1. Node.js
REM ---------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo   [X] O Node.js nao esta instalado neste computador.
  echo.
  echo       O sistema precisa dele para funcionar.
  echo.
  echo       1. Abra  https://nodejs.org
  echo       2. Baixe a versao LTS
  echo       3. Instale aceitando as opcoes padrao
  echo       4. Rode este arquivo novamente
  echo.
  pause
  exit /b 1
)

echo   [1/5] Instalando os componentes do sistema...
echo         ^(pode levar alguns minutos na primeira vez^)
echo.
call npm install --no-audit --no-fund
if errorlevel 1 goto :falhou

echo.
echo   [2/5] Preparando a configuracao...
call node scripts\preparar-ambiente.mjs
if errorlevel 1 goto :falhou

echo.
echo   [3/5] Criando o banco de dados...
call npm run setup
if errorlevel 1 goto :falhou

echo.
echo   [4/5] Compilando o sistema...
echo         ^(esta e a etapa mais demorada^)
echo.
call npm run build
if errorlevel 1 goto :falhou

echo.
echo   [5/5] Criando os atalhos...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\windows\criar-atalhos.ps1"
if errorlevel 1 (
  echo   [!] Nao foi possivel criar os atalhos automaticamente.
  echo       O sistema funciona: use o arquivo iniciar.bat desta pasta.
)

echo.
echo  ============================================================
echo    INSTALACAO CONCLUIDA
echo  ============================================================
echo.
call node scripts\rede.mjs 3000 --instalado
echo    Um atalho "Sistema Menegatti" foi criado na area de trabalho.
echo    O sistema tambem passa a iniciar sozinho junto com o Windows.
echo.
echo    Usuario: admin
echo    Senha:   menegatti2024
echo.
echo    TROQUE A SENHA no primeiro acesso, em Configuracoes.
echo.
echo  ============================================================
echo.
echo    Iniciando o sistema agora...
echo.
timeout /t 3 /nobreak >nul
start "" "%~dp0abrir.bat"
exit /b 0

:falhou
echo.
echo  ============================================================
echo    A INSTALACAO FALHOU
echo  ============================================================
echo.
echo    Alguma etapa acima terminou com erro. A mensagem em
echo    vermelho, logo antes desta, diz o motivo.
echo.
echo    O que costuma resolver:
echo      - Conferir se este computador esta conectado a internet
echo        ^(so a instalacao precisa dela; o uso diario nao^)
echo      - Rodar este arquivo como administrador
echo        ^(clique com o botao direito - Executar como administrador^)
echo.
pause
exit /b 1
