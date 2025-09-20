# Start Backend Server with Port Alignment
# This script ensures the frontend and backend use the same port

param(
    [int]$Port = 8002,
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
    try {
        $processes = Get-NetTCPConnection -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess
        if ($processes) {
            foreach ($processId in $processes) {
                try {
                    $process = Get-Process -Id $processId -ErrorAction Stop
                    Stop-Process -Id $processId -Force -ErrorAction Stop
                    Write-Host "✅ Killed process $processId ($($process.ProcessName))" -ForegroundColor Green
                } catch {
                    Write-Host "⚠️ Could not kill process $processId`: $($_.Exception.Message)" -ForegroundColor Yellow
                }
            }
        } else {
            Write-Host "ℹ️ No processes found using port $Port" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "⚠️ Could not retrieve processes using port $Port`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
    
    Start-Sleep -Seconds 2
}

# Update frontend configuration
Write-Host "Updating frontend configuration..." -ForegroundColor Yellow

# Update analysisService.ts
$analysisServicePath = "src/services/analysisService.ts"
if (Test-Path $analysisServicePath) {
    try {
        $content = Get-Content $analysisServicePath -Raw -ErrorAction Stop
        $newContent = $content -replace 'http://localhost:\d+', "http://localhost:$Port"
        Set-Content $analysisServicePath -Value $newContent -NoNewline -ErrorAction Stop
        Write-Host "✅ Updated $analysisServicePath" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Could not update $analysisServicePath`: $($_.Exception.Message)" -ForegroundColor Yellow
    }
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
        try {
            $content = Get-Content $file -Raw -ErrorAction Stop
            if ($content -match 'localhost:\d+') {
                $newContent = $content -replace 'localhost:\d+', "localhost:$Port"
                Set-Content $file -Value $newContent -NoNewline -ErrorAction Stop
                Write-Host "✅ Updated $file" -ForegroundColor Green
            }
        } catch {
            Write-Host "⚠️ Could not update $file`: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "⚠️ Could not find $file" -ForegroundColor Yellow
    }
}

# Change to the python directory where the core module is located
Write-Host "Changing to python directory..." -ForegroundColor Yellow
Set-Location python
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Cyan

# Start the appropriate server
Write-Host "Starting backend server..." -ForegroundColor Yellow

if ($ServerType -eq "simple") {
    # Start simple analysis server
    $serverPath = "simple_analysis_server.py"
    if (Test-Path $serverPath) {
        # Update the port in the server file
        $serverContent = Get-Content $serverPath -Raw
        $newServerContent = $serverContent -replace '--port \d+', "--port $Port"
        Set-Content $serverPath -Value $newServerContent -NoNewline
        
        Write-Host "Starting simple analysis server on port $Port..." -ForegroundColor Cyan
        Start-Process python -ArgumentList $serverPath -WindowStyle Normal
    } else {
        Write-Host "❌ Could not find $serverPath" -ForegroundColor Red
        Write-Host "The simple analysis server file is missing." -ForegroundColor Yellow
        Write-Host "Falling back to main server..." -ForegroundColor Yellow
        Write-Host ""
        
        # Fallback to main server
        Write-Host "Starting core API server on port $Port..." -ForegroundColor Cyan
        
        # Check for environment variables or .env file
        if (-not $env:SUPABASE_URL -or $env:SUPABASE_URL -eq "https://your-project.supabase.co") {
            Write-Host "⚠️ SUPABASE_URL not set or using default value" -ForegroundColor Yellow
            Write-Host "Please set SUPABASE_URL environment variable or check your .env file" -ForegroundColor Yellow
        }
        
        if (-not $env:SUPABASE_ANON_KEY -or $env:SUPABASE_ANON_KEY -eq "your-anon-key-here") {
            Write-Host "⚠️ SUPABASE_ANON_KEY not set or using default value" -ForegroundColor Yellow
            Write-Host "Please set SUPABASE_ANON_KEY environment variable or check your .env file" -ForegroundColor Yellow
        }
        
        Start-Process python -ArgumentList "-m", "core.api_server" -WindowStyle Normal
    }
} elseif ($ServerType -eq "main") {
    # Start main server using the core API server
    Write-Host "Starting core API server on port $Port..." -ForegroundColor Cyan
    
    # Check for environment variables or .env file
    if (-not $env:SUPABASE_URL -or $env:SUPABASE_URL -eq "https://your-project.supabase.co") {
        Write-Host "⚠️ SUPABASE_URL not set or using default value" -ForegroundColor Yellow
        Write-Host "Please set SUPABASE_URL environment variable or check your .env file" -ForegroundColor Yellow
    }
    
    if (-not $env:SUPABASE_ANON_KEY -or $env:SUPABASE_ANON_KEY -eq "your-anon-key-here") {
        Write-Host "⚠️ SUPABASE_ANON_KEY not set or using default value" -ForegroundColor Yellow
        Write-Host "Please set SUPABASE_ANON_KEY environment variable or check your .env file" -ForegroundColor Yellow
    }
    
    Start-Process python -ArgumentList "-m", "core.api_server" -WindowStyle Normal
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
