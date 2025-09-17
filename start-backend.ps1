Write-Host "Starting Chess Analysis Backend Server..." -ForegroundColor Green
Write-Host ""

Set-Location python

Write-Host "Checking Python dependencies..." -ForegroundColor Yellow
try {
    python -c "import fastapi, uvicorn, supabase, chess_analyzer" 2>$null
    Write-Host "Dependencies OK" -ForegroundColor Green
} catch {
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r ..\requirements.txt
}

Write-Host ""
Write-Host "Starting server on http://localhost:8002" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -c "import sys; sys.path.append('python'); import uvicorn; uvicorn.run('main:app', host='127.0.0.1', port=8002, log_level='info')"
