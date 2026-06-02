@echo off
title FAT Document Generator

python --version >nul 2>&1
if not errorlevel 1 (
    python -c "import openpyxl" >nul 2>&1
    if errorlevel 1 python -m pip install openpyxl
    python "%~dp0FAT_Generator.py"
    if errorlevel 1 pause
    exit /b
)

py --version >nul 2>&1
if not errorlevel 1 (
    py -c "import openpyxl" >nul 2>&1
    if errorlevel 1 py -m pip install openpyxl
    py "%~dp0FAT_Generator.py"
    if errorlevel 1 pause
    exit /b
)

echo.
echo [오류] Python이 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
echo.
echo  해결 방법:
echo  1) https://www.python.org/downloads 에서 Python 설치
echo  2) 설치 시 Add Python to PATH 반드시 체크
echo  3) 설치 완료 후 이 파일 다시 실행
echo.
pause
