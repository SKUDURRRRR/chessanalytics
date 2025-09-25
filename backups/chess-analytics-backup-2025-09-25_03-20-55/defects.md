# Defect & Risk Report

- [D-001] Blocker — .env:6; src/lib/env.ts:5,9 — bug/config
  - **Evidence**: `envSchema` marks `VITE_ANALYSIS_API_URL` as `z.string().url(...)` while `.env` currently sets `http://localhost:8002!`, which fails Zod validation and throws during app bootstrap.
  - **Root Cause**: Trailing `!` in the committed environment example (and likely developer envs) creates an invalid URL string.
  - **FIX PLAN**: Correct the sample/env values (`http://localhost:8002`), regenerate `.env.example`, and add lint/test that `npm run validate-env`/`npm run typecheck` run as part of CI to prevent regressions.

- [D-002] Blocker — python/core/config.py:14; python/core/unified_api_server.py:55 — bug/config
  - **Evidence**: `load_dotenv((Path(__file__).resolve().parent.parent / '.env'))` loads the frontend `.env` instead of `python/.env`, so Supabase settings resolve to empty strings. Runtime logs confirm fallback: `⚠️  Database configuration not found. Using mock clients for development.`
  - **Root Cause**: Mis-targeted dotenv path ignores backend-specific configuration, leaving the API without DB credentials even when `python/.env` exists.
  - **FIX PLAN**: Point `load_dotenv` to `Path(__file__).resolve().parent / '..' / '.env'` (or allow injecting a path), honour `python/.env`, and add tests that `get_config()` emits populated values when backend env vars are present.

- [D-003] Blocker — python/.env:1-32 — security
  - **Evidence**: File checked into git with real Supabase anon & service keys plus JWT secret and Stockfish paths (lines 1-32). Service-role key is especially sensitive.
  - **Root Cause**: Secrets committed to the repository and referenced directly instead of using secret management / ignored files.
  - **FIX PLAN**: Remove the file from version control, rotate Supabase keys, provide `.env.example` guidance, and update `.gitignore` & docs to keep secrets local-only.

- [D-004] Blocker — supabase/migrations (missing game_analyses/move_analyses/game_features) — bug/db
  - **Evidence**: `rg "CREATE TABLE .*game_analyses" supabase/migrations` returns no results, yet migrations such as `20241220_complete_rls_policies.sql` reference those tables. Running `supabase db reset` fails because required tables are absent.
  - **Root Cause**: Core analysis tables were never added (or were removed) from the migration set while downstream code and policies still depend on them.
  - **FIX PLAN**: Author forward-only migrations that create `game_analyses`, `move_analyses`, and `game_features` with the documented schema, re-run policy migrations, and add regression tests (`supabase db reset` in CI) to ensure bootstrap succeeds.

- [D-005] Major — supabase/migrations/20241220_consolidate_schema_final.sql:76-80 — bug/db
  - **Evidence**: Migration recreates `user_profiles` with `user_id TEXT UNIQUE NOT NULL`, eliminating the `(user_id, platform)` composite uniqueness required for multi-platform support.
  - **Root Cause**: Later consolidation migration diverged from the original schema, forcing a global unique index on `user_id`.
  - **FIX PLAN**: Replace with a composite unique constraint `(user_id, platform)`, include a follow-up migration to fix existing indexes, and add regression tests in diagnostics utilities to assert per-platform duplicates are allowed.

- [D-006] Major — supabase/migrations/20241220_create_games_pgn_table.sql:45 — security
  - **Evidence**: The migration ends with `GRANT ALL ON games_pgn TO anon;`, allowing unauthenticated clients to insert/update/delete raw PGNs.
  - **Root Cause**: Overly permissive grant intended for reads only.
  - **FIX PLAN**: Restrict anon role to `SELECT` (or remove entirely), ensure write operations use authenticated/service roles, and document the security posture.

- [D-007] Major — src/services/autoImportService.ts:312-315 — bug/data
  - **Evidence**: After import, the profile updater runs `.update({ total_games: savedGames, ... })`, overwriting cumulative totals with the size of the most recent batch.
  - **Root Cause**: Using the number of games imported in the current run rather than persisting the actual total from Supabase.
  - **FIX PLAN**: Fetch the current totals (or derive from Supabase counts) and increment appropriately, adding unit tests around `importLast100Games` to verify totals are cumulative.

- [D-008] Major — src/services/autoImportService.ts:69 — bug/dx
  - **Evidence**: Chess.com validation fetches `http://localhost:8002/proxy/chess-com/...` directly, hard-coding localhost and HTTP.
  - **Root Cause**: Service bypasses the runtime configuration (`config.getApi().baseUrl`), so non-local deployments cannot validate Chess.com users.
  - **FIX PLAN**: Drive all API calls through the configured analysis API base URL, reuse the central config helper, and cover with integration tests that respect environment overrides.

- [D-009] Major — src/services/profileService.ts:35-74 — bug/data
  - **Evidence**: `getOrCreateProfile` and related helpers query/insert using the raw `userId`, whereas Chess.com usernames should be lowercased (see `AutoImportService.normalizeUsername`).
  - **Root Cause**: Lack of shared normalization between profile and import services causes duplicate rows and mismatched lookups for case-insensitive platforms.
  - **FIX PLAN**: Introduce a shared `normalizeUserId` helper, apply it across profile CRUD/update methods, and add regression tests covering case-variant usernames.

- [D-010] Major — .github/workflows/ci.yml:49-53 — bug/dx
  - **Evidence**: CI runs `npm run test:contract`, `test:fe`, `test:import`, `test:parity`, `test:rls`, none of which exist in `package.json` (verified via scripts list).
  - **Root Cause**: Workflow copied from a different project without aligning to available npm scripts, so CI will fail immediately.
  - **FIX PLAN**: Update the workflow to run the real commands (`npm run lint`, `npm run typecheck`, `npm run test`, `npm run e2e`, etc.), add Supabase service bootstrapping, and gate merges on passing jobs.

- [D-011] Major — src/services/autoImportService.ts:343-345 — type
  - **Evidence**: Import result returns `errors: errors as unknown as string[]` while `errors` is a numeric counter, producing a runtime type mismatch and confusing API consumers/tests.
  - **Root Cause**: Interface `ImportResult.errors` was defined as `string[]`, but implementation kept a counter and force-cast it.
  - **FIX PLAN**: Decide on the desired type (array vs count), adjust the interface and implementation accordingly, and extend unit tests to assert the error payload shape.

- [D-012] Minor — supabase/sql/health.sql:68 — bug
  - **Evidence**: Health check flags invalid platforms using `platform NOT IN ('lichess', 'chesscom')`; the schema stores `'chess.com'`, so every Chess.com row is treated as invalid.
  - **Root Cause**: Typo in the validation SQL.
  - **FIX PLAN**: Update the health script to reference `'chess.com'`, add regression coverage (SQL test) to keep checks aligned with enum constraints.

- [D-013] Minor — src/lib/env.ts:88-93 — security
  - **Evidence**: Development log prints `SUPABASE_URL` and `API_URL` to the console alongside other envs, broadcasting credentials whenever the module loads.
  - **Root Cause**: Debug logging left in production bundle path; even though anon keys are public, logging credentials is discouraged and noisy.
  - **FIX PLAN**: Remove or behind a debug flag for sensitive env logging, and document logging expectations in CONTRIBUTING.
