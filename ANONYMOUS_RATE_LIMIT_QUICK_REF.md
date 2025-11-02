# Anonymous User Rate Limiting - Quick Reference

## 🎯 Feature Summary

Anonymous users can analyze **3 games per day** using IP-based tracking with 24-hour rolling window.

## 📋 Deployment Checklist

### 1. Database Migration
```bash
# Apply migration
supabase db push
# Or: psql $DATABASE_URL -f supabase/migrations/20251102000010_anonymous_usage_tracking.sql

# Verify
psql $DATABASE_URL -c "\dt anonymous_usage_tracking"
psql $DATABASE_URL -c "\df check_anonymous_analysis_limit"
```

### 2. Deploy Backend
```bash
# Deploy updated Python code
# Files changed: unified_api_server.py, analysis_queue.py
```

### 3. Test
```bash
# Run automated tests
python test_anonymous_usage.py

# Manual test (no auth token)
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test", "platform": "lichess", "game_id": "abc123"}'
```

## 🔧 Quick Commands

### Check Usage
```sql
-- Today's anonymous usage
SELECT COUNT(*) as ips, SUM(games_analyzed) as analyses
FROM anonymous_usage_tracking WHERE date = CURRENT_DATE;

-- IPs at limit
SELECT * FROM anonymous_usage_tracking
WHERE date = CURRENT_DATE AND games_analyzed >= 3;
```

### Manual Testing
```sql
-- Reset test IP
DELETE FROM anonymous_usage_tracking WHERE ip_address = '192.168.1.1';

-- Check specific IP
SELECT * FROM anonymous_usage_tracking WHERE ip_address = '192.168.1.1';
```

### Disable Feature (Emergency)
```sql
-- Temporarily disable (all anonymous users unlimited)
CREATE OR REPLACE FUNCTION check_anonymous_analysis_limit(p_ip_address TEXT)
RETURNS JSON AS $$ BEGIN
    RETURN json_build_object('can_proceed', true);
END; $$ LANGUAGE plpgsql;
```

## 📊 Expected Behavior

| Action | Result |
|--------|--------|
| 1st analysis | ✅ Success, remaining: 2 |
| 2nd analysis | ✅ Success, remaining: 1 |
| 3rd analysis | ✅ Success, remaining: 0 |
| 4th analysis | ❌ 429 Error: "Daily limit reached" |
| After 24h | ✅ Reset, remaining: 3 |

## 🚨 Error Response (When Limit Reached)

```json
{
  "error": "rate_limit_exceeded",
  "message": "Daily limit reached. Sign up for unlimited access!",
  "limit": 3,
  "current_usage": 3,
  "remaining": 0,
  "resets_in_hours": 18.5,
  "upgrade_message": "Sign up for unlimited access!"
}
```

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| All requests blocked | Check `SUPABASE_SERVICE_ROLE_KEY` configured |
| Usage not incrementing | Check logs, verify function permissions |
| Wrong IP detected | Check X-Forwarded-For header in production |
| Limit resets immediately | Check system time, use UTC |

## 📚 Documentation

- **Full Guide**: `docs/ANONYMOUS_USAGE_RATE_LIMITING.md`
- **Summary**: `docs/ANONYMOUS_USER_RATE_LIMITING_SUMMARY.md`
- **Test Script**: `test_anonymous_usage.py`
- **Migration**: `supabase/migrations/20251102000010_anonymous_usage_tracking.sql`

## 🎯 Key Files Changed

```
✅ supabase/migrations/20251102000010_anonymous_usage_tracking.sql  [NEW]
✅ python/core/unified_api_server.py                                [MODIFIED]
✅ python/core/analysis_queue.py                                    [MODIFIED]
```

## 💡 Frontend Integration (Next Steps)

### Show Usage Status
```typescript
// After analysis
if (!user && remaining !== undefined) {
  toast(`${remaining} free analyses remaining`);
}
```

### Handle Limit
```typescript
// On 429 error
showModal({
  title: "Daily Limit Reached",
  message: details.message,
  cta: "Sign Up"
});
```

## 📈 Success Metrics to Track

- Anonymous → Signup conversion rate
- % users hitting 3/day limit
- Average analyses per anonymous user
- Retention (users returning next day)

---

**Status**: ✅ Production Ready
**Testing**: ✅ Automated tests included
**Rollback**: ✅ Simple SQL command
**Impact**: 🔥 Increases trial usage + conversions
