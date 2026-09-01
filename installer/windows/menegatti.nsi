; ═══════════════════════════════════════════════════════════════════════════
;  Instalador de um clique — Sistema Menegatti (Windows)
; ═══════════════════════════════════════════════════════════════════════════
;
; Gera um único MenegattiERP-Setup.exe que qualquer pessoa baixa e instala
; como qualquer outro programa — sem precisar instalar Node.js à parte, sem
; terminal, sem editar nada à mão. O que ele faz por baixo dos panos é
; reaproveitar 100% da instalação já existente (instalar.bat): só extrai os
; arquivos do sistema e um Node.js portátil (runtime\node), e então roda o
; instalar.bat de sempre — que passa a enxergar esse Node.js embutido e
; funciona sem exigir um Node.js instalado no sistema.
;
; Não precisa de privilégio de administrador: instala em
; %LOCALAPPDATA%\MenegattiERP (por usuário), mesma filosofia já documentada
; em scripts/windows/criar-atalhos.ps1 — evita a classe de problema mais
; comum nesse tipo de instalação, a de permissão.
;
; Gerado por installer/windows/gerar-instalador.sh — não é para editar à mão
; o resultado (dist/MenegattiERP-Setup.exe), só este .nsi.

Unicode true

!ifndef VERSAO
  !define VERSAO "1.0.0"
!endif

!define APPNAME "Sistema Menegatti"
!define EMPRESA "Recuperadora Menegatti"
!define CHAVE_DESINSTALAR "Software\Microsoft\Windows\CurrentVersion\Uninstall\MenegattiERP"

Name "${APPNAME}"
OutFile "dist\MenegattiERP-Setup.exe"
InstallDir "$LOCALAPPDATA\MenegattiERP"
InstallDirRegKey HKCU "Software\MenegattiERP" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma

; ── Interface ────────────────────────────────────────────────────────────
!include "MUI2.nsh"

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Instalar o ${APPNAME}"
!define MUI_WELCOMEPAGE_TEXT "Este assistente instala o sistema de gestão financeira e precificação da Recuperadora Menegatti neste computador.$\r$\n$\r$\nNão é preciso ter Node.js nem nenhum outro programa instalado antes — este instalador já traz tudo que é necessário.$\r$\n$\r$\nA instalação precisa de internet (só desta vez; o uso diário não) e leva de 5 a 15 minutos."
!define MUI_FINISHPAGE_TITLE "Instalação concluída"
!define MUI_FINISHPAGE_TEXT "O sistema foi instalado e já deve estar abrindo no navegador.$\r$\n$\r$\nUsuário: admin$\r$\nSenha: menegatti2024$\r$\n$\r$\nTroque a senha imediatamente em Configurações. Um atalho 'Sistema Menegatti' foi criado na área de trabalho para o uso do dia a dia."
!define MUI_FINISHPAGE_NOAUTOCLOSE

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "PortugueseBR"

; ═══════════════════════════════════════════════════════════════════════════
;  Instalação
; ═══════════════════════════════════════════════════════════════════════════

Section "Instalar" SEC_INSTALAR
  SetOutPath "$INSTDIR"
  File /r "build\app\*.*"

  SetOutPath "$INSTDIR\runtime\node"
  File /r "build\node-runtime\*.*"

  SetOutPath "$INSTDIR"

  WriteRegStr HKCU "Software\MenegattiERP" "InstallDir" "$INSTDIR"
  WriteUninstaller "$INSTDIR\Desinstalar.exe"

  ; Entrada em "Aplicativos instalados" do Windows (por usuário, sem admin)
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "DisplayName"     "${APPNAME}"
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "DisplayVersion"  "${VERSAO}"
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "Publisher"       "${EMPRESA}"
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "InstallLocation" "$INSTDIR"
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "UninstallString" '"$INSTDIR\Desinstalar.exe"'
  WriteRegStr   HKCU "${CHAVE_DESINSTALAR}" "DisplayIcon"     "$INSTDIR\Desinstalar.exe"
  WriteRegDWORD HKCU "${CHAVE_DESINSTALAR}" "NoModify" 1
  WriteRegDWORD HKCU "${CHAVE_DESINSTALAR}" "NoRepair" 1

  DetailPrint "Preparando o sistema (isso leva alguns minutos na primeira vez)..."
  ; O mesmo instalar.bat de sempre: agora ele enxerga runtime\node embutido
  ; acima e não precisa mais de um Node.js do sistema. Ele mesmo instala as
  ; dependências, cria o banco, compila e abre o navegador ao final.
  ExecWait '"$INSTDIR\instalar.bat"' $0
  DetailPrint "instalar.bat terminou com código $0."
SectionEnd

; ═══════════════════════════════════════════════════════════════════════════
;  Desinstalação
; ═══════════════════════════════════════════════════════════════════════════

Section "Uninstall"
  ; Fecha o servidor, se estiver rodando — evita arquivo bloqueado.
  nsExec::Exec 'taskkill /FI "WINDOWTITLE eq Sistema Menegatti*" /T /F'

  Delete "$DESKTOP\Sistema Menegatti.lnk"
  Delete "$SMSTARTUP\Sistema Menegatti (servidor).lnk"
  nsExec::Exec 'netsh advfirewall firewall delete rule name="Sistema Menegatti"'

  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Manter o banco de dados e os backups desta instalação?$\r$\n$\r$\nEscolha SIM se pretende reinstalar depois sem perder nada. Escolha NÃO para apagar tudo, inclusive os dados financeiros." \
    IDYES manter_dados IDNO apagar_tudo

  apagar_tudo:
    RMDir /r "$INSTDIR"
    Goto fim_dados

  manter_dados:
    ; Remove só o que é reinstalável; deixa prisma\ (banco), backups\ e .env.
    RMDir /r "$INSTDIR\node_modules"
    RMDir /r "$INSTDIR\.next"
    RMDir /r "$INSTDIR\runtime"
    RMDir /r "$INSTDIR\src"
    RMDir /r "$INSTDIR\public"
    RMDir /r "$INSTDIR\scripts"
    RMDir /r "$INSTDIR\docs"
    Delete "$INSTDIR\*.bat"
    Delete "$INSTDIR\*.sh"
    Delete "$INSTDIR\*.md"
    Delete "$INSTDIR\*.json"
    Delete "$INSTDIR\*.js"
    Delete "$INSTDIR\*.ts"
    Delete "$INSTDIR\.eslintrc.json"
    Delete "$INSTDIR\.env.example"
    Delete "$INSTDIR\Desinstalar.exe"
    MessageBox MB_OK|MB_ICONINFORMATION \
      "O programa foi removido. Os dados continuam em:$\r$\n$INSTDIR\prisma e $INSTDIR\backups$\r$\n$\r$\nPara reinstalar sem perder nada, instale de novo na mesma pasta."

  fim_dados:

  DeleteRegKey HKCU "${CHAVE_DESINSTALAR}"
  DeleteRegKey HKCU "Software\MenegattiERP"
SectionEnd
