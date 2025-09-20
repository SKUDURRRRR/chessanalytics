# Chess Analytics System Map

## Architecture Overview
```
                  +------------------------------+
                  |  React SPA (Vite + TS)       |
                  |  src/main.tsx / App.tsx      |
                  |  - PlayerSearch / MatchHistory|
                  |  - SimpleAnalytics dashboard |
                  |  - DeepAnalysis area         |
                  +---------------+--------------+
                                  | (supabase-js anon key)
                                  v
       +--------------------------+--------------------------+
       |        Supabase Postgres (managed)                  |
       |  Tables: games, user_profiles, games_pgn, *(missing |
       |           game_analyses/move_analyses/game_features)|
       |  Views: unified_analyses, combined_game_analysis    |
       |  Edge Functions (Deno): analytics, parity, imports  |
       +--------------------------+--------------------------+
                                  ^
                                  | (REST over HTTPS / service key)
                  +---------------+--------------+
                  |  Python API (FastAPI)        |
                  |  python/core/unified_api     |
                  |  - Unified /api/v1 endpoints |
                  |  - Background Stockfish jobs |
                  |  - Supabase client (anon/service)|
                  +---------------+--------------+
                                  ^
                                  | (fetch from frontend)
                                  |
                        External services
                     -----------------------
                     |  Lichess REST API   |
                     |  Chess.com REST API |
                     |  Local Stockfish    |
                     -----------------------
```

## Runtime Components
- **Frontend**: Vite-powered React SPA (TypeScript). Router lives in `src/App.tsx`; state via hooks and a custom `AuthContext` that wraps Supabase auth.
- **Services layer** (`src/services/*`): wraps fetch calls to the Python API (`analysisService`, `unifiedAnalysisService`) and direct Supabase queries (`profileService`, `autoImportService`, `deepAnalysisService`).
- **Backend API**: `python/core/unified_api_server.py` (FastAPI) exposes unified analysis endpoints, coordinates Stockfish via `analysis_engine.py`, and persists results to Supabase using the service-role key when available.
- **Data tier**: Supabase Postgres schema + Row Level Security policies, plus a `games_pgn` table for raw PGNs and `unified_analyses`/`combined_game_analysis` views for reporting.
- **Edge functions**: Deno functions under `supabase/functions` provide lightweight analytics endpoints that the frontend can call directly via Supabase.
- **Tooling**: Vitest/Jest DOM for unit tests, Playwright config present for E2E, GitHub Actions workflow (`.github/workflows/ci.yml`), Supabase CLI scripts, Python uses Uvicorn for dev server.

## Request & Data Flow
- **Player lookup**: `PlayerSearch` queries Supabase directly for cached profiles and offers auto-import. Auto-import validates usernames against Lichess/Chess.com (direct HTTP or via FastAPI proxy) and populates `games`, `games_pgn`, and profile metadata via Supabase upserts. It may also trigger analysis jobs through `AnalysisService.startAnalysis`.
- **Analysis workflow**:
  1. Frontend hits `POST {VITE_ANALYSIS_API_URL}/api/v1/analyze` (`AnalysisService` or `UnifiedAnalysisService`).
  2. FastAPI validates inputs, enqueues `_perform_batch_analysis` background task, and returns an `analysis_id`.
  3. Background task reads PGNs from `games_pgn`, runs Stockfish via `ChessAnalysisEngine`, and persists summaries to Supabase tables (intended: `game_analyses`, `move_analyses`, `game_features`). It also updates in-memory `analysis_progress` for UI polling.
  4. Frontend polls `/api/v1/progress/{user}/{platform}` and refreshes stats via `/api/v1/stats/...` and `/api/v1/results/...`.
- **Dashboards**: Components such as `SimpleAnalytics`, `AnalyticsBar`, and `MatchHistory` either call the FastAPI stats endpoint or query Supabase directly (`supabase.from('games')`, `unified_analyses`). Deep analysis UI currently derives results from Supabase tables rather than the Python endpoint (which returns placeholder data).
- **Diagnostics**: `DatabaseDiagnosticsComponent` aggregates Supabase checks via helper utilities (`src/utils/databaseDiagnostics.ts`, `databaseQuery.ts`). Console-heavy logging is used for troubleshooting.

