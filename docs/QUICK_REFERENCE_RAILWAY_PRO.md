# Quick Reference: Railway Pro Configuration

## TL;DR - What You Need to Do

1. **In Railway Dashboard:**
   - Go to your backend service
   - Click "Variables" tab
   - Add: `RAILWAY_TIER` = `pro`
   - Redeploy

2. **Verify It Works:**
   - Check startup logs for: `[CONFIG] Railway Pro: depth=14, skill=20, time=0.8s`
   - Look for: `Rate Limit: 500/hour` in configuration summary

## The Problem We Fixed

**Before:**
```
[CONFIG] Railway Hobby mode: depth=14, skill=20
Rate Limit: 200/hour (but you're on Pro plan!)
```

**After:**
```
[CONFIG] Railway Pro: depth=14, skill=20, time=0.8s
Rate Limit: 500/hour (correct for Pro plan!)
```

## What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Tier Detection | Hardcoded "Hobby" | Dynamic detection |
| Rate Limit | Always 200/hour | 200 (Hobby) or 500 (Pro) |
| Configuration | Fixed values | Tier-based values |
| Logging | Misleading | Accurate |

## Environment Variables

### Option 1 (Recommended):
```bash
RAILWAY_TIER=pro
```

### Option 2 (Alternative):
```bash
DEPLOYMENT_TIER=railway_pro
```

## Configuration Values

| Setting | Value | Notes |
|---------|-------|-------|
| Analysis Depth | 14 | Same for Hobby/Pro |
| Skill Level | 20 | Same for Hobby/Pro |
| Time Limit | 0.8s | Same for Hobby/Pro |
| **Rate Limit (Hobby)** | **200/hour** | **Authenticated users** |
| **Rate Limit (Pro)** | **500/hour** | **+150% for Pro** |

## Quick Test

Run locally:
```bash
python test_config_detection.py
```

Should show:
- ✅ Tier Detection works
- ✅ Config Loading works
- ✅ Railway Pro shows 500/hour

## Files Changed

- `python/core/config.py` - Integrated tier detection
- `python/core/config_free_tier.py` - Added cache reset
- `python/core/unified_api_server.py` - Clarified rate limits

## Documentation

📄 **Full Setup Guide:** `docs/RAILWAY_PRO_CONFIG_SETUP.md`
📄 **Complete Summary:** `docs/CONFIG_SYSTEM_UPDATE_SUMMARY.md`
🧪 **Test Script:** `test_config_detection.py`

## Troubleshooting One-Liners

**Problem:** Still shows "Hobby"
**Fix:** Add `RAILWAY_TIER=pro` in Railway and redeploy

**Problem:** Rate limit is 200
**Fix:** Verify env var is set correctly and restart service

**Problem:** Not sure if it's working
**Fix:** Check startup logs for "Railway Pro" message

## Key Takeaway

**Main benefit of Pro tier:** 500 requests/hour instead of 200 for authenticated users.

Analysis quality (depth, skill, time) is the same between Hobby and Pro - both use optimized settings.
