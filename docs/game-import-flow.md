# Game Import Flow

This document captures how a game import moves through Chess Analytics so future breakages can be traced quickly. The flow spans the React frontend, a FastAPI backend, and Supabase persistence.

## Key Actors & Files
- **Frontend UI**
  - `src/components/simple/PlayerSearch.tsx` handles the search + manual import prompt.
  - `src/pages/SimpleAnalyticsPage.tsx` exposes the "Import Latest Games" button for existing profiles.
- **Frontend services**
  - `src/services/autoImportService.ts` orchestrates validation, remote fetches, parsing, and the import API call.
  - `src/services/profileService.ts` is used to seed or update `user_profiles` before analytics run.
- **Backend API**
  - `python/core/unified_api_server.py` (see `BulkGameImportRequest` and `/api/v1/import/games`) receives prepared payloads and writes to Supabase using a service-role key.
- **Supabase tables**
  - `games` stores per-game metadata (result, ratings, timing, opening).
  - `games_pgn` stores the raw PGN.
  - `user_profiles` stores import metadata (`total_games`, `last_accessed`, `display_name`).

## Lifecycle of an Import
1. **User action**
   - PlayerSearch prompts manual import when no cached profile is found.
   - SimpleAnalyticsPage exposes an import button for already-selected users.
2. **Username canonicalisation** (`normalizeUserId`)
   - `chess.com` usernames are trimmed + lowercased; Lichess names retain case. This same helper is used across the frontend and backend.
3. **Platform validation**
   - Lichess: direct fetch `https://lichess.org/api/user/{username}`.
   - Chess.com: frontend hits `GET {API_BASE_URL}/proxy/chess-com/{username}` to avoid browser CORS.
4. **Duplicate check**
   - `AutoImportService.checkUserExists` queries Supabase `user_profiles` to warn users if data already exists before an import.
5. **Game retrieval** (`fetchGamesFromPlatform`)
   - Lichess: downloads NDJSON or PGN via `https://lichess.org/api/games/user/{username}` (max=100, preferring JSON via `pgnInJson=true`).
   - Chess.com: loops through the last 12 months calling the FastAPI proxy (`/proxy/chess-com/{username}/games/{year}/{month}`), trimming once `maxGames` is reached.
6. **PGN parsing**
   - Each PGN is parsed client-side (`parsePGNForGameInfo`) to extract result, colour, ratings, opening, time control, and a canonical played date. Parsing failures accumulate warnings but do not block other games.
7. **POST import payload**
   - Frontend builds `BulkGameImportRequest` and `fetch`es `POST {API_BASE_URL}/api/v1/import/games` with:
     ```json
     {
       "user_id": "canonical username",
       "platform": "lichess|chess.com",
       "display_name": "platform display name",
       "games": [ { provider_game_id, pgn, parsed metadata } ]
     }
     ```
   - Progress updates surface to the UI (`ImportProgress` callbacks).
8. **Backend persistence** (`/api/v1/import/games`)
   - Calls `_canonical_user_id` to repeat the chess.com lowercasing.
   - Upserts `games` (conflict target: `user_id,platform,provider_game_id`).
   - Upserts `games_pgn` with the same conflict key.
   - Counts imported rows to update/display and upserts `user_profiles` (refreshing `total_games`/`last_accessed`).
9. **Follow-up analysis**
   - On success the frontend immediately invokes `POST /api/v1/analyze` (basic analysis) so charts populate without extra clicks.

## Expected Data Outcomes
- **games**: one row per imported match with canonical `user_id` and provider metadata.
- **games_pgn**: mirrors `games` `provider_game_id` with raw PGN text.
- **user_profiles**: `total_games` reflects current count; `display_name` defaults to platform username if nothing better.
- Game-specific analytics (e.g. `game_features`) are wiped and re-produced when running `AutoImportService.reimportGames`.

## Configuration Prerequisites
- Frontend `VITE_ANALYSIS_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` must be valid (see `src/lib/env.ts`).
- Backend `.env` must supply `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and ideally `SUPABASE_SERVICE_ROLE_KEY` so upserts succeed.
- CORS must allow the frontend origin (`cors_config.allowed_origins` in `python/core/unified_api_server.py`).

## Troubleshooting Checklist
1. **Frontend progress stalls at validation** -> Confirm platform API is reachable (check browser console/network).
2. **Import API 503** -> Backend missing Supabase credentials (`supabase_service` is `None`).
3. **Games not persisted** -> Inspect backend logs for `[import_games]` messages; verify conflict keys are correct.
4. **Profiles not updated** -> Ensure `_canonical_user_id` matches `normalizeUserId`; mismatches usually mean a casing bug.
5. **Analysis never starts** -> Check `/api/v1/analyze` response; failures are logged in the browser console and backend.
6. **Chess.com imports empty** -> Proxy may be blocked; verify FastAPI server can reach `https://api.chess.com` and that the month loop still points at recent archives.
7. **Lichess imports empty** -> Their API may rate-limit; inspect response status (logged in console) and try with a personal token if necessary.

Keeping this map handy should make it faster to diagnose which layer regressed whenever game imports misbehave.
