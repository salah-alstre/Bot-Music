<#
.SYNOPSIS
  Updates the bot safely: stop, (git pull), install dependencies, build, restart, verify.

.DESCRIPTION
  Run from an elevated PowerShell. If the build fails, the previous build is restored and the bot
  is started again, so a broken update never leaves the server offline.

.PARAMETER SkipGit
  Do not run "git pull" even if the folder is a Git checkout (use this after copying new files by hand).

.PARAMETER RestartLavalink
  Also restart Lavalink (needed after changing lavalink\application.yml or plugin versions).
#>
[CmdletBinding()]
param(
    [switch]$SkipGit,
    [switch]$RestartLavalink
)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
Assert-Admin 'Updating the bot'

$node = Find-Node
if (-not $node) { Write-Bad 'Node.js was not found.'; exit 1 }
$npm = Join-Path (Split-Path -Parent $node) 'npm.cmd'
if (-not (Test-Path -LiteralPath $npm)) { $npm = (Get-Command npm.cmd -ErrorAction Stop).Source }

if ((Get-ServiceState $script:BotServiceName) -eq 'NotInstalled') {
    Write-Bad 'The bot service is not installed. Run scripts\install-services.ps1 first.'
    exit 1
}

Push-Location $script:ProjectRoot
$dist = Join-Path $script:ProjectRoot 'dist'
$backup = Join-Path $script:ProjectRoot 'dist.previous'
$startedAt = Get-Date
$backedUp = $false

try {
    if (-not $SkipGit -and (Test-Path -LiteralPath (Join-Path $script:ProjectRoot '.git'))) {
        $git = Get-Command git -ErrorAction SilentlyContinue
        if ($git) {
            Write-Step 'Pulling the latest changes (git)'
            $dirty = & git status --porcelain --untracked-files=no 2>$null
            if ($dirty) { Write-Bad 'There are local changes to tracked files. Commit or stash them first, or rerun with -SkipGit.'; exit 1 }
            Invoke-Native 'git pull' { & git pull --ff-only }
        } else {
            Write-Warn 'This folder is a Git checkout but git is not installed. Skipping "git pull".'
        }
    } else {
        Write-Info 'Not pulling from Git (not a Git checkout, or -SkipGit was used).'
    }

    Write-Step "Stopping $script:BotServiceName"
    if ((Get-ServiceState $script:BotServiceName) -eq 'Running') {
        Stop-Service -Name $script:BotServiceName -Force
        if (-not (Wait-ForServiceState $script:BotServiceName 'Stopped' 45)) { Write-Bad 'The bot did not stop in time.'; exit 1 }
    }
    Write-Ok 'Bot stopped'

    if (Test-Path -LiteralPath $dist) {
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        Move-Item -LiteralPath $dist -Destination $backup
        $backedUp = $true
    }

    Write-Step 'Installing dependencies and building'
    Invoke-Native 'npm ci' { & $npm ci --no-audit --no-fund }
    Invoke-Native 'npm run build' { & $npm run build }
    Invoke-Native 'npm prune' { & $npm prune --omit=dev --no-audit --no-fund }
    if (-not (Test-Path -LiteralPath (Join-Path $dist 'index.js'))) { throw 'The build finished without producing dist\index.js.' }
    Write-Ok 'Build finished (development dependencies removed)'
} catch {
    Write-Bad "Update failed: $($_.Exception.Message)"
    if ($backedUp) {
        Write-Warn 'Restoring the previous build.'
        if (Test-Path -LiteralPath $dist) { Remove-Item -LiteralPath $dist -Recurse -Force }
        Move-Item -LiteralPath $backup -Destination $dist
        try { Invoke-Native 'npm ci' { & $npm ci --omit=dev --no-audit --no-fund | Out-Null } } catch { }
    }
    Start-Service -Name $script:BotServiceName -ErrorAction SilentlyContinue
    Write-Info 'The previous version was started again.'
    Pop-Location
    exit 1
}

if ($RestartLavalink) {
    Write-Step "Restarting $script:LavalinkServiceName"
    Restart-Service -Name $script:LavalinkServiceName -Force
    if (-not (Wait-ForLavalink 150)) { Write-Warn 'Lavalink is slow to respond; the bot will keep retrying.' } else { Write-Ok 'Lavalink is ready.' }
}

Write-Step "Starting $script:BotServiceName"
Start-Service -Name $script:BotServiceName
if (-not (Wait-ForServiceState $script:BotServiceName 'Running' 60)) { Write-Bad 'The bot service did not start.'; Pop-Location; exit 1 }

# Startup is confirmed by the bot's own log rather than by the service state alone.
$botLog = Join-Path $script:LogsDir 'bot.log'
$deadline = (Get-Date).AddSeconds(90)
$confirmed = $false
while ((Get-Date) -lt $deadline) {
    if ((Get-ServiceState $script:BotServiceName) -ne 'Running') { break }
    if (Test-Path -LiteralPath $botLog) {
        $hit = Get-Content -LiteralPath $botLog -Tail 60 -ErrorAction SilentlyContinue | Where-Object {
            $_ -like '*"msg":"Discord connected"*' -and ([datetime]([regex]::Match($_, '"time":"([^"]+)"').Groups[1].Value)).ToUniversalTime() -ge $startedAt.ToUniversalTime()
        }
        if ($hit) { $confirmed = $true; break }
    }
    Start-Sleep -Seconds 2
}
Pop-Location

if ($confirmed) {
    if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue }
    Write-Host "`nUpdate complete: the bot restarted and reconnected to Discord." -ForegroundColor Green
    exit 0
}

Write-Bad 'The bot did not confirm a Discord connection within 90 seconds.'
Write-Info 'Check logs\error.log. The previous build is kept in dist.previous in case you need to roll back.'
& (Join-Path $PSScriptRoot 'status.ps1')
exit 1
