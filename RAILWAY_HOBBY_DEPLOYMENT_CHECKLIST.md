# Railway Hobby Tier Deployment Checklist

## Pre-Deployment Checklist

### ✅ Code Changes Completed
- [x] **Phase 1**: Move-level parallelism enabled (max_concurrent = 4)
- [x] **Phase 2**: Stockfish configuration optimized (128MB hash, 4 threads)
- [x] **Phase 3**: Game-level parallelism enabled (max_workers = 6)
- [x] **Phase 4**: Railway Hobby tier configuration created
- [x] **Phase 5**: Performance config updated with Railway Hobby profile

### ✅ Files Modified
- [x] `python/core/analysis_engine.py` - Move parallelism + Stockfish config
- [x] `python/core/parallel_analysis_engine.py` - Game parallelism
- [x] `python/core/config_free_tier.py` - Railway Hobby tier config
- [x] `python/core/performance_config.py` - Railway Hobby profile

### ✅ New Files Created
- [x] `railway-hobby-setup.md` - Environment variables guide
- [x] `test_railway_hobby_performance.py` - Performance testing script
- [x] `RAILWAY_HOBBY_DEPLOYMENT_CHECKLIST.md` - This checklist

## Deployment Steps

### Step 1: Set Environment Variables in Railway
1. Go to Railway dashboard
2. Select your service
3. Go to **Variables** tab
4. Add these variables:
   ```
   DEPLOYMENT_TIER=railway_hobby
   PERFORMANCE_PROFILE=railway_hobby
   ```

### Step 2: Deploy to Railway
1. Commit and push changes to your repository
2. Railway will automatically deploy
3. Monitor deployment logs for any errors

### Step 3: Verify Deployment
1. Check that the service starts successfully
2. Look for this log message:
   ```
   [Config] Using RAILWAY_HOBBY tier configuration:
     - Analysis depth: 12
     - Time limit: 1.0s
     - Threads: 4
     - Hash size: 128MB
     - Max concurrent analyses: 6
   ```

### Step 4: Run Performance Tests
1. SSH into your Railway service or run locally with Railway env vars
2. Execute the performance test:
   ```bash
   python test_railway_hobby_performance.py
   ```

## Expected Performance Improvements

### Before (Free Tier)
- Single game: 45-90 seconds
- 10 games: 7.5-15 minutes
- Memory usage: 200-300 MB
- Concurrent capacity: 1 game

### After (Railway Hobby Tier)
- Single game: 8-15 seconds (**6x faster**)
- 10 games: 1-2 minutes (**8x faster**)
- Memory usage: 3-4 GB (better utilization)
- Concurrent capacity: 6 games + 4 moves per game

## Monitoring and Troubleshooting

### Check Performance
- Monitor analysis times in logs
- Check memory usage in Railway dashboard
- Verify concurrent analysis is working

### Common Issues and Solutions

#### Issue: Memory Usage Too High
**Symptoms**: Service crashes with OOM errors
**Solution**: 
- Reduce `MAX_CONCURRENT_ANALYSES` to 4
- Reduce `MOVE_CONCURRENCY` to 2
- Reduce `STOCKFISH_HASH_SIZE` to 64

#### Issue: Analysis Too Slow
**Symptoms**: Analysis takes longer than expected
**Solution**:
- Increase `STOCKFISH_TIME_LIMIT` to 1.5
- Increase `STOCKFISH_DEPTH` to 15
- Check if parallel processing is enabled

#### Issue: Service Won't Start
**Symptoms**: Service fails to start or crashes immediately
**Solution**:
- Check environment variables are set correctly
- Verify all code changes are deployed
- Check logs for specific error messages

### Performance Monitoring Commands

```bash
# Check service status
railway status

# View logs
railway logs --tail 100

# Check environment variables
railway variables

# Restart service if needed
railway restart
```

## Rollback Plan

If issues occur, you can rollback by:

1. **Quick Rollback**: Set environment variable
   ```
   DEPLOYMENT_TIER=production
   ```

2. **Full Rollback**: Revert code changes
   - Change `max_concurrent = 1` in analysis_engine.py
   - Change `max_workers = 3` in parallel_analysis_engine.py
   - Remove Railway Hobby config

## Success Criteria

### ✅ Deployment Successful
- [ ] Service starts without errors
- [ ] Environment variables are set correctly
- [ ] Configuration logs show Railway Hobby tier

### ✅ Performance Improved
- [ ] Single game analysis < 15 seconds
- [ ] 10 games analysis < 2 minutes
- [ ] Memory usage < 6 GB
- [ ] Parallel processing working

### ✅ Functionality Working
- [ ] Game analysis completes successfully
- [ ] Results are saved to database
- [ ] No crashes or errors
- [ ] User experience improved

## Next Steps After Successful Deployment

1. **Monitor Performance**: Track analysis times and resource usage
2. **User Testing**: Test with real users and gather feedback
3. **Optimize Further**: Fine-tune settings based on actual usage
4. **Scale Up**: Consider upgrading to higher Railway tiers if needed

## Support

If you encounter issues:
1. Check Railway logs for error messages
2. Run the performance test script
3. Verify environment variables are set correctly
4. Check this checklist for troubleshooting steps
