<#
.SYNOPSIS
  Stops the bot first, then Lavalink.
#>
[CmdletBinding()]
param()

. (Join-Path $PSScriptRoot 'lib\common.ps1')
Assert-Admin 'Stopping Windows services'

Write-Step 'Stopping services'
foreach ($name in @($script:BotServiceName, $script:LavalinkServiceName)) {
    $state = Get-ServiceState $name
    if ($state -eq 'NotInstalled') { Write-Info "$name is not installed."; continue }
    if ($state -eq 'Stopped') { Write-Info "$name is already stopped."; continue }
    Stop-Service -Name $name -Force
    if (Wait-ForServiceState $name 'Stopped' 45) { Write-Ok "Stopped $name" } else { Write-Warn "$name did not stop within 45 seconds." }
}
