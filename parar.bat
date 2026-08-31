@echo off
REM ---------------------------------------------------------------------
REM  Desliga o sistema.
REM  O servidor roda oculto, entao precisa existir uma forma explicita de
REM  encerra-lo sem depender do Gerenciador de Tarefas.
REM ---------------------------------------------------------------------
setlocal
cd /d "%~dp0"

if exist "%~dp0runtime\node\node.exe" set "PATH=%~dp0runtime\node;%PATH%"

node "%~dp0scripts\parar.mjs"
if errorlevel 1 pause
