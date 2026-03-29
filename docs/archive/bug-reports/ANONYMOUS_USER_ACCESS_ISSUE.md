# Anonymous User Access Issue - Import & Analysis Not Working

## Problem Summary

**User Observation:**
- User "skudurrrrr" is NOT logged in (visitor/anonymous user)
- Auto-import didn't work
- Analysis didn't work
- Button changes to "Analyze games" but nothing happens

## Root Cause Analysis

### The System Design Intent
Based on `docs/SECURITY_FIX_CORRECTED.md`, this application is designed as a **PUBLIC CHESS ANALYTICS TOOL**:

1. Anonymous user visits the site ✅
2. Enters any chess player's username (e.g., "Magnus Carlsen") ✅
3. App imports that player's games from Chess.com/Lichess ❌ (BLOCKED)
4. App analyzes the games ❌ (BLOCKED)
5. **Anyone can view anyone's data** - all analytics are public ✅ (for existing data)

### What's Blocking Anonymous Users?

#### RLS Policy Issue (`20250115000001_enable_rls_games.sql`)

```sql
-- Line 34-35:
REVOKE ALL ON public.games FROM anon;
GRANT ALL ON public.games TO authenticated;
```

**This revokes ALL permissions from anonymous users**, including:
- ❌ Cannot INSERT games (import fails)
- ❌ Cannot SELECT games (viewing fails)
- ❌ Cannot access game analysis data

### Backend Architecture

The backend **correctly** uses `service_role` key for database operations:

```python
# unified_api_server.py
if config.database.service_role_key:
    supabase_service: Client = create_client(
        str(config.database.url),
        config.database.service_role_key
    )
```

**Service role bypasses RLS**, so the backend CAN:
- ✅ Insert games to database
- ✅ Insert analysis results
- ✅ Read any data

But there's a problem...

### The Missing Link

The backend endpoints ARE designed to work for anonymous users:

```python
# Import endpoint
async def import_games_simple(
    request: Dict[str, Any],
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
):
    # Check usage limits for authenticated users
    auth_user_id = None
    try:
        if credentials:
            token_data = await verify_token(credentials)
            # ... check limits ...
    except Exception as e:
        # Log but don't fail - allow anonymous/failed auth to proceed
        print(f"Auth check failed (non-critical): {e}")
```

**Credentials are OPTIONAL** - anonymous users should be able to proceed.

### Why It Still Fails

1. **Frontend might be making direct Supabase queries** with anon key
2. **Auto-import might rely on client-side database access**
3. **RLS policies block anonymous users from reading their imported data**

## The Solution

### Option 1: Grant Anonymous Read Access (Recommended for Public Tool)

If the app is truly meant to be a public analytics tool where anyone can view any data:

```sql
-- Allow anonymous users to read all data
GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.games_pgn TO anon;
GRANT SELECT ON public.move_analyses TO anon;
GRANT SELECT ON public.game_analyses TO anon;
GRANT SELECT ON public.user_profiles TO anon;

-- Add RLS policies for anonymous SELECT
CREATE POLICY "games_select_all_anon" ON public.games
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "games_pgn_select_all_anon" ON public.games_pgn
    FOR SELECT TO anon
    USING (true);

-- etc. for other tables
```

**BUT keep INSERT/UPDATE/DELETE blocked:**

```sql
-- Anonymous users CANNOT write to database directly
-- (only backend with service_role can write)
```

### Option 2: Require Authentication (Recommended for Private Tool)

If users must be logged in to use the tool:

1. **Frontend**: Show "Sign in to import/analyze" message for anonymous users
2. **Backend**: Return 401 Unauthorized for anonymous requests
3. **Update UI**: Disable import/analyze buttons when not logged in

```typescript
// SimpleAnalyticsPage.tsx
if (!user) {
  return (
    <div className="text-center">
      <h2>Sign in to analyze games</h2>
      <Link to="/login">Sign In</Link>
    </div>
  )
}
```

### Option 3: Hybrid Approach

- **Anonymous users**: Can VIEW data, limited imports/analysis
- **Authenticated users**: Full access with usage tracking
- **Pro users**: Unlimited

```python
# Backend logic
if auth_user_id:
    # Check tier limits
    can_proceed, stats = await usage_tracker.check_import_limit(auth_user_id)
    if not can_proceed:
        raise HTTPException(429, "Limit reached")
else:
    # Anonymous: strict rate limiting, smaller limits
    _enforce_rate_limit(user_key, strict_limit=10)
```

