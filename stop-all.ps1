# stop-all.ps1
# Stops docker backend and any python main.py window started via start-all.ps1

$root    = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$compose = Join-Path $root "docker-compose.api.yml"

if (Test-Path $compose) {
    docker compose -f $compose down
    Write-Host "Docker analysis API stopped." -ForegroundColor Yellow
}

# Close python main.py windows launched by start-all.ps1
Get-Process powershell -ErrorAction Ignore |
    Where-Object { $_.Path -like "*powershell.exe" -and $_.MainWindowTitle -match "python\\main.py" } |
    Stop-Process -Force

# Optionally kill the venv python if left running
Get-Process python -ErrorAction Ignore |
    Where-Object { $_.Path -like "*python\\*" } |
    Stop-Process -Force

Write-Host "All services stopped." -ForegroundColor Yellow