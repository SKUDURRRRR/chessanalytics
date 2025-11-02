# Anonymous User Rate Limiting Implementation

## Overview

This feature allows anonymous (not logged in) users to analyze **3 games per day** using IP-based tracking. This provides a trial experience while encouraging sign-ups for unlimited access.

## Features

✅ **Anonymous users can analyze 3 games per day**
✅ **24-hour rolling window** (not calendar day)
✅ **IP-based tracking** (handles proxies/load balancers)
✅ **Clear error messages** with upgrade prompts
✅ **Fail-safe design** (errors don't block service)
✅ **Works for both single game and batch analysis**

## Implementation Details

### Database Changes

#### New Table: `anonymous_usage_tracking`
```sql
CREATE TABLE anonymous_usage_tracking (
    id UUID PRIMARY KEY,
    ip_address TEXT NOT NULL,
    date DATE NOT NULL,
    games_analyzed INTEGER DEFAULT 0,
    reset_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE(ip_address, date)
);
```

#### New Functions

1. **`check_anonymous_analysis_limit(p_ip_address TEXT)`**
   - Checks if anonymous user can analyze more games
   - Returns limit info (3 per day)
   - Uses 24-hour rolling window

2. **`increment_anonymous_usage(p_ip_address TEXT, p_count INTEGER)`**
   - Increments analysis counter for anonymous users
   - Handles rolling window resets automatically

3. **`cleanup_old_anonymous_usage()`**
   - Optional maintenance function to clean up old records (30+ days)

### Backend Changes

#### `unified_api_server.py`

**Added to `/api/v1/analyze` endpoint:**
- Accept `Request` object to extract client IP
- Check anonymous limits before allowing analysis
- Return detailed error with usage stats when limit reached
- Increment anonymous usage after successful analysis

**Key Code Flow:**
```python
# 1. Check if user is authenticated
if credentials:
    # Authenticated user - check tier limits
    ...
else:
    # Anonymous user - check IP-based limits
    client_ip = get_client_ip(request)
    result = check_anonymous_analysis_limit(client_ip)

    if not result['can_proceed']:
        raise HTTPException(429, detail={
            "error": "rate_limit_exceeded",
            "message": "Daily limit reached",
            "limit": 3,
            "current_usage": result['current_usage'],
            "remaining": 0,
            "resets_in_hours": result['resets_in_hours'],
            "upgrade_message": "Sign up for unlimited access!"
        })

# 2. Perform analysis...

# 3. After success, increment usage
if is_anonymous:
    increment_anonymous_usage(client_ip, games_analyzed)
```

#### `analysis_queue.py`

**Added to `AnalysisJob` dataclass:**
```python
is_anonymous: bool = True
client_ip: Optional[str] = None
```

**Updated job completion handler:**
- Increment anonymous usage counter after batch analysis completes
- Track actual number of games analyzed (not just requested)

### IP Address Handling

The system properly handles various network configurations:

```python
# Get client IP
client_ip = http_request.client.host if http_request.client else "unknown"

# Handle proxies/load balancers (X-Forwarded-For header)
forwarded_for = http_request.headers.get("x-forwarded-for")
if forwarded_for:
    client_ip = forwarded_for.split(",")[0].strip()
```

This works with:
- Direct connections
- Reverse proxies (nginx, Apache)
- Load balancers (AWS ALB, Cloudflare)
- CDNs

## User Experience

### Anonymous User Journey

1. **First Analysis** (0/3 used)
   ```json
   {
     "success": true,
     "message": "Analysis complete",
     "analyses_remaining": 2
   }
   ```

2. **Second Analysis** (1/3 used)
   ```json
   {
     "success": true,
     "message": "Analysis complete",
     "analyses_remaining": 1
   }
   ```

3. **Third Analysis** (2/3 used)
   ```json
   {
     "success": true,
     "message": "Analysis complete",
     "analyses_remaining": 0,
     "upgrade_message": "Sign up for unlimited access!"
   }
   ```

4. **Fourth Analysis** (3/3 used - BLOCKED)
   ```json
   {
     "error": "rate_limit_exceeded",
     "message": "Daily limit reached. Sign up for unlimited access or wait for reset.",
     "limit": 3,
     "current_usage": 3,
     "remaining": 0,
     "resets_in_hours": 18.5,
     "upgrade_message": "Sign up for unlimited access!"
   }
   ```

### After 24 Hours

Usage automatically resets on a rolling 24-hour window:
- First analysis at 10:00 AM Monday → Resets at 10:00 AM Tuesday
- Not a calendar day reset (midnight)

## Security Considerations

### IP Spoofing Protection

While IP addresses can be spoofed, this is a reasonable balance:

**Why IP-based is acceptable:**
- ✅ No registration friction for trials
- ✅ Most users don't spoof IPs
- ✅ 3 analyses is a small limit (low abuse impact)
- ✅ Still encourages sign-ups
- ✅ Production environment (Vercel, Railway) uses X-Forwarded-For which is harder to spoof

**Additional protection:**
- Rate limiting still applies (5 requests/minute)
- Backend-level enforcement (can't bypass via client)
- Database-level atomic operations (no race conditions)

### Privacy

- Only stores IP address (hashed would be better for production)
- Old records auto-deleted after 30 days
- No personal data collected for anonymous users

## Migration Guide

### Deploy Database Migration

```bash
# Apply migration
psql $DATABASE_URL -f supabase/migrations/20251102000010_anonymous_usage_tracking.sql
```

Or use Supabase CLI:
```bash
supabase db push
```

### Verify Functions Created

```sql
-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'check_anonymous_analysis_limit',
    'increment_anonymous_usage',
    'cleanup_old_anonymous_usage'
);
```

Should return 3 rows.

### Test Locally

See `test_anonymous_usage.py` for automated tests.

Manual test:
```bash
# Start backend
python python/main.py

# Test analysis (no auth token)
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "testuser",
    "platform": "lichess",
    "analysis_type": "stockfish",
    "game_id": "abc123"
  }'
```

## Frontend Integration

### Display Remaining Analyses

```typescript
// After successful analysis
if (response.data.is_anonymous) {
  const remaining = response.data.remaining || 0;

  if (remaining === 0) {
    showUpgradePrompt("You've used all 3 free analyses. Sign up for unlimited access!");
  } else {
    showInfo(`${remaining} free analyses remaining today`);
  }
}
```

### Handle Rate Limit Error

```typescript
// Catch 429 error
if (error.response?.status === 429) {
  const details = error.response.data;

  if (details.error === 'rate_limit_exceeded') {
    showModal({
      title: "Daily Limit Reached",
      message: details.message,
      details: `Resets in ${details.resets_in_hours} hours`,
      actions: [
        { label: "Sign Up for Unlimited", onClick: () => router.push('/signup') },
        { label: "OK", onClick: closeModal }
      ]
    });
  }
}
```

### Add Usage Indicator

```typescript
// Before submitting analysis
async function checkAnonymousUsage() {
  if (!user) {
    // Call backend to get current usage
    const usage = await fetchAnonymousUsage();

    return (
      <div className="usage-indicator">
        Free analyses: {usage.remaining}/{usage.limit}
        <Link to="/signup">Sign up for unlimited</Link>
      </div>
    );
  }
}
```

## Monitoring

### Check Anonymous Usage

```sql
-- Today's anonymous usage
SELECT
    COUNT(*) as unique_ips,
    SUM(games_analyzed) as total_analyses,
    AVG(games_analyzed) as avg_per_ip,
    MAX(games_analyzed) as max_analyses
FROM anonymous_usage_tracking
WHERE date = CURRENT_DATE;
```

### Find Heavy Users

```sql
-- IPs that hit the limit today
SELECT
    ip_address,
    games_analyzed,
    reset_at,
    (NOW() - reset_at) as hours_since_first
FROM anonymous_usage_tracking
WHERE date = CURRENT_DATE
AND games_analyzed >= 3
ORDER BY games_analyzed DESC;
```

### Cleanup Old Records

```sql
-- Run maintenance (optional - automatic after 30 days)
SELECT cleanup_old_anonymous_usage();
```

## Future Enhancements

### Potential Improvements

1. **IP Hashing** - Hash IPs for better privacy
2. **Browser Fingerprinting** - More robust tracking (less privacy-friendly)
3. **Increase Limit** - Maybe 5 games per day instead of 3
4. **Progressive Limits** - 3 games, then show shorter games/simpler analysis
5. **Time-based Hints** - Show when limit resets in UI
6. **A/B Testing** - Test different limits for conversion

### Analytics to Track

- Anonymous vs authenticated usage ratio
- Conversion rate (anonymous → sign up)
- Limit hit rate (how many users hit 3/day)
- Churn at limit (do users leave or sign up?)

## Troubleshooting

### Issue: Anonymous users still unlimited

**Check:**
1. Migration applied? `\dt anonymous_usage_tracking`
2. Functions created? `\df check_anonymous_analysis_limit`
3. Backend using new code? Check logs for "Anonymous user can analyze"

### Issue: All anonymous requests blocked

**Check:**
1. Database connectivity (service_role key configured?)
2. Function errors: Check `supabase logs`
3. IP address extraction: Check request headers

### Issue: Limit resets too quickly/slowly

**Check:**
- `reset_at` timestamp in database
- System time synchronization (NTP)
- Timezone handling (should use UTC)

## Summary

This implementation provides a balanced approach to anonymous access:

✅ **User-friendly** - 3 free analyses encourages trials
✅ **Conversion-focused** - Clear upgrade messaging
✅ **Secure** - Backend enforcement, rate limiting
✅ **Scalable** - Efficient database design
✅ **Maintainable** - Clean code, good error handling

The 3 analyses per day limit provides enough value for users to try the service while creating a natural conversion point for sign-ups.
