# =============================================================================
# Smart Signage Pro — Biblioteca do instalador Windows
# Carregada por install-smartsignage.ps1 (paridade funcional com install-smartsignage.sh)
# Não execute este ficheiro diretamente.
# =============================================================================

function Get-SmSiRepoRoot {
    if ($script:SmSiScriptRoot) {
        return Split-Path -Parent $script:SmSiScriptRoot
    }
    $scriptDir = $PSScriptRoot
    if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.ScriptName }
    Split-Path -Parent $scriptDir
}

# npm escreve avisos em stderr; com $ErrorActionPreference=Stop o PowerShell 5.1 falha o script.
# Em Windows, npm e um .cmd: & npm @args no PS 5.1 pode passar argumentos mal (npm mostra "Unknown command: pm").
function Get-SmSiNpmCliJs {
    $nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $nodeCmd) { $nodeCmd = Get-Command node -ErrorAction SilentlyContinue }
    if (-not $nodeCmd) { return $null }
    $nodeExe = $nodeCmd.Source
    # PS 5.1: Split-Path -LiteralPath e -Parent juntos geram AmbiguousParameterSet
    $dir = [System.IO.Path]::GetDirectoryName($nodeExe)
    $cli = Join-Path $dir 'node_modules\npm\bin\npm-cli.js'
    if (Test-Path -LiteralPath $cli) { return @{ Node = $nodeExe; Cli = $cli } }
    return $null
}

function Invoke-SmSiNpm {
    # Funcao simples (sem [Parameter]/CmdletBinding): no PS 5.1, Invoke-* + [string[]] + Mandatory
    # gerava AmbiguousParameterSet ao usar -NpmArgs.
    param([string[]]$NpmArgs)
    if ($null -eq $NpmArgs -or $NpmArgs.Count -lt 1) {
        throw 'Invoke-SmSiNpm: indique NpmArgs (ex.: install, --legacy-peer-deps).'
    }
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $code = 1
    try {
        $npmJs = Get-SmSiNpmCliJs
        if ($npmJs) {
            & $npmJs.Node $npmJs.Cli @NpmArgs
            $code = $LASTEXITCODE
        } else {
            $npmCmd = Get-Command npm.cmd -CommandType Application -ErrorAction SilentlyContinue
            if (-not $npmCmd) { $npmCmd = Get-Command npm.exe -CommandType Application -ErrorAction SilentlyContinue }
            if (-not $npmCmd) { $npmCmd = Get-Command npm -CommandType Application -ErrorAction Stop }
            $p = Start-Process -FilePath $npmCmd.Source -ArgumentList $NpmArgs -Wait -PassThru -NoNewWindow
            $code = $p.ExitCode
        }
    } finally {
        $ErrorActionPreference = $oldEap
    }
    if ($null -eq $code) { $code = 1 }
    if ($code -ne 0) {
        throw "npm falhou (codigo $code). Comando: npm $($NpmArgs -join ' ')"
    }
}

function Stop-SmSiProcessOnPort {
    param([int[]]$Ports)
    foreach ($p in $Ports) {
        try {
            $conns = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
            foreach ($c in $conns) {
                if ($c.OwningProcess -gt 0) {
                    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
                }
            }
        } catch { }
    }
    Start-Sleep -Seconds 1
}

function Invoke-SmSiDockerCompose {
    param([string[]]$ComposeArgs)
    Push-Location $script:INSTALL_DIR
    try {
        $null = & docker compose version 2>&1
        if ($LASTEXITCODE -eq 0) {
            & docker compose @ComposeArgs
            if ($LASTEXITCODE -ne 0) { throw "docker compose falhou codigo $LASTEXITCODE" }
            return
        }
        $legacy = Get-Command docker-compose -ErrorAction SilentlyContinue
        if ($legacy) {
            & docker-compose @ComposeArgs
            if ($LASTEXITCODE -ne 0) { throw "docker-compose falhou codigo $LASTEXITCODE" }
            return
        }
        throw "Instale Docker Desktop e use 'docker compose' ou 'docker-compose'."
    } finally { Pop-Location }
}

function Install-SmSiChocolatey {
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Log ('[OK] Chocolatey ja instalado')
        return
    }
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
}

function Install-SmSiGit {
    if (Get-Command git -ErrorAction SilentlyContinue) { Write-Log ('[OK] Git OK'); return }
    choco install git -y
}

function Install-SmSiNodeLts {
    if (Get-Command node -ErrorAction SilentlyContinue) {
        $v = (node --version) -replace '^v', ''
        $maj = [int]($v.Split('.')[0])
        if ($maj -ge 18) {
            Write-Log ('[OK] Node.js ' + (node --version))
            return
        }
    }
    choco install nodejs-lts -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Test-SmSiChocoPackageInstalledLocal {
    param([string]$PackageId)
    if ([string]::IsNullOrWhiteSpace($PackageId)) { return $false }
    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $listed = choco list $PackageId --local-only --limit-output 2>&1 | Out-String
    $ErrorActionPreference = $oldEap
    $pat = '(?m)^' + [regex]::Escape($PackageId.Trim()) + '(\||\s)'
    return [bool]($listed -match $pat)
}

function Get-SmSiPostgreSqlBin {
    $roots = @(
        "C:\Program Files\PostgreSQL\18\bin",
        "C:\Program Files\PostgreSQL\17\bin",
        "C:\Program Files\PostgreSQL\16\bin",
        "C:\Program Files\PostgreSQL\15\bin"
    )
    foreach ($r in $roots) {
        if (Test-Path (Join-Path $r "psql.exe")) { return $r }
    }
    $any = Get-ChildItem "C:\Program Files\PostgreSQL" -ErrorAction SilentlyContinue | Where-Object { $_.PSIsContainer } | Sort-Object Name -Descending
    foreach ($d in $any) {
        $b = Join-Path $d.FullName "bin\psql.exe"
        if (Test-Path $b) { return Split-Path $b -Parent }
    }
    return $null
}

function Test-SmSiTcpPortOpen {
    param([string]$HostName = '127.0.0.1', [int]$Port = 5432)
    try {
        $c = New-Object System.Net.Sockets.TcpClient
        $c.Connect($HostName, $Port)
        $c.Close()
        return $true
    } catch {
        return $false
    }
}

function Start-SmSiPostgreSqlService {
    $svcs = @(Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -like 'postgresql*' -or $_.Name -like 'pgsql*'
    })
    if ($svcs.Count -eq 0) {
        $svcs = @(Get-Service -ErrorAction SilentlyContinue | Where-Object {
            $_.DisplayName -and ($_.DisplayName -like '*PostgreSQL*' -or $_.DisplayName -like '*postgres*')
        })
    }
    foreach ($s in $svcs) {
        if ($s.Status -eq 'Running') { continue }
        try {
            if ($s.StartType -eq 'Disabled') {
                Set-Service -Name $s.Name -StartupType Manual -ErrorAction SilentlyContinue
            }
            Start-Service -InputObject $s -ErrorAction Stop
        } catch {
            Write-Warn ('Start-Service falhou em ' + $s.Name + ': ' + $_.Exception.Message)
            try {
                $null = & cmd.exe /c ('sc start "' + $s.Name + '"') 2>&1
            } catch { }
        }
    }
    Start-Sleep -Seconds 4
    for ($i = 0; $i -lt 90; $i++) {
        if (Test-SmSiTcpPortOpen -HostName '127.0.0.1' -Port 5432) { return $true }
        Start-Sleep -Seconds 1
    }
    return (Test-SmSiTcpPortOpen -HostName '127.0.0.1' -Port 5432)
}

