param(
    [int]$Port = 5500,
    [string]$ExpectedProxy = "3.1.12.4",
    [string]$StatusUrl = "http://127.0.0.1:5500/api/compendium/dnd5e/status",
    [string]$AppUrl = "http://127.0.0.1:5500/programs/app/index.html",
    [string]$ShutdownUrl = "http://127.0.0.1:5500/api/shutdown"
)

$ErrorActionPreference = "SilentlyContinue"

function Get-ListeningPids {
    $pids = @()
    foreach ($line in (& netstat -ano -p tcp 2>$null)) {
        if ($line -match '^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0):' + $Port + '\s+\S+\s+LISTENING\s+(\d+)\s*$') {
            $candidatePid = [int]$Matches[1]
            # Windows can briefly emit a LISTENING row owned by PID 0 while a
            # loopback socket is being torn down. PID 0 is not an actionable
            # user process and must not block enCounter startup.
            if ($candidatePid -gt 0) {
                $pids += $candidatePid
            }
        }
    }
    return @($pids | Sort-Object -Unique)
}

function Get-StableListeningPids {
    # A clean enCounter shutdown can leave the Windows TCP table in transition
    # for a fraction of a second. Require a real PID-backed listener to persist
    # across several checks before treating the port as occupied.
    for ($attempt = 0; $attempt -lt 6; $attempt++) {
        $pids = @(Get-ListeningPids)
        $livePids = @()
        foreach ($procId in $pids) {
            if ($null -ne (Get-ProcessInfo $procId)) {
                $livePids += $procId
            }
        }
        $livePids = @($livePids | Sort-Object -Unique)
        if ($livePids.Count -gt 0) {
            return $livePids
        }
        if ($attempt -lt 5) {
            Start-Sleep -Milliseconds 250
        }
    }
    return @()
}

function Get-ProcessInfo([int]$ProcId) {
    return Get-CimInstance Win32_Process -Filter "ProcessId=$ProcId"
}

function Show-Owners([int[]]$Pids) {
    Write-Host ""
    Write-Host "Port $Port is owned by:" -ForegroundColor Yellow
    foreach ($procId in $Pids) {
        $proc = Get-ProcessInfo $procId
        if ($null -ne $proc) {
            Write-Host "  PID: $procId"
            Write-Host "  Process: $($proc.Name)"
            if ($proc.CommandLine) {
                Write-Host "  Command: $($proc.CommandLine)"
            }
            Write-Host ""
        } else {
            Write-Host "  PID: $procId (process details unavailable)"
        }
    }
}

function Test-IsEnCounterLauncher([int]$ProcId) {
    $proc = Get-ProcessInfo $ProcId
    if ($null -eq $proc) { return $false }

    $name = [string]$proc.Name
    $cmd = [string]$proc.CommandLine

    # Development/source launcher: python/pythonw running programs\launcher.py.
    if ($name -match '^(?i)python(?:w)?\.exe$' -and
        $cmd -match '(?i)(?:^|[\\/\s\"])(?:programs[\\/])launcher\.py(?:[\"\s]|$)') {
        return $true
    }

    # Packaged portable launcher. Only recognize the explicit enCounter executable name.
    if ($name -match '^(?i)enCounter\.exe$') {
        return $true
    }

    return $false
}

function Stop-VerifiedEnCounterListeners([int[]]$Pids) {
    if ($Pids.Count -eq 0) { return $true }

    foreach ($procId in $Pids) {
        if (-not (Test-IsEnCounterLauncher $procId)) {
            return $false
        }
    }

    Write-Host ""
    Write-Host "All remaining listeners are verified stale enCounter launcher processes." -ForegroundColor Yellow
    Write-Host "Stopping the stale enCounter processes..."

    foreach ($procId in $Pids) {
        try {
            Stop-Process -Id $procId -Force -ErrorAction Stop
            Write-Host "  Stopped enCounter PID $procId" -ForegroundColor Green
        } catch {
            Write-Host "  Could not stop PID ${procId}: $($_.Exception.Message)" -ForegroundColor Red
        }
    }

    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 200
        if (@(Get-ListeningPids).Count -eq 0) {
            return $true
        }
    }

    return $false
}

# Reuse an already-running current server.
try {
    $status = Invoke-RestMethod -Uri $StatusUrl -TimeoutSec 1
    if ($status.proxyVersion -eq $ExpectedProxy) {
        exit 10
    }
} catch {}

$pids = @(Get-StableListeningPids)
if ($pids.Count -eq 0) {
    exit 0
}

# Determine whether the listener is an older enCounter server before touching it.
$isEnCounter = $false
try {
    $app = Invoke-WebRequest -Uri $AppUrl -UseBasicParsing -TimeoutSec 2
    if ($app.StatusCode -eq 200 -and $app.Content -match '(?i)enCounter') {
        $isEnCounter = $true
    }
} catch {}

if ($isEnCounter) {
    Write-Host ""
    Write-Host "An older enCounter server is already using port $Port." -ForegroundColor Yellow
    Write-Host "Attempting a graceful enCounter shutdown..."
    try {
        Invoke-RestMethod -Uri $ShutdownUrl -Method Post -TimeoutSec 2 | Out-Null
    } catch {
        # Some older builds close a socket before PowerShell receives a reply.
    }

    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Milliseconds 250
        if (@(Get-ListeningPids).Count -eq 0) {
            Write-Host "The stale enCounter server was stopped successfully." -ForegroundColor Green
            exit 20
        }
    }

    $remaining = @(Get-StableListeningPids)
    Write-Host "The old enCounter server did not shut down cleanly." -ForegroundColor Yellow
    Show-Owners $remaining

    # Multiple older source launchers could share port 5500 because previous
    # builds allowed socket reuse. Only force-stop processes that are positively
    # identified as enCounter launchers; never terminate an unknown owner.
    if (Stop-VerifiedEnCounterListeners $remaining) {
        Write-Host "Stale enCounter server cleanup completed." -ForegroundColor Green
        exit 20
    }

    Write-Host "One or more port owners could not be verified as enCounter." -ForegroundColor Red
    Write-Host "No unknown process was terminated." -ForegroundColor Red
    Show-Owners @(Get-StableListeningPids)
    exit 11
}

# If the HTTP probe failed but every listener is nevertheless a verified
# enCounter launcher, clean them up. This covers severely stale/partially
# responsive source servers while still protecting unrelated applications.
$allVerified = $true
foreach ($procId in $pids) {
    if (-not (Test-IsEnCounterLauncher $procId)) {
        $allVerified = $false
        break
    }
}

if ($allVerified -and $pids.Count -gt 0) {
    Write-Host ""
    Write-Host "Port $Port is held only by verified enCounter launcher processes." -ForegroundColor Yellow
    Show-Owners $pids
    if (Stop-VerifiedEnCounterListeners $pids) {
        Write-Host "Stale enCounter server cleanup completed." -ForegroundColor Green
        exit 20
    }
}

Write-Host ""
Write-Host "Port $Port is in use by another application." -ForegroundColor Red
Show-Owners @(Get-StableListeningPids)
Write-Host "No unknown process was terminated." -ForegroundColor Red
exit 11
