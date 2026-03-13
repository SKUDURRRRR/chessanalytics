# Quick Capacity Reference Guide

## Current Capacity (Railway Pro - Optimized)

### Comfortable Capacity: **10-20 concurrent users**
- ✅ Fast response times (<2s for most operations)
- ✅ No queuing delays
- ✅ <30% resource utilization

### Acceptable Capacity: **20-40 concurrent users**
- ⚠️ Some queuing (5-30s wait times)
- ⚠️ Response times increase (2-5s)
- ⚠️ 50-80% resource utilization

### Breaking Point: **50+ concurrent users**
- ❌ Significant queuing (1-5 min waits)
- ❌ Timeout errors
- ❌ >90% resource utilization
- ❌ Poor user experience

---

## Quick Capacity Check

### Check Current Load
```bash
# Check API metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.railway.app/api/v1/metrics/memory | jq

# Monitor in real-time
python tests/capacity_monitor.py --api-url https://your-api.railway.app --interval 10
```

### Key Metrics to Watch

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| **Memory Usage** | <50% | 50-70% | >70% |
| **Engine Pool** | <70% utilized | 70-90% | 100% |
| **Queue Depth** | 0-2 | 3-5 | >5 |
| **Response Time (p95)** | <2s | 2-5s | >5s |
| **Cache Hit Rate** | >60% | 40-60% | <40% |

---

## When to Scale Up

### Phase 1: Increase Concurrency (Free - No Infrastructure Change)

**Trigger:** Sustained queue depth >3, engine pool >80% utilized

**Action:**
```bash
# In Railway environment variables, add:
MAX_CONCURRENT_IMPORTS=3
```

**Result:** +30% capacity (25-30 comfortable users)

---

### Phase 2: Infrastructure Upgrade ($40-60/month more)

**Trigger:** Memory >70%, CPU >80% sustained, or >30 concurrent users

**Action:**
1. Upgrade to Railway Pro (16 GB RAM)
2. Add Supabase Pro ($25/month)
3. Implement Redis caching

**Result:** +100% capacity (50-75 comfortable users)

---

### Phase 3: Horizontal Scaling ($150-200/month more)

**Trigger:** >75 concurrent users or can't maintain <5s response times

**Action:**
1. Add load balancer
2. Deploy 2-3 API instances
3. Separate analysis workers
4. Use Redis for shared state

**Result:** +200% capacity (150-200 comfortable users)

---

## Quick Load Test

### Light Load Test (10 users, 5 min)
```bash
python tests/load_test.py --scenario light --api-url https://your-api.railway.app
```

### Moderate Load Test (25 users, 10 min)
```bash
python tests/load_test.py --scenario moderate --api-url https://your-api.railway.app
```

### Heavy Load Test (50 users, 15 min)
```bash
python tests/load_test.py --scenario heavy --api-url https://your-api.railway.app
```

### Spike Test (fast ramp-up)
```bash
python tests/load_test.py --scenario spike --api-url https://your-api.railway.app
```

---

## Environment Variable Tuning

### Current Settings (Railway Pro)
```bash
# Analysis concurrency
MAX_CONCURRENT_IMPORTS=2        # Concurrent imports
DEPLOYMENT_TIER=railway_pro

# Analysis queue (in code)
max_concurrent_jobs=4           # Analysis jobs
max_workers_per_job=8           # Parallel moves per job

# Engine pool (in code)
max_size=3-4                    # Stockfish engines
ttl=300                         # 5-minute TTL

# Cache
CACHE_TTL_SECONDS=300          # 5-minute cache
```

### For 20-30 Users
```bash
MAX_CONCURRENT_IMPORTS=3        # +50% import capacity
# Increase in analysis_queue.py:
max_concurrent_jobs=5           # +25% analysis capacity
ENGINE_POOL_MAX_SIZE=4          # Ensure 4 engines
```