function Write-SmSiPostgreSqlDiagnostics {
    Write-Warn '--- Diagnostico PostgreSQL ---'
    $all = @(Get-Service -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -like '*postgres*' -or ($_.DisplayName -and $_.DisplayName -like '*PostgreSQL*')
    })
    if ($all.Count -eq 0) {
        Write-Warn 'Nenhum servico Windows com "postgres" no nome. Chocolatey pode nao ter criado o servico.'
        Write-Warn 'Comandos uteis (PowerShell como Administrador): choco install postgresql --params "/Password:smartsignage123" -y'
    } else {
        foreach ($x in $all) {
            Write-Warn ('  ' + $x.Name + ' | ' + $x.Status + ' | arranque=' + $x.StartType)
        }
    }
    try {
        $p = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p) {
            Write-Warn ('Porta 5432 em escuta (PID): ' + $p.OwningProcess)
        } else {
            Write-Warn 'Nenhum processo em escuta na porta 5432 (127.0.0.1 nao acessivel).'
        }
    } catch {
        Write-Warn 'Nao foi possivel consultar conexoes TCP na porta 5432.'
    }
    Write-Warn 'Logs tipicos: C:\Program Files\PostgreSQL\18\data\log\ (ajuste a versao 17, 16, ...)'
    Write-Warn 'Eventos: Visualizador de eventos > Registos do Windows > Application (PostgreSQL).'
}

function Install-SmSiPostgreSql {
    if (Get-Command psql -ErrorAction SilentlyContinue) { Write-Log ('[OK] PostgreSQL cliente OK'); return }
    if (Test-SmSiChocoPackageInstalledLocal -PackageId 'postgresql') {
        Write-Log ('[OK] PostgreSQL ja instalado (Chocolatey)')
    } else {
        choco install postgresql --params '/Password:smartsignage123' -y
    }
    $bin = Get-SmSiPostgreSqlBin
    if ($bin) { $env:Path += ";$bin" }
    if (-not (Test-SmSiTcpPortOpen -HostName '127.0.0.1' -Port 5432)) {
        Write-Log 'A tentar iniciar PostgreSQL apos instalacao...'
        Start-SmSiPostgreSqlService | Out-Null
    }
}

function Add-SmSiPgBinToPath {
    $bin = Get-SmSiPostgreSqlBin
    if ($bin -and $env:Path -notlike "*$bin*") { $script:envPathExtra = $bin; $env:Path += ";$bin" }
}

function Install-SmSiRedis {
    if (Get-Command redis-server -ErrorAction SilentlyContinue) { return }
    try {
        if (Test-SmSiChocoPackageInstalledLocal -PackageId 'redis-64') {
            Write-Log ('[OK] redis-64 ja instalado (Chocolatey)')
        } else {
            choco install redis-64 -y
        }
        Start-Sleep -Seconds 2
        $svc = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -ne 'Running') { Start-Service -Name "Redis" -ErrorAction SilentlyContinue }
    } catch {
        Write-Warn "Redis não instalado automaticamente. CACHE pode ficar desativado."
    }
}

function Install-SmSiNginx {
    if (Get-Command nginx -ErrorAction SilentlyContinue) { Write-Log ('[OK] Nginx no PATH'); return }
    if (Test-SmSiChocoPackageInstalledLocal -PackageId 'nginx') {
        Write-Log ('[OK] Nginx ja instalado (Chocolatey); a atualizar PATH')
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        return
    }
    choco install nginx -y
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

function Install-SmSiDockerDesktop {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Log ('[OK] Docker: ' + (docker --version))
        return
    }
    choco install docker-desktop -y
    Write-Warn "Reinicie o Windows e execute o script novamente para continuar com Docker."
    exit 0
}

function Get-SmSiNginxPrefix {
    $cmd = Get-Command nginx.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $dir = Split-Path $cmd.Source -Parent
        if (Test-Path (Join-Path $dir "conf\nginx.conf")) { return $dir }
    }
    $tools = Get-ChildItem "C:\tools" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "nginx*" } | Sort-Object Name -Descending | Select-Object -First 1
    if ($tools) {
        $c = Join-Path $tools.FullName "conf\nginx.conf"
        if (Test-Path $c) { return $tools.FullName }
    }
    return $null
}

function ConvertTo-SmSiNginxPath {
    param([string]$WinPath)
    if ([string]::IsNullOrWhiteSpace($WinPath)) { return "" }
    ($WinPath -replace '\\', '/')
}

