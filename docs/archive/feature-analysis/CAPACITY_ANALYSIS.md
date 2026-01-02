# Chess Analytics Application - Capacity Analysis

**Date:** October 29, 2025
**Current Status:** Optimized for Railway Pro tier
**Assessment:** Detailed multi-user load capacity investigation

---

## Executive Summary

Your chess analytics application is well-architected with modern optimizations including:
- ✅ Async/await FastAPI backend with concurrent request handling
- ✅ Memory-optimized Stockfish engine pooling (3-4 engines, TTL-based cleanup)
- ✅ Queue-based job processing for analysis and imports
- ✅ HTTP connection pooling for external APIs
- ✅ LRU caching with TTL for analytics and evaluations
- ✅ Configurable concurrency limits per deployment tier

**Current Capacity Estimate:**
- **10-20 concurrent users:** ✅ Comfortable
- **20-50 concurrent users:** ⚠️ Acceptable with some queuing
- **50-100 concurrent users:** ❌ Would need infrastructure upgrades
- **100+ concurrent users:** ❌ Requires horizontal scaling + load balancing

---

## Current Configuration (Railway Pro Tier)

### Infrastructure
- **Platform:** Railway Pro
- **Resources:** 8 GB RAM, 8 vCPUs
- **Memory Usage:** ~400 MB baseline (down from 1.4 GB after optimizations)
- **Cost:** $20-30/month (down from $68/month)

### Concurrency Limits

#### Game Analysis
```python
MAX_CONCURRENT_JOBS = 4           # Analysis jobs running simultaneously
MAX_WORKERS_PER_JOB = 8           # Parallel moves analyzed per job
TOTAL_PARALLEL_MOVES = 32         # 4 jobs × 8 workers
ANALYSIS_DEPTH = 14               # Stockfish depth
TIME_LIMIT = 0.8s                 # Per position
```

#### Game Imports
```python
MAX_CONCURRENT_IMPORTS = 2        # Concurrent imports (configurable via env)
IMPORT_BATCH_SIZE = 50            # Games per batch
HTTP_CONNECTIONS = 15             # Total across all hosts
HTTP_CONNECTIONS_PER_HOST = 6     # Per platform (Lichess/Chess.com)
```

#### Stockfish Engine Pool
```python
ENGINE_POOL_MAX_SIZE = 3-4        # Pre-warmed engines
ENGINE_TTL = 300s                 # 5-minute idle timeout
ENGINE_CLEANUP_INTERVAL = 60s     # Check every minute
```

#### Caching
```python
ANALYTICS_CACHE_TTL = 300s        # 5 minutes
POSITION_CACHE_SIZE = 1000        # LRU cache entries
RATE_LIMIT_CACHE_TTL = 300s       # 5 minutes
```

### Rate Limiting
```python
RATE_LIMIT_PER_HOUR = 500         # API calls per user per hour
```

---

## Load Capacity Analysis

### Scenario 1: Light Activity (10 Concurrent Users)

**Activity Mix:**
- 3 users browsing analytics (cached)
- 2 users importing games (200 games each)
- 3 users analyzing games (40 moves avg)
- 2 users idle/navigating

**Resource Usage:**

| Resource | Usage | Available | Utilization |
|----------|-------|-----------|-------------|
| Memory | ~800 MB | 8 GB | 10% |
| CPU | 2-3 vCPUs | 8 vCPUs | 30-40% |
| Stockfish Engines | 2-3 active | 3-4 max | 75% |
| HTTP Connections | 4-6 | 15 max | 40% |

**Performance:**
- ✅ **Analytics page load:** <1s (cached)
- ✅ **Game analysis:** 5-8s per game
- ✅ **Import 200 games:** ~1-2 minutes
- ✅ **No queuing delays**

**Bottlenecks:** None

**Verdict:** ✅ **Comfortable capacity** with excellent performance

---

### Scenario 2: Moderate Activity (25 Concurrent Users)

**Activity Mix:**
- 10 users browsing analytics
- 5 users importing games (200 games each)
- 8 users analyzing games
- 2 users idle

