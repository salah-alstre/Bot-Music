<#
.SYNOPSIS
  Shows whether the bot and Lavalink are healthy. Does not need administrator rights.
  Exit code 0 means everything is running, 1 means something needs attention.
#>
[CmdletBinding()]
param([int]$ErrorLines = 5)

. (Join-Path $PSScriptRoot 'lib\common.ps1')
$ErrorActionPreference = 'Continue'
$healthy = $true

function Write-Line([string]$Label, [string]$Value, [string]$Color = 'White') {
    Write-Host ('{0,-24}' -f $Label) -NoNewline
    Write-Host $Value -ForegroundColor $Color
}

function Get-ServiceProcess([string]$Name) {
    $service = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
    if ($service -and $service.ProcessId -gt 0) { return $service.ProcessId }
    return $null
}

function Format-Age([datetime]$Start) {
    $span = (Get-Date) - $Start
    if ($span.TotalDays -ge 1) { return ('{0}d {1}h' -f [int]$span.TotalDays, $span.Hours) }
    if ($span.TotalHours -ge 1) { return ('{0}h {1}m' -f [int]$span.TotalHours, $span.Minutes) }
    return ('{0}m {1}s' -f [int]$span.TotalMinutes, $span.Seconds)
}

Write-Host "`nSonaris status" -ForegroundColor Cyan
Write-Host ('-' * 60) -ForegroundColor DarkGray

foreach ($entry in @(
        @{ Label = 'Discord Bot Service'; Name = $script:BotServiceName },
        @{ Label = 'Lavalink Service'; Name = $script:LavalinkServiceName })) {
    $state = Get-ServiceState $entry.Name
    switch ($state) {
        'Running' { Write-Line "$($entry.Label):" 'Running' 'Green' }
        'NotInstalled' { Write-Line "$($entry.Label):" 'Not installed' 'Yellow'; $healthy = $false }
        default { Write-Line "$($entry.Label):" $state 'Red'; $healthy = $false }
    }
}

# Lavalink connectivity. Any HTTP answer proves it is up; 401 means LAVALINK_PASSWORD in .env is wrong.
$endpoint = Get-LavalinkEndpoint
$answer = Get-LavalinkHttpStatus $endpoint
if (-not $answer) {
    Write-Line 'Lavalink connectivity:' "NOT reachable at $($endpoint.Url)" 'Red'
    $healthy = $false
} elseif ($answer.Status -eq 200) {
    $plugins = ''
    try {
        $info = Invoke-RestMethod -Uri "$($endpoint.Url)/v4/info" -Headers @{ Authorization = $endpoint.Password } -TimeoutSec 5
        $plugins = ($info.plugins | ForEach-Object { "$($_.name)@$($_.version)" }) -join ', '
    } catch { }
    Write-Line 'Lavalink connectivity:' "reachable at $($endpoint.Url), v$($answer.Version), password accepted" 'Green'
    if ($plugins) { Write-Line 'Lavalink plugins:' $plugins }
} elseif ($answer.Status -eq 401) {
    Write-Line 'Lavalink connectivity:' 'reachable, but the PASSWORD IS REJECTED (LAVALINK_PASSWORD in .env differs from the one Lavalink started with; restart both services)' 'Red'
    $healthy = $false
} else {
    Write-Line 'Lavalink connectivity:' "unexpected HTTP status $($answer.Status)" 'Red'
    $healthy = $false
}

# Bot process details
$botPid = Get-ServiceProcess $script:BotServiceName
if ($botPid) {
    $process = Get-Process -Id $botPid -ErrorAction SilentlyContinue
    if ($process) {
        Write-Line 'Bot process:' ("PID {0}, {1} MB, running for {2}" -f $botPid, [int]($process.WorkingSet64 / 1MB), (Format-Age $process.StartTime))
    }
} else {
    Write-Line 'Bot process:' 'not running' 'Yellow'
}

$lavalinkPid = Get-ServiceProcess $script:LavalinkServiceName
if ($lavalinkPid) {
    $java = Get-CimInstance Win32_Process -Filter "ParentProcessId=$lavalinkPid AND Name='java.exe'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($java) {
        $javaProcess = Get-Process -Id $java.ProcessId -ErrorAction SilentlyContinue
        if ($javaProcess) { Write-Line 'Lavalink process:' ("PID {0}, {1} MB, running for {2}" -f $java.ProcessId, [int]($javaProcess.WorkingSet64 / 1MB), (Format-Age $javaProcess.StartTime)) }
    }
}

# Discord connection, taken from the bot's own log.
$botLog = Join-Path $script:LogsDir 'bot.log'
if (Test-Path -LiteralPath $botLog) {
    $lines = @(Get-Content -LiteralPath $botLog -Tail 400 -ErrorAction SilentlyContinue)
    $lastStart = -1
    for ($i = 0; $i -lt $lines.Count; $i++) { if ($lines[$i] -like '*"msg":"Starting Sonaris"*') { $lastStart = $i } }
    $session = if ($lastStart -ge 0) { $lines[$lastStart..($lines.Count - 1)] } else { $lines }
    $connected = $session | Where-Object { $_ -like '*"msg":"Discord connected"*' } | Select-Object -Last 1
    if ($connected) {
        $time = ([regex]::Match($connected, '"time":"([^"]+)"')).Groups[1].Value
        Write-Line 'Discord connection:' "connected (since $time)" 'Green'
    } elseif ((Get-ServiceState $script:BotServiceName) -eq 'Running') {
        Write-Line 'Discord connection:' 'not confirmed in the log yet' 'Yellow'
    }
} else {
    Write-Line 'Discord connection:' 'no bot.log yet' 'DarkGray'
}

# Recent errors
Write-Host ''
$errorLog = Join-Path $script:LogsDir 'error.log'
$recent = @()
if (Test-Path -LiteralPath $errorLog) { $recent = @(Get-Content -LiteralPath $errorLog -Tail $ErrorLines -ErrorAction SilentlyContinue) }
if ($recent.Count -eq 0) {
    Write-Host 'Recent errors: none' -ForegroundColor Green
} else {
    Write-Host "Recent errors (last $($recent.Count) from logs\error.log):" -ForegroundColor Yellow
    foreach ($line in $recent) {
        try {
            $entry = $line | ConvertFrom-Json
            $detail = if ($entry.err -and $entry.err.message) { " - $($entry.err.message)" } else { '' }
            Write-Host "  $($entry.time)  $($entry.msg)$detail" -ForegroundColor DarkYellow
        } catch { Write-Host "  $line" -ForegroundColor DarkYellow }
    }
}

$lavalinkErr = Join-Path $script:LogsDir 'lavalink.err.log'
if ((Test-Path -LiteralPath $lavalinkErr) -and (Get-Item -LiteralPath $lavalinkErr).Length -gt 0) {
    Write-Host "Lavalink service stderr (last 3 lines, logs\lavalink.err.log):" -ForegroundColor Yellow
    Get-Content -LiteralPath $lavalinkErr -Tail 3 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkYellow }
}

Write-Host ''
if ($healthy) { Write-Host 'Everything looks healthy.' -ForegroundColor Green; exit 0 }
Write-Host 'Something needs attention. See docs\WINDOWS-SERVER.md (Troubleshooting).' -ForegroundColor Yellow
exit 1
