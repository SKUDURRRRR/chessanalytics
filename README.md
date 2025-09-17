# Chess Analytics with Stockfish Integration

A powerful chess analytics app with real-time analysis powered by the Stockfish chess engine.

## 🎯 What This Gives You

- **Real Chess Analysis** powered by Stockfish 17.1 engine
- **Professional-Grade Accuracy** with move quality assessment
- **Detailed Move Analysis** with blunder/mistake/inaccuracy detection
- **Phase-Specific Metrics** for opening, middle game, and endgame
- **Scalable Architecture** handling multiple users and concurrent analysis
- **Simple Integration** with existing frontend components

## 🚀 Quick Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
# Copy the example env file
cp env.example .env

# Edit .env with your Supabase credentials
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Set Up Supabase
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Reset database to simple schema
supabase db reset

# Deploy the simple functions
supabase functions deploy analytics
supabase functions deploy import-games
```

### 4. Install Stockfish Engine
```bash
# Install Stockfish via Windows Package Manager
winget install Stockfish.Stockfish

# Verify installation
stockfish-windows-x86-64-avx2 --version
```

### 5. Start the Backend Server
```bash
# Option 1: Use the provided script (Windows)
start-backend.bat

# Option 2: Use PowerShell script
.\start-backend.ps1

# Option 3: Manual start
cd python
python main.py
```

### 6. Test Everything Works
```bash
# Test Stockfish integration
cd python
python example_integration.py

# Test the app
npm test
```

### 7. Run the App
```bash
# Start development server
npm run dev
```

### 8. Open in Browser
- Go to: `http://localhost:3000`
- Import some games and see the real Stockfish analysis!

## 🔧 Backend Server

The Python backend server provides real-time chess analysis powered by Stockfish. Make sure it's running on `http://localhost:8002` before using the analysis features.

**Features:**
- Real-time chess analysis with Stockfish 17.1
- Move quality assessment (blunders, mistakes, inaccuracies)
- Phase-specific accuracy calculations
- Background processing with progress tracking
- RESTful API for frontend integration

**If you see 404 errors in the browser console:**
1. Make sure the Python backend server is running
2. Check that it's accessible at `http://localhost:8002/health`
3. Verify Stockfish is installed and accessible
4. Use the provided startup scripts above

## 📁 Project Structure

```
src/
├── components/simple/
│   ├── SimpleAnalytics.tsx    # One analytics component
│   └── SimpleImport.tsx       # One import component
├── services/
│   └── simpleAnalytics.ts     # One service
├── pages/
│   └── SimpleAnalyticsPage.tsx # One page
├── lib/
│   └── supabase.ts            # Supabase client
└── App.tsx                    # Main app

supabase/
├── functions/
│   ├── analytics/index.ts     # One analytics function
│   └── import-games/index.ts  # One import function
└── migrations/
    └── 20240101000000_initial_schema.sql # Simple schema
```

## 🎉 How to Use

### 1. Import Games
- Go to "Import Games" tab
- Enter a user ID (e.g., "testuser")
- Click "Import Games"
- Games are imported with PGN data

### 2. Start Analysis
- Go to "Analytics" tab
- Click "Start Analysis" to begin Stockfish analysis
- Watch real-time progress as games are analyzed
- View detailed move-by-move analysis results

### 3. View Results
- See overall accuracy and move quality metrics
- View phase-specific performance (opening, middle game, endgame)
- Analyze blunders, mistakes, and brilliant moves
- Track improvement over time

## 🔥 Benefits

- **Real Chess Analysis** - Powered by the world's strongest chess engine
- **Professional Accuracy** - Move quality assessment with centipawn evaluation
- **Detailed Insights** - Blunder/mistake/inaccuracy detection for improvement
- **Scalable Performance** - Handles multiple users and concurrent analysis
- **Easy Integration** - Works seamlessly with existing frontend components

## 📚 Documentation

- **[Stockfish Integration Guide](docs/STOCKFISH_INTEGRATION.md)** - Complete integration documentation
- **[Technical Summary](docs/TECHNICAL_SUMMARY.md)** - Technical architecture and implementation
- **[Developer Quick Start](docs/DEVELOPER_QUICK_START.md)** - Quick reference for developers
- **[Setup Instructions](python/STOCKFISH_SETUP.md)** - Detailed setup and configuration

## 💡 Why This Works

- **Real Chess Engine** - Stockfish provides professional-grade analysis
- **Accurate Results** - Move quality assessment with centipawn precision
- **Scalable Architecture** - Handles multiple users and concurrent analysis
- **Simple Integration** - Works with existing frontend without changes
- **Rich Data** - Detailed move-by-move analysis for chess improvement

## 🎯 The Result

Your chess analytics app now provides:

- **Real Chess Analysis** - Powered by Stockfish 17.1 engine
- **Professional Accuracy** - Move quality assessment with centipawn evaluation
- **Detailed Insights** - Blunder/mistake/inaccuracy detection for improvement
- **Phase Analysis** - Separate accuracy for opening, middle game, and endgame
- **Scalable Performance** - Handles multiple users and concurrent analysis
- **Rich Data** - Detailed move-by-move analysis stored in database

**This transforms your app from a simple analytics tool into a professional chess analysis platform.**