**Resource Usage:**

| Resource | Usage | Available | Utilization |
|----------|-------|-----------|-------------|
| Memory | 1.2-1.5 GB | 8 GB | 15-19% |
| CPU | 5-6 vCPUs | 8 vCPUs | 70-75% |
| Stockfish Engines | 3-4 active | 4 max | 100% |
| HTTP Connections | 10-12 | 15 max | 80% |
| Analysis Queue | 4-6 waiting | - | Queued |
| Import Queue | 3 waiting | - | Queued |

**Performance:**
- ✅ **Analytics page load:** 1-2s (mix of cached/fresh)
- ⚠️ **Game analysis:** 8-15s (includes queue wait)
- ⚠️ **Import 200 games:** 2-4 minutes (some queuing)
- ⚠️ **Queue wait times:** 5-30s depending on activity

**Bottlenecks:**
1. **Stockfish engine pool** - all engines in use
2. **Analysis concurrency** - limited to 4 jobs
3. **Import concurrency** - limited to 2 imports

**Optimizations Needed:**
- Increase `MAX_CONCURRENT_IMPORTS` to 3
- Increase engine pool to 4-5 engines
- Add queue priority (premium users first)

**Verdict:** ⚠️ **Acceptable** with minor queuing delays

---

### Scenario 3: Heavy Activity (50 Concurrent Users)

**Activity Mix:**
- 20 users browsing analytics
- 10 users importing games (500 games each)
- 15 users analyzing games
- 5 users idle

**Resource Usage:**

| Resource | Usage | Available | Utilization |
|----------|-------|-----------|-------------|
| Memory | 2.5-3 GB | 8 GB | 31-37% |
| CPU | 7-8 vCPUs | 8 vCPUs | 90-100% |
| Stockfish Engines | 4 active | 4 max | 100% |
| HTTP Connections | 15 | 15 max | 100% |
| Analysis Queue | 10-15 waiting | - | Long queue |
| Import Queue | 8 waiting | - | Long queue |

**Performance:**
- ⚠️ **Analytics page load:** 2-5s (cache thrashing)
- ❌ **Game analysis:** 20-60s (long queue waits)
- ❌ **Import 500 games:** 10-20 minutes (heavy queuing)
- ❌ **Queue wait times:** 1-5 minutes

**Bottlenecks:**
1. **CPU saturation** - all vCPUs maxed out
2. **Engine pool exhaustion** - long waits for available engine
3. **HTTP connections maxed** - import delays
4. **Memory starting to climb** - potential for OOM at peak
5. **Queue buildup** - poor user experience

**Critical Issues:**
- Users would experience significant delays
- Risk of timeouts (5-minute limit)
- Potential memory spikes with complex games
- Database connection pool may saturate

**Verdict:** ❌ **Not recommended** - requires infrastructure upgrades

---

### Scenario 4: Peak Load (100 Concurrent Users)

**Activity Mix:**
- 40 users browsing analytics
- 20 users importing games
- 30 users analyzing games
- 10 users idle

**Resource Usage:**

| Resource | Usage | Available | Utilization |
|----------|-------|-----------|-------------|
| Memory | 4-6 GB | 8 GB | 50-75% |
| CPU | 8 vCPUs | 8 vCPUs | 100% |
| Stockfish Engines | 4 active | 4 max | 100% |
| Analysis Queue | 25+ waiting | - | Severe backlog |
| Import Queue | 18 waiting | - | Severe backlog |

**Performance:**
- ❌ **Analytics page load:** 5-15s (cache misses, DB slow)
- ❌ **Game analysis:** 2-10 minutes (extreme queuing)
- ❌ **Import games:** 15-60 minutes
- ❌ **Many timeout errors**

**Critical Failures:**
- Queue timeouts (5-minute limit exceeded)
- Memory warnings (approaching 85% threshold)
- Database connection pool exhaustion
- HTTP connection pool exhaustion
- CPU throttling
- User frustration and abandonment

**Verdict:** ❌ **System collapse** - requires complete architectural redesign

---

## Performance Metrics by Operation

### Game Analysis (40-move game)