### For 30-50 Users (Requires 16 GB RAM)
```bash
MAX_CONCURRENT_IMPORTS=4        # +100% import capacity
# Increase in code:
max_concurrent_jobs=6           # +50% analysis capacity
max_workers_per_job=10          # +25% parallel moves
ENGINE_POOL_MAX_SIZE=6          # More engines
```

---

## Bottleneck Identification

### Symptom: Long queue waits for analysis
**Cause:** Engine pool exhausted
**Fix:** Increase `ENGINE_POOL_MAX_SIZE` and `max_concurrent_jobs`

### Symptom: Import timeouts
**Cause:** Too many concurrent imports
**Fix:** Increase `MAX_CONCURRENT_IMPORTS` (but watch memory)

### Symptom: Slow analytics page loads
**Cause:** Database queries slow or cache misses
**Fix:**
1. Check cache hit rate (should be >60%)
2. Optimize database queries (add JOINs)
3. Increase `CACHE_TTL_SECONDS`

### Symptom: Memory warnings
**Cause:** Too many operations or memory leak
**Fix:**
1. Reduce concurrency limits
2. Check for memory leaks (baseline should stay ~400 MB)
3. Restart server if memory doesn't drop

### Symptom: CPU at 100%
**Cause:** Too many Stockfish processes
**Fix:**
1. Reduce `max_concurrent_jobs`
2. Reduce `max_workers_per_job`
3. Upgrade to more vCPUs

---

## Monitoring Commands

### Check Railway Metrics
```bash
# View in Railway dashboard:
https://railway.app/project/your-project/metrics
```

### Check API Health
```bash
curl https://your-api.railway.app/health
```

### Check Memory & Capacity
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.railway.app/api/v1/metrics/memory | jq
```

### Check Analysis Queue
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-api.railway.app/api/v1/analysis/queue/stats | jq
```

---

## Cost vs Capacity

| Monthly Cost | Infrastructure | Comfortable Users | Max Users |
|--------------|---------------|-------------------|-----------|
| **$20-30** | Railway Pro (8GB) | 10-20 | 30-40 |
| **$60-80** | Railway Pro (16GB) + Supabase Pro | 30-50 | 75-100 |
| **$150-250** | Multi-instance + Redis + Load Balancer | 100-150 | 200-300 |
| **$500+** | Enterprise (K8s, auto-scaling) | 200+ | 1000+ |

---

## Emergency Procedures

### If Memory Critical (>85%)
1. Check what's using memory: `/api/v1/metrics/memory`
2. Reduce `MAX_CONCURRENT_IMPORTS` to 1
3. Reduce `max_concurrent_jobs` to 2
4. Restart server if necessary
5. Wait for engine TTL cleanup (5 min)

### If Queue Backlog Building
1. Reduce new job acceptance temporarily
2. Let queue drain (stop accepting new imports)
3. Increase concurrency if resources available
4. Consider scaling up infrastructure

### If Timeouts Occurring
1. Check Railway logs for errors
2. Check database connection pool
3. Verify external API availability (Chess.com, Lichess)
4. Increase timeout limits if legitimate

---

## Performance Targets

### Response Time Targets
- **Analytics page:** <2s (p95)
- **Game analysis:** <10s (p95)
- **Import 200 games:** <3 minutes
- **Queue wait time:** <30s (p95)

### Utilization Targets
- **Memory:** <70% sustained
- **CPU:** <80% sustained
- **Engine pool:** <80% sustained
- **Queue depth:** <5 jobs

### Cache Targets
- **Hit rate:** >60%
- **Size:** <80% of max
- **TTL:** 5 minutes (adjust as needed)

---

## Contact & Escalation

### Monitoring Alerts
Set up alerts for:
- Memory >70% for 5+ minutes
- CPU >90% for 5+ minutes
- Queue depth >10 jobs
- Error rate >5%
- Response time p95 >5s

### Tools
- **Railway Dashboard:** Real-time metrics
- **Sentry:** Error tracking (recommended)
- **Custom scripts:** `capacity_monitor.py`, `load_test.py`

---

**Last Updated:** October 29, 2025
**For detailed analysis:** See `CAPACITY_ANALYSIS.md`
