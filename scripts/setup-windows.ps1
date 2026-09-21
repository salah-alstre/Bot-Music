<#
.SYNOPSIS
  Prepares this folder to run Sonaris on Windows (Server or desktop): checks prerequisites,
  creates .env, installs dependencies, builds the bot and downloads Lavalink.

.DESCRIPTION
  Safe to run repeatedly. It never installs software silently: missing requirements are reported
  with exact instructions. Add -InstallPrerequisites to let it install Node.js LTS and Java
  through winget (opt-in, requires winget and an elevated PowerShell).

.PARAMETER InstallPrerequisites
  Install missing Node.js / Java using winget after you confirm the prompt.

.PARAMETER InstallServices
  After a successful setup, install and start the Windows services (needs an elevated PowerShell
  and a completed .env).

.PARAMETER SkipLavalinkDownload
  Do not download Lavalink.jar (use this if you placed it manually).
#>
[CmdletBinding()]
param(
    [switch]$InstallPrerequisites,
    [switch]$InstallServices,
    [switch]$SkipLavalinkDownload
)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
$problems = New-Object System.Collections.Generic.List[string]

Write-Host "`nSonaris - Windows setup" -ForegroundColor Cyan
Write-Host "Project folder: $script:ProjectRoot" -ForegroundColor Gray

# ---- 1. Prerequisites ---------------------------------------------------------------------------
Write-Step 'Checking prerequisites'

$node = Find-Node
$nodeVersion = if ($node) { Get-NodeVersion $node } else { $null }
if ($InstallPrerequisites -and (-not $nodeVersion -or $nodeVersion -lt $script:MinNodeVersion)) {
    Assert-Admin 'Installing Node.js'
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Warn 'winget is not available on this Windows version. Install Node.js manually (see below).'
    } elseif ((Read-Host 'Install Node.js LTS with winget now? (y/N)') -match '^(y|yes)$') {
        winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        $node = Find-Node
        $nodeVersion = if ($node) { Get-NodeVersion $node } else { $null }
    }
}
if ($nodeVersion -and $nodeVersion -ge $script:MinNodeVersion) {
    Write-Ok "Node.js $nodeVersion ($node)"
} elseif ($nodeVersion) {
    Write-Bad "Node.js $nodeVersion is too old. Version $script:MinNodeVersion or newer is required (Node 22 LTS or 24 LTS)."
    $problems.Add('Upgrade Node.js to the current LTS: https://nodejs.org/en/download')
} else {
    Write-Bad 'Node.js was not found.'
    $problems.Add('Install Node.js LTS from https://nodejs.org/en/download (choose the Windows Installer .msi), then open a new PowerShell window.')
}

$java = Find-Java
if ($InstallPrerequisites -and -not $java) {
    Assert-Admin 'Installing Java'
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Warn 'winget is not available on this Windows version. Install Java manually (see below).'
    } elseif ((Read-Host 'Install Eclipse Temurin JRE 21 with winget now? (y/N)') -match '^(y|yes)$') {
        winget install --id EclipseAdoptium.Temurin.21.JRE -e --accept-package-agreements --accept-source-agreements
        $java = Find-Java
    }
}
if ($java) {
    Write-Ok "Java $($java.Major) ($($java.Path))"
} else {
    Write-Bad "Java $script:MinJavaMajor or newer was not found (Lavalink needs it)."
    $problems.Add('Install a Java runtime, for example Eclipse Temurin JRE 21 (.msi) from https://adoptium.net/temurin/releases/?os=windows&package=jre and enable "Set JAVA_HOME" in the installer.')
}

$npm = $null
if ($node) {
    $npm = Join-Path (Split-Path -Parent $node) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npm)) { $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source }
}
if ($npm) { Write-Ok "npm found ($npm)" } elseif ($node) { Write-Bad 'npm was not found next to node.exe.'; $problems.Add('Reinstall Node.js with the official installer (it includes npm).') }

if ($problems.Count -gt 0) {
    Write-Host "`nCannot continue yet. Please fix the following, then run this script again:" -ForegroundColor Red
    $index = 1
    foreach ($problem in $problems) { Write-Host "  $index. $problem" -ForegroundColor Yellow; $index++ }
    exit 1
}

