# Chess Analytics

Chess analytics platform. React frontend analyzes chess games using Stockfish engine via Python backend, stores results in Supabase.

## Tech Stack

- Frontend: React 18 + TypeScript 5.8 + Vite 7 + TailwindCSS (port 3000)
- Backend: Python 3 + FastAPI + Uvicorn (port 8002)
- Database: Supabase (PostgreSQL) with Row Level Security
- Chess Engine: Stockfish 17.1
- AI Coaching: Google Gemini + Anthropic Claude
- Auth: Supabase Auth + JWT
- Payments: Stripe
- Deploy: Vercel (frontend), Railway (backend), Supabase (database)
- Testing: Vitest + Playwright (frontend), pytest (backend)
- State: React Context API (no Redux/Zustand)

## Commands

```bash
# Frontend
npm run dev              # Dev server on port 3000
npm run build            # Production build (Vite)
npm run lint             # ESLint (--max-warnings=0)
npm test                 # Vitest unit tests
npm run e2e              # Playwright E2E tests

# Backend
cd python && python main.py    # Start API server on port 8002
pytest python/tests/           # Backend tests

# Database
supabase db reset              # Reset schema from migrations
supabase migration up          # Apply pending migrations
```

## Directory Structure

```
src/
  components/
    simple/              # Core analytics (PlayerSearch, MatchHistory, EloTrendGraph)
    deep/                # Advanced analysis (PersonalityRadar, LongTermPlanner, ScoreCards)
    chess/               # Chess UI (FollowUpExplorer, ModernChessArrows)
    debug/               # Diagnostic (UnifiedChessAnalysis - main game analysis view)
    ui/                  # Reusable primitives (ActionMenu, BottomSheet)
  pages/                 # React Router pages (lazy-loaded)
  services/              # API service layer (unifiedAnalysisService, autoImportService)
  lib/                   # Supabase client, config, env validation (Zod)
  utils/                 # Helpers (chessColors, chessUtils, apiCache)
  hooks/                 # Custom hooks
  contexts/              # AuthContext, ChessSoundContext
  types/                 # TypeScript type definitions (index.ts - 550+ lines)

python/core/
  unified_api_server.py        # FastAPI server - all endpoints
  analysis_engine.py           # Stockfish analysis + move classification
  config.py                    # Central config (env loading, tier detection)
  engine_pool.py               # Stockfish engine pool management
  cache_manager.py             # LRUCache + TTLDict
  error_handlers.py            # Custom exception hierarchy
  cors_security.py             # CORS configuration
  resilient_api_client.py      # HTTP client with circuit breaker + retry
  ai_comment_generator.py      # AI coaching comments (Gemini/Claude)
  personality_scoring.py       # Player personality trait scoring
  stripe_service.py            # Payment processing
  usage_tracker.py             # Rate limiting per user/tier

supabase/
  migrations/                  # Timestamped SQL migrations
  functions/                   # Edge functions
```

## Coding Conventions

### TypeScript/React
- Strict mode enabled, never use `any`
- Functional components only with hooks
- PascalCase components, camelCase functions, UPPER_SNAKE_CASE constants
- Interfaces preferred over types for component props
- Import order: external -> internal -> relative
- TailwindCSS for all styling (dark theme, mobile-first)
- Error boundaries wrap major component trees
- Zod validates env vars in `src/lib/env.ts`
- All frontend env vars require `VITE_` prefix
- Service layer pattern: all API calls go through `src/services/`
- No inline styles - use Tailwind classes

### Python/FastAPI
- Type hints on all function parameters and return types
- Google-style docstrings for public functions/classes
- snake_case files and functions, PascalCase classes
- All endpoints under `/api/v1/` prefix
- Pydantic models for request/response validation
- Custom exceptions from `error_handlers.py` (base: `ChessAnalyticsError`)
- Config loaded via: `.env.local` > `.env` > defaults (see `config.py`)
- Tier-based resource limits: free / starter / production / railway_pro
- Never expose internal errors to users - use `create_error_response()`

### Database
- snake_case tables and columns
- UUID primary keys with `gen_random_uuid()`
- Always include `created_at` and `updated_at` timestamps
- RLS enabled on all user-facing tables
- Migrations must be idempotent
- Migration naming: `YYYYMMDDHHMMSS_description.sql`
- Use parameterized queries, never string concatenation

## Critical Architecture Patterns

### Two-step game selection
Game selection fetches IDs ordered by `played_at DESC`, then re-fetches PGN data maintaining that order. This prevents a regression bug where random selection broke chronological analysis. Do not refactor into a single query.

### Cache version bumping
Cache invalidation uses version strings (currently v8). When changing analysis output format, bump the cache version in both backend config and frontend `apiCache.ts`.

### Dual API calls for stats
Frontend makes two separate API calls:
- `limit=10000` for color/opening statistics (needs large sample)
- `limit=100` for detailed analysis data (expensive per-game)
Do not consolidate these.

### Selective AI comments
AI coaching comments are generated only for critical moves (blunders, mistakes, brilliant moves), not all moves. This is intentional cost optimization.

### Rating-adjusted thresholds
Brilliant move detection uses rating-adjusted centipawn thresholds. Lower-rated players get more lenient thresholds to encourage learning.

### Circuit breaker for external APIs
External API calls (Lichess, Chess.com, Gemini, Claude) use circuit breaker pattern in `resilient_api_client.py`. Check there before adding new external integrations.

### Move classification standard
Follows chess.com naming: brilliant, best, great, excellent, good, acceptable, inaccuracy, mistake, blunder. Reference: `docs/MOVE_CLASSIFICATION_STANDARDS.md`.

## Common Pitfalls

- Backend port is **8002**, not 8001 (old docs may say 8001)
- Never hardcode API URLs - use `config.getApi().baseUrl` on frontend
- Never use `SELECT *` in production database queries
- Never forget RLS policies when adding new tables
- Never skip Pydantic validation on new backend endpoints
- `console.log` calls are stripped in production builds (vite plugin)
- Chess.com usernames are case-insensitive (lowercase); Lichess usernames are case-sensitive

## Key API Endpoints

```
POST /api/v1/analyze                      # Start batch analysis
GET  /api/v1/results/{user_id}/{platform} # Get analysis results
GET  /api/v1/stats/{user_id}/{platform}   # Get aggregated statistics
GET  /api/v1/progress/{user_id}/{platform}# Poll analysis progress
GET  /api/v1/deep-analysis/{user_id}/{platform} # Deep personality analysis
GET  /health                              # Health check
```

## Environment Variables

### Frontend (`.env.local`)
- `VITE_SUPABASE_URL` (required)
- `VITE_SUPABASE_ANON_KEY` (required)
- `VITE_ANALYSIS_API_URL` (optional, defaults to `http://localhost:8002`)
- `VITE_STRIPE_PUBLISHABLE_KEY` (required for payments)
- `VITE_DEBUG`, `VITE_LOG_LEVEL` (optional)

### Backend (`python/.env.local`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (required)
- `STOCKFISH_PATH` (auto-detected, override if needed)
- `PORT` (default: 8002)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (required for payments)
- `GEMINI_API_KEY` (for AI coaching)
- `JWT_SECRET` (min 32 chars)
- `LOG_LEVEL` (default: INFO)
