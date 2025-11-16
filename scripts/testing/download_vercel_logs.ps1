# Download Vercel Runtime Logs
# This script downloads Vercel logs for analysis

Write-Host "Downloading Vercel runtime logs..." -ForegroundColor Cyan

# Check if Vercel CLI is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Vercel CLI is not installed." -ForegroundColor Red
    Write-Host "Install it with: npm install -g vercel" -ForegroundColor Yellow
    exit 1
}

# Create logs directory if it doesn't exist
$logsDir = "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

# Get current timestamp for filename
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "$logsDir\vercel_runtime_logs_$timestamp.txt"
$errorFile = "$logsDir\vercel_errors_$timestamp.txt"

Write-Host "Downloading logs from last 24 hours..." -ForegroundColor Cyan
Write-Host "Output file: $outputFile" -ForegroundColor Gray

# Download all runtime logs
vercel logs --since 24h --output runtime > $outputFile 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Logs downloaded successfully!" -ForegroundColor Green
    Write-Host "Total size: $((Get-Item $outputFile).Length / 1KB) KB" -ForegroundColor Gray

    # Extract errors
    Write-Host "`nExtracting errors..." -ForegroundColor Cyan
    Select-String -Path $outputFile -Pattern "error|Error|ERROR|500|404|503|502|timeout|Timeout|Exception|Failed|failed" -CaseSensitive:$false | Out-File $errorFile

    $errorCount = (Get-Content $errorFile | Measure-Object -Line).Lines
    Write-Host "✓ Found $errorCount error lines" -ForegroundColor $(if ($errorCount -gt 0) { "Yellow" } else { "Green" })
    Write-Host "Error file: $errorFile" -ForegroundColor Gray
} else {
    Write-Host "✗ Failed to download logs. Make sure you're logged in: vercel login" -ForegroundColor Red
    exit 1
}

Write-Host "`nDone! Check the logs directory for results." -ForegroundColor Green
