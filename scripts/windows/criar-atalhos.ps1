<#
    Cria os dois atalhos da instalação no Windows.

    1. Área de trabalho -> abre o sistema no navegador.
       É o que o dono usa todo dia.

    2. Pasta Inicializar -> sobe o servidor junto com o Windows,
       minimizado.

    A pasta Inicializar do usuário foi escolhida de propósito, no lugar de um
    serviço do Windows: não exige privilégio de administrador, e o servidor
    roda com a mesma conta que é dona do arquivo do banco — o que evita a
    classe de problema mais comum numa instalação assim, a de permissão.

    O contrapartida está documentada em docs/INSTALACAO.md: o sistema fica
    disponível a partir do login, não do ligar do computador.
#>

$ErrorActionPreference = 'Stop'

try {
    $raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $shell = New-Object -ComObject WScript.Shell

    # ── 1. Atalho da área de trabalho ────────────────────────────────────
    # Aponta para abrir.bat, não para a URL: um atalho direto ao endereço
    # mostraria erro de conexão sempre que o servidor estivesse parado.
    # O abrir.bat sobe o servidor se preciso e só então abre o navegador.
    $areaDeTrabalho = [Environment]::GetFolderPath('Desktop')
    $atalhoApp = Join-Path $areaDeTrabalho 'Sistema Menegatti.lnk'

    $link = $shell.CreateShortcut($atalhoApp)
    $link.TargetPath = Join-Path $raiz 'abrir.bat'
    $link.WorkingDirectory = $raiz
    $link.WindowStyle = 7
    $link.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,14"
    $link.Description = 'Abrir o sistema de gestao da Recuperadora Menegatti'
    $link.Save()

    Write-Host '        Atalho criado na area de trabalho.'

    # ── 2. Inicialização automática ──────────────────────────────────────
    $inicializar = [Environment]::GetFolderPath('Startup')
    $atalhoInicio = Join-Path $inicializar 'Sistema Menegatti (servidor).lnk'

    $link = $shell.CreateShortcut($atalhoInicio)
    $link.TargetPath = Join-Path $raiz 'iniciar.bat'
    $link.WorkingDirectory = $raiz
    $link.WindowStyle = 7   # minimizado: visivel na barra, fora do caminho
    $link.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,44"
    $link.Description = 'Servidor do sistema Menegatti'
    $link.Save()

    Write-Host '        Inicializacao automatica configurada.'

    # ── 3. Liberação no firewall (opcional, precisa de administrador) ────
    # Sem isso o sistema funciona neste computador, mas nao e alcancavel
    # a partir de outro. Falhar aqui nao e motivo para abortar nada.
    try {
        $regra = 'Sistema Menegatti'
        $existe = Get-NetFirewallRule -DisplayName $regra -ErrorAction SilentlyContinue
        if (-not $existe) {
            New-NetFirewallRule -DisplayName $regra `
                -Direction Inbound -Action Allow `
                -Protocol TCP -LocalPort 3000 `
                -Profile Private `
                -ErrorAction Stop | Out-Null
            Write-Host '        Acesso pela rede da oficina liberado no firewall.'
        }
    }
    catch {
        Write-Host '        (Acesso pela rede nao liberado - requer administrador.'
        Write-Host '         O sistema funciona normalmente neste computador.)'
    }

    exit 0
}
catch {
    Write-Host "        Falha ao criar atalhos: $($_.Exception.Message)"
    exit 1
}
