# Start Backend with Correct Supabase Credentials
# Run this script to start your backend with the right environment variables

# Set Supabase credentials (FRESH keys from dashboard)
$env:SUPABASE_URL="https://nhpsnvhvfscrmyniihdn.supabase.co"
$env:SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4ODIzMTcsImV4cCI6MjA3NTQ1ODMxN30.ed1X0YIg_ccm6Kare0Bdul-5869xYL4Ua-tIv6UnyGQ"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0"

Write-Host "Environment variables set!" -ForegroundColor Green
Write-Host "SUPABASE_URL: $env:SUPABASE_URL" -ForegroundColor Cyan
Write-Host "Starting backend..." -ForegroundColor Yellow

# Start backend
python python/main.py

