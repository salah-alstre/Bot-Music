<#
.SYNOPSIS
  Starts Lavalink first, waits until it answers, then starts the bot.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'lib\common.ps1')
Assert-Admin 'Starting Windows services'

foreach ($name in @($script:LavalinkServiceName, $script:BotServiceName)) {
    if ((Get-ServiceState $name) -eq 'NotInstalled') {
        Write-Bad "$name is not installed. Run .\scripts\install-services.ps1 first."
        exit 1
    }
}

Write-Step "Starting $script:LavalinkServiceName"
if ((Get-ServiceState $script:LavalinkServiceName) -ne 'Running') { Start-Service -Name $script:LavalinkServiceName }
if (-not (Wait-ForServiceState $script:LavalinkServiceName 'Running' 60)) { Write-Bad 'The Lavalink service did not reach the Running state.'; exit 1 }
Write-Ok 'Service is running. Waiting for Lavalink to accept connections (first start downloads plugins and can take a minute) ...'

if (Wait-ForLavalink 150) {
    Write-Ok 'Lavalink is ready.'
} else {
    Write-Warn 'Lavalink is not answering yet. Starting the bot anyway; it keeps retrying until Lavalink is ready.'
    Write-Info "Check logs\lavalink.err.log and lavalink\logs for details."
}

Write-Step "Starting $script:BotServiceName"
if ((Get-ServiceState $script:BotServiceName) -ne 'Running') { Start-Service -Name $script:BotServiceName }
if (-not (Wait-ForServiceState $script:BotServiceName 'Running' 60)) { Write-Bad 'The bot service did not reach the Running state.'; exit 1 }

# A service that crashes on startup (bad token, for example) flaps; confirm it is still alive a few seconds later.
Start-Sleep -Seconds 8
if ((Get-ServiceState $script:BotServiceName) -ne 'Running') {
    Write-Bad 'The bot stopped right after starting. Look at logs\error.log for the reason (a wrong DISCORD_TOKEN is the most common cause).'
    exit 1
}
Write-Ok 'Bot service is running.'

Write-Host ''
& (Join-Path $PSScriptRoot 'status.ps1')
exit $LASTEXITCODE