| Concurrent Jobs | Time per Game | Queue Wait | Total Time |
|-----------------|---------------|------------|------------|
| 1 | 5-8s | 0s | 5-8s |
| 4 | 6-9s | 0s | 6-9s |
| 8 | 8-12s | 10-20s | 18-32s |
| 12 | 10-15s | 30-60s | 40-75s |
| 20+ | 12-20s | 1-5 min | 72-320s |

### Game Import (200 games)

| Concurrent Imports | Time | Queue Wait | Total Time |
|-------------------|------|------------|------------|
| 1 | 1.5 min | 0s | 1.5 min |
| 2 | 1.8 min | 0s | 1.8 min |
| 4 | 2.5 min | 1-2 min | 3.5-4.5 min |
| 6 | 3 min | 2-4 min | 5-7 min |
| 10+ | 4 min | 5-15 min | 9-19 min |

### Analytics Page Load

| Cache Status | DB Query Time | Processing | Total Time |
|--------------|---------------|------------|------------|
| Cache Hit | N/A | <50ms | <500ms |
| Cache Miss (no load) | 500ms | 200ms | 700ms |
| Cache Miss (light load) | 800ms | 300ms | 1.1s |
| Cache Miss (heavy load) | 2-5s | 500ms | 2.5-5.5s |

---

## Database Capacity

### Supabase Connection Limits

Your Supabase instance has connection pooling, but the free/starter tier has limits:

| Tier | Max Connections | Current Usage | Headroom |
|------|----------------|---------------|----------|
| Free | 60 | ~5-10 | Good |
| Pro | 200 | ~5-10 | Excellent |

### Query Performance

**Current optimization status:**
- ✅ Indexes on user_id, platform, played_at
- ⚠️ Sequential queries (could use JOINs)
- ✅ Pagination for large datasets
- ✅ Caching for analytics

**Estimated capacity:**
- 50 queries/second: ✅ Comfortable
- 100 queries/second: ⚠️ May hit limits
- 200+ queries/second: ❌ Would need optimization

With **50 concurrent users** doing mixed activities:
- ~20-30 queries/second (analytics, imports, analysis saves)
- ✅ **Within safe limits**

With **100 concurrent users:**
- ~50-80 queries/second
- ⚠️ **Approaching limits** - would need query optimization

---

## Scaling Recommendations

### Phase 1: Optimize Current Infrastructure (0-30 Users)

**Cost:** $0
**Effort:** Low (1-2 days)
**Capacity Gain:** +50%

**Changes:**
1. Increase `MAX_CONCURRENT_IMPORTS` to 3
2. Increase engine pool to 4 engines
3. Increase `MAX_CONCURRENT_JOBS` to 5
4. Optimize database queries (use JOINs instead of sequential)
5. Implement position evaluation caching

**Expected Results:**
- Comfortable capacity for 25-30 users
- Reduced queue wait times by 40%
- Better resource utilization

---

### Phase 2: Medium Infrastructure Upgrade (30-75 Users)

**Cost:** +$20-40/month (Railway Pro + Supabase Pro)
**Effort:** Medium (3-5 days)
**Capacity Gain:** +100%

**Changes:**
1. Upgrade to Supabase Pro (200 connections)
2. Implement Redis for distributed caching
3. Increase Railway Pro resources (16 GB RAM, 8 vCPUs)
4. Add read replicas for database
5. Implement background job queue (Bull/Redis)
6. Add request queueing with priority

**Configuration:**
```python
MAX_CONCURRENT_IMPORTS = 5
MAX_CONCURRENT_JOBS = 8
ENGINE_POOL_MAX_SIZE = 8
MAX_WORKERS_PER_JOB = 8
```

**Expected Results:**
- Comfortable capacity for 50-75 users
- Minimal queue wait times (<10s)
- Better separation of read/write operations

---

### Phase 3: Horizontal Scaling (75-200 Users)

**Cost:** +$100-200/month
**Effort:** High (2-3 weeks)
**Capacity Gain:** +200-300%