## Current State Analysis

### What Works ✅
- Backend has service_role access
- Backend can write to database
- Authenticated users can import/analyze
- Backend endpoints accept optional auth

### What's Broken ❌
- Anonymous users cannot view games (RLS blocks SELECT)
- Anonymous users might not be able to trigger imports
- Auto-import might rely on client-side database access
- Frontend might error when fetching data as anonymous user

## Testing the Issue

### Test 1: Check Backend Logs

When anonymous user clicks "Import" or "Analyze", check backend logs:

```bash
# Look for these patterns:
[info] import_games_simple called for user_id=skudurrrrr, platform=chess.com
Auth check failed (non-critical): ...
[info] Fetching games from Chess.com for skudurrrrr
[error] Database write failed: new row violates row-level security policy
```

If you see RLS policy violations, the service_role key is not being used correctly.

### Test 2: Check Frontend Errors

Open browser console and look for:

```
Failed to fetch games: 403 Forbidden
Error: new row violates row-level security policy for table "games"
```

### Test 3: Check Database Permissions

```sql
-- Check what permissions anon has
SELECT table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'anon'
AND table_schema = 'public'
AND table_name IN ('games', 'games_pgn', 'move_analyses')
ORDER BY table_name, privilege_type;
```

Expected for **public tool**:
```
games       | SELECT
games_pgn   | SELECT
```

Expected for **private tool**:
```
(no rows)
```

## Recommended Actions

### Immediate Fix (Public Tool Model)

1. **Grant anonymous users SELECT permissions:**

```sql
-- File: supabase/migrations/20250131000001_allow_anon_read_access.sql

-- Grant SELECT to anonymous users for public data viewing
GRANT SELECT ON public.games TO anon;
GRANT SELECT ON public.games_pgn TO anon;
GRANT SELECT ON public.move_analyses TO anon;
GRANT SELECT ON public.game_analyses TO anon;
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT ON public.unified_analyses TO anon;

-- Create RLS policies for anonymous SELECT
CREATE POLICY "games_select_all_anon" ON public.games
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "games_pgn_select_all_anon" ON public.games_pgn
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "move_analyses_select_all_anon" ON public.move_analyses
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "game_analyses_select_all_anon" ON public.game_analyses
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "user_profiles_select_all_anon" ON public.user_profiles
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "unified_analyses_select_all_anon" ON public.unified_analyses
    FOR SELECT TO anon
    USING (true);

-- IMPORTANT: Keep INSERT/UPDATE/DELETE blocked for anonymous users
-- These operations should only be done by backend with service_role
```

2. **Verify backend is using service_role key:**

```bash
# Check .env file
echo $SUPABASE_SERVICE_ROLE_KEY
```

3. **Test as anonymous user:**
- Visit site without logging in
- Enter a username
- Click "Import games"
- Check if import works
- Click "Analyze games"
- Check if analysis works

### Alternative Fix (Private Tool Model)

If you want to require authentication:

1. **Update frontend to check auth status:**

```typescript
// src/pages/SimpleAnalyticsPage.tsx
import { useAuth } from '../contexts/AuthContext'

export default function SimpleAnalyticsPage() {
  const { user, loading } = useAuth()

  if (loading) return <div>Loading...</div>

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Sign in required</h1>
        <p className="mb-4">You must be signed in to analyze games.</p>
        <Link to="/login" className="btn-primary">Sign In</Link>
      </div>
    )
  }

  // ... rest of component
}
```

2. **Update backend to require auth:**

```python
# Change Optional to Required
async def import_games_simple(
    request: Dict[str, Any],
    credentials: HTTPAuthorizationCredentials = Depends(security)  # Remove Optional
):
    token_data = await verify_token(credentials)  # Will raise 401 if missing
    # ... rest of function
```

## Conclusion

**The core issue:** RLS policies block anonymous users from reading data, and possibly from triggering backend operations.

**Choose your model:**
1. **Public tool**: Grant anonymous SELECT, keep writes service-role only
2. **Private tool**: Require authentication for all operations

**Current state:** The code suggests public tool intent, but RLS policies enforce private tool behavior.

**Resolution:** Align RLS policies with the intended user experience.
