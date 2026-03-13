# Chess Analytics - AI Agent Instructions

For comprehensive project context, see [CLAUDE.md](../CLAUDE.md) in the project root.

## Project Overview

Chess analytics platform built with React (frontend), Python FastAPI (backend), and Supabase (database). Provides player analysis, game insights, personality scoring, and AI coaching.

Key components:
- Frontend: TypeScript + React 18 + Tailwind CSS (port 3000)
- Backend: Python FastAPI + Stockfish 17.1 engine (port 8002)
- Database: PostgreSQL (Supabase) with RLS
- AI: Google Gemini + Anthropic Claude for coaching comments
- Payments: Stripe
- Deploy: Vercel (frontend), Railway (backend)

## Critical Architecture Patterns

### Data Flow
```
Frontend -> Services -> Supabase/Python Backend -> External APIs
```
Player search in `src/components/simple/PlayerSearch.tsx` flows through:
1. `AutoImportService` -> Fetch games from Lichess/Chess.com
2. `UnifiedAnalysisService` -> Process with Python backend
3. Store in Supabase tables -> Display results

### Component Structure
- Simple components (`src/components/simple/`) - Core analytics
- Deep components (`src/components/deep/`) - Advanced analysis
- Debug components (`src/components/debug/`) - Diagnostic/analysis views
- Chess components (`src/components/chess/`) - Chess UI (boards, arrows)
- Each analytics feature follows: Search -> Import -> Analyze -> Display

### Database Schema
Core tables with relationships:
- `games` - Core chess game data
- `games_pgn` - PGN content storage
- `game_analyses` - Stockfish analysis results
- `move_analyses` - Move-by-move analysis data
- `unified_analyses` - Consolidated analysis view
- `user_profiles` - User profile management
- `user_subscriptions` - Subscription tier tracking
- `user_usage` - Rate limiting tracking

## Development Workflow

### Setting Up
```bash
npm install
cd python && pip install -r requirements.txt
cp env.example .env.local  # Edit with your Supabase credentials
```

### Running
```bash
# Backend (required for analysis)
cd python && python main.py    # Runs on port 8002

# Frontend
npm run dev                     # Runs on port 3000
```

### Testing
```bash
npm test           # Vitest unit tests
npm run e2e        # Playwright E2E tests
pytest python/tests/  # Backend tests
```

## Conventions

### Code Organization
- Services in `src/services/` handle data fetching and processing
- Utils in `src/utils/` for shared helper functions
- Components grouped by complexity (simple/deep/debug/chess)

### Naming Conventions
- Components: PascalCase (e.g., `UnifiedChessAnalysis.tsx`)
- Services: camelCase files ending with `Service.ts`
- Python: snake_case files and functions, PascalCase classes

### State Management
- React Context for auth state (`AuthContext`) and sound settings (`ChessSoundContext`)
- Local component state for UI
- Service layer with caching for API calls

## Common Pitfalls
- Backend port is **8002**, not 8001
- Frontend env vars must use `VITE_` prefix
- Chess.com usernames are case-insensitive (lowercase); Lichess usernames are case-sensitive
- Never use `any` type in TypeScript - use proper types
- Never hardcode API URLs - use config
- Never expose internal errors to users
