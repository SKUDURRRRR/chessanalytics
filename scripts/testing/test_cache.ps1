# Test Cache Script
# This will help us see if caching is working

Write-Host "Testing cache behavior..." -ForegroundColor Cyan

# Make first request
Write-Host "`n1. Making FIRST request (should be slow)..." -ForegroundColor Yellow
$start1 = Get-Date
$response1 = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/comprehensive-analytics/skudurrrrr/chess.com?limit=10000" -UseBasicParsing
$end1 = Get-Date
$time1 = ($end1 - $start1).TotalSeconds

Write-Host "   First request took: $([math]::Round($time1, 2)) seconds" -ForegroundColor Green

# Wait 2 seconds
Write-Host "`n2. Waiting 2 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# Make second request (should be cached)
Write-Host "`n3. Making SECOND request (should be instant if cache works)..." -ForegroundColor Yellow
$start2 = Get-Date
$response2 = Invoke-WebRequest -Uri "http://localhost:8002/api/v1/comprehensive-analytics/skudurrrrr/chess.com?limit=10000" -UseBasicParsing
$end2 = Get-Date
$time2 = ($end2 - $start2).TotalSeconds

Write-Host "   Second request took: $([math]::Round($time2, 2)) seconds" -ForegroundColor Green

# Compare
Write-Host "`n=== RESULTS ===" -ForegroundColor Cyan
Write-Host "First request:  $([math]::Round($time1, 2))s" -ForegroundColor White
Write-Host "Second request: $([math]::Round($time2, 2))s" -ForegroundColor White

if ($time2 -lt 0.5) {
    Write-Host "`n✅ CACHE IS WORKING! Second request was instant." -ForegroundColor Green
} elseif ($time2 -lt ($time1 * 0.2)) {
    Write-Host "`n⚠️ Cache might be working but slower than expected." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ CACHE NOT WORKING! Both requests took similar time." -ForegroundColor Red
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  - Backend is restarting between requests" -ForegroundColor Yellow
    Write-Host "  - Cache implementation issue" -ForegroundColor Yellow
    Write-Host "  - Different parameters on each request" -ForegroundColor Yellow
}
