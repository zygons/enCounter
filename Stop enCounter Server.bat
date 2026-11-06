@echo off
REM Copyright (C) 2026 Zygons
REM SPDX-License-Identifier: MIT
REM This file is part of enCounter. See LICENSE for the full license terms.

setlocal
cd /d "%~dp0"

echo Checking for enCounter server processes on port 5500...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$pids=@(); foreach($l in (netstat -ano -p tcp 2^>^$null)){ if($l -match '^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0):5500\s+\S+\s+LISTENING\s+(\d+)\s*$'){ $pids += [int]$Matches[1] } }; $pids=$pids|Sort-Object -Unique; if(-not $pids){ Write-Host 'No server is listening on port 5500.' -ForegroundColor Green; exit 0 }; $safe=@(); $unsafe=@(); foreach($id in $pids){ $p=Get-CimInstance Win32_Process -Filter \"ProcessId=$id\"; if($p -and ((($p.Name -match '^(?i)python(?:w)?\.exe$') -and ($p.CommandLine -match '(?i)(?:^|[\\/\s\"])(?:programs[\\/])launcher\.py(?:[\"\s]|$)')) -or ($p.Name -match '^(?i)enCounter\.exe$'))){ $safe += $id } else { $unsafe += $id; if($p){ Write-Host (\"Unknown owner PID {0}: {1} {2}\" -f $id,$p.Name,$p.CommandLine) -ForegroundColor Red } } }; if($unsafe.Count -gt 0){ Write-Host 'No processes were stopped because at least one owner is not verified as enCounter.' -ForegroundColor Red; exit 1 }; foreach($id in $safe){ Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Host (\"Stopped enCounter PID {0}\" -f $id) -ForegroundColor Green }"

echo.
pause
