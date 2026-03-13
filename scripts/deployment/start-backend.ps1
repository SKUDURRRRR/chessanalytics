Write-Host "Starting Chess Analysis Backend Server..." -ForegroundColor Green
Write-Host ""

# Change to the python directory where the core module is located
Set-Location "python"

Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
try {
    python -c "import fastapi, uvicorn, supabase" 2>$null
    Write-Host "Dependencies OK" -ForegroundColor Green
} catch {
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r ..\requirements.txt
}

Write-Host ""
Write-Host "Starting server on http://localhost:8002" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Run the core API server from the python directory
python -m core.unified_api_server
