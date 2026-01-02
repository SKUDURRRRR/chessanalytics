# start-all.ps1
# Starts docker backend, python main service, and Vite dev UI

param(
    [switch]$NoDockerBuild  # use `.\start-all.ps1 -NoDockerBuild` after the first run
)

$root    = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$venv    = Join-Path $root ".venv\Scripts\Activate.ps1"
$compose = Join-Path $root "docker-compose.api.yml"

if (-not (Test-Path $compose)) {
    Write-Error "docker-compose.api.yml not found. Run from repo root."
    exit 1
}

# 1. Try Docker first, but fall back to Python if it fails
$composeArgs = @("compose","-f",$compose,"up","--detach")
if (-not $NoDockerBuild) { $composeArgs += "--build" }
$dockerProcess = Start-Process docker -ArgumentList $composeArgs -NoNewWindow -PassThru -Wait
Start-Sleep -Seconds 3

# Check if Docker container is running
$dockerRunning = docker ps --filter "name=analysis-api" --format "{{.Names}}" | Select-String "analysis-api"
if ($dockerRunning) {
    Write-Host "✅ Docker analysis API started successfully." -ForegroundColor Green
    # Test if it's actually responding
    Start-Sleep -Seconds 2
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:8002/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ Backend API is healthy and responding." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Docker container started but not responding. Starting Python service as fallback..." -ForegroundColor Yellow
        $dockerRunning = $false
    }
} else {
    Write-Host "⚠️ Docker analysis API failed to start. Using Python service instead." -ForegroundColor Yellow
    $dockerRunning = $false
}

# 2. Start Python service if Docker didn't work or as primary option
if (-not $dockerRunning) {
    $venvPython = Join-Path $root ".venv\Scripts\python.exe"
    $pythonDir = Join-Path $root "python"
    if (Test-Path $venvPython) {
        # Use -WorkingDirectory to avoid path quoting issues
        Start-Process powershell -ArgumentList @(
            "-NoExit","-Command", "cd '$pythonDir'; & '$venvPython' main.py"
        ) -WindowStyle Normal
        Write-Host "✅ Launched python\main.py in a new PowerShell window using venv Python." -ForegroundColor Green
    } else {
        # Use -WorkingDirectory to avoid path quoting issues
        Start-Process powershell -ArgumentList @(
            "-NoExit","-Command", "cd '$pythonDir'; python main.py"
        ) -WindowStyle Normal
        Write-Host "✅ Launched python\main.py in a new PowerShell window (using system Python)." -ForegroundColor Green
    }
    Write-Host "⏳ Waiting for Python backend to start..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:8002/health" -TimeoutSec 5 -ErrorAction Stop
        Write-Host "✅ Python backend is healthy and responding." -ForegroundColor Green
    } catch {
        Write-Host "⚠️ Backend may still be starting. Check the Python window for errors." -ForegroundColor Yellow
    }
}

# 3. Vite dev server
Start-Process powershell -ArgumentList @(
    "-NoExit","-Command",
    "cd '$root'; npm run dev"
) -WindowStyle Normal
Write-Host "Launched npm run dev in another PowerShell window." -ForegroundColor Green