# ---- 2. Folders ---------------------------------------------------------------------------------
Write-Step 'Creating folders'
foreach ($folder in @('data', 'logs', 'lavalink\plugins', 'lavalink\logs')) {
    New-Item -ItemType Directory -Force -Path (Join-Path $script:ProjectRoot $folder) | Out-Null
    Write-Ok $folder
}

# ---- 3. Environment file ------------------------------------------------------------------------
Write-Step 'Configuration (.env)'
$example = Join-Path $script:ProjectRoot '.env.example'
$newEnv = $false
if (-not (Test-Path -LiteralPath $script:EnvFile)) {
    Copy-Item -LiteralPath $example -Destination $script:EnvFile
    $newEnv = $true
    Write-Ok 'Created .env from .env.example'
} else {
    Write-Ok '.env already exists (left unchanged)'
}
$values = Read-DotEnv
$password = Get-EnvValue $values 'LAVALINK_PASSWORD'
if ($password.Length -lt 12 -or $password -match '^(changeme|your|youshallnotpass)') {
    Set-EnvFileValue 'LAVALINK_PASSWORD' (New-RandomSecret 32)
    Write-Ok 'Generated a random LAVALINK_PASSWORD (used by both the bot and Lavalink)'
}

# ---- 4. Dependencies and build ------------------------------------------------------------------
Write-Step 'Installing dependencies and building'
Push-Location $script:ProjectRoot
try {
    Invoke-Native 'npm ci' { & $npm ci --no-audit --no-fund }
    Invoke-Native 'npm run build' { & $npm run build }
    Invoke-Native 'npm prune' { & $npm prune --omit=dev --no-audit --no-fund }
    Write-Ok 'Production build created in dist\ and development dependencies were removed'
} finally { Pop-Location }

# ---- 5. Lavalink --------------------------------------------------------------------------------
Write-Step 'Lavalink'
$jar = Join-Path $script:LavalinkDir 'Lavalink.jar'
if (Test-FileHash $jar $script:LavalinkSha256) {
    Write-Ok "Lavalink $script:LavalinkVersion is present and verified"
} elseif ($SkipLavalinkDownload -and (Test-Path -LiteralPath $jar)) {
    Write-Warn 'Using the Lavalink.jar you placed manually (checksum not verified).'
} else {
    Save-VerifiedDownload -Url $script:LavalinkUrl -Destination $jar -ExpectedSha256 $script:LavalinkSha256 -Label "Lavalink $script:LavalinkVersion"
    Write-Ok "Downloaded Lavalink $script:LavalinkVersion (checksum verified)"
}
Write-Info 'Plugins (YouTube, LavaSrc) are downloaded by Lavalink itself on its first start.'

# ---- 6. Validate configuration ------------------------------------------------------------------
Write-Step 'Validating .env'
Push-Location $script:ProjectRoot
$envOk = $true
try {
    Invoke-Native 'Environment check' { & $node --disable-warning=ExperimentalWarning (Join-Path $script:ProjectRoot 'dist\scripts\checkEnv.js') }
} catch {
    $envOk = $false
} finally { Pop-Location }

Write-Host ''
if (-not $envOk) {
    Write-Host 'Setup finished, but .env still needs your values.' -ForegroundColor Yellow
    Write-Host '  1. Open .env in Notepad:   notepad .env' -ForegroundColor Yellow
    Write-Host '  2. Fill in DISCORD_TOKEN and DISCORD_CLIENT_ID (see docs\WINDOWS-SERVER.md, section 5).' -ForegroundColor Yellow
    Write-Host '  3. Run this script again, or continue with:  .\scripts\install-services.ps1  (as administrator)' -ForegroundColor Yellow
    if ($InstallServices) { Write-Warn 'Skipping service installation until .env is valid.' }
    exit 0
}

Write-Host 'Setup complete. Configuration is valid.' -ForegroundColor Green
if ($InstallServices) {
    & (Join-Path $PSScriptRoot 'install-services.ps1')
    exit $LASTEXITCODE
}
Write-Host 'Next step (as administrator):  .\scripts\install-services.ps1' -ForegroundColor Green
