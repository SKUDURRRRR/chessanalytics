@echo off
REM Update Vercel Environment Variable
echo.
echo ========================================
echo   Update Vercel Frontend Configuration
echo ========================================
echo.
echo Run this command to set the backend URL:
echo.
echo vercel env add VITE_ANALYSIS_API_URL production
echo.
echo When prompted, enter:
echo https://chessanalytics-production.up.railway.app
echo.
echo Then redeploy:
echo vercel --prod
echo.
echo ========================================
echo.
echo OR update via Vercel Dashboard:
echo 1. Go to https://vercel.com/dashboard
echo 2. Select your chess-analytics project
echo 3. Settings -^> Environment Variables
echo 4. Add:
echo    Name: VITE_ANALYSIS_API_URL
echo    Value: https://chessanalytics-production.up.railway.app
echo 5. Deployments -^> Redeploy latest
echo.
pause
