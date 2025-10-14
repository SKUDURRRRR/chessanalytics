# Start Backend with Supabase Credentials from .env file
# Run this script to start your backend with the right environment variables
# 
# IMPORTANT: Make sure you have a .env file with your credentials!
# See START_BACKEND_LOCAL.ps1.example for the required variables

# Load environment variables from .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
    Write-Host "Loaded environment variables from .env file" -ForegroundColor Green
} else {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your Supabase credentials." -ForegroundColor Yellow
    Write-Host "See START_BACKEND_LOCAL.ps1.example for required variables." -ForegroundColor Yellow
    exit 1
}

# Verify required variables are set
if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Host "ERROR: Missing required environment variables!" -ForegroundColor Red
    Write-Host "Please ensure your .env file contains:" -ForegroundColor Yellow
    Write-Host "  - SUPABASE_URL" -ForegroundColor Yellow
    Write-Host "  - SUPABASE_ANON_KEY" -ForegroundColor Yellow
    Write-Host "  - SUPABASE_SERVICE_ROLE_KEY" -ForegroundColor Yellow
    exit 1
}

Write-Host "SUPABASE_URL: $env:SUPABASE_URL" -ForegroundColor Cyan
Write-Host "Starting backend..." -ForegroundColor Yellow

# Start backend
python python/main.py

