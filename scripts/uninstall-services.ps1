<#
.SYNOPSIS
  Stops and removes the MusicBot and MusicBot-Lavalink Windows services.
  Your .env, database (data\) and logs (logs\) are left untouched.

.PARAMETER RemoveTools
  Also delete the services\ folder (WinSW executables and generated definitions).
#>
[CmdletBinding()]
param([switch]$RemoveTools)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
Assert-Admin 'Removing Windows services'

Write-Step 'Removing services'
foreach ($name in @($script:BotServiceName, $script:LavalinkServiceName)) {
    $state = Get-ServiceState $name
    if ($state -eq 'NotInstalled') { Write-Info "$name is not installed."; continue }

    $exe = Join-Path $script:ServicesDir "$name.exe"
    if ($state -ne 'Stopped') {
        Stop-Service -Name $name -Force -ErrorAction SilentlyContinue
        [void](Wait-ForServiceState $name 'Stopped' 45)
    }
    if (Test-Path -LiteralPath $exe) {
        & $exe uninstall | Out-Null
    } else {
        & sc.exe delete $name | Out-Null
    }
    Write-Ok "Removed $name"
}

if ($RemoveTools -and (Test-Path -LiteralPath $script:ServicesDir)) {
    Remove-Item -LiteralPath $script:ServicesDir -Recurse -Force
    Write-Ok 'Deleted services\ folder'
}
Write-Host "`nDone. The bot files, .env, data and logs were not touched." -ForegroundColor Green
