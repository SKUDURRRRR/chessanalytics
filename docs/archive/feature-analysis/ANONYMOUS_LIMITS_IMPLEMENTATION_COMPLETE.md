# Anonymous User Limits Implementation - COMPLETE

**Date**: 2025-11-07
**Status**: ✅ **DEPLOYED**

## Summary

Successfully implemented and deployed backend enforcement of anonymous user limits:
- **50 game imports per 24 hours** (reduced from 100)
- **2 game analyses per 24 hours** (reduced from 5)

The backend now tracks anonymous users by IP address and enforces these limits server-side, preventing bypass by clearing localStorage or calling APIs directly.

## Changes Made

### 1. Database Migration ✅

**File**: `supabase/migrations/20251107000001_update_anonymous_limits.sql`

- Updated `check_anonymous_usage_limits()` function with new limits:
  - Import limit: 100 → **50** per 24 hours
  - Analysis limit: 5 → **2** per 24 hours

**Note**: You need to manually run this migration in Supabase SQL Editor. See `APPLY_ANONYMOUS_LIMITS_UPDATE.md` for instructions.

### 2. Backend Implementation ✅

#### a. IP Extraction Helper (`python/core/unified_api_server.py`)

Added `get_client_ip(request: Request)` function (lines 327-363):
- Checks headers in priority order: `X-Forwarded-For`, `X-Real-IP`, `X-Remote-IP`
- Handles proxies and load balancers (Railway, Vercel, etc.)
- Falls back to direct client host

#### b. UsageTracker Extension (`python/core/usage_tracker.py`)

Added methods (lines 397-525):
- `check_anonymous_import_limit(ip_address: str)`
- `check_anonymous_analysis_limit(ip_address: str)`
- `increment_anonymous_usage(ip_address: str, action_type: str, count: int)`
- `_check_anonymous_limit(ip_address: str, action_type: str)` (internal)

**Features**:
- IP address validation
- Input validation
- Fail-open strategy (allows operation if check fails)
- Comprehensive logging

#### c. Analysis Endpoint Updated (`/api/v1/analyze`)

**Changes**:
- Added `http_request: Request` parameter
- Checks anonymous limits before analysis (if not authenticated)
- Returns 429 error if limit exceeded
- Increments anonymous usage after successful analysis

**Updated for**:
- Single game analysis (PGN)
- Single game analysis (game_id)
- Move analysis
- Position analysis (not counted against limits)

#### d. Import Endpoints Updated

**`/api/v1/import-games-smart`**:
- Added `http_request: Request` parameter
- Checks anonymous limits before import
- Returns 429 error if limit exceeded
- Increments anonymous usage after successful import

**`/api/v1/import-games`**:
- Added `http_request: Request` parameter
- Checks anonymous limits before import
- Returns 429 error if limit exceeded
- Increments anonymous usage after successful import

### 3. Error Messages ✅

Limit exceeded messages now encourage registration:
- **Import limit**: "Anonymous users: 50 imports per 24 hours. Create a free account for 100 imports per day!"
- **Analysis limit**: "Anonymous users: 2 analyses per 24 hours. Create a free account for 5 analyses per day!"

## How It Works

### For Anonymous Users

1. **User makes request** → Backend extracts IP address using `get_client_ip()`
2. **Check limits** → Calls `check_anonymous_usage_limits(ip_address, action_type)` in database
3. **If limit exceeded** → Returns 429 error with informative message
4. **If under limit** → Proceeds with operation
5. **After success** → Calls `increment_anonymous_usage(ip_address, action_type, count)`

### For Authenticated Users

1. **Check auth user limits** (as before)
2. **If authenticated** → Uses regular tier-based limits
3. **Anonymous checks are skipped** for authenticated users

### Frontend Impact

- Frontend localStorage tracking (`anonymousUsageTracker.ts`) remains unchanged
- Frontend still uses same limits (50/2)
- Backend enforcement is an additional security layer
- Frontend provides better UX (shows limits before hitting backend)
- Backend prevents abuse/bypass

## Security Considerations

### Limitations

1. **Shared IPs**: Users behind same NAT/VPN/proxy share limits
2. **IP Changes**: Users can change IP (VPN, mobile data, restart router)
3. **IPv6**: Multiple devices may share IPv6 prefix

