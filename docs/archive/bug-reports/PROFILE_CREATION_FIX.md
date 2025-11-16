# Profile Creation Fix

## Problem
When users tried to import games for a new player, they encountered an error:
```
Failed to select player. Please try again.
row violates the check security policy for table 'user_profiles'
```

## Root Cause
The frontend was trying to directly insert records into the `user_profiles` table using the Supabase anonymous client. However, the database has Row Level Security (RLS) policies that only allow the `service_role` to insert into `user_profiles`:

```sql
-- Only service_role can insert
create policy "user_profiles_insert_service"
on "public"."user_profiles"
as permissive
for insert
to service_role
with check (true);
```

The frontend's anonymous client doesn't have permission to insert profiles, causing the security policy violation.

## Solution
Created a backend API endpoint that uses the service role key to handle profile creation:

### 1. Backend Endpoint (`/api/v1/profiles`)
**File:** `python/core/unified_api_server.py`

Added a new POST endpoint that:
- Accepts `user_id`, `platform`, and optional `display_name`
- Uses `supabase_service` (service role client) to query and create profiles
- Returns the profile after creation or update

```python
@app.post("/api/v1/profiles")
async def get_or_create_profile(request: dict):
    """Get or create a user profile using service role access."""
    # ... implementation ...
```

### 2. Frontend Service Update
**File:** `src/services/profileService.ts`

Updated `ProfileService.getOrCreateProfile()` to:
- Call the backend API instead of direct database access
- Use the `VITE_ANALYSIS_API_URL` environment variable
- Handle errors properly and display meaningful messages

```typescript
static async getOrCreateProfile(
  userId: string,
  platform: 'lichess' | 'chess.com',
  displayName?: string
): Promise<UserProfile> {
  // Calls backend API at ${API_BASE_URL}/api/v1/profiles
}
```

## How It Works Now
1. User searches for a player (e.g., "lakis5")
2. Frontend calls `ProfileService.getOrCreateProfile()`
3. Frontend makes HTTP POST to `/api/v1/profiles` on the backend
4. Backend uses service role to check if profile exists
5. If exists, backend updates `last_accessed` and returns it
6. If not exists, backend creates new profile with defaults
7. Profile is returned to frontend
8. User can now import games successfully

## Security Benefits
- Frontend never has direct write access to `user_profiles`
- All profile creation goes through backend validation
- Service role is only used in backend, never exposed to client
- RLS policies remain secure and restrictive

## Testing
To test the fix:
1. Restart the backend server to load the new endpoint
2. Open the application in browser
3. Search for a new player that doesn't exist in database
4. Profile should be created successfully
5. Games import should proceed without errors

## Files Changed
- `python/core/unified_api_server.py` - Added `/api/v1/profiles` endpoint
- `src/services/profileService.ts` - Updated to use backend API instead of direct DB access

## Environment Variables Required
- `VITE_ANALYSIS_API_URL` - Should point to backend server (e.g., `http://localhost:8000`)
- `SUPABASE_SERVICE_ROLE_KEY` - Backend needs this to create profiles (already configured)
