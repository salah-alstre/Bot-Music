# Shared helpers for the Sonaris Windows scripts. Dot-source this file: . "$PSScriptRoot\lib\common.ps1"
# Compatible with Windows PowerShell 5.1 (the default on Windows Server 2016/2019/2022) and PowerShell 7.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.ServicePointManager]::SecurityProtocol } catch { }

$script:ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$script:BotServiceName = 'MusicBot'
$script:LavalinkServiceName = 'MusicBot-Lavalink'
$script:ServicesDir = Join-Path $script:ProjectRoot 'services'
$script:LogsDir = Join-Path $script:ProjectRoot 'logs'
$script:LavalinkDir = Join-Path $script:ProjectRoot 'lavalink'
$script:EnvFile = Join-Path $script:ProjectRoot '.env'

# Pinned downloads. Hashes are verified before anything is executed.
$script:LavalinkVersion = '4.2.2'
$script:LavalinkUrl = "https://github.com/lavalink-devs/Lavalink/releases/download/$($script:LavalinkVersion)/Lavalink.jar"
$script:LavalinkSha256 = '8CB801E591072C3689FAFD71CCF571A95A4EAD3CC35DFC045E157D763D89119A'
$script:WinSwVersion = '2.12.0'
$script:WinSwUrl = "https://github.com/winsw/winsw/releases/download/v$($script:WinSwVersion)/WinSW-x64.exe"
$script:WinSwSha256 = '05B82D46AD331CC16BDC00DE5C6332C1EF818DF8CEEFCD49C726553209B3A0DA'

$script:MinNodeVersion = [version]'22.13.0'
$script:MinJavaMajor = 17

function Write-Step([string]$Message) { Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "  [ OK ] $Message" -ForegroundColor Green }
function Write-Warn([string]$Message) { Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Bad([string]$Message) { Write-Host "  [FAIL] $Message" -ForegroundColor Red }
function Write-Info([string]$Message) { Write-Host "         $Message" -ForegroundColor Gray }

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    return ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-Admin([string]$Action) {
    if (-not (Test-IsAdmin)) {
        Write-Bad "$Action requires an elevated PowerShell."
        Write-Info 'Right-click PowerShell and choose "Run as administrator", then run the command again.'
        exit 1
    }
}

function Read-DotEnv([string]$Path = $script:EnvFile) {
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
        $index = $trimmed.IndexOf('=')
        if ($index -lt 1) { continue }
        $key = $trimmed.Substring(0, $index).Trim()
        $value = $trimmed.Substring($index + 1).Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$key] = $value
    }
    return $values
}

function Get-EnvValue($Values, [string]$Key, [string]$Default = '') {
    if ($Values.ContainsKey($Key) -and $Values[$Key] -ne '') { return $Values[$Key] }
    return $Default
}

function Find-Node {
    $command = Get-Command node -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    foreach ($candidate in @("$env:ProgramFiles\nodejs\node.exe", "${env:ProgramFiles(x86)}\nodejs\node.exe")) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
    }
    return $null
}

function Get-NodeVersion([string]$NodePath) {
    try { return [version]((& $NodePath --version).TrimStart('v')) } catch { return $null }
}

function Find-Java {
    $candidates = New-Object System.Collections.Generic.List[string]
    if ($env:JAVA_HOME) { $candidates.Add((Join-Path $env:JAVA_HOME 'bin\java.exe')) }
    $command = Get-Command java -ErrorAction SilentlyContinue
    if ($command) { $candidates.Add($command.Source) }
    foreach ($root in @($env:ProgramFiles, ${env:ProgramFiles(x86)})) {
        if (-not $root) { continue }
        foreach ($vendor in @('Eclipse Adoptium', 'Java', 'Microsoft', 'Zulu', 'Amazon Corretto', 'BellSoft', 'Semeru')) {
            $vendorDir = Join-Path $root $vendor
            if (Test-Path -LiteralPath $vendorDir) {
                Get-ChildItem -LiteralPath $vendorDir -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | ForEach-Object {
                    $candidates.Add((Join-Path $_.FullName 'bin\java.exe'))
                }
            }
        }
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            $major = Get-JavaMajor $candidate
            if ($major -ge $script:MinJavaMajor) { return [pscustomobject]@{ Path = $candidate; Major = $major } }
        }
    }
    return $null
}

