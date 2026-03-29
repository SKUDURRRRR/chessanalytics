@echo off
echo Starting Chess Analytics Backend...
echo.

REM Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: PowerShell is not available
    pause
    exit /b 1
)

REM Change to python directory and run the PowerShell script
cd python
powershell -ExecutionPolicy Bypass -File "..\scripts\start-backend.ps1" -Port 8002 -ServerType main

echo.
echo Press any key to exit...
pause >nul
