@echo off
REM Environment Variables Setup Script for Windows
REM This script helps you set up environment variables for the chess analytics app

echo 🔧 Chess Analytics Environment Setup
echo ====================================

REM Check if .env files exist
if not exist ".env" (
    echo 📝 Creating frontend .env file...
    copy env.example .env
    echo ✅ Created .env file from env.example
) else (
    echo ⚠️  .env file already exists, skipping creation
)

if not exist "python\.env" (
    echo 📝 Creating backend .env file...
    copy python\env.example python\.env
    echo ✅ Created python\.env file from python\env.example
) else (
    echo ⚠️  python\.env file already exists, skipping creation
)

echo.
echo 🔑 Next Steps:
echo 1. Edit .env with your Supabase credentials
echo 2. Edit python\.env with your Supabase credentials
echo 3. Run: npm run dev (for frontend)
echo 4. Run: cd python && python main.py (for backend)
echo.
echo 📖 For detailed instructions, see DEPLOYMENT_SETUP.md
pause
