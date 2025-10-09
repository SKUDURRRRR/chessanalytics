# Railway Hobby Tier Setup Guide

## Environment Variables to Set in Railway

Set these environment variables in your Railway dashboard to enable the Railway Hobby tier optimizations:

### Required Variables
```bash
# Enable Railway Hobby tier configuration
DEPLOYMENT_TIER=railway_hobby

# Alternative: Auto-detect Railway Hobby tier
RAILWAY_TIER=hobby
RAILWAY_HOBBY_TIER=true

# Performance profile
PERFORMANCE_PROFILE=railway_hobby
```

### Optional Variables (for fine-tuning)
```bash
# Analysis settings
STOCKFISH_DEPTH=12
STOCKFISH_SKILL_LEVEL=10
STOCKFISH_TIME_LIMIT=1.0
STOCKFISH_THREADS=4
STOCKFISH_HASH_SIZE=128

# Concurrency settings
MAX_CONCURRENT_ANALYSES=6
MOVE_CONCURRENCY=4

# Memory settings
MAX_MEMORY_USAGE_MB=6144
MAX_CACHE_SIZE_MB=256
```

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard
2. Select your service
3. Go to **Variables** tab
4. Add each variable with its value
5. Click **Deploy** to apply changes

## Expected Performance Improvements

### Before (Free Tier)
- Single game: 45-90 seconds
- 10 games: 7.5-15 minutes
- Memory usage: 200-300 MB
- Concurrent capacity: 1 game

### After (Railway Hobby Tier)
- Single game: 8-15 seconds (6x faster)
- 10 games: 1-2 minutes (8x faster)
- Memory usage: 3-4 GB (better utilization)
- Concurrent capacity: 6 games + 4 moves per game

## Monitoring Performance

After deployment, check the logs for:
```
[Config] Using RAILWAY_HOBBY tier configuration:
  - Analysis depth: 12
  - Time limit: 1.0s
  - Threads: 4
  - Hash size: 128MB
  - Max concurrent analyses: 6
```

## Troubleshooting

If you see memory issues:
1. Reduce `MAX_CONCURRENT_ANALYSES` to 4
2. Reduce `MOVE_CONCURRENCY` to 2
3. Reduce `STOCKFISH_HASH_SIZE` to 64

If analysis is too slow:
1. Increase `STOCKFISH_TIME_LIMIT` to 1.5
2. Increase `STOCKFISH_DEPTH` to 15
3. Increase `MAX_CONCURRENT_ANALYSES` to 8