function Get-JavaMajor([string]$JavaPath) {
    try {
        # java prints its version banner on stderr; ErrorActionPreference must not turn that into an exception.
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $text = (& $JavaPath -version 2>&1 | Out-String)
        $ErrorActionPreference = $previous
        if ($text -match 'version "(\d+)(?:\.(\d+))?') {
            $major = [int]$Matches[1]
            if ($major -eq 1 -and $Matches[2]) { return [int]$Matches[2] }
            return $major
        }
    } catch { }
    return 0
}

function Get-ServiceState([string]$Name) {
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (-not $service) { return 'NotInstalled' }
    return [string]$service.Status
}

function Test-TcpPort([string]$HostName, [int]$Port, [int]$TimeoutMs = 1500) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $task = $client.ConnectAsync($HostName, $Port)
        return ($task.Wait($TimeoutMs) -and $client.Connected)
    } catch { return $false } finally { $client.Dispose() }
}

function Get-LavalinkEndpoint {
    $values = Read-DotEnv
    $hostName = Get-EnvValue $values 'LAVALINK_HOST' '127.0.0.1'
    $port = [int](Get-EnvValue $values 'LAVALINK_PORT' '2333')
    $scheme = if ((Get-EnvValue $values 'LAVALINK_SECURE' 'false') -match '^(true|1|yes)$') { 'https' } else { 'http' }
    return [pscustomobject]@{ Host = $hostName; Port = $port; Scheme = $scheme; Password = (Get-EnvValue $values 'LAVALINK_PASSWORD'); Url = "${scheme}://${hostName}:${port}" }
}

# Lavalink answers every request, even a rejected one, once it is up: 200 = ready, 401 = up but wrong password.
function Get-LavalinkHttpStatus($Endpoint) {
    try {
        $headers = @{}
        if ($Endpoint.Password) { $headers['Authorization'] = $Endpoint.Password }
        $response = Invoke-WebRequest -Uri "$($Endpoint.Url)/version" -Headers $headers -UseBasicParsing -TimeoutSec 4
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Version = $response.Content.Trim() }
    } catch {
        $response = $_.Exception.Response
        if ($response) { return [pscustomobject]@{ Status = [int]$response.StatusCode; Version = $null } }
        return $null
    }
}

function Wait-ForLavalink([int]$TimeoutSeconds = 120) {
    $endpoint = Get-LavalinkEndpoint
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Get-LavalinkHttpStatus $endpoint) { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Wait-ForServiceState([string]$Name, [string]$State, [int]$TimeoutSeconds = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ((Get-ServiceState $Name) -eq $State) { return $true }
        Start-Sleep -Milliseconds 700
    }
    return $false
}

function Save-VerifiedDownload([string]$Url, [string]$Destination, [string]$ExpectedSha256, [string]$Label) {
    $directory = Split-Path -Parent $Destination
    if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory -Force | Out-Null }
    $temporary = "$Destination.download"
    Write-Info "Downloading $Label ..."
    Invoke-WebRequest -Uri $Url -OutFile $temporary -UseBasicParsing
    $actual = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash
    if ($actual -ne $ExpectedSha256) {
        Remove-Item -LiteralPath $temporary -Force
        throw "Checksum mismatch for $Label. Expected $ExpectedSha256 but got $actual. The download was discarded."
    }
    Move-Item -LiteralPath $temporary -Destination $Destination -Force
}

function Test-FileHash([string]$Path, [string]$ExpectedSha256) {
    return (Test-Path -LiteralPath $Path) -and ((Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash -eq $ExpectedSha256)
}

# Native tools (npm, git, WinSW) write warnings to stderr. PowerShell can turn that into a terminating error,
# so only the exit code decides whether a command failed.
function Invoke-Native([string]$Label, [scriptblock]$Command) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { & $Command } finally { $ErrorActionPreference = $previous }
    if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE." }
}

function New-RandomSecret([int]$Length = 32) {
    $alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}

function Set-EnvFileValue([string]$Key, [string]$Value, [string]$Path = $script:EnvFile) {
    $lines = @(Get-Content -LiteralPath $Path)
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "^\s*$([regex]::Escape($Key))\s*=") { $lines[$i] = "$Key=$Value"; $found = $true; break }
    }
    if (-not $found) { $lines += "$Key=$Value" }
    Set-Content -LiteralPath $Path -Value $lines -Encoding UTF8
}
