# Environment Variables Setup Script for PowerShell
# This script helps you set up environment variables for the chess analytics app

Write-Host "🔧 Chess Analytics Environment Setup" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# Check if .env files exist
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating frontend .env file..." -ForegroundColor Yellow
    Copy-Item "env.example" ".env"
    Write-Host "✅ Created .env file from env.example" -ForegroundColor Green
} else {
    Write-Host "⚠️  .env file already exists, skipping creation" -ForegroundColor Yellow
}

if (-not (Test-Path "python\.env")) {
    Write-Host "📝 Creating backend .env file..." -ForegroundColor Yellow
    Copy-Item "python\env.example" "python\.env"
    Write-Host "✅ Created python\.env file from python\env.example" -ForegroundColor Green
} else {
    Write-Host "⚠️  python\.env file already exists, skipping creation" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔑 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Edit .env with your Supabase credentials" -ForegroundColor White
Write-Host "2. Edit python\.env with your Supabase credentials" -ForegroundColor White
Write-Host "3. Run: npm run dev (for frontend)" -ForegroundColor White
Write-Host "4. Run: cd python && python main.py (for backend)" -ForegroundColor White
Write-Host ""
Write-Host "📖 For detailed instructions, see DEPLOYMENT_SETUP.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
