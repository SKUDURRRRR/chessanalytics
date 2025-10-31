# Railway Pro Configuration Setup

## Overview
This document explains how to configure your Railway deployment to properly detect and use Railway Pro plan settings.

## Changes Made

### 1. Configuration System Update
We've updated the configuration system to use tier-based settings from `config_free_tier.py`:

- **`config.py`**: Now integrates with tier detection logic
- **`StockfishConfig`**: Uses tier-specific parameters instead of hardcoded "Railway Hobby" values
- **`AnalysisConfig`**: Includes tier-based rate limits (200/hour for Hobby, 500/hour for Pro)

### 2. Tier Detection Logic
The system detects your Railway plan in the following order:

1. **Explicit `DEPLOYMENT_TIER` variable** (if set)
2. **Railway-specific detection**: Checks `RAILWAY_TIER` variable
3. **Render detection**: For Render deployments
4. **Default**: Falls back to "production" for local development

## Railway Environment Variable Setup

### Required Environment Variables

To enable Railway Pro detection, add the following environment variable in your Railway dashboard:

```
RAILWAY_TIER=pro
```

### Steps to Set Environment Variable in Railway:

1. Go to your Railway project dashboard
2. Select your backend service
3. Click on the "Variables" tab
4. Click "New Variable"
5. Add:
   - **Key**: `RAILWAY_TIER`
   - **Value**: `pro`
6. Save and redeploy

### Alternative: Use DEPLOYMENT_TIER

You can also use the more explicit `DEPLOYMENT_TIER` variable:

```
DEPLOYMENT_TIER=railway_pro
```

Valid values:
- `railway_pro` - Railway Pro plan
- `railway_hobby` - Railway Hobby plan
- `production` - Generic production
- `starter` - Starter tier
- `free` - Free tier

## Configuration Differences

### Railway Hobby vs Railway Pro

| Setting | Railway Hobby | Railway Pro |
|---------|---------------|-------------|
| Analysis Depth | 14 | 14 |
| Skill Level | 20 | 20 |
| Time Limit | 0.8s | 0.8s |
| Threads | 1 | 1 |
| Hash Size | 96 MB | 96 MB |
| Max Concurrent | 4 | 4 |
| Deep Mode | Enabled | Enabled |
| Batch Size | 10 | 10 |
| **Rate Limit** | **200/hour** | **500/hour** |

**Key Difference**: The main benefit of Railway Pro is the increased rate limit (500 vs 200 requests per hour) for authenticated users.

## Verification

### Check Tier Detection at Startup

When your backend starts, you should see:

**Before (incorrect detection):**
```
[CONFIG] Railway Hobby mode: depth=14, skill=20
```

**After (correct detection):**
```
[CONFIG] Railway Pro: depth=14, skill=20, time=0.8s

==================================================
CHESS ANALYSIS CONFIGURATION
==================================================

Deployment Tier: Railway Pro

Stockfish:
  Path: /usr/games/stockfish
  Depth: 14
  Skill Level: 20
  Time Limit: 0.8s
  Max Concurrent: 4

Analysis:
  Default Type: stockfish
  Batch Size: 10
  Max Games: 100
  Parallel: True
  Cache: True
  Deep Mode: True
  Rate Limit: 500/hour
```

### Manual Verification

You can also verify the detected tier by checking the configuration in your Python code:

```python
from python.core.config_free_tier import get_deployment_tier

tier = get_deployment_tier()
print(f"Detected tier: {tier}")
# Should print: "Detected tier: railway_pro"
```

## Environment Variable Overrides

You can still override specific settings with environment variables:

```bash
STOCKFISH_DEPTH=16              # Override analysis depth
STOCKFISH_SKILL_LEVEL=20        # Override skill level
STOCKFISH_TIME_LIMIT=1.0        # Override time limit
STOCKFISH_MAX_CONCURRENT=6      # Override concurrent analyses
ANALYSIS_BATCH_SIZE=15          # Override batch size
```

These overrides take precedence over tier-based defaults.

## Troubleshooting

### Issue: Still shows "Railway Hobby mode"

**Cause**: Environment variable not set or not recognized

**Solution**:
1. Verify `RAILWAY_TIER=pro` is set in Railway dashboard
2. Redeploy your service after adding the variable
3. Check the startup logs to confirm the tier is detected

### Issue: Configuration shows "production" tier

**Cause**: Neither `RAILWAY_TIER` nor `DEPLOYMENT_TIER` is set

**Solution**: Add one of these variables to your Railway environment

### Issue: Rate limit still 200/hour

**Cause**: Old configuration cached or environment variable not applied

**Solution**:
1. Confirm environment variable is set correctly
2. Restart/redeploy the service
3. Check the configuration summary in startup logs for "Rate Limit: 500/hour"

## Rate Limiting Details

### Two Types of Rate Limits

1. **Burst Protection** (per-minute limits)
   - Applies to all requests (authenticated and anonymous)
   - Default: 5 requests/minute for analysis, 3 requests/minute for imports
   - Prevents API abuse and DDoS attacks
   - Configure with `ANALYSIS_RATE_LIMIT` and `IMPORT_RATE_LIMIT` env vars

2. **Usage Quotas** (tier-based hourly limits)
   - Applies to authenticated users only
   - Railway Hobby: 200 requests/hour
   - Railway Pro: 500 requests/hour
   - Managed by `usage_tracker` service
   - Based on user's subscription tier in database

## Benefits of Proper Configuration

✅ **Accurate Rate Limits**: Pro users get 500 req/hour instead of 200
✅ **Clear Logging**: Startup logs show correct tier
✅ **Future Scalability**: Easy to adjust Pro-specific settings
✅ **Proper Resource Allocation**: Can increase concurrent analyses for Pro if needed

## Next Steps

After setting up the environment variable:

1. Redeploy your Railway service
2. Check startup logs to confirm tier detection
3. Verify rate limit is 500/hour in the configuration summary
4. Monitor performance and adjust Pro-specific settings if needed

## Future Improvements

Once Railway Pro is confirmed working, you can consider:

- Increasing `max_concurrent_analyses` from 4 to 6-8 for Pro tier
- Increasing `max_batch_size` from 10 to 15-20 for Pro tier
- Adding tier-specific caching strategies
- Implementing tiered timeout values

These can be adjusted in `python/core/config_free_tier.py` under the `RAILWAY_PRO_CONFIG` section.
