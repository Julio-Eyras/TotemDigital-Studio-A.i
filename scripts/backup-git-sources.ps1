#Requires -Version 5.1
<#
.SYNOPSIS
  Backup compactado dos fontes exactamente como no Git + copia local descompactada.

.DESCRIPTION
  Usa `git archive` (so ficheiros rastreados / commitados no indice Git).
  NAO inclui node_modules, build, .env locais nao versionados, nem ficheiros untracked
  (salvo se usar -IncludeUntracked).

  Gera:
    1) ZIP timestampado
    2) Pasta local espelhando o conteudo do ZIP (copia descompactada)

.EXAMPLE
  .\scripts\backup-git-sources.ps1

.EXAMPLE
  .\scripts\backup-git-sources.ps1 -OutputDir "D:\Backups\TotemDigital" -LocalCopyDir "D:\Backups\TotemDigital\src-atual"

.EXAMPLE
  .\scripts\backup-git-sources.ps1 -Ref HEAD -IncludeUntracked
#>
[CmdletBinding()]
param(
    # Pasta onde gravar o ZIP (criada se nao existir)
    [string] $OutputDir = "",

    # Pasta da copia local descompactada (criada/limpa se -ForceLocalCopy)
    [string] $LocalCopyDir = "",

    # Ref Git: HEAD, branch, tag ou commit
    [string] $Ref = "HEAD",

    # Incluir tambem ficheiros untracked (respeitando .gitignore)
    [switch] $IncludeUntracked,

    # Se a pasta LocalCopyDir existir, apagar e recriar
    [switch] $ForceLocalCopy,

    # Abrir o Explorer no fim
    [switch] $OpenExplorer
)

$ErrorActionPreference = 'Stop'

$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRootCandidate = (Resolve-Path (Join-Path $ScriptDir '..')).Path

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git nao esta no PATH."
}

Push-Location $RepoRootCandidate
try {
    $gitRoot = (& git rev-parse --show-toplevel 2>&1 | Out-String).Trim()
    if ($gitRoot -match 'fatal:|not a git repository' -or [string]::IsNullOrWhiteSpace($gitRoot) -or -not (Test-Path -LiteralPath $gitRoot)) {
        throw "Nao e um repositorio Git: $RepoRootCandidate"
    }
    $RepoRoot = (Resolve-Path -LiteralPath $gitRoot).Path
}
finally {
    Pop-Location
}

Set-Location $RepoRoot

