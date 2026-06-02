@echo off
chcp 65001 > nul
title HiNAS BOM Server v6
pushd "%~dp0"

echo.
echo  ========================================
echo   HiNAS Control 2.0 - BOM Server v6
echo  ========================================
echo.

python --version > nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found.
    echo  Install: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo  [OK] Python ready.
echo.

echo  [INFO] Installing libraries...
pip install openpyxl -q
pip install xlrd -q
echo  [OK] Libraries ready.
echo.

echo  [INFO] Excel files in folder:
dir /b *.xlsx *.xls 2>nul
echo.

echo  ========================================
echo   URL: http://localhost:8080
echo   Stop: Ctrl+C
echo  ========================================
echo.

REM ProgramFiles(x86) 괄호 문제 우회: 변수로 먼저 분리
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"
set "LAPPD=%LocalAppData%"

REM Chrome 경로 탐색 (세 위치 순서대로)
set "CHROME="
if exist "%PF%\Google\Chrome\Application\chrome.exe"    set "CHROME=%PF%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%PF86%\Google\Chrome\Application\chrome.exe"  set "CHROME=%PF86%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LAPPD%\Google\Chrome\Application\chrome.exe" set "CHROME=%LAPPD%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
    echo  [OK] Chrome found: %CHROME%
    echo  [INFO] Chrome will open in 2 seconds...
    start /b powershell -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process '%CHROME%' 'http://localhost:8080'"
) else (
    echo  [WARN] Chrome not found. Opening default browser...
    start /b powershell -WindowStyle Hidden -Command "Start-Sleep 2; Start-Process 'http://localhost:8080'"
)

python "%~dp0watch_bom.py"

echo.
echo  Server stopped.
popd
pause
