#Requires -Version 5.1
<#
.SYNOPSIS
  Empacota e instala o Player-WOS em TV LG webOS via ares-cli.

.DESCRIPTION
  Fluxo:
  1) valida comandos ares-cli
  2) gera .ipk com ares-package
  3) instala com ares-install
  4) abre app com ares-launch

.EXAMPLE
  .\install-lg-webos.ps1 -DeviceName lg-tv

.EXAMPLE
  .\install-lg-webos.ps1 -DeviceName lg-tv -OnlyPackage

.EXAMPLE
  .\install-lg-webos.ps1 -DeviceName lg-tv -SkipLaunch
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string] $DeviceName,
    [switch] $OnlyPackage,
    [switch] $SkipLaunch
)

$ErrorActionPreference = "Stop"
$AppId = "br.com.smartchannel.playerwos"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

function Require-Cmd([string] $cmd) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Comando '$cmd' nao encontrado. Instale CLI: npm install -g @webos-tools/cli"
    }
}

Write-Host "== Player-WOS install LG webOS ==" -ForegroundColor Cyan
Write-Host "Root: $RootDir"
Write-Host "Device: $DeviceName"

Require-Cmd "ares-package"
Require-Cmd "ares-install"
Require-Cmd "ares-launch"
Require-Cmd "ares-device"

Write-Host "`n>> Validando device registrado..." -ForegroundColor Yellow
$devList = & ares-device -F 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    throw "Falha ao listar devices. Configure com: ares-setup-device"
}
if ($devList -notmatch [Regex]::Escape($DeviceName)) {
    throw "Device '$DeviceName' nao encontrado. Execute: ares-setup-device"
}

Push-Location $RootDir
try {
    Write-Host "`n>> Empacotando app..." -ForegroundColor Yellow
    & ares-package . 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "ares-package falhou."
    }

    $ipk = Get-ChildItem -Path $RootDir -Filter "*.ipk" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if (-not $ipk) {
        throw "Nenhum .ipk gerado em $RootDir"
    }

    Write-Host "IPK: $($ipk.FullName)" -ForegroundColor Green

    if ($OnlyPackage) {
        Write-Host "OnlyPackage ativo: empacotamento concluido." -ForegroundColor Green
        return
    }

    Write-Host "`n>> Instalando na TV..." -ForegroundColor Yellow
    & ares-install --device $DeviceName $ipk.FullName 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "ares-install falhou."
    }

    if (-not $SkipLaunch) {
        Write-Host "`n>> Abrindo app..." -ForegroundColor Yellow
        & ares-launch --device $DeviceName $AppId 2>&1 | Out-Host
        if ($LASTEXITCODE -ne 0) {
            throw "ares-launch falhou."
        }
    }
}
finally {
    Pop-Location
}

Write-Host "`nConcluido com sucesso." -ForegroundColor Green
