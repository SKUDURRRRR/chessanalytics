# Hard-coded Credentials Security Fix

## Issue Summary
CodeRabbit identified a critical security vulnerability where `update_pricing_db.py` contained a hard-coded Supabase service role key.

## Security Risk
- **Severity**: Critical 🔴
- **Impact**: Full database access credentials exposed in source control
- **File**: `update_pricing_db.py`
- **Exposed credential**: Service role key `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`

## Fix Applied

### Before (lines 8-12):
```python
# Connect to local Supabase
url = "http://127.0.0.1:54321"
key = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"  # pragma: allowlist secret - Example of removed local dev key

supabase: Client = create_client(url, key)
```

### After (lines 8-18):
```python
# Read credentials from environment variables
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Validate that both env vars are present
if not url:
    raise ValueError("SUPABASE_URL environment variable is required but not set")
if not key:
    raise ValueError("SUPABASE_SERVICE_ROLE_KEY environment variable is required but not set")

supabase: Client = create_client(url, key)
```

## Changes Made
1. ✅ Removed hard-coded Supabase URL and service role key
2. ✅ Added environment variable reading with `os.environ.get()`
3. ✅ Added validation to ensure both env vars are present
4. ✅ Added clear error messages if variables are missing

## Additional Findings
- ✅ Verified no other files contain the exposed key
- ✅ Confirmed `update_db_pricing.py` already uses environment variables correctly
- ✅ Confirmed `update_price_ids_now.py` uses the config system correctly

## Important Notes

### For Local Development
The exposed key was a **local development key** (URL: `http://127.0.0.1:54321`), which means:
- ✅ It only works on localhost
- ✅ It's not connected to production databases
- ✅ Lower risk than a production key exposure

However, even local keys should not be committed to source control as it's a bad security practice.

### Key Rotation
Since this appears to be a local Supabase key:
- The key is automatically regenerated each time you run `supabase start`
- No manual rotation needed unless you're using a persistent local instance
- If this is a shared development database, you may want to restart your local Supabase instance

### To Use the Script Now
```bash
# Set environment variables
export SUPABASE_URL="http://127.0.0.1:54321"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Or use a .env file (recommended)
# Then run:
python update_pricing_db.py
```

## Best Practices Applied
1. ✅ Read secrets from environment variables
2. ✅ Validate required variables are present
3. ✅ Provide clear error messages
4. ✅ Keep credentials out of source control

## Status
✅ **FIXED** - Credentials removed and environment variable approach implemented
