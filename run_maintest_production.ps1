# PowerShell script to run MAINTEST against production environment
# Sets environment variables for Railway backend and Vercel frontend

Write-Host "Setting up production environment for MAINTEST..." -ForegroundColor Cyan

# Production URLs
$env:VITE_ANALYSIS_API_URL = "https://chessanalytics-production.up.railway.app"
$env:FRONTEND_URL = "https://chess-analytics-martynas2000.vercel.app"

# Stockfish
$env:STOCKFISH_PATH = "./stockfish/stockfish-windows-x86-64-avx2.exe"

# Python encoding for Unicode support
$env:PYTHONIOENCODING = "utf-8"

Write-Host "`nEnvironment configured:" -ForegroundColor Green
Write-Host "  Backend (Railway):  $env:VITE_ANALYSIS_API_URL" -ForegroundColor Yellow
Write-Host "  Frontend (Vercel):  $env:FRONTEND_URL" -ForegroundColor Yellow
Write-Host "  Stockfish:          $env:STOCKFISH_PATH" -ForegroundColor Yellow

Write-Host "`nNote: Supabase credentials should be configured in Railway environment" -ForegroundColor Magenta
Write-Host "      The backend will use those credentials for database access`n" -ForegroundColor Magenta

Write-Host "Running MAINTEST..." -ForegroundColor Cyan
Write-Host "======================================`n" -ForegroundColor Cyan

# Run MAINTEST with --backend-only since we're testing production backend
# Skip security tests that require direct DB access (use --ignore-security)
python run_MAINTEST.py --full --backend-only --ignore-security

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "MAINTEST completed" -ForegroundColor Green
