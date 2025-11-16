# Anonymous User Limit Enforcement Bug

## Problem

Anonymous users can import and analyze unlimited games, bypassing the 100 imports/5 analyses per 24 hours limit.

## Root Cause Analysis

### 1. Backend Does NOT Enforce Anonymous Limits

**File**: `python/core/unified_api_server.py`

#### Import Endpoint (Line 5848-5867)
```python
# Check usage limits for authenticated users
auth_user_id = None
try:
    if credentials:
        token_data = await verify_token(credentials)
        auth_user_id = token_data.get('sub')

        # Check import limit
        if auth_user_id and usage_tracker:
            can_proceed, stats = await usage_tracker.check_import_limit(auth_user_id)
            if not can_proceed:
                raise HTTPException(status_code=429, ...)
except HTTPException:
    raise
except Exception as e:
    # Log but don't fail - allow anonymous/failed auth to proceed
    print(f"Auth check failed (non-critical): {e}")
```

**Problem**: Only checks limits for `auth_user_id` (authenticated users). Anonymous users (`auth_user_id = None`) bypass all checks.

#### Analysis Endpoint (Line 1124-1143)
```python
# Check usage limits for authenticated users
auth_user_id = None
try:
    if credentials:
        token_data = await verify_token(credentials)
        auth_user_id = token_data.get('sub')

        # Check analysis limit
        if auth_user_id and usage_tracker:
            can_proceed, stats = await usage_tracker.check_analysis_limit(auth_user_id)
            if not can_proceed:
                raise HTTPException(status_code=429, ...)
except HTTPException:
    raise
except Exception as e:
    # Log but don't fail - allow anonymous/failed auth to proceed
    print(f"Auth check failed (non-critical): {e}")
```

**Problem**: Same issue - only checks authenticated users.

### 2. Database Function Allows Anonymous Users

**File**: `supabase/migrations/20251030000002_link_existing_data.sql` (Line 267-274)

```sql
-- If user not found, they're anonymous (legacy behavior - no limits yet)
IF NOT FOUND THEN
    RETURN json_build_object(
        'can_proceed', true,
        'is_anonymous', true,
        'reason', 'Anonymous users have temporary unlimited access'
    );
END IF;
```

**Problem**: Explicitly allows anonymous users unlimited access.

### 3. Frontend-Only Enforcement is Insufficient

**File**: `src/services/anonymousUsageTracker.ts`

- Limits are tracked in `localStorage` (can be cleared)
- Checks happen in frontend only
- Backend doesn't verify limits
- Users can bypass by:
  - Clearing localStorage
  - Modifying frontend code
  - Using API directly

### 4. Auto-Import Runs Automatically

**File**: `src/pages/SimpleAnalyticsPage.tsx` (Line 179-191)

Auto-import runs on page load. While it checks limits, if the check fails or is bypassed, it still imports.

## Current Behavior

1. ✅ Frontend checks limits (localStorage-based)
2. ❌ Backend allows all anonymous requests (no limit enforcement)
3. ❌ Users can bypass by clearing localStorage
4. ❌ Users can bypass by calling API directly
5. ❌ Auto-import can run even if limits exceeded (if check fails)

## Impact

- **Security**: Anonymous users can abuse the system
- **Cost**: Unlimited API calls and database writes
- **Fairness**: Registered users are limited, anonymous users are not
- **Business**: No incentive to register

## Solution Options

### Option 1: Backend IP-Based Tracking (Recommended)

Track anonymous usage by IP address with 24-hour rolling window:
- Store usage in Redis or database keyed by IP
- Enforce limits on backend
- Frontend checks are UX optimization, backend is enforcement

**Pros**:
- Enforces limits server-side
- Can't be bypassed by clearing localStorage
- More reliable

**Cons**:
- IP can be shared (VPN, shared networks)
- Requires Redis or additional database table

### Option 2: Session-Based Backend Tracking

Track anonymous usage by session ID:
- Generate session ID on first request
- Store in cookie or return in response
- Track usage per session

**Pros**:
- More reliable than localStorage
- Can't be easily bypassed

**Cons**:
- Users can clear cookies
- Still bypassable, but harder

### Option 3: Frontend-Only with Rate Limiting

Keep frontend-only but add backend rate limiting:
- Rate limit per IP address
- Lower limits (e.g., 10 requests/minute)
- Prevents abuse while allowing reasonable usage

**Pros**:
- Easier to implement
- Prevents abuse

**Cons**:
- Doesn't enforce exact 100/5 limits
- Can still be bypassed with VPN

## Recommended Solution

**Option 1: Backend IP-Based Tracking**

Implement backend enforcement while keeping frontend checks for UX:
1. Create `anonymous_usage_tracking` table (IP, action_type, count, reset_at)
2. Check limits on backend before allowing operations
3. Return 429 when limit exceeded
4. Frontend checks are optional (UX optimization only)

This ensures limits are enforced even if frontend is bypassed.
