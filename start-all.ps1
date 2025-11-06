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

# 1. analysis API inside Docker (parallel execution)
$composeArgs = @("compose","-f",$compose,"up","--detach")
if (-not $NoDockerBuild) { $composeArgs += "--build" }
Start-Process docker -ArgumentList $composeArgs -NoNewWindow -Wait
Write-Host "Docker analysis API started." -ForegroundColor Green

# 2. Python main service (if you still need it locally)
$venvPython = Join-Path $root ".venv\Scripts\python.exe"
$pythonDir = Join-Path $root "python"
if (Test-Path $venvPython) {
    # Use -WorkingDirectory to avoid path quoting issues
    Start-Process powershell -ArgumentList @(
        "-NoExit","-Command", "& '$venvPython' main.py"
    ) -WorkingDirectory $pythonDir -WindowStyle Normal
    Write-Host "Launched python\main.py in a new PowerShell window using venv Python." -ForegroundColor Green
} else {
    # Use -WorkingDirectory to avoid path quoting issues
    Start-Process powershell -ArgumentList @(
        "-NoExit","-Command", "& '$venv'; python main.py"
    ) -WorkingDirectory $pythonDir -WindowStyle Normal
    Write-Host "Launched python\main.py in a new PowerShell window (venv not found, using system Python)." -ForegroundColor Yellow
}

# 3. Vite dev server
Start-Process powershell -ArgumentList @(
    "-NoExit","-Command",
    "cd '$root'; npm run dev"
) -WindowStyle Normal
Write-Host "Launched npm run dev in another PowerShell window." -ForegroundColor Green
