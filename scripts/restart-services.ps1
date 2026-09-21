<#
.SYNOPSIS
  Restarts both services in the correct order.

.PARAMETER BotOnly
  Restart only the bot and leave Lavalink running (keeps its plugin and connection state warm).
#>
[CmdletBinding()]
param([switch]$BotOnly)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
Assert-Admin 'Restarting Windows services'

if ($BotOnly) {
    Write-Step "Restarting $script:BotServiceName"
    if ((Get-ServiceState $script:BotServiceName) -eq 'NotInstalled') { Write-Bad 'The bot service is not installed.'; exit 1 }
    Restart-Service -Name $script:BotServiceName -Force
    if (-not (Wait-ForServiceState $script:BotServiceName 'Running' 60)) { Write-Bad 'The bot service did not come back.'; exit 1 }
    Write-Ok 'Bot restarted.'
    exit 0
}

& (Join-Path $PSScriptRoot 'stop-services.ps1')
& (Join-Path $PSScriptRoot 'start-services.ps1')
exit $LASTEXITCODE
