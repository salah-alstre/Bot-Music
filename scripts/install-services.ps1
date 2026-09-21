<#
.SYNOPSIS
  Installs the MusicBot and MusicBot-Lavalink Windows services (via WinSW) and starts them.

.DESCRIPTION
  Run once from an elevated PowerShell after scripts\setup-windows.ps1 has succeeded.
  Both services start automatically with Windows, restart after crashes and run without any
  logged-in desktop session. Lavalink starts first; the bot depends on it.

.PARAMETER GenerateOnly
  Only download WinSW and generate the service definitions. Does not touch the service manager
  and does not need administrator rights (useful for reviewing what will be installed).

.PARAMETER NoStart
  Install the services but do not start them.

.PARAMETER Force
  Reinstall services that already exist (for example after moving the project folder).
#>
[CmdletBinding()]
param(
    [switch]$GenerateOnly,
    [switch]$NoStart,
    [switch]$Force
)

. (Join-Path $PSScriptRoot 'lib\common.ps1')

if (-not $GenerateOnly) { Assert-Admin 'Installing Windows services' }

Write-Step 'Checking prerequisites'
$node = Find-Node
if (-not $node) { Write-Bad 'Node.js was not found. Run scripts\setup-windows.ps1 first.'; exit 1 }
$nodeVersion = Get-NodeVersion $node
if (-not $nodeVersion -or $nodeVersion -lt $script:MinNodeVersion) { Write-Bad "Node.js $script:MinNodeVersion or newer is required (found $nodeVersion)."; exit 1 }
Write-Ok "Node.js $nodeVersion at $node"

$java = Find-Java
if (-not $java) { Write-Bad "Java $script:MinJavaMajor or newer was not found. Run scripts\setup-windows.ps1 for instructions."; exit 1 }
Write-Ok "Java $($java.Major) at $($java.Path)"

$entry = Join-Path $script:ProjectRoot 'dist\index.js'
if (-not (Test-Path -LiteralPath $entry)) { Write-Bad 'dist\index.js is missing. Run scripts\setup-windows.ps1 (or "npm run build") first.'; exit 1 }
Write-Ok 'Production build found (dist\index.js)'

if (-not (Test-Path -LiteralPath (Join-Path $script:LavalinkDir 'Lavalink.jar'))) { Write-Bad 'lavalink\Lavalink.jar is missing. Run scripts\setup-windows.ps1 first.'; exit 1 }
Write-Ok 'lavalink\Lavalink.jar found'

if (-not (Test-Path -LiteralPath $script:EnvFile)) { Write-Bad '.env is missing. Run scripts\setup-windows.ps1 first, then fill in your Discord token.'; exit 1 }
Push-Location $script:ProjectRoot
try {
    try {
        Invoke-Native 'Environment check' { & $node --disable-warning=ExperimentalWarning (Join-Path $script:ProjectRoot 'dist\scripts\checkEnv.js') }
    } catch {
        Write-Bad '.env has problems (listed above). Fix them and run this script again.'
        exit 1
    }
} finally { Pop-Location }

Write-Step 'Preparing WinSW service wrapper'
New-Item -ItemType Directory -Force -Path $script:ServicesDir, $script:LogsDir | Out-Null
$winsw = Join-Path $script:ServicesDir 'WinSW-x64.exe'
if (-not (Test-FileHash $winsw $script:WinSwSha256)) {
    Save-VerifiedDownload -Url $script:WinSwUrl -Destination $winsw -ExpectedSha256 $script:WinSwSha256 -Label "WinSW $script:WinSwVersion"
}
Write-Ok "WinSW $script:WinSwVersion verified (SHA-256 matches the pinned value)"

$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$tokens = @{ '{{ROOT}}' = $script:ProjectRoot.TrimEnd('\'); '{{NODE}}' = $node; '{{POWERSHELL}}' = $powershell }
foreach ($name in @($script:LavalinkServiceName, $script:BotServiceName)) {
    $template = Get-Content -LiteralPath (Join-Path $PSScriptRoot "services\$name.xml.template") -Raw
    foreach ($token in $tokens.Keys) { $template = $template.Replace($token, [System.Security.SecurityElement]::Escape($tokens[$token])) }
    Set-Content -LiteralPath (Join-Path $script:ServicesDir "$name.xml") -Value $template -Encoding UTF8
    Copy-Item -LiteralPath $winsw -Destination (Join-Path $script:ServicesDir "$name.exe") -Force
    [void][xml](Get-Content -LiteralPath (Join-Path $script:ServicesDir "$name.xml") -Raw)
    Write-Ok "Generated services\$name.xml"
}

if ($GenerateOnly) {
    Write-Host "`nGenerate-only run finished. Nothing was installed." -ForegroundColor Green
    exit 0
}

Write-Step 'Installing services'
foreach ($name in @($script:LavalinkServiceName, $script:BotServiceName)) {
    $exe = Join-Path $script:ServicesDir "$name.exe"
    $state = Get-ServiceState $name
    if ($state -ne 'NotInstalled') {
        if (-not $Force) { Write-Warn "$name is already installed ($state). Use -Force to reinstall it."; continue }
        if ($state -eq 'Running') { Invoke-Native "Stop $name" { & $exe stop | Out-Null }; [void](Wait-ForServiceState $name 'Stopped' 45) }
        Invoke-Native "Uninstall $name" { & $exe uninstall | Out-Null }
        Start-Sleep -Seconds 2
    }
    try { Invoke-Native "Install $name" { & $exe install } } catch { Write-Bad $_.Exception.Message; exit 1 }
    Write-Ok "Installed $name (automatic start, restarts after failure)"
}

if ($NoStart) {
    Write-Host "`nServices installed but not started. Start them with: .\scripts\start-services.ps1" -ForegroundColor Green
    exit 0
}

& (Join-Path $PSScriptRoot 'start-services.ps1')
exit $LASTEXITCODE
