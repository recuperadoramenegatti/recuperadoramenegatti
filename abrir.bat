@echo off
REM ---------------------------------------------------------------------
REM  Icone que o dono usa no dia a dia.
REM
REM  Involucro fino de proposito: toda a logica (checar se o servidor esta
REM  no ar, liga-lo, esperar, abrir o navegador) esta em scripts\abrir.mjs.
REM
REM  Este arquivo NAO deve ganhar laco, goto nem call. Foi exatamente essa
REM  logica em batch que quebrou na maquina da empresa: o cmd.exe le .bat
REM  por posicao de byte, erra a conta quando o arquivo esta salvo com
REM  quebra de linha do Unix, e o sistema morria dizendo
REM  "30 foi inesperado neste momento".
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

node "%~dp0scripts\abrir.mjs"
if errorlevel 1 pause
