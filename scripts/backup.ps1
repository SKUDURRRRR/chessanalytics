# Chess Analytics Backup Script for Windows PowerShell
# This script provides an easy way to create backups on Windows systems

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("full", "quick", "database", "code", "config", "list")]
    [string]$Type = "full",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoData,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeSensitive,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoGit,
    
    [Parameter(Mandatory=$false)]
    [switch]$NoCompress,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectRoot = "."
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to display colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to check if Python is available
function Test-Python {
    try {
        $pythonVersion = python --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $true
        }
    }
    catch {
        return $false
    }
    return $false
}

# Function to check if required Python packages are installed
function Test-PythonPackages {
    $requiredPackages = @("supabase", "aiohttp", "asyncpg")
    $missingPackages = @()
    
    foreach ($package in $requiredPackages) {
        try {
            python -c "import $package" 2>$null
            if ($LASTEXITCODE -ne 0) {
                $missingPackages += $package
            }
        }
        catch {
            $missingPackages += $package
        }
    }
    
    return $missingPackages
}

# Main script
Write-ColorOutput "Chess Analytics Backup System" "Cyan"
Write-ColorOutput "=============================" "Cyan"
Write-ColorOutput ""

# Check prerequisites
Write-ColorOutput "Checking prerequisites..." "Yellow"

# Check Python
if (-not (Test-Python)) {
    Write-ColorOutput "❌ Python is not installed or not in PATH" "Red"
    Write-ColorOutput "Please install Python 3.8 or higher and add it to your PATH" "Red"
    exit 1
}

$pythonVersion = python --version
Write-ColorOutput "✅ Python found: $pythonVersion" "Green"

# Check Python packages
$missingPackages = Test-PythonPackages
if ($missingPackages.Count -gt 0) {
    Write-ColorOutput "❌ Missing Python packages: $($missingPackages -join ', ')" "Red"
    Write-ColorOutput "Installing missing packages..." "Yellow"
    
    foreach ($package in $missingPackages) {
        Write-ColorOutput "Installing $package..." "Yellow"
        pip install $package
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "❌ Failed to install $package" "Red"
            exit 1
        }
    }
}

Write-ColorOutput "✅ All required packages are available" "Green"
Write-ColorOutput ""

# Build command arguments
$args = @()

switch ($Type) {
    "full" {
        $scriptPath = "backup_all.py"
        $args += "--action", "backup"
    }
    "quick" {
        $scriptPath = "backup_all.py"
        $args += "--action", "quick-backup"
    }
    "database" {
        $scriptPath = "backup_database.py"
        $args += "--action", "backup"
    }
    "code" {
        $scriptPath = "backup_code.py"
        $args += "--action", "backup"
    }
    "config" {
        $scriptPath = "backup_config.py"
        $args += "--action", "backup"
    }
    "list" {
        $scriptPath = "backup_all.py"
        $args += "--action", "list"
    }
}

# Add additional arguments
if ($NoData) { $args += "--no-data" }
if ($IncludeSensitive) { $args += "--include-sensitive" }
if ($NoGit) { $args += "--no-git" }
if ($NoCompress) { $args += "--no-compress" }
if ($ProjectRoot -ne ".") { $args += "--project-root", $ProjectRoot }

# Change to scripts directory
$originalLocation = Get-Location
$scriptsPath = Join-Path $ProjectRoot "scripts"

if (-not (Test-Path $scriptsPath)) {
    Write-ColorOutput "❌ Scripts directory not found: $scriptsPath" "Red"
    exit 1
}

Set-Location $scriptsPath

try {
    # Run the appropriate backup script
    Write-ColorOutput "Running $Type backup..." "Yellow"
    Write-ColorOutput "Command: python $scriptPath $($args -join ' ')" "Gray"
    Write-ColorOutput ""
    
    python $scriptPath @args
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput ""
        Write-ColorOutput "🎉 Backup completed successfully!" "Green"
    } else {
        Write-ColorOutput ""
        Write-ColorOutput "❌ Backup failed with exit code $LASTEXITCODE" "Red"
        exit $LASTEXITCODE
    }
}
catch {
    Write-ColorOutput ""
    Write-ColorOutput "❌ Error running backup script: $($_.Exception.Message)" "Red"
    exit 1
}
finally {
    # Return to original location
    Set-Location $originalLocation
}

Write-ColorOutput ""
Write-ColorOutput "Backup system completed." "Cyan"