function Set-SmSiNginxSiteConfig {
    param(
        [string]$InstallDir,
        [string]$DomainName = "_"
    )
    if ($script:INSTALL_MODE -eq "docker") { Write-Log "Nginx gerido pelo Docker Compose"; return }

    $buildPath = Join-Path $InstallDir "frontend\build"
    if (-not (Test-Path (Join-Path $buildPath "index.html"))) {
        Write-LogError "Build do frontend em falta: $buildPath"
        exit 1
    }
    $rootFs = ConvertTo-SmSiNginxPath $buildPath

    $prefix = Get-SmSiNginxPrefix
    if (-not $prefix) {
        Write-Warn "Nginx não encontrado. Instale com: choco install nginx"
        return
    }
    $confDir = Join-Path $prefix "conf\conf.d"
    if (-not (Test-Path $confDir)) { New-Item -ItemType Directory -Path $confDir -Force | Out-Null }
    $site = Join-Path $confDir "smartsignage.conf"

    $block = @(
        "server {",
        "    listen       80;",
        "    server_name  $DomainName;",
        "",
        "    location / {",
        "        root   $rootFs;",
        "        try_files `$uri `$uri/ /index.html;",
        "    }",
        "",
        "    location /ws {",
        "        proxy_pass http://127.0.0.1:3000;",
        "        proxy_http_version 1.1;",
        "        proxy_set_header Upgrade `$http_upgrade;",
        '        proxy_set_header Connection "upgrade";',
        "        proxy_set_header Host `$host;",
        "        proxy_set_header X-Real-IP `$remote_addr;",
        "        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;",
        "        proxy_set_header X-Forwarded-Proto `$scheme;",
        "        proxy_read_timeout 86400s;",
        "        proxy_send_timeout 86400s;",
        "    }",
        "",
        "    client_max_body_size 500M;",
        "",
        "    location ^~ /api/ {",
        "        proxy_pass http://127.0.0.1:3000;",
        "        proxy_http_version 1.1;",
        "        proxy_set_header Upgrade `$http_upgrade;",
        "        proxy_set_header Connection 'upgrade';",
        "        proxy_set_header Host `$host;",
        "        proxy_set_header X-Real-IP `$remote_addr;",
        "        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;",
        "        proxy_connect_timeout 300s;",
        "        proxy_send_timeout 300s;",
        "        proxy_read_timeout 300s;",
        "    }",
        "",
        "    location ^~ /player {",
        "        proxy_pass http://127.0.0.1:3000;",
        "        proxy_http_version 1.1;",
        "        proxy_set_header Host `$host;",
        "        proxy_set_header X-Real-IP `$remote_addr;",
        "        proxy_read_timeout 300s;",
        "        proxy_buffer_size 256k;",
        "        proxy_buffers 8 512k;",
        "    }",
        "",
        "    location /assets/ {",
        "        proxy_pass http://127.0.0.1:3000;",
        "        proxy_http_version 1.1;",
        "        proxy_set_header Host `$host;",
        "    }",
        "}"
    ) -join [Environment]::NewLine
    Set-Content -Path $site -Value $block -Encoding UTF8
    Write-Log ('[OK] Nginx: ' + $site)

    $mainConf = Join-Path $prefix "conf\nginx.conf"
    if (Test-Path $mainConf) {
        $txt = Get-Content $mainConf -Raw
        if ($txt -notmatch "conf\.d/\*\.conf") {
            Write-Warn "Inclua manualmente em nginx.conf: include conf.d/*.conf;"
        }
    }
}

function Start-SmSiNginx {
    $prefix = Get-SmSiNginxPrefix
    if (-not $prefix) { return }
    Push-Location $prefix
    try {
        & nginx.exe -t 2>&1 | Out-Null
        & nginx.exe -s reload 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { Start-Process -FilePath "nginx.exe" -WorkingDirectory $prefix -WindowStyle Hidden }
    } catch { Write-Warn "Nginx: $_" }
    finally { Pop-Location }
}

function Install-SmSiDemoMedia {
    param([string]$Root)
    $src = Join-Path $Root "player-web\propagandas"
    if (-not (Test-Path $src)) {
        Write-Log ('[i] player-web/propagandas nao encontrado - midias demo omitidas')
        return
    }
    $base = Join-Path $Root "public\assets\uploads"
    $map = @(
        @{ Sub = 1; Files = @("Cestto_00005.png", "Cestto_0001.mp4") },
        @{ Sub = 2; Files = @("zaffari-bourbon_8255.jpg") },
        @{ Sub = 3; Files = @("Panvel_0001.mp4", "Panvel_ABC-00010.jpg") },
        @{ Sub = 4; Files = @("Fruteiradogeraldo0001.jpg", "Fruteiradogeraldo0002.mp4") },
        @{ Sub = 5; Files = @("Fashion_Woman-0001.webp", "moda_homem.webp") },
        @{ Sub = 6; Files = @("beleza-produtos-0001.mp4") },
        @{ Sub = 7; Files = @("check-up.jpg") },
        @{ Sub = 8; Files = @("supermercado-promocoes.jpg", "black-friday-banner.jpg") },
        @{ Sub = 9; Files = @("Smartsignage-interface-333.mp4", "Resgate Totem-_001.mp4") },
        @{ Sub = 10; Files = @("menu-executivo.jpg") }
    )
    foreach ($m in $map) {
        $dest = Join-Path $base "subscriber-$($m.Sub)\medias"
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($f in $m.Files) {
            $from = Join-Path $src $f
            if (Test-Path $from) { Copy-Item -Path $from -Destination (Join-Path $dest $f) -Force }
        }
    }
    Write-Log ('[OK] Midias demo copiadas para public/assets/uploads/subscriber-*')
}