**Architecture Changes:**
1. **Load balancer** - distribute requests across multiple API instances
2. **Multiple API instances** - 3-5 instances behind load balancer
3. **Dedicated analysis workers** - separate from web API
4. **Redis queue** - shared job queue across all instances
5. **CDN** - cache static assets and API responses
6. **Database connection pooling** - PgBouncer or similar
7. **Separate Stockfish workers** - dedicated analysis cluster

**Architecture:**
```
         Load Balancer (Railway/AWS)
              /    |    \
          API-1  API-2  API-3  (FastAPI instances)
              \    |    /
            Redis Queue/Cache
              /    |    \
       Worker-1 Worker-2 Worker-3  (Analysis workers)
              \    |    /
           Supabase Database
```

**Expected Results:**
- Comfortable capacity for 150-200 users
- Linear scaling (add more workers as needed)
- Better fault tolerance
- Geographic distribution possible

---

### Phase 4: Enterprise Scale (200+ Users)

**Cost:** $500-1000+/month
**Effort:** Very High (1-2 months)

**Architecture:**
- Kubernetes cluster
- Auto-scaling based on load
- Multiple geographic regions
- Microservices architecture
- Message queue (RabbitMQ/Kafka)
- Prometheus monitoring + Grafana dashboards
- Distributed tracing (Jaeger)

---

## Cost-Benefit Analysis

### Current State (Railway Pro - Optimized)

| Metric | Value |
|--------|-------|
| **Monthly Cost** | $20-30 |
| **Comfortable Capacity** | 10-20 users |
| **Max Capacity** | 30-40 users (with queuing) |
| **Cost per User** | $1-2/user |

### With Phase 1 Optimizations

| Metric | Value |
|--------|-------|
| **Monthly Cost** | $20-30 (no change) |
| **Comfortable Capacity** | 20-30 users |
| **Max Capacity** | 50 users (with queuing) |
| **Cost per User** | $0.60-1.00/user |

### With Phase 2 Upgrade

| Metric | Value |
|--------|-------|
| **Monthly Cost** | $60-80 |
| **Comfortable Capacity** | 50-75 users |
| **Max Capacity** | 100 users |
| **Cost per User** | $0.80-1.20/user |

### With Phase 3 Horizontal Scaling

| Metric | Value |
|--------|-------|
| **Monthly Cost** | $150-250 |
| **Comfortable Capacity** | 150-200 users |
| **Max Capacity** | 300+ users |
| **Cost per User** | $0.75-1.25/user |

---

## Monitoring & Alerts

### Current Monitoring

✅ **Implemented:**
- Memory monitor (60s interval, alerts at 70%/85%)
- Engine pool statistics
- Cache hit/miss tracking
- Analysis queue depth

❌ **Missing:**
- Request rate monitoring
- Database query performance tracking
- User session tracking
- Error rate monitoring
- Queue wait time tracking

### Recommended Monitoring

**Essential Metrics:**
1. **Request rate** - requests/second by endpoint
2. **Response time** - p50, p95, p99 latency
3. **Error rate** - 5xx errors, timeouts
4. **Queue depth** - analysis and import queues
5. **Queue wait time** - average and p95
6. **Cache hit rate** - should be >60%
7. **Database query time** - slow query alerts
8. **Memory usage** - trend analysis
9. **CPU usage** - peak and average
10. **Concurrent users** - active sessions

**Tools:**
- **Sentry** - error tracking
- **DataDog/New Relic** - APM (expensive)
- **Prometheus + Grafana** - metrics (self-hosted)
- **Railway Metrics** - built-in monitoring

---

## Load Testing Recommendations

To validate these estimates, you should perform load tests:

### Test Scenarios

**Test 1: Baseline Performance**
- 1 user doing each activity
- Measure: response times, resource usage
- Goal: Establish baseline metrics

**Test 2: Light Load**
- 10 concurrent users
- Mix: 40% analytics, 30% analysis, 20% import, 10% idle
- Duration: 15 minutes
- Goal: Verify comfortable capacity

**Test 3: Moderate Load**
- 25 concurrent users
- Same mix
- Duration: 30 minutes
- Goal: Find first bottlenecks

