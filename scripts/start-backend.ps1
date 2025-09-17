# Start Backend Server with Port Alignment
# This script ensures the frontend and backend use the same port

param(
    [int]$Port = 8003,
    [string]$ServerType = "simple"
)

Write-Host "=== Chess Analytics Backend Starter ===" -ForegroundColor Green
Write-Host "Port: $Port" -ForegroundColor Yellow
Write-Host "Server Type: $ServerType" -ForegroundColor Yellow
Write-Host ""

# Check if port is available
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    Write-Host "❌ Port $Port is already in use!" -ForegroundColor Red
    Write-Host "Killing existing processes on port $Port..." -ForegroundColor Yellow
    
    # Kill processes using the port
    $processes = Get-NetTCPConnection -LocalPort $Port | Select-Object -ExpandProperty OwningProcess
    foreach ($pid in $processes) {
        try {
            Stop-Process -Id $pid -Force
            Write-Host "✅ Killed process $pid" -ForegroundColor Green
        } catch {
            Write-Host "⚠️ Could not kill process $pid" -ForegroundColor Yellow
        }
    }
    
    Start-Sleep -Seconds 2
}

# Update frontend configuration
Write-Host "Updating frontend configuration..." -ForegroundColor Yellow

# Update analysisService.ts
$analysisServicePath = "src/services/analysisService.ts"
if (Test-Path $analysisServicePath) {
    $content = Get-Content $analysisServicePath -Raw
    $newContent = $content -replace 'http://localhost:\d+', "http://localhost:$Port"
    Set-Content $analysisServicePath -Value $newContent -NoNewline
    Write-Host "✅ Updated $analysisServicePath" -ForegroundColor Green
} else {
    Write-Host "⚠️ Could not find $analysisServicePath" -ForegroundColor Yellow
}

# Update any other frontend files that might reference the port
$frontendFiles = @(
    "src/services/deepAnalysisService.ts",
    "src/components/admin/DataGenerator.tsx"
)

foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match 'localhost:\d+') {
            $newContent = $content -replace 'localhost:\d+', "localhost:$Port"
            Set-Content $file -Value $newContent -NoNewline
            Write-Host "✅ Updated $file" -ForegroundColor Green
        }
    }
}

# Start the appropriate server
Write-Host "Starting backend server..." -ForegroundColor Yellow

if ($ServerType -eq "simple") {
    # Start simple analysis server
    $serverPath = "python/simple_analysis_server.py"
    if (Test-Path $serverPath) {
        # Update the port in the server file
        $serverContent = Get-Content $serverPath -Raw
        $newServerContent = $serverContent -replace '--port \d+', "--port $Port"
        Set-Content $serverPath -Value $newServerContent -NoNewline
        
        Write-Host "Starting simple analysis server on port $Port..." -ForegroundColor Cyan
        Start-Process python -ArgumentList $serverPath -WindowStyle Normal
    } else {
        Write-Host "❌ Could not find $serverPath" -ForegroundColor Red
        exit 1
    }
} elseif ($ServerType -eq "main") {
    # Start main server
    $serverPath = "python/main.py"
    if (Test-Path $serverPath) {
        Write-Host "Starting main server on port $Port..." -ForegroundColor Cyan
        $env:SUPABASE_URL = "https://nkeaifrhtyigfmicfwch.supabase.co"
        $env:SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rZWFpZnJodHlpZ2ZtaWNmd2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0NzQwMDAsImV4cCI6MjA1MDA1MDAwMH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8"
        Start-Process python -ArgumentList $serverPath -WindowStyle Normal
    } else {
        Write-Host "❌ Could not find $serverPath" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ Unknown server type: $ServerType" -ForegroundColor Red
    Write-Host "Valid options: 'simple' or 'main'" -ForegroundColor Yellow
    exit 1
}

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Test the server
Write-Host "Testing server health..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:$Port/health" -TimeoutSec 10
    Write-Host "✅ Server is running and healthy!" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Server health check failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check if the server window opened successfully" -ForegroundColor White
    Write-Host "2. Look for any error messages in the server window" -ForegroundColor White
    Write-Host "3. Try running: Get-Process python" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "🎉 Backend server is ready!" -ForegroundColor Green
Write-Host "Frontend should now be able to connect to: http://localhost:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the server:" -ForegroundColor Yellow
Write-Host "1. Close the server window, or" -ForegroundColor White
Write-Host "2. Run: Get-Process python | Stop-Process" -ForegroundColor White