function Copy-SmSiSelectedPlayers {
    $src = $script:SOURCE_DIR
    $dst = $script:INSTALL_DIR
    if ((Resolve-Path $src).Path -eq (Resolve-Path $dst).Path) {
        Write-Log ('[OK] Players ja no diretorio de origem')
        return
    }
    if ($script:INSTALL_ALL_PLAYERS) {
        @("player-client", "Player-SmartDisplayFX-client", "Player-Smart-FX-Interface", "player-web-cache") | ForEach-Object {
            $d = Join-Path $src $_
            if (Test-Path $d) {
                Write-Log "Copiando $_ ..."
                Copy-Item -Path $d -Destination (Join-Path $dst $_) -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
        return
    }
    $flags = @{
        "INSTALL_PLAYER_WEBOS"            = "player-client\platforms\webos"
        "INSTALL_PLAYER_ANDROID"          = "player-client\platforms\android"
        "INSTALL_PLAYER_LINUX_ELECTRON"   = "player-client\platforms\linux-electron"
        "INSTALL_PLAYER_LINUX_CPP"        = "player-client\platforms\linux-cpp"
        "INSTALL_PLAYER_WINDOWS_ELECTRON" = "player-client\platforms\windows-electron"
        "INSTALL_PLAYER_TIZEN"            = "player-client\platforms\tizen"
        "INSTALL_PLAYER_SMARTDISPLAYFX"   = "Player-SmartDisplayFX-client"
        "INSTALL_PLAYER_FX_INTERFACE"     = "Player-Smart-FX-Interface"
        "INSTALL_PLAYER_WEB_CACHE"        = "player-web-cache"
    }
    foreach ($k in $flags.Keys) {
        $rel = $flags[$k]
        $flagOn = $false
        switch ($k) {
            "INSTALL_PLAYER_WEBOS" { $flagOn = $script:INSTALL_PLAYER_WEBOS }
            "INSTALL_PLAYER_ANDROID" { $flagOn = $script:INSTALL_PLAYER_ANDROID }
            "INSTALL_PLAYER_LINUX_ELECTRON" { $flagOn = $script:INSTALL_PLAYER_LINUX_ELECTRON }
            "INSTALL_PLAYER_LINUX_CPP" { $flagOn = $script:INSTALL_PLAYER_LINUX_CPP }
            "INSTALL_PLAYER_WINDOWS_ELECTRON" { $flagOn = $script:INSTALL_PLAYER_WINDOWS_ELECTRON }
            "INSTALL_PLAYER_TIZEN" { $flagOn = $script:INSTALL_PLAYER_TIZEN }
            "INSTALL_PLAYER_SMARTDISPLAYFX" { $flagOn = $script:INSTALL_PLAYER_SMARTDISPLAYFX }
            "INSTALL_PLAYER_FX_INTERFACE" { $flagOn = $script:INSTALL_PLAYER_FX_INTERFACE }
            "INSTALL_PLAYER_WEB_CACHE" { $flagOn = $script:INSTALL_PLAYER_WEB_CACHE }
        }
        if (-not $flagOn) { continue }
        $from = Join-Path $src $rel
        if (Test-Path $from) {
            $toParent = Split-Path (Join-Path $dst $rel) -Parent
            if (-not (Test-Path $toParent)) { New-Item -ItemType Directory -Path $toParent -Force | Out-Null }
            Copy-Item -Path $from -Destination (Join-Path $dst $rel) -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Copy-SmSiPlayerWeb {
    $src = $script:SOURCE_DIR
    $dst = $script:INSTALL_DIR
    if ((Resolve-Path $src).Path -eq (Resolve-Path $dst).Path) { return }
    $pw = Join-Path $src "player-web\index.html"
    if (-not (Test-Path $pw)) { return }
    $dest = Join-Path $dst "player-web"
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path (Join-Path $src "player-web\*") -Destination $dest -Recurse -Force
    Write-Log ('[OK] player-web copiado')
}

function New-SmSiRootEnv {
    param(
        [string]$InstallDir,
        [string]$DbUrl,
        [string]$PlayerDir
    )
    $jwt = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    $playerEsc = ConvertTo-SmSiNginxPath $PlayerDir
    $uploads = ConvertTo-SmSiNginxPath (Join-Path $InstallDir "public\assets\uploads")
    $lines = @(
        '# Smart Signage Pro - Windows (install-smartsignage.ps1)',
        "NODE_ENV=production",
        "PORT=3000",
        "HOST=0.0.0.0",
        "DB_DRIVER=postgresql",
        "DATABASE_URL=$DbUrl",
        "JWT_SECRET=$jwt",
        "UPLOAD_PATH=$uploads",
        "PLAYER_DIR=$playerEsc",
        "REDIS_HOST=127.0.0.1",
        "REDIS_PORT=6379",
        "MQTT_ENABLED=true",
        "MQTT_URL=mqtt://127.0.0.1:1883",
        "",
        "# Financeiro / bloqueio inadimplencia (ver backend/env.example)",
        "FINANCIAL_WHATSAPP_NUMBER=",
        "FINANCIAL_CRON_ENFORCE_BLOCKS=15 4 * * *",
        "WHATSAPP_CLOUD_API_TOKEN=",
        "WHATSAPP_PHONE_NUMBER_ID=",
        "WHATSAPP_API_VERSION=v21.0",
        "FINANCIAL_WORKER_ENABLED=true",
        "FINANCIAL_CRON_ISSUE=30 2 * * *",
        "FINANCIAL_CRON_OVERDUE=30 3 * * *",
        "FINANCIAL_CRON_REMINDERS=0 9 * * *",
        "EMAIL_ENABLED=false"
    )
    $envFile = Join-Path $InstallDir ".env"
    $lines | Set-Content -Path $envFile -Encoding UTF8
    Copy-Item -Path $envFile -Destination (Join-Path $InstallDir "backend\.env") -Force
    Write-Log '[OK] .env raiz + backend'
}

function Invoke-SmSiNpmInstallBuild {
    param(
        [string]$ProjectPath,
        [switch]$BuildOnly
    )
    Push-Location $ProjectPath
    try {
        Invoke-SmSiNpm -NpmArgs @('install', '--legacy-peer-deps')
        if (-not $BuildOnly) { return }
        Invoke-SmSiNpm -NpmArgs @('run', 'build')
    } finally { Pop-Location }
}

function Invoke-SmSiDatabaseSetup {
    Add-SmSiPgBinToPath
    if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
        Write-Warn 'psql nao encontrado - configure PostgreSQL manualmente'
        return
    }

    $savedPgHost = $env:PGHOST
    $savedPgPort = $env:PGPORT
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '5432'

    if (-not (Test-SmSiTcpPortOpen -HostName '127.0.0.1' -Port 5432)) {
        Write-Log 'A iniciar servico PostgreSQL (Windows)...'
        if (-not (Start-SmSiPostgreSqlService)) {
            Write-SmSiPostgreSqlDiagnostics
            if ($null -ne $savedPgHost) { $env:PGHOST = $savedPgHost } else { Remove-Item Env:PGHOST -ErrorAction SilentlyContinue }
            if ($null -ne $savedPgPort) { $env:PGPORT = $savedPgPort } else { Remove-Item Env:PGPORT -ErrorAction SilentlyContinue }
            Write-LogError 'PostgreSQL nao aceita ligacoes em 127.0.0.1:5432. Execute o instalador como Administrador; veja AVISO acima e services.msc.'
            throw 'PostgreSQL indisponivel na porta 5432'
        }
    }

    $oldEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'

    try {
    $dbName = "smartsignage"
    $dbUser = "smartsignage"
    $dbPassword = "smartsignage123"
    $env:PGPASSWORD = "smartsignage123"

    $sqlDbExists = "SELECT 1 FROM pg_database WHERE datname='$dbName'"
    $exists = (psql -U postgres -tAc $sqlDbExists 2>$null).Trim()
    $dbWasNew = $false

    if ($script:RESET_DATABASE -and -not $script:PRESERVE_DB -and $exists -eq "1") {
        $sqlTerm = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$dbName' AND pid " + '<> pg_backend_pid();'
        psql -U postgres -d postgres -c $sqlTerm 2>$null | Out-Null
        psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS $dbName;" 2>$null | Out-Null
        $exists = ""
        $dbWasNew = $true
    }

    if ($exists -ne "1") {
        psql -U postgres -d postgres -c "CREATE DATABASE $dbName;" 2>$null | Out-Null
        $dbWasNew = $true
    }

    $sqlUserExists = "SELECT 1 FROM pg_roles WHERE rolname='$dbUser'"
    $uExists = (psql -U postgres -tAc $sqlUserExists 2>$null).Trim()
    if ($uExists -ne "1") {
        psql -U postgres -c "CREATE USER $dbUser WITH PASSWORD '$dbPassword';" 2>$null | Out-Null
        psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;" 2>$null | Out-Null
        psql -U postgres -d $dbName -c "GRANT ALL ON SCHEMA public TO $dbUser;" 2>$null | Out-Null
    }

    if ($dbWasNew -and -not $script:SEEDS_OPTION_FORCED) {
        $script:LOAD_SEEDS = $true
    }

    $databaseUrl = ('postgresql://{0}:{1}@127.0.0.1:5432/{2}' -f $dbUser, $dbPassword, $dbName)
    $dbDir = Join-Path $script:INSTALL_DIR "database"

    if ($dbWasNew -or $script:RESET_DATABASE) {
        $applyAll = Join-Path $dbDir "smartchannel-db-v2-refactored-apply-all.sql"
        if (Test-Path $applyAll) {
            Write-Log 'Aplicando schema apply-all...'
            Push-Location $dbDir
            try {
                psql $databaseUrl -v ON_ERROR_STOP=1 -f "smartchannel-db-v2-refactored-apply-all.sql" 2>&1 | Out-Null
            } finally { Pop-Location }
        } else {
            $parts = Get-ChildItem -Path $dbDir -Filter "smartchannel-db-v2-refactored-part*.sql" | Sort-Object Name
            foreach ($p in $parts) {
                Write-Log "DDL: $($p.Name)"
                psql $databaseUrl -v ON_ERROR_STOP=1 -f $p.FullName 2>&1 | Out-Null
            }
        }
        $seedFile = Join-Path $dbDir "carga-inicial-v6.sql"
        if ($script:LOAD_SEEDS -and (Test-Path $seedFile)) {
            Write-Log "Seeds: carga-inicial-v6.sql"
            psql $databaseUrl -f $seedFile 2>&1 | Out-Null
        }
    } elseif ($script:LOAD_SEEDS) {
        $seedFile = Join-Path $dbDir "carga-inicial-v6.sql"
        if (Test-Path $seedFile) {
            psql $databaseUrl -f $seedFile 2>&1 | Out-Null
        }
    }

    $script:SM_DB_URL = $databaseUrl
    } finally {
        $ErrorActionPreference = $oldEap
        if ($null -ne $savedPgHost) { $env:PGHOST = $savedPgHost } else { Remove-Item Env:PGHOST -ErrorAction SilentlyContinue }
        if ($null -ne $savedPgPort) { $env:PGPORT = $savedPgPort } else { Remove-Item Env:PGPORT -ErrorAction SilentlyContinue }
    }
}

function New-SmSiPm2Ecosystem {
    param([string]$InstallDir)
    $backend = Join-Path $InstallDir "backend"
    $envFile = Join-Path $InstallDir ".env"
    $bc = $backend -replace '\\', '/'
    $js = @(
        'module.exports = {',
        '  apps: [{',
        '    name: ''smart-signage'',',
        "    cwd: '$bc',",
        '    script: ''dist/index.js'',',
        '    interpreter: ''node'',',
        '    instances: 1,',
        '    autorestart: true,',
        '    max_restarts: 20,',
        '    env: { NODE_ENV: ''production'' }',
        '  }]',
        '};'
    ) -join [Environment]::NewLine

    $eco = Join-Path $InstallDir "ecosystem.config.cjs"
    Set-Content -Path $eco -Value $js -Encoding UTF8

    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
        Invoke-SmSiNpm -NpmArgs @('install', '-g', 'pm2')
        Invoke-SmSiNpm -NpmArgs @('install', '-g', 'pm2-windows-startup')
    }
    Push-Location $InstallDir
    try {
        Get-Content $envFile -Raw | ForEach-Object {
            $_ -split "`n" | ForEach-Object {
                $line = $_.Trim()
                if ($line -and $line -notmatch '^\s*#' -and $line -match '^([^=]+)=(.*)$') {
                    $k = $matches[1].Trim()
                    $v = $matches[2].Trim().Trim([char]0x22).Trim([char]0x27)
                    [Environment]::SetEnvironmentVariable($k, $v, 'Process')
                }
            }
        }
        pm2 delete smart-signage 2>$null | Out-Null
        pm2 start $eco
        pm2 save
        pm2 startup | Out-Null
    } finally { Pop-Location }
}

function Test-SmSiRebuildNeeded {
    if ($script:FORCE_REBUILD) { return $true }
    $info = Join-Path $script:INSTALL_DIR ".build-info.json"
    if (-not (Test-Path $info)) { return $false }
    $prev = Get-Content $info -Raw | ConvertFrom-Json
    $h = @{ }
    $files = @(
        "Dockerfile.backend",
        "Dockerfile.frontend",
        "docker-compose.yml",
        "nginx\nginx-complete.conf",
        "docker\nginx-entrypoint.sh"
    )
    foreach ($f in $files) {
        $p = Join-Path $script:INSTALL_DIR $f
        if (Test-Path $p) {
            $h[$f] = (Get-FileHash $p -Algorithm MD5).Hash
        } else {
            $h[$f] = "missing"
        }
    }
    foreach ($f in $files) {
        $cur = $h[$f]
        $old = $prev.checksums.$($f.Replace('\', '/'))
        if (-not $old) { $old = $prev.checksums.$f }
        if ($cur -ne $old) { return $true }
    }
    return $false
}

function Save-SmSiBuildInfo {
    $h = @{ }
    $files = @(
        "Dockerfile.backend",
        "Dockerfile.frontend",
        "docker-compose.yml",
        "nginx\nginx-complete.conf",
        "docker\nginx-entrypoint.sh"
    )
    foreach ($f in $files) {
        $p = Join-Path $script:INSTALL_DIR $f
        if (Test-Path $p) { $h[$f] = (Get-FileHash $p -Algorithm MD5).Hash } else { $h[$f] = "missing" }
    }
    $obj = @{
        build_date = (Get-Date).ToUniversalTime().ToString("o")
        version    = "2.1.0"
        checksums  = $h
    }
    $obj | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $script:INSTALL_DIR ".build-info.json") -Encoding UTF8
}

function Invoke-SmSiRebuildRestart {
    $dir = $script:INSTALL_DIR
    if ([string]::IsNullOrWhiteSpace($dir)) { $dir = Get-SmSiRepoRoot; $script:INSTALL_DIR = $dir }
    Write-Log 'REBUILD E RESTART Windows'
    Stop-SmSiProcessOnPort -Ports @(3000, 3001, 80)
    pm2 delete smart-signage 2>$null | Out-Null
    npm cache clean --force 2>$null | Out-Null

    $be = Join-Path $dir "backend"
    if (Test-Path $be) {
        Remove-Item "$be\dist" -Recurse -Force -ErrorAction SilentlyContinue
        Invoke-SmSiNpmInstallBuild -ProjectPath $be -BuildOnly
    }
    $fe = Join-Path $dir "frontend"
    if (Test-Path $fe) {
        Remove-Item "$fe\build" -Recurse -Force -ErrorAction SilentlyContinue
        Invoke-SmSiNpmInstallBuild -ProjectPath $fe -BuildOnly
    }

    Set-SmSiNginxSiteConfig -InstallDir $dir
    Start-SmSiNginx
    New-SmSiPm2Ecosystem -InstallDir $dir
    Write-Log ('[OK] Rebuild e restart concluidos')
}

function Set-SmSiLocalHosts {
    param([string[]]$Hostnames, [string]$Ip = "127.0.0.1")
    if ($script:CONFIGURE_DNS_LOCAL -ne $true) { return }
    $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
    $content = Get-Content $hosts -ErrorAction SilentlyContinue
    foreach ($h in $Hostnames) {
        $line = "$Ip`t$h"
        if ($content -notmatch [regex]::Escape($h)) {
            Add-Content -Path $hosts -Value $line -Encoding ASCII
            Write-Log "Hosts: $line"
        }
    }
}

function Start-SmSiTotemLab {
    if (-not $script:START_TOTEM) { return }
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    $u1 = "http://${ip}/player?uin=DEMO1"
    $u2 = "http://${ip}/player?uin=DEMO2"
    foreach ($b in @("msedge", "chrome")) {
        $exe = Get-Command $b -ErrorAction SilentlyContinue
        if ($exe) {
            Start-Process $exe.Source -ArgumentList $u1
            Start-Process $exe.Source -ArgumentList $u2
            Write-Log ('[OK] Navegadores de laboratorio abertos')
            return
        }
    }
    Write-Warn 'Navegador Edge/Chrome nao encontrado para flag starttotem'
}

function Set-SmSiKioskStartup {
    if ($script:ENABLE_KIOSK_MODE -ne $true) { return }
    if ($script:INSTALL_MODE -ne "single-server" -and $script:INSTALL_MODE -ne "development") { return }
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    $url = "http://$ip/player"
    $startup = [Environment]::GetFolderPath('Startup')
    $cmdPath = Join-Path $startup "SmartSignageKiosk.cmd"
    $pf86 = [Environment]::GetFolderPath('ProgramFilesX86')
    $edge = Join-Path $pf86 "Microsoft\Edge\Application\msedge.exe"
    if (-not (Test-Path $edge)) { $edge = Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe" }
    if (Test-Path $edge) {
        $batch = @(
            '@echo off',
            ('start "" "{0}" --kiosk "{1}" --edge-kiosk-type=fullscreen' -f $edge, $url)
        )
        Set-Content -Path $cmdPath -Value $batch -Encoding ASCII
        Write-Log ('[OK] Kiosk Windows: atalho em Startup - ' + $cmdPath)
    } else {
        Write-Warn 'Edge nao encontrado - kiosk nao configurado'
    }
}

function Show-SmSiFinalInfo {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "127.0.0.1" }
    Write-Host ""
    Write-Host 'Instalacao Smart Signage Pro Windows concluida.' -ForegroundColor Green
    Write-Host "Painel:  http://${ip}:80  via Nginx single-server" -ForegroundColor Cyan
    Write-Host "API:     http://${ip}:3000" -ForegroundColor Cyan
    Write-Host "Player:  http://${ip}/player" -ForegroundColor Cyan
    Write-Host 'Credenciais padrao com seeds: admin / admin123' -ForegroundColor Yellow
    Write-Host "Diretorio: $($script:INSTALL_DIR)" -ForegroundColor Gray
}

function Invoke-SmSiDbOnly {
    $script:SOURCE_DIR = Get-SmSiRepoRoot
    $script:INSTALL_DIR = $script:SOURCE_DIR
    if ([string]::IsNullOrWhiteSpace($script:INSTALL_MODE)) { $script:INSTALL_MODE = "single-server" }
    Install-SmSiChocolatey
    Install-SmSiPostgreSql
    $script:RESET_DATABASE = $true
    $script:PRESERVE_DB = $false
    Invoke-SmSiDatabaseSetup
    $playerDir = Join-Path $script:INSTALL_DIR "player-web"
    New-SmSiRootEnv -InstallDir $script:INSTALL_DIR -DbUrl $script:SM_DB_URL -PlayerDir $playerDir
    Write-Log 'db-only concluido'
}

function Invoke-SmSiSelectiveBuild {
    if ($script:INSTALL_MODE -eq "docker") {
        Write-LogError 'Modos backend-only frontend-only backfront-build nao suportados com mode docker.'
        exit 1
    }
    $script:SOURCE_DIR = Get-SmSiRepoRoot
    $script:INSTALL_DIR = $script:SOURCE_DIR
    Write-Log 'Parando servicos antes do build...'
    Stop-SmSiProcessOnPort -Ports @(3000, 8080, 3001, 80)
    pm2 delete smart-signage 2>$null | Out-Null

    $be = Join-Path $script:INSTALL_DIR "backend"
    $fe = Join-Path $script:INSTALL_DIR "frontend"

    if ($script:BACKFRONT_BUILD_ONLY) {
        Invoke-SmSiNpmInstallBuild -ProjectPath $be -BuildOnly
        Invoke-SmSiNpmInstallBuild -ProjectPath $fe -BuildOnly
        Set-SmSiNginxSiteConfig -InstallDir $script:INSTALL_DIR
        Start-SmSiNginx
        New-SmSiPm2Ecosystem -InstallDir $script:INSTALL_DIR
    } elseif ($script:BACKEND_BUILD_ONLY) {
        Invoke-SmSiNpmInstallBuild -ProjectPath $be -BuildOnly
        New-SmSiPm2Ecosystem -InstallDir $script:INSTALL_DIR
    } elseif ($script:FRONTEND_BUILD_ONLY) {
        Invoke-SmSiNpmInstallBuild -ProjectPath $fe -BuildOnly
        Set-SmSiNginxSiteConfig -InstallDir $script:INSTALL_DIR
        Start-SmSiNginx
    }
    Write-Log ('[OK] Build seletivo concluido')
}

function Show-SmSiMainMenu {
    if ($script:SKIP_MENU) {
        if ([string]::IsNullOrWhiteSpace($script:INSTALL_MODE)) { $script:INSTALL_MODE = "single-server" }
        Write-Log "Modo: $($script:INSTALL_MODE) skip-menu"
        return
    }
    Write-Host "`nSelecione o modo de instalacao:"
    Write-Host '1) Single-Server'
    Write-Host '2) Docker'
    Write-Host '3) Rebuild e Restart'
    $c = Read-Host 'Escolha 1-3 [padrao 1]'
    if ([string]::IsNullOrWhiteSpace($c)) { $c = "1" }
    switch ($c) {
        "1" { $script:INSTALL_MODE = "single-server" }
        "2" { $script:INSTALL_MODE = "docker" }
        "3" { $script:INSTALL_MODE = "rebuild-restart"; $script:SKIP_MENU = $true }
        default { Write-LogError 'Opcao invalida'; exit 1 }
    }
}

function Show-SmSiPlayersMenu {
    if ($script:SKIP_MENU) {
        $script:INSTALL_ALL_PLAYERS = $true
        $script:INSTALL_PLAYER_WEBOS = $true
        $script:INSTALL_PLAYER_ANDROID = $true
        $script:INSTALL_PLAYER_LINUX_ELECTRON = $true
        $script:INSTALL_PLAYER_LINUX_CPP = $true
        $script:INSTALL_PLAYER_WINDOWS_ELECTRON = $true
        $script:INSTALL_PLAYER_TIZEN = $true
        $script:INSTALL_PLAYER_SMARTDISPLAYFX = $true
        $script:INSTALL_PLAYER_FX_INTERFACE = $true
        $script:INSTALL_PLAYER_WEB_CACHE = $true
        Copy-SmSiSelectedPlayers
        return
    }
    Write-Host ("`nPlayers: numeros separados por virgula, 10=todos, 0=nenhum " + '[10]:')
    Write-Host "9 = Player Web Cache"
    $pc = Read-Host
    if ([string]::IsNullOrWhiteSpace($pc)) { $pc = "10" }
    $script:INSTALL_PLAYER_WEBOS = $false
    $script:INSTALL_PLAYER_ANDROID = $false
    $script:INSTALL_PLAYER_LINUX_ELECTRON = $false
    $script:INSTALL_PLAYER_LINUX_CPP = $false
    $script:INSTALL_PLAYER_WINDOWS_ELECTRON = $false
    $script:INSTALL_PLAYER_TIZEN = $false
    $script:INSTALL_PLAYER_SMARTDISPLAYFX = $false
    $script:INSTALL_PLAYER_FX_INTERFACE = $false
    $script:INSTALL_PLAYER_WEB_CACHE = $false
    $script:INSTALL_ALL_PLAYERS = $false
    if ($pc -eq "10") {
        $script:INSTALL_ALL_PLAYERS = $true
        $script:INSTALL_PLAYER_WEBOS = $true
        $script:INSTALL_PLAYER_ANDROID = $true
        $script:INSTALL_PLAYER_LINUX_ELECTRON = $true
        $script:INSTALL_PLAYER_LINUX_CPP = $true
        $script:INSTALL_PLAYER_WINDOWS_ELECTRON = $true
        $script:INSTALL_PLAYER_TIZEN = $true
        $script:INSTALL_PLAYER_SMARTDISPLAYFX = $true
        $script:INSTALL_PLAYER_FX_INTERFACE = $true
        $script:INSTALL_PLAYER_WEB_CACHE = $true
    } elseif ($pc -ne "0") {
        foreach ($x in ($pc -split ',')) {
            switch ($x.Trim()) {
                "1" { $script:INSTALL_PLAYER_WEBOS = $true }
                "2" { $script:INSTALL_PLAYER_ANDROID = $true }
                "3" { $script:INSTALL_PLAYER_LINUX_ELECTRON = $true }
                "4" { $script:INSTALL_PLAYER_LINUX_CPP = $true }
                "5" { $script:INSTALL_PLAYER_WINDOWS_ELECTRON = $true }
                "6" { $script:INSTALL_PLAYER_TIZEN = $true }
                "7" { $script:INSTALL_PLAYER_SMARTDISPLAYFX = $true }
                "8" { $script:INSTALL_PLAYER_FX_INTERFACE = $true }
                "9" { $script:INSTALL_PLAYER_WEB_CACHE = $true }
            }
        }
    }
    Copy-SmSiSelectedPlayers
}

function Show-SmSiMenuContinuation {
    if (-not $script:SKIP_MENU) {
        Write-Host "`nConfigurar DNS local no ficheiro hosts? s/N"
        $d = Read-Host
        if ($d -match '^[sSyY]') { $script:CONFIGURE_DNS_LOCAL = $true }
        else { $script:CONFIGURE_DNS_LOCAL = $false }

        if ($script:SEEDS_OPTION_FORCED -ne $true) {
            Write-Host 'Carregar seeds de demonstracao? s/N'
            $s = Read-Host
            if ($s -match '^[sSyY]') { $script:LOAD_SEEDS = $true } else { $script:LOAD_SEEDS = $false }
        }

        if ($script:INSTALL_MODE -eq "single-server") {
            Write-Host 'Modo Kiosk Edge ecran completo no arranque? S/n'
            $k = Read-Host
            if ([string]::IsNullOrWhiteSpace($k) -or $k -match '^[sS]') {
                $script:ENABLE_KIOSK_MODE = $true
            } else {
                $script:ENABLE_KIOSK_MODE = $false
            }
        }
    } else {
        if ($script:SEEDS_OPTION_FORCED -ne $true) {
            $script:LOAD_SEEDS = $false
        }
        if ($script:INSTALL_MODE -eq "single-server") {
            $script:ENABLE_KIOSK_MODE = $true
        }
    }
}

function Ask-SmSiHttps {
    if ($script:SKIP_MENU) { return }
    Write-Host "`nHTTPS: no Windows use certificado manual ou win-acme. Lets Encrypt automatico nao esta incluido."
    Write-Host 'Ativar nota https-self-signed para futura extensao Nginx SSL? s/N'
    $h = Read-Host
    if ($h -match '^[sSyY]') { $script:ENABLE_HTTPS_SELF_SIGNED = $true }
}

function Invoke-SmSiLetsEncryptStub {
    if ($script:ENABLE_HTTPS_LETSENCRYPT) {
        Write-Warn 'Lets Encrypt: configure manualmente ex. win-acme ou IIS.'
    }
    if ($script:ENABLE_HTTPS_SELF_SIGNED) {
        Write-Warn 'HTTPS autoassinado: use OpenSSL manual no Windows para Nginx.'
    }
}

function Invoke-SmSiFullInstall {
    $script:SOURCE_DIR = Get-SmSiRepoRoot
    $script:INSTALL_DIR = $script:SOURCE_DIR

    if ($script:INSTALL_MODE -eq "rebuild-restart") {
        Invoke-SmSiRebuildRestart
        Show-SmSiFinalInfo
        return
    }

    Show-SmSiMainMenu
    if ($script:INSTALL_MODE -eq "rebuild-restart") {
        Invoke-SmSiRebuildRestart
        Show-SmSiFinalInfo
        return
    }

    if ($script:INSTALL_MODE -notmatch '^(single-server|docker|development)$') {
        Write-LogError "INSTALL_MODE inválido: $($script:INSTALL_MODE)"
        exit 1
    }

    Show-SmSiPlayersMenu
    Copy-SmSiPlayerWeb
    Show-SmSiMenuContinuation
    Ask-SmSiHttps

    Write-Log "Iniciando instalacao Smart Signage Pro v$($script:SYSTEM_VERSION) Windows..."

    Install-SmSiChocolatey
    Install-SmSiGit
    Install-SmSiNodeLts
    if ($script:INSTALL_MODE -eq "single-server" -or $script:INSTALL_MODE -eq "development") {
        Install-SmSiPostgreSql
        Install-SmSiRedis
        Install-SmSiNginx
    }
    if ($script:INSTALL_MODE -eq "docker") {
        Install-SmSiDockerDesktop
    }

    $ports = @(80, 3000, 8080, 5432, 6379, 1883, 9090, 3002)
    foreach ($port in $ports) {
        try {
            if (-not (Get-NetFirewallRule -DisplayName "Smart Signage Pro - Port $port" -ErrorAction SilentlyContinue)) {
                New-NetFirewallRule -DisplayName "Smart Signage Pro - Port $port" -Direction Inbound -LocalPort $port -Protocol TCP -Action Allow | Out-Null
            }
        } catch { }
    }

    New-Item -ItemType Directory -Path (Join-Path $script:INSTALL_DIR "public\assets\uploads") -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $script:INSTALL_DIR "logs") -Force | Out-Null

    Invoke-SmSiNpmInstallBuild -ProjectPath (Join-Path $script:INSTALL_DIR "backend") -BuildOnly
    Invoke-SmSiNpmInstallBuild -ProjectPath (Join-Path $script:INSTALL_DIR "frontend") -BuildOnly

    if ($script:INSTALL_MODE -eq "docker") {
        Push-Location $script:INSTALL_DIR
        try {
            if ($script:REBUILD_CACHE) {
                Invoke-SmSiDockerCompose @("build", "--no-cache")
            } else {
                Invoke-SmSiDockerCompose @("build")
            }
            if (-not $script:REBUILD_ONLY) {
                Invoke-SmSiDockerCompose @("up", "-d")
            }
        } finally { Pop-Location }
        Save-SmSiBuildInfo
        if ($script:START_TOTEM) { Start-SmSiTotemLab }
        Show-SmSiFinalInfo
        return
    }

    Add-SmSiPgBinToPath
    Invoke-SmSiDatabaseSetup
    $playerDir = Join-Path $script:INSTALL_DIR "player-web"
    New-SmSiRootEnv -InstallDir $script:INSTALL_DIR -DbUrl $script:SM_DB_URL -PlayerDir $playerDir

    Install-SmSiDemoMedia -Root $script:INSTALL_DIR
    Set-SmSiLocalHosts -Hostnames @("smartsignage.local", "panel.smartsignage.local")

    Set-SmSiNginxSiteConfig -InstallDir $script:INSTALL_DIR
    Invoke-SmSiLetsEncryptStub
    Start-SmSiNginx
    New-SmSiPm2Ecosystem -InstallDir $script:INSTALL_DIR

    Set-SmSiKioskStartup
    if ($script:START_TOTEM) { Start-SmSiTotemLab }
    Show-SmSiFinalInfo
}
