# Starts Lavalink with the settings from the project's .env file.
# This is what the MusicBot-Lavalink Windows service runs, but it also works by hand:
#   powershell -ExecutionPolicy Bypass -File .\lavalink\start-lavalink.ps1
#
# Secrets stay in .env. They are handed to Lavalink as environment variables and are never
# written to application.yml or to a command line.

$ErrorActionPreference = 'Stop'
$lavalinkDir = $PSScriptRoot
$projectRoot = Split-Path -Parent $lavalinkDir
. (Join-Path $projectRoot 'scripts\lib\common.ps1')

$jar = Join-Path $lavalinkDir 'Lavalink.jar'
if (-not (Test-Path -LiteralPath $jar)) {
    Write-Host "Lavalink.jar not found in $lavalinkDir. Run scripts\setup-windows.ps1 to download it." -ForegroundColor Red
    exit 2
}

$java = Find-Java
if (-not $java) {
    Write-Host "Java $script:MinJavaMajor or newer was not found. Install a JRE (for example Eclipse Temurin 21) and set JAVA_HOME." -ForegroundColor Red
    exit 3
}

$values = Read-DotEnv (Join-Path $projectRoot '.env')
if (-not $values.ContainsKey('LAVALINK_PASSWORD') -or $values['LAVALINK_PASSWORD'].Length -lt 12) {
    Write-Host 'LAVALINK_PASSWORD is missing or too short in .env (minimum 12 characters).' -ForegroundColor Red
    exit 4
}

# Only forward what Lavalink's application.yml reads.
$forward = @('LAVALINK_PASSWORD', 'LAVALINK_PORT', 'LAVALINK_BIND_ADDRESS', 'SPOTIFY_ENABLED', 'SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'SPOTIFY_COUNTRY_CODE', 'YOUTUBE_OAUTH_ENABLED', 'YOUTUBE_OAUTH_REFRESH_TOKEN')
foreach ($key in $forward) {
    if ($values.ContainsKey($key) -and $values[$key] -ne '') { [Environment]::SetEnvironmentVariable($key, $values[$key], 'Process') }
}

$memory = Get-EnvValue $values 'LAVALINK_MEMORY' '1G'
if ($memory -notmatch '^\d+[mMgG]$') { $memory = '1G' }

Set-Location -LiteralPath $lavalinkDir
New-Item -ItemType Directory -Force -Path (Join-Path $lavalinkDir 'logs'), (Join-Path $lavalinkDir 'plugins') | Out-Null

# If a previous Lavalink of this project survived a forced stop, it still owns the port and the new
# instance would crash-loop. Only processes started from this exact jar are ever touched.
try {
    $port = [int](Get-EnvValue $values 'LAVALINK_PORT' '2333')
    $owners = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($ownerId in $owners) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId" -ErrorAction SilentlyContinue
        if ($owner -and $owner.Name -eq 'java.exe' -and $owner.CommandLine -and $owner.CommandLine.Contains($jar)) {
            Write-Host "Stopping a leftover Lavalink process (PID $ownerId) that still holds port $port."
            Stop-Process -Id $ownerId -Force
            Start-Sleep -Seconds 2
        } elseif ($owner) {
            Write-Host "Port $port is already used by $($owner.Name) (PID $ownerId). Change LAVALINK_PORT in .env." -ForegroundColor Red
            exit 5
        }
    }
} catch {
    Write-Host "Port check skipped: $($_.Exception.Message)"
}

Write-Host "Starting Lavalink with Java $($java.Major) ($($java.Path)), heap $memory"
& $java.Path "-Xmx$memory" '-Dfile.encoding=UTF-8' -jar $jar
exit $LASTEXITCODE
