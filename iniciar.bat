@echo off
REM ---------------------------------------------------------------------
REM  Sobe o servidor sem abrir o navegador.
REM  E o que a inicializacao automatica do Windows chama.
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

node "%~dp0scripts\abrir.mjs" --sem-navegador