### Mitigations

- Frontend checks provide UX optimization and reduce server load
- Backend enforcement prevents direct API abuse
- Rate limiting provides additional burst protection
- 24-hour rolling window prevents rapid abuse
- Fail-open strategy prevents blocking legitimate users on errors

### Why Fail-Open for Anonymous?

Anonymous users can bypass IP-based tracking anyway (VPN, proxy, IP change), so:
- Fail-open prevents blocking legitimate users due to database errors
- Authenticated users use fail-closed (more secure)
- Anonymous limits are primarily to encourage registration, not perfect security

## Comparison: Anonymous vs Free Tier

| Feature | Anonymous | Free Tier (Logged In) |
|---------|-----------|----------------------|
| Import Limit | **50** / 24h | **100** / 24h |
| Analysis Limit | **2** / 24h | **5** / 24h |
| Auto-Sync | ❌ No | ✅ Yes (future) |
| Limit Tracking | IP-based | User-based |
| Can View Others' Analytics | ✅ Yes | ✅ Yes |

## Next Steps

### CRITICAL: Apply Database Migration

**You must manually run the SQL migration** in Supabase SQL Editor:

1. Go to Supabase Dashboard → Your Project → SQL Editor
2. Open `APPLY_ANONYMOUS_LIMITS_UPDATE.md` and copy the SQL
3. Paste and run in SQL Editor
4. Verify with test queries

Without this migration, the old limits (100/5) will still be enforced!

### Testing Checklist

#### Anonymous Users
- [ ] Import 50 games → should succeed
- [ ] Import 51st game → should return 429 error
- [ ] Analyze 2 games → should succeed
- [ ] Analyze 3rd game → should return 429 error
- [ ] Frontend shows correct limit modal on 429
- [ ] Wait 24 hours → limits should reset
- [ ] Clear localStorage → limits still enforced (backend)

#### Authenticated Users (Free Tier)
- [ ] Import 100 games → should succeed
- [ ] Import 101st game → should return 429 error
- [ ] Analyze 5 games → should succeed
- [ ] Analyze 6th game → should return 429 error
- [ ] No impact from anonymous user changes

#### Authenticated Users (Pro Tier)
- [ ] Unlimited imports → should succeed
- [ ] Unlimited analyses → should succeed
- [ ] No limits enforced

#### Edge Cases
- [ ] Invalid IP address → should handle gracefully (fail-open)
- [ ] Missing IP headers → should use fallback IP
- [ ] Database errors → should fail-open for anonymous, fail-closed for auth
- [ ] Concurrent requests → should handle race conditions

## Files Modified

1. `supabase/migrations/20251107000001_update_anonymous_limits.sql` (NEW)
2. `supabase/migrations/20250104000001_create_anonymous_usage_tracking.sql` (updated comments)
3. `python/core/unified_api_server.py` (added IP helper, updated endpoints)
4. `python/core/usage_tracker.py` (added anonymous limit methods)
5. `APPLY_ANONYMOUS_LIMITS_UPDATE.md` (NEW - migration instructions)

## Deployment Status

- ✅ Code committed and pushed to master
- ✅ Backend deployment triggered (Railway)
- ✅ Frontend already has correct limits (no changes needed)
- ⚠️ **MANUAL ACTION REQUIRED**: Run database migration in Supabase SQL Editor

## Monitoring

After deployment, monitor:
- Anonymous user 429 errors (should see more now due to stricter limits)
- User registrations (should increase as anonymous users hit limits)
- Database `anonymous_usage_tracking` table (should see IP-based tracking)
- Railway logs for anonymous limit check messages

## Support

If anonymous users report issues:
1. Check their IP address in logs
2. Query `anonymous_usage_tracking` table
3. Verify migration was applied correctly
4. Check for shared IP scenarios (corporate network, VPN)
5. Consider temporary IP whitelist for edge cases

## Success Metrics

- [ ] Anonymous users hitting limits see clear 429 errors
- [ ] Frontend shows "Limit Reached" modal with registration CTA
- [ ] Increased registration rate from limit-blocked users
- [ ] Reduced server load from anonymous game analysis abuse
- [ ] No impact on legitimate authenticated user experience
