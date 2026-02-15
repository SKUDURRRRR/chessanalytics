# Configuration System Update - Summary

## What Was Fixed

### Problem
Your backend was showing "Railway Hobby mode" configuration even though you're on Railway Pro plan. The system was using hardcoded configuration values and wasn't detecting your actual deployment tier.

### Root Cause
Two configuration systems existed:
1. **Old System (`config.py`)**: Hardcoded to always show "Railway Hobby mode"
2. **New System (`config_free_tier.py`)**: Had proper tier detection but wasn't being used

### Solution
Integrated the tier-based configuration system throughout the application so it properly detects and uses Railway Pro settings.

## Changes Made

### 1. `python/core/config.py`
**Changes:**
- Imported tier detection functions from `config_free_tier.py`
- Updated `StockfishConfig` to be tier-aware instead of hardcoded
- Updated `AnalysisConfig` to include tier-based rate limits
- Modified `_load_stockfish_config()` to use detected tier configuration
- Modified `_load_analysis_config()` to use tier-based rate limits
- Updated `print_summary()` to display detected tier and rate limits
- Modified `reload_config()` to reset tier cache when reloading

**Key Improvements:**
```python
# Before
print(f"[CONFIG] Railway Hobby mode: depth={self.depth}, skill={self.skill_level}")

# After
print(f"[CONFIG] {tier_display}: depth={self.depth}, skill={self.skill_level}, time={self.time_limit}s")
```

### 2. `python/core/config_free_tier.py`
**Changes:**
- Added `reset_config()` function to clear cached configuration
- Enables proper configuration reloading when environment changes

**Function:**
```python
def reset_config() -> None:
    """Reset the cached configuration. Useful for testing or when environment changes."""
    global current_config
    current_config = None
```

### 3. `python/core/unified_api_server.py`
**Changes:**
- Added clarifying comments for rate limiting
- Differentiated between burst protection (per-minute) and tier-based quotas (per-hour)

**Clarification:**
```python
# Note: These are burst protection limits (requests per minute)
# Tier-based usage quotas (hourly/daily) are handled separately via usage_tracker
```

### 4. Documentation
**Created:**
- `docs/RAILWAY_PRO_CONFIG_SETUP.md` - Comprehensive setup and troubleshooting guide
- `test_config_detection.py` - Test script to verify configuration

## Configuration Differences

| Setting | Railway Hobby | Railway Pro | Difference |
|---------|---------------|-------------|------------|
| Analysis Depth | 14 | 14 | Same |
| Skill Level | 20 | 20 | Same |
| Time Limit | 0.8s | 0.8s | Same |
| Hash Size | 96 MB | 96 MB | Same |
| Max Concurrent | 4 | 4 | Same |
| **Rate Limit** | **200/hour** | **500/hour** | **+150% for Pro** |

**Note:** The analysis parameters are identical between Hobby and Pro. The main benefit of Pro tier is the increased rate limit for authenticated users.

## What You Need to Do on Railway

### Step 1: Add Environment Variable
In your Railway dashboard:

1. Go to your backend service
2. Click "Variables" tab
3. Add new variable:
   - **Key:** `RAILWAY_TIER`
   - **Value:** `pro`
4. Save and redeploy

### Alternative: Use DEPLOYMENT_TIER
You can also use:
- **Key:** `DEPLOYMENT_TIER`
- **Value:** `railway_pro`

## Verification

### Before (Current State)
When your backend starts, you see:
```
[CONFIG] Railway Hobby mode: depth=14, skill=20
```

### After (With Environment Variable Set)
You should see:
```
[CONFIG] Railway Pro: depth=14, skill=20, time=0.8s

==================================================
CHESS ANALYSIS CONFIGURATION
==================================================

Deployment Tier: Railway Pro

Analysis:
  ...
  Rate Limit: 500/hour    <-- This is the key difference!
```

## Test Results

All configuration tests passed successfully:

✅ **Tier Detection:** Works correctly based on environment variables
✅ **Configuration Loading:** Properly loads tier-specific settings
✅ **Environment Overrides:** Individual settings can be overridden
✅ **Railway Pro Detection:** Correctly shows 500/hour rate limit

## How to Test Locally

Run the test script:
```bash
cd "C:\my files\Projects\chess-analytics"
python test_config_detection.py
```

This will:
1. Show current tier detection
2. Display configuration values
3. Test environment variable overrides
4. Verify Railway Pro settings work correctly

## Rate Limiting Explained

### Two Types of Limits:

1. **Burst Protection** (Per-Minute)
   - Purpose: Prevent API abuse/DDoS
   - Applies to: All requests (authenticated + anonymous)
   - Default: 5 req/min for analysis, 3 req/min for imports
   - Configured via: `ANALYSIS_RATE_LIMIT`, `IMPORT_RATE_LIMIT` env vars

2. **Usage Quotas** (Per-Hour, Tier-Based)
   - Purpose: Fair usage across subscription tiers
   - Applies to: Authenticated users only
   - Railway Hobby: 200 req/hour
   - Railway Pro: 500 req/hour
   - Managed by: `usage_tracker` service + database

## Files Modified

```
python/core/config.py              (Updated - tier integration)
python/core/config_free_tier.py    (Updated - added reset function)
python/core/unified_api_server.py  (Updated - clarifying comments)
```

## Files Created

```
docs/RAILWAY_PRO_CONFIG_SETUP.md   (New - setup guide)
docs/CONFIG_SYSTEM_UPDATE_SUMMARY.md (This file - summary)
test_config_detection.py           (New - test script)
```

## Benefits

✅ **Accurate Tier Detection:** System now correctly identifies Railway Pro
✅ **Proper Rate Limits:** Pro users get 500 req/hour instead of 200
✅ **Clear Logging:** Startup logs show correct deployment tier
✅ **Maintainable:** Easy to adjust tier-specific settings in future
✅ **Testable:** Includes test script to verify configuration
✅ **Documented:** Comprehensive setup and troubleshooting guides

## Future Enhancements

Once Railway Pro is confirmed working in production, you can consider:

1. **Increase Concurrency for Pro:**
   ```python
   # In config_free_tier.py - RAILWAY_PRO_CONFIG
   max_concurrent_analyses=6,  # Increase from 4 to 6
   ```

2. **Larger Batch Sizes for Pro:**
   ```python
   max_batch_size=15,  # Increase from 10 to 15
   ```

3. **Tier-Specific Timeouts:**
   ```python
   timeout_seconds=600,  # 10 minutes for Pro vs 5 for Hobby
   ```

These optimizations can be made in `python/core/config_free_tier.py` under the `RAILWAY_PRO_CONFIG` section.

## Troubleshooting

### Still Shows "Railway Hobby"?
- Verify `RAILWAY_TIER=pro` is set in Railway dashboard
- Redeploy after adding the variable
- Check startup logs for tier detection message

### Rate Limit Still 200/hour?
- Confirm environment variable is correct
- Restart/redeploy the service
- Check configuration summary in logs

### Need Help?
- See `docs/RAILWAY_PRO_CONFIG_SETUP.md` for detailed troubleshooting
- Run `test_config_detection.py` to diagnose configuration issues

## Next Steps

1. ✅ Add `RAILWAY_TIER=pro` environment variable in Railway
2. ✅ Redeploy your backend service
3. ✅ Verify startup logs show "Railway Pro" tier
4. ✅ Confirm rate limit is 500/hour in configuration summary
5. ✅ Monitor performance and adjust Pro-specific settings if needed

## Summary

The configuration system has been successfully updated to properly detect and use Railway Pro plan settings. The main functional difference is the increased rate limit (500/hour vs 200/hour) for authenticated users. Once you add the `RAILWAY_TIER=pro` environment variable in Railway and redeploy, your backend will correctly identify and use Pro plan configuration.
