@echo off
REM Copyright (C) 2026 enCounter contributors
REM SPDX-License-Identifier: MIT
REM See LICENSE for the full license terms.

setlocal EnableExtensions
cd /d "%~dp0"

title enCounter 0.1.0-alpha.1 Windows Build

set "VERSION=0.1.0-alpha.1"
set "RELEASE_ROOT=release"
set "RELEASE_NAME=enCounter-v%VERSION%-Windows-Portable"
set "RELEASE_DIR=%RELEASE_ROOT%\%RELEASE_NAME%"
set "RELEASE_ZIP=%RELEASE_ROOT%\%RELEASE_NAME%.zip"
set "RELEASE_SHA=%RELEASE_ROOT%\%RELEASE_NAME%.sha256.txt"
set "PYTHON_CMD="

echo.
echo ==========================================
echo   enCounter %VERSION% Windows Build
echo ==========================================
echo.

REM Prefer the Python selected by setup-python / PATH, but support py.exe too.
where python >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=python"

if not defined PYTHON_CMD (
    where py >nul 2>nul
    if not errorlevel 1 set "PYTHON_CMD=py"
)

if not defined PYTHON_CMD (
    echo ERROR: Python was not found.
    echo Python and PyInstaller are only required on the build computer.
    echo.
    if not defined CI pause
    exit /b 1
)

%PYTHON_CMD% -m PyInstaller --version >nul 2>nul
if errorlevel 1 (
    echo ERROR: PyInstaller is not installed.
    echo Run: %PYTHON_CMD% -m pip install -r requirements-build.txt
    echo.
    if not defined CI pause
    exit /b 1
)

if not exist "LICENSE" (
    echo ERROR: LICENSE was not found.
    if not defined CI pause
    exit /b 1
)

if not exist "assets\branding\enCounter-icon.ico" (
    echo ERROR: assets\branding\enCounter-icon.ico was not found.
    if not defined CI pause
    exit /b 1
)

echo Removing previous build output...
if exist "build" rmdir /s /q "build"
if exist "dist" rmdir /s /q "dist"
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
if exist "%RELEASE_ZIP%" del /q "%RELEASE_ZIP%"
if exist "%RELEASE_SHA%" del /q "%RELEASE_SHA%"
if not exist "%RELEASE_ROOT%" mkdir "%RELEASE_ROOT%"

echo.
echo Building enCounter.exe...
%PYTHON_CMD% -m PyInstaller --noconfirm --clean "enCounter-Windows.spec"
if errorlevel 1 (
    echo.
    echo BUILD FAILED.
    if not defined CI pause
    exit /b 1
)

if not exist "dist\enCounter\enCounter.exe" (
    echo ERROR: dist\enCounter\enCounter.exe was not created.
    if not defined CI pause
    exit /b 1
)

echo.
echo Creating clean portable release...
mkdir "%RELEASE_DIR%" >nul 2>nul
xcopy "dist\enCounter\*" "%RELEASE_DIR%\" /E /I /Y >nul

mkdir "%RELEASE_DIR%\programs" >nul 2>nul
xcopy "programs\app" "%RELEASE_DIR%\programs\app\" /E /I /Y >nul

mkdir "%RELEASE_DIR%\assets\branding" >nul 2>nul
xcopy "assets\branding" "%RELEASE_DIR%\assets\branding\" /E /I /Y >nul

for %%D in (
    "backgrounds\fantasy"
    "backgrounds\sci-fi"
    "backgrounds\dungeon"
    "backgrounds\wilderness"
    "backgrounds\custom"
    "portraits\players"
    "portraits\npcs"
    "portraits\enemies"
    "portraits\custom"
    "icons\conditions"
    "icons\combat"
    "icons\systems"
    "tokens"
    "sounds"
) do mkdir "%RELEASE_DIR%\assets\%%~D" >nul 2>nul

mkdir "%RELEASE_DIR%\data\backups" >nul 2>nul
mkdir "%RELEASE_DIR%\data\exports" >nul 2>nul
mkdir "%RELEASE_DIR%\data\imports" >nul 2>nul

if exist "docs" xcopy "docs" "%RELEASE_DIR%\docs\" /E /I /Y >nul
copy /Y "LICENSE" "%RELEASE_DIR%\LICENSE" >nul
copy /Y "README.md" "%RELEASE_DIR%\README.md" >nul
copy /Y "AI_ASSISTANCE.md" "%RELEASE_DIR%\AI_ASSISTANCE.md" >nul
copy /Y "PRIVACY.md" "%RELEASE_DIR%\PRIVACY.md" >nul
copy /Y "THIRD_PARTY_NOTICES.md" "%RELEASE_DIR%\THIRD_PARTY_NOTICES.md" >nul

REM Defensive cleanup: no prior user data may ship.
del /q "%RELEASE_DIR%\data\backups\*" >nul 2>nul
del /q "%RELEASE_DIR%\data\exports\*" >nul 2>nul
del /q "%RELEASE_DIR%\data\imports\*" >nul 2>nul
del /q "%RELEASE_DIR%\data\enCounter-startup-error.log" >nul 2>nul

echo.
echo Creating ZIP package...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Compress-Archive -Path '%RELEASE_DIR%' -DestinationPath '%RELEASE_ZIP%' -Force"

if errorlevel 1 (
    echo WARNING: Portable folder was created, but ZIP creation failed.
    echo Folder: %RELEASE_DIR%
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$h=(Get-FileHash -Algorithm SHA256 '%RELEASE_ZIP%').Hash.ToLower(); Set-Content -Encoding ASCII '%RELEASE_SHA%' ($h + '  %RELEASE_NAME%.zip')"
    echo ZIP: %RELEASE_ZIP%
    echo SHA-256: %RELEASE_SHA%
)

echo.
echo ==========================================
echo          WINDOWS BUILD COMPLETE
echo ==========================================
echo.
echo Portable folder:
echo %RELEASE_DIR%
echo.
echo License: MIT
echo.
echo This build contains NO previous backups, exports, imports,
echo saved Library data, or personal campaign assets.
echo.
echo NOTE: Browser IndexedDB lives outside the folder.
echo This Alpha uses enCounterAlphaDB.
echo.
if not defined CI pause
