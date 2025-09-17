#!/bin/bash

echo "🚀 Setting up Simple Chess Analytics..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp env.example .env
    echo "⚠️  Please edit .env with your Supabase credentials"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Supabase credentials"
echo "2. Run: supabase db reset"
echo "3. Run: supabase functions deploy analytics"
echo "4. Run: supabase functions deploy import-games"
echo "5. Run: npm run dev"
echo ""
echo "🎉 Your simple chess analytics app is ready!"