**Test 4: Heavy Load**
- 50 concurrent users
- Same mix
- Duration: 30 minutes
- Goal: Find breaking point

**Test 5: Spike Test**
- Ramp from 10 to 50 users in 2 minutes
- Hold for 5 minutes
- Goal: Test queue handling and recovery

### Load Testing Tools

**Option 1: Locust (Python)**
```python
from locust import HttpUser, task, between

class ChessAnalyticsUser(HttpUser):
    wait_time = between(5, 15)

    @task(4)
    def view_analytics(self):
        self.client.get("/api/v1/analytics?user_id=test&platform=lichess")

    @task(3)
    def analyze_game(self):
        self.client.post("/api/v1/analyze", json={...})

    @task(2)
    def import_games(self):
        self.client.post("/api/v1/import", json={...})
```

**Option 2: k6 (JavaScript)**
**Option 3: Artillery (JavaScript)**

---

## Bottleneck Summary

### Current Bottlenecks (Railway Pro - Optimized)

| Bottleneck | Limit | Impact at Users |
|------------|-------|-----------------|
| **Stockfish Engine Pool** | 3-4 engines | >15 users |
| **Analysis Concurrency** | 4 jobs | >20 users |
| **Import Concurrency** | 2 imports | >10 imports |
| **CPU** | 8 vCPUs | >40 users |
| **HTTP Connections** | 15 total | >8 imports |

### How to Identify Bottlenecks

1. **Monitor queue depths** - if consistently >5, you're bottlenecked
2. **Check engine pool** - if 100% utilized, increase pool size
3. **Watch CPU** - if >80% sustained, need more vCPUs
4. **Track response times** - if p95 >5s, investigate
5. **Monitor memory** - if trending up, check for leaks

---

## Recommendations by User Count

### 1-10 Users
- ✅ **Current setup is perfect**
- No changes needed
- Focus on feature development

### 10-25 Users
- ⚠️ **Minor optimizations recommended**
- Increase `MAX_CONCURRENT_IMPORTS` to 3
- Add queue priority for paid users
- Implement position caching

### 25-50 Users
- ⚠️ **Significant optimizations required**
- Implement all Phase 1 optimizations
- Consider Supabase Pro
- Add Redis for caching
- Increase engine pool to 5-6

### 50-100 Users
- ❌ **Infrastructure upgrade required**
- Implement Phase 2 upgrades
- Add read replicas
- Background job processing
- Request prioritization

### 100+ Users
- ❌ **Architectural changes required**
- Implement Phase 3 horizontal scaling
- Load balancing
- Dedicated analysis workers
- Geographic distribution

---

## Conclusion

### Current Status

Your application is **well-optimized for 10-20 concurrent users** with:
- Modern async architecture
- Memory-efficient engine pooling
- Sensible concurrency limits
- Good caching strategy

### Immediate Capacity

- **10 users:** ✅ Excellent performance
- **20 users:** ✅ Good performance
- **30 users:** ⚠️ Acceptable with some queuing
- **50+ users:** ❌ Significant delays

### Growth Path

1. **0-25 users:** Current infrastructure + Phase 1 optimizations
2. **25-75 users:** Phase 2 upgrade ($60-80/month)
3. **75-200 users:** Phase 3 horizontal scaling ($150-250/month)
4. **200+ users:** Enterprise architecture ($500+/month)

### Next Steps

1. **Implement Phase 1 optimizations** (1-2 days)
   - Zero cost, 50% capacity gain
   - Enables comfortable 25-30 user capacity

2. **Set up monitoring** (2-3 days)
   - Track actual usage patterns
   - Identify real bottlenecks
   - Make data-driven decisions

3. **Perform load testing** (1 week)
   - Validate capacity estimates
   - Find unexpected bottlenecks
   - Tune configuration

4. **Monitor and iterate**
   - Watch for queue buildup
   - Adjust limits as needed
   - Scale when approaching 70% capacity

---

**Analysis Date:** October 29, 2025
**Next Review:** After implementing Phase 1 optimizations or at 15 concurrent users
