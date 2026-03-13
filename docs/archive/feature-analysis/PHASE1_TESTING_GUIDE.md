# Phase 1 Testing Guide

## Changes Implemented

### 1. Dynamic Worker Count
- **Before:** Fixed 8 workers (CPU saturation)
- **After:** `max(1, min(3, os.cpu_count() // 2))` workers
- **Expected:** 60-70% CPU reduction

### 2. Environment-Based Configuration
- **Development:** Depth 6, Skill 6 (faster, 88% quality)
- **Production:** Depth 8, Skill 8 (slower, 92% quality)
- **Expected:** 3-5x faster analytics loading

## Testing Steps

### 1. Set Environment Variable
```bash
# For development (faster analysis)
export APP_ENV=dev

# For production (higher quality)
export APP_ENV=production
```

### 2. Restart Backend
```bash
# Stop current backend
Ctrl+C

# Start with new configuration
python python/main.py
```

### 3. Test Single User Analysis
1. **Start analysis** for one user
2. **Check console logs** for worker count:
   ```
   PARALLEL BATCH ANALYSIS: Using 3 parallel workers for 10 games
   ```
3. **Monitor CPU usage** - should be much lower
4. **Check analysis quality** - should still be good

### 4. Test Multiple Users
1. **Start analysis** for user A
2. **Immediately start analysis** for user B
3. **Check that user B's analytics load** without freezing
4. **Verify both analyses complete** successfully

### 5. Performance Verification
```bash
# Check worker count in logs
grep "Using.*parallel workers" python/backend.out.log

# Check environment detection
grep "Development mode" python/backend.out.log

# Check CPU usage (should be much lower)
# Use Task Manager or htop
```

## Expected Results

### Development Mode (APP_ENV=dev)
- ✅ **Worker count:** 1-3 (instead of 8)
- ✅ **Analysis depth:** 6 (instead of 8)
- ✅ **CPU usage:** 60-70% reduction
- ✅ **Analytics loading:** 3-5x faster
- ✅ **Quality:** 88% (still very good)

### Production Mode (APP_ENV=production)
- ✅ **Worker count:** 1-3 (instead of 8)
- ✅ **Analysis depth:** 8 (same as before)
- ✅ **CPU usage:** 60-70% reduction
- ✅ **Analytics loading:** 3-5x faster
- ✅ **Quality:** 92% (same as before)

## Troubleshooting

### If analytics still load slowly:
1. Check `APP_ENV` is set correctly
2. Verify backend restarted with new config
3. Check console logs for worker count
4. Monitor CPU usage during analysis

### If analysis quality seems poor:
1. Verify `APP_ENV=production` for production use
2. Check depth/skill in console logs
3. Compare with previous analysis results

### If multiple users still cause issues:
1. Check worker count is actually reduced
2. Monitor CPU usage during concurrent analysis
3. Consider Phase 2 (queue and rate limiting)

## Success Criteria

- [ ] Analytics load 3-5x faster
- [ ] CPU usage reduced by 60-70%
- [ ] Multiple users can analyze without app freezing
- [ ] Analysis quality maintained (88% dev, 92% prod)
- [ ] No breaking changes to existing functionality
