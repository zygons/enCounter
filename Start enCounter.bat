@echo off
REM Copyright (C) 2026 enCounter contributors
REM SPDX-License-Identifier: MIT
REM This file is part of enCounter. See LICENSE for the full license terms.

setlocal EnableDelayedExpansion
cd /d "%~dp0"

title enCounter 0.1.0-alpha.1

REM ============================================================
REM Verify launcher exists
REM ============================================================

if not exist "programs\launcher.py" (
    echo.
    echo ERROR:
    echo programs\launcher.py could not be found.
    echo.
    echo Make sure this BAT file is in the main enCounter folder.
    echo.
    pause
    exit /b 1
)

REM ============================================================
REM Launch enCounter without leaving a command window open.
REM ============================================================

where pyw >nul 2>nul
if not errorlevel 1 (
    start "" pyw "programs\launcher.py"
    exit /b 0
)

where pythonw >nul 2>nul
if not errorlevel 1 (
    start "" pythonw "programs\launcher.py"
    exit /b 0
)

REM Fallback: locate python.exe through the Python launcher and use
REM the matching pythonw.exe if it exists.
where py >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%P in (`py -c "import sys; print(sys.executable)"`) do set "PYEXE=%%P"
    if defined PYEXE (
        for %%I in ("!PYEXE!") do set "PYDIR=%%~dpI"
        if exist "!PYDIR!pythonw.exe" (
            start "" "!PYDIR!pythonw.exe" "programs\launcher.py"
            exit /b 0
        )
    )
)

echo.
echo enCounter could not locate a windowless Python executable.
echo.
echo Python is required for this development build.
echo The packaged enCounter EXE includes the Python runtime automatically.
echo.
pause
exit /b 1
