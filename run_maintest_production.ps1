# MAINTEST Production Test Runner
# Run MAINTEST against production deployment (Railway + Vercel)
# This script sets environment variables from your production deployment

param(
    [switch]$Quick,
    [switch]$Full,
    [switch]$BackendOnly,
    [switch]$FrontendOnly
)

Write-Host "MAINTEST Production Test Runner" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Get production URLs from user input or use defaults
$productionBackend = Read-Host "Enter your Railway backend URL (or press Enter for localhost:8002)"
if ([string]::IsNullOrWhiteSpace($productionBackend)) {
    $productionBackend = "http://localhost:8002"
}

$productionFrontend = Read-Host "Enter your Vercel frontend URL (or press Enter for localhost:3000)"
if ([string]::IsNullOrWhiteSpace($productionFrontend)) {
    $productionFrontend = "http://localhost:3000"
}

Write-Host ""
Write-Host "Now you need to provide Supabase credentials..." -ForegroundColor Yellow
Write-Host "Get them from: https://app.supabase.com -> Your Project -> Settings -> API" -ForegroundColor Gray
Write-Host ""

$supabaseUrl = Read-Host "Enter SUPABASE_URL"
$supabaseAnonKey = Read-Host "Enter SUPABASE_ANON_KEY"
$supabaseServiceKey = Read-Host "Enter SUPABASE_SERVICE_ROLE_KEY (will be hidden)" -AsSecureString

# Convert secure string to plain text for environment variable
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabaseServiceKey)
$supabaseServiceKeyPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# Set environment variables for this session
$env:VITE_SUPABASE_URL = $supabaseUrl
$env:VITE_SUPABASE_ANON_KEY = $supabaseAnonKey
$env:SUPABASE_URL = $supabaseUrl
$env:SUPABASE_ANON_KEY = $supabaseAnonKey
$env:SUPABASE_SERVICE_ROLE_KEY = $supabaseServiceKeyPlain
$env:VITE_ANALYSIS_API_URL = $productionBackend
$env:VITE_API_URL = $productionBackend
$env:FRONTEND_URL = $productionFrontend
$env:STOCKFISH_PATH = "./stockfish/stockfish-windows-x86-64-avx2.exe"

Write-Host ""
Write-Host "Environment configured:" -ForegroundColor Green
Write-Host "  Backend:  $productionBackend" -ForegroundColor White
Write-Host "  Frontend: $productionFrontend" -ForegroundColor White
Write-Host "  Supabase: $supabaseUrl" -ForegroundColor White
Write-Host ""

# Build command
$command = "python run_MAINTEST.py"

if ($Quick) {
    $command += " --quick"
} elseif ($Full) {
    $command += " --full"
} else {
    # Default to quick mode
    $command += " --quick"
}

if ($BackendOnly) {
    $command += " --backend-only"
} elseif ($FrontendOnly) {
    $command += " --frontend-only"
}

Write-Host "Running: $command" -ForegroundColor Cyan
Write-Host ""

# Run MAINTEST
Invoke-Expression $command

# Clean up sensitive data
Remove-Variable -Name supabaseServiceKeyPlain -ErrorAction SilentlyContinue
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
