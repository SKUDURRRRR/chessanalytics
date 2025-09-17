#!/bin/bash

# Environment Variables Setup Script
# This script helps you set up environment variables for the chess analytics app

echo "🔧 Chess Analytics Environment Setup"
echo "===================================="

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "📝 Creating frontend .env file..."
    cp env.example .env
    echo "✅ Created .env file from env.example"
else
    echo "⚠️  .env file already exists, skipping creation"
fi

if [ ! -f "python/.env" ]; then
    echo "📝 Creating backend .env file..."
    cp python/env.example python/.env
    echo "✅ Created python/.env file from python/env.example"
else
    echo "⚠️  python/.env file already exists, skipping creation"
fi

echo ""
echo "🔑 Next Steps:"
echo "1. Edit .env with your Supabase credentials"
echo "2. Edit python/.env with your Supabase credentials"
echo "3. Run: npm run dev (for frontend)"
echo "4. Run: cd python && python main.py (for backend)"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT_SETUP.md"
