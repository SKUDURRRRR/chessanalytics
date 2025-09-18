# Chess Analytics System Map

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   HomePage      │  │ SimpleAnalytics │  │ DeepAnalysis    │  │
│  │   (Search)      │  │   Page          │  │   Components    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  AuthContext    │  │  Services Layer │  │  Components     │  │
│  │  (Supabase)     │  │  (API Calls)    │  │  (UI)           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Python FastAPI)                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   API Server    │  │ Analysis Engine │  │ Stockfish       │  │
│  │   (FastAPI)     │  │   (Unified)     │  │   Integration   │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│           │                     │                     │          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Configuration  │  │  Move Analysis  │  │  Game Analysis  │  │
│  │  Management     │  │  (UCI/SAN)      │  │  (PGN)          │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   games         │  │  user_profiles  │  │  move_analyses  │  │
│  │   (Basic)       │  │  (User Data)    │  │  (Stockfish)    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  game_analyses  │  │  games_pgn      │  │ unified_analyses│  │
│  │  (Basic)        │  │  (PGN Data)     │  │  (View)         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Game Import Flow
```
User Input → AutoImportService → Chess.com/Lichess API → games_pgn table → Analysis Trigger
```

### 2. Analysis Flow
```
PGN Data → Analysis Engine → Stockfish Engine → Move Analysis → Database Storage → Frontend Display
```

### 3. Authentication Flow
```
User → Supabase Auth → JWT Token → API Authorization → Database RLS
```

## Key Modules

### Frontend (React + TypeScript)
- **App.tsx**: Main application with routing
- **Pages**: HomePage, SimpleAnalyticsPage
- **Components**: 
  - Simple: AnalyticsBar, MatchHistory, SimpleAnalytics, PlayerSearch
  - Deep: DeepAnalysisBlock, PersonalityRadar, ScoreCards, etc.
- **Services**: analysisService, autoImportService, deepAnalysisService, profileService
- **Contexts**: AuthContext (Supabase integration)

### Backend (Python + FastAPI)
- **main.py**: Entry point using unified core
- **core/api_server.py**: Unified API server with all endpoints
- **core/analysis_engine.py**: Chess analysis engine with Stockfish integration
- **core/config.py**: Configuration management
- **core/unified_config.py**: Unified configuration system

### Database Schema (Supabase PostgreSQL)
- **games**: Basic game data (result, rating, opening, etc.)
- **user_profiles**: User information and statistics
- **games_pgn**: PGN data for analysis
- **move_analyses**: Detailed Stockfish analysis results
- **game_analyses**: Basic analysis results
- **unified_analyses**: View combining all analysis types

## External Dependencies

### Frontend
- React 18.3.1
- Vite 5.4.19
- Supabase JS 2.57.2
- Recharts 3.2.1
- React Router DOM 6.30.1

### Backend
- FastAPI
- Uvicorn
- Chess 1.999
- Stockfish (external binary)
- Supabase Python client

### Database
- Supabase (PostgreSQL)
- Row Level Security (RLS)
- Real-time subscriptions

## Entry Points

### Frontend
- **Development**: `npm run dev` → http://localhost:3000
- **Production**: `npm run build` → Static files

### Backend
- **Development**: `python main.py` → http://localhost:8002
- **Production**: `uvicorn core.api_server:app` → http://localhost:8002

### Database
- **Supabase Dashboard**: https://app.supabase.com
- **Direct Connection**: PostgreSQL connection string

## API Endpoints

### Analysis API (Port 8002)
- `GET /` - Health check
- `GET /health` - Service status
- `POST /analyze-games` - Batch game analysis
- `POST /analyze-position` - Position analysis
- `POST /analyze-move` - Move analysis
- `POST /analyze-game` - Single game analysis
- `GET /analysis/{user_id}/{platform}` - Get analysis results
- `GET /analysis-stats/{user_id}/{platform}` - Get statistics
- `GET /analysis-progress/{user_id}/{platform}` - Get progress

### Proxy Endpoints
- `GET /proxy/chess-com/{username}/games/{year}/{month}` - Chess.com games
- `GET /proxy/chess-com/{username}` - Chess.com user info

## Configuration

### Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key
- `VITE_ANALYSIS_API_URL`: Backend API URL
- `SUPABASE_JWT_SECRET`: JWT secret for authentication

### Database Configuration
- Row Level Security enabled
- Service role key for admin operations
- Anonymous key for public operations

## Security Model

### Authentication
- Supabase Auth with JWT tokens
- Optional authentication (can be disabled for development)
- User-specific data access via RLS

### Authorization
- Row Level Security policies
- User can only access their own data
- Service role for system operations

### Data Protection
- Environment variable validation
- Input sanitization
- SQL injection prevention via parameterized queries