$branch = (& git rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1)
$commit = (& git rev-parse --short HEAD 2>$null | Select-Object -First 1)
$commitFull = (& git rev-parse HEAD 2>$null | Select-Object -First 1)
$statusPorcelain = (& git status --porcelain 2>$null)
$dirty = -not [string]::IsNullOrWhiteSpace(($statusPorcelain | Out-String).Trim())

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$safeBranch = ($branch -replace '[\\/:*?"<>|]', '_')
$zipName = "TotemDigital-Studio_git_${safeBranch}_${commit}_${ts}.zip"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
    $OutputDir = Join-Path $RepoRoot 'backups\git-sources'
}
if ([string]::IsNullOrWhiteSpace($LocalCopyDir)) {
    $LocalCopyDir = Join-Path $OutputDir "TotemDigital-Studio_${safeBranch}_${commit}_${ts}"
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$zipPath = Join-Path $OutputDir $zipName

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backup Git fontes (archive + copia)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Repo:    $RepoRoot"
Write-Host "Branch:  $branch"
Write-Host "Commit:  $commitFull"
Write-Host "Ref:     $Ref"
Write-Host "Dirty:   $dirty"
Write-Host "ZIP:     $zipPath"
Write-Host "Copia:   $LocalCopyDir"
Write-Host ""

# --- ZIP via git archive (conteudo versionado) ---
Write-Host ">> git archive ($Ref) ..." -ForegroundColor Yellow
$prefix = "TotemDigital-Studio/"
& git archive --format=zip --prefix=$prefix -o $zipPath $Ref
if ($LASTEXITCODE -ne 0) {
    throw "git archive falhou (ref=$Ref). Exit=$LASTEXITCODE"
}

# Manifesto dentro do ZIP (append) — ficheiro ao lado + dentro da copia
$manifest = @"
# TotemDigital-Studio — backup de fontes Git
created_utc=$([DateTime]::UtcNow.ToString('o'))
created_local=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
repo=$RepoRoot
branch=$branch
commit=$commitFull
ref=$Ref
working_tree_dirty=$dirty
include_untracked=$IncludeUntracked
zip=$zipPath
"@
$manifestPath = Join-Path $OutputDir ("MANIFEST_${safeBranch}_${commit}_${ts}.txt")
Set-Content -Path $manifestPath -Value $manifest -Encoding UTF8

# --- Untracked opcional (respeita .gitignore) ---
if ($IncludeUntracked) {
    Write-Host ">> A incluir untracked (git ls-files --others --exclude-standard)..." -ForegroundColor Yellow
    $others = & git ls-files --others --exclude-standard
    if ($others) {
        $tmpExtra = Join-Path $env:TEMP ("td-git-extra_" + $ts)
        New-Item -ItemType Directory -Force -Path $tmpExtra | Out-Null
        $extraRoot = Join-Path $tmpExtra 'TotemDigital-Studio'
        New-Item -ItemType Directory -Force -Path $extraRoot | Out-Null
        foreach ($rel in $others) {
            $src = Join-Path $RepoRoot $rel
            if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { continue }
            $dst = Join-Path $extraRoot $rel
            $dstDir = Split-Path -Parent $dst
            if (-not (Test-Path $dstDir)) {
                New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
            }
            Copy-Item -LiteralPath $src -Destination $dst -Force
        }
        # Juntar ao ZIP existente: Expand + Compress e mais simples e fiavel no Windows
        $mergeDir = Join-Path $env:TEMP ("td-git-merge_" + $ts)
        if (Test-Path $mergeDir) { Remove-Item -Recurse -Force $mergeDir }
        Expand-Archive -Path $zipPath -DestinationPath $mergeDir -Force
        Copy-Item -Path (Join-Path $tmpExtra 'TotemDigital-Studio\*') -Destination (Join-Path $mergeDir 'TotemDigital-Studio') -Recurse -Force
        Remove-Item -Force $zipPath
        Compress-Archive -Path (Join-Path $mergeDir 'TotemDigital-Studio') -DestinationPath $zipPath -CompressionLevel Optimal
        Remove-Item -Recurse -Force $tmpExtra, $mergeDir
        Write-Host "   Untracked incluidos: $($others.Count) ficheiro(s)" -ForegroundColor Gray
    } else {
        Write-Host "   Nenhum untracked (respeitando .gitignore)." -ForegroundColor Gray
    }
}

# --- Copia local ---
Write-Host ">> Copia local descompactada..." -ForegroundColor Yellow
if (Test-Path $LocalCopyDir) {
    if (-not $ForceLocalCopy) {
        throw "LocalCopyDir ja existe: $LocalCopyDir`nUse -ForceLocalCopy para substituir."
    }
    Remove-Item -Recurse -Force $LocalCopyDir
}
New-Item -ItemType Directory -Force -Path $LocalCopyDir | Out-Null

$extractTmp = Join-Path $env:TEMP ("td-git-extract_" + $ts)
if (Test-Path $extractTmp) { Remove-Item -Recurse -Force $extractTmp }
Expand-Archive -Path $zipPath -DestinationPath $extractTmp -Force

$inner = Join-Path $extractTmp 'TotemDigital-Studio'
if (Test-Path $inner) {
    # Copiar conteudo para LocalCopyDir (sem pasta intermedia extra)
    Get-ChildItem -Force $inner | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $LocalCopyDir -Recurse -Force
    }
} else {
    Get-ChildItem -Force $extractTmp | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination $LocalCopyDir -Recurse -Force
    }
}
Copy-Item -Force $manifestPath -Destination (Join-Path $LocalCopyDir 'BACKUP-MANIFEST.txt')
Remove-Item -Recurse -Force $extractTmp

$zipSizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
$fileCount = (Get-ChildItem -Path $LocalCopyDir -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count

Write-Host ""
Write-Host "Concluido." -ForegroundColor Green
Write-Host "  ZIP:     $zipPath ($zipSizeMb MB)"
Write-Host "  Copia:   $LocalCopyDir ($fileCount ficheiros)"
Write-Host "  Manifest:$manifestPath"
if ($dirty) {
    Write-Host "  AVISO: working tree dirty - o ZIP reflecte o commit $Ref, nao alteracoes locais nao commitadas." -ForegroundColor DarkYellow
    Write-Host "         Use -IncludeUntracked para untracked, ou faca commit antes do backup." -ForegroundColor DarkYellow
}

if ($OpenExplorer) {
    Start-Process explorer.exe $OutputDir
}

# Devolver objecto util em pipelines
[pscustomobject]@{
    ZipPath      = $zipPath
    LocalCopyDir = $LocalCopyDir
    ManifestPath = $manifestPath
    Branch       = $branch
    Commit       = $commitFull
    ZipSizeMb    = $zipSizeMb
    FileCount    = $fileCount
}