## Entry Points & Key Modules
- `src/main.tsx`: React bootstrap (StrictMode) rendering `App`.
- `src/App.tsx`: React Router configuration for `/`, `/search`, `/simple-analytics`, and `/profile/:userId/:platform`, wrapped in page/component error boundaries.
- Contexts: `AuthContext` handles Supabase session state.
- Services: `analysisService`, `unifiedAnalysisService`, `profileService`, `autoImportService`, `deepAnalysisService`.
- Utilities: `src/lib/env.ts` (Zod env validation), `config.ts` (central configuration manager), `supabase.ts` (singleton client), error handling helpers, `utils/` (analytics diagnostics, formatting helpers).
- Python backend: `python/main.py` (uvicorn entry), `core/unified_api_server.py` (routing & orchestration), `analysis_engine.py` (Stockfish integration), `config.py` (env loader), `env_validation.py`, `cors_security.py`, `error_handlers.py`.
- Supabase artifacts: SQL migrations in `supabase/migrations`, helper SQL in `supabase/sql`, edge functions in `supabase/functions/*`.

## Database Schema (Supabase)
- **games**: Imported game metadata (`user_id`, `platform`, `provider_game_id`, results, ratings, timestamps). Unique index on `(user_id, platform, provider_game_id)`; RLS intended to scope to owner.
- **games_pgn**: Raw PGNs (unique on user/platform/game). Currently grants full access to `anon` role.
- **user_profiles**: Cached profile data (`display_name`, ratings, totals, last_accessed`). Conflicting definitions create uniqueness on `user_id` only in latest migration.
- **Intended but missing in repo**: `game_analyses`, `move_analyses`, `game_features` tables referenced throughout services, migrations, and docs but no DDL present. Corresponding RLS migrations assume they exist. Views `unified_analyses` and `combined_game_analysis` union data from those tables when available.
- **Indexes/Policies**: Numerous policies defined in `20241220_complete_rls_policies.sql` covering CRUD per table, plus helper functions for RLS validation.

## External Integrations & Dependencies
- **Supabase**: `@supabase/supabase-js` on frontend; Supabase Python client on backend. Requires anon key for client, service role for server writes.
- **Stockfish**: Bundled binary in `stockfish/`; Python engine wrapper orchestrates depth/skill configuration.
- **Lichess API**: Used by `AutoImportService` to fetch latest games directly from the browser.
- **Chess.com API (proxied)**: Frontend hits FastAPI proxy endpoints (`/proxy/chess-com/...`) to bypass CORS and rate limits.
- **React ecosystem**: `react-router-dom`, `recharts` for charts, Tailwind CSS classes for styling.
- **Testing**: `vitest` + Testing Library, `@playwright/test` (configured but no scripts wired), Supabase CLI (`supabase db ...`).

## Configuration & Environments
- Frontend env: `.env` & `env.ts` demand valid URLs for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ANALYSIS_API_URL`. Validation happens at module load and throws on failure.
- Backend env: `python/.env` (currently committed with secrets) and `python/core/config.py` (loads `../.env`, i.e., the frontend file). Missing or malformed values fall back to mock clients causing the API to operate in degraded mode.
- Scripts: `npm run dev/build/start/typecheck/lint/format/test/e2e`, Playwright config, Supabase CLI helpers (`db:reset`, `db:push`, `db:diff`), PowerShell helpers to start backend.

## Observability & Diagnostics
- Extensive console logging with emoji markers in both TS and Python for tracing flows (env load, API calls, database diagnostics).
- `tests/setup.ts` turns console methods into spies to keep unit tests quiet.
- No centralized metrics/log aggregation; relies on manual diagnostics components and CLI scripts (`validate-env.js`, `supabase/sql/health.sql`).

## Test & Automation Footprint
- Unit tests under `tests/` (components/services) rely on mocks; coverage for analytics logic is thin.
- Playwright config (`playwright.config.ts`) exists but `package.json` lacks `e2e` wiring in CI.
- GitHub Actions workflow `ci.yml` attempts multi-stage checks but references non-existent npm scripts (`test:contract`, `test:fe`, etc.).
