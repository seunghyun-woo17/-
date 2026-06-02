@echo off
cd /d "%~dp0"

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found.
    pause
    exit /b 1
)

python -c "import openpyxl" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing openpyxl...
    pip install openpyxl
    if %errorlevel% neq 0 (
        echo [ERROR] pip install openpyxl failed.
        pause
        exit /b 1
    )
)

python 검사성적서_자동화.py
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Exit code: %errorlevel%
    if exist error_log.txt type error_log.txt
    pause
)
