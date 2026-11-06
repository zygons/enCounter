@echo off
REM Copyright (C) 2026 Zygons
REM SPDX-License-Identifier: MIT
REM This file is part of enCounter. See LICENSE for the full license terms.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "ENCOUNTER_PORT=5500"
set "EXPECTED_PROXY=3.1.12.4"
set "APP_URL=http://127.0.0.1:5500/programs/app/index.html"
set "STATUS_URL=http://127.0.0.1:5500/api/compendium/dnd5e/status"
set "SHUTDOWN_URL=http://127.0.0.1:5500/api/shutdown"

set "VERSION=Development"
for /f "tokens=2" %%V in ('findstr /B /C:"Version:" "docs\VERSION.txt" 2^>nul') do set "VERSION=%%V"
title enCounter !VERSION!

if not exist "programs\launcher.py" (
    echo.
    echo ERROR: programs\launcher.py could not be found.
    echo Make sure this BAT file is in the main enCounter folder.
    echo.
    pause
    exit /b 1
)

if not exist "programs\startup_guard.ps1" (
    echo.
    echo ERROR: programs\startup_guard.ps1 could not be found.
    echo Copy all Phase 3.1.12.4 files into the enCounter folder.
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM Phase 3.1.12.4 Windows startup ownership guard.
REM - Reuses the correct current server.
REM - Gracefully shuts down an older enCounter server.
REM - Shows PID/process/command line if another app owns port 5500.
REM ============================================================

powershell -NoProfile -ExecutionPolicy Bypass -File "programs\startup_guard.ps1" ^
    -Port 5500 ^
    -ExpectedProxy "%EXPECTED_PROXY%" ^
    -StatusUrl "%STATUS_URL%" ^
    -AppUrl "%APP_URL%" ^
    -ShutdownUrl "%SHUTDOWN_URL%"
set "PREFLIGHT=!ERRORLEVEL!"

if "!PREFLIGHT!"=="10" (
    start "" "%APP_URL%"
    exit /b 0
)

if not "!PREFLIGHT!"=="0" if not "!PREFLIGHT!"=="20" (
    echo.
    echo ============================================================
    echo enCounter could not claim port 5500.
    echo ============================================================
    echo.
    echo The process information above identifies the current owner.
    echo Do not force-close an unknown process unless you know it is safe.
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM Launch the current source launcher.
REM ============================================================

set "LAUNCHED=0"

where pyw >nul 2>nul
if not errorlevel 1 (
    start "" pyw "programs\launcher.py"
    set "LAUNCHED=1"
    goto :verify
)

where pythonw >nul 2>nul
if not errorlevel 1 (
    start "" pythonw "programs\launcher.py"
    set "LAUNCHED=1"
    goto :verify
)

where py >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%P in (`py -c "import sys; print(sys.executable)"`) do set "PYEXE=%%P"
    if defined PYEXE (
        for %%I in ("!PYEXE!") do set "PYDIR=%%~dpI"
        if exist "!PYDIR!pythonw.exe" (
            start "" "!PYDIR!pythonw.exe" "programs\launcher.py"
            set "LAUNCHED=1"
            goto :verify
        )
    )
)

echo.
echo enCounter could not locate a windowless Python executable.
echo Python is required for this development build.
echo The packaged enCounter EXE includes the Python runtime automatically.
echo.
pause
exit /b 1

:verify
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 1400"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "try { $r=Invoke-RestMethod -Uri '%STATUS_URL%' -TimeoutSec 3; if ($r.proxyVersion -eq '%EXPECTED_PROXY%') { exit 0 } else { exit 2 } } catch { exit 1 }"
set "VERIFY=!ERRORLEVEL!"

if "!VERIFY!"=="0" exit /b 0

echo.
echo ============================================================
echo enCounter started, but the expected Compendium proxy was not found.
echo ============================================================
echo.
echo Expected proxy version: %EXPECTED_PROXY%
echo Status URL: %STATUS_URL%
echo.
echo Check data\enCounter-startup-error.log if it was created.
echo.
pause
exit /b 1
