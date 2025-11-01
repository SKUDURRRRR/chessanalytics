# 🚨 Disk I/O Optimization Plan - Supabase Free Tier
**Date:** November 1, 2025
**Project:** Chess Analytics
**Current Tier:** Nano (Free) - 43 Mbps baseline, 2,085 Mbps burst (30 min/day)
**Goal:** Reduce disk I/O to stay within free tier limits

---

## 📊 Current Situation Analysis

### Disk I/O Stats (from Supabase Dashboard)
- **Baseline IO Bandwidth:** 43 Mbps
- **Burst IO Bandwidth:** 2,085 Mbps (limited to 30 min/day)
- **Current Activity:** HIGH - 588 REST requests in 60 minutes
- **Status:** ⚠️ **Disk IO budget being consumed** - Will throttle after burst expires

### What's Causing High Disk I/O

#### 🔥 **CRITICAL ISSUES** (High Impact)

1. **Massive Query on Every Page Load**
   - **Location:** `src/components/simple/SimpleAnalytics.tsx:111`
   - **Problem:** Fetching **10,000 games** on EVERY analytics page load
   ```typescript
   getComprehensiveAnalytics(userId, platform, 10000)  // ❌ FETCHING 10K GAMES!
   ```
   - **Impact:** This single query can read 10-20 MB of data per page load
   - **Frequency:** Every user visiting analytics page

2. **Querying Both Tables Instead of Using View**
   - **Location:** `python/core/unified_api_server.py:1283-1348`
   - **Problem:** Querying `game_analyses` AND `move_analyses` separately
   ```python
   # Line 1283: Stats endpoint queries unified_analyses
   # Line 1343: Analyses endpoint also queries unified_analyses
   # But they're fetching 100-200+ records each time
   ```
   - **Impact:** 2x database reads, duplicate data scanning

3. **Short Cache TTL (5 minutes)**
   - **Location:** `python/core/unified_api_server.py:140`
   ```python
   CACHE_TTL_SECONDS = 300  # Only 5 minutes!
   ```
   - **Impact:** Cache expires quickly, forcing frequent re-queries
   - **Problem:** Users refreshing pages within 10-15 minutes hit DB again

4. **Frequent Import Polling (Every 2 Seconds)**
   - **Location:** `src/pages/SimpleAnalyticsPage.tsx:407-448`
   ```typescript
   largeImportIntervalRef.current = setInterval(async () => {
     const progress = await AutoImportService.getImportProgress(userId, platform)
     // ...
   }, 2000)  // ❌ Polling every 2 seconds!
   ```
   - **Impact:** During imports, hitting DB 30 times per minute

5. **Analysis Status Polling (Every 10 Seconds)**
   - **Location:** `src/pages/GameAnalysisPage.tsx:563`
   ```typescript
   setTimeout(poll, 10000) // Poll every 10 seconds for up to 5 minutes
   ```
   - **Impact:** Up to 30 polling requests per analysis session

#### ⚠️ **MODERATE ISSUES**

6. **No Batch Limit on Stats Query**
   - Fetching 100 analyses for stats calculation
   - Could be optimized to use aggregation instead

7. **Multiple Parallel API Calls on Page Load**
   - 6 parallel API calls on SimpleAnalytics load
   - Each triggers separate DB queries

---

## 🎯 Optimization Plan - Ordered by Impact

### Phase 1: Quick Wins (30 minutes) - **Expected 70-80% I/O Reduction**

#### ✅ Fix #1: Reduce Comprehensive Analytics Query (CRITICAL)
**Impact:** 50-60% I/O reduction
**Effort:** 5 minutes

```typescript
// File: src/components/simple/SimpleAnalytics.tsx:111
// BEFORE:
getComprehensiveAnalytics(userId, platform, 10000)

// AFTER:
getComprehensiveAnalytics(userId, platform, 500)  // Still enough for accurate stats
```

**Rationale:**
- Most users have < 500 games
- 500 games is statistically significant for analytics
- Reduces data read from ~20MB to ~1MB per request

---

#### ✅ Fix #2: Increase Cache TTL
**Impact:** 20-30% I/O reduction
**Effort:** 2 minutes

```python
# File: python/core/unified_api_server.py:140
# BEFORE:
CACHE_TTL_SECONDS = 300  # 5 minutes

# AFTER:
CACHE_TTL_SECONDS = 1800  # 30 minutes - analytics don't change that often
```

**Rationale:**
- Chess game analytics are relatively static
- Users typically play a few games per day
- 30-minute cache still feels responsive
- Massively reduces repeat queries from same user

---

#### ✅ Fix #3: Optimize Import Polling Interval
**Impact:** 10-15% I/O reduction
**Effort:** 3 minutes

```typescript
// File: src/pages/SimpleAnalyticsPage.tsx:448
// BEFORE:
}, 2000)  // Poll every 2 seconds

// AFTER:
}, 5000)  // Poll every 5 seconds - still responsive
```

**Rationale:**
- Import progress doesn't need sub-second updates
- 5-second intervals still feel real-time
- Reduces polling requests by 60% (30/min → 12/min)

---

### Phase 2: Database Optimizations (30 minutes) - **Expected 15-20% Additional Reduction**

#### ✅ Fix #4: Create Index for Unified Analyses View
**Impact:** 10-15% I/O reduction (faster queries = less disk time)
**Effort:** 10 minutes

Create new migration: `supabase/migrations/20251101000001_optimize_unified_analyses_queries.sql`

```sql
-- Composite index for most common query pattern
CREATE INDEX IF NOT EXISTS idx_unified_analyses_user_platform_date
  ON move_analyses(user_id, platform, analysis_date DESC)
  WHERE game_id NOT IN (SELECT game_id FROM game_analyses);

CREATE INDEX IF NOT EXISTS idx_game_analyses_user_platform_date
  ON game_analyses(user_id, platform, analysis_date DESC);

-- Analyze tables for query planner optimization
ANALYZE game_analyses;
ANALYZE move_analyses;
ANALYZE unified_analyses;
```

---

#### ✅ Fix #5: Use COUNT(*) Instead of Fetching All Records
**Impact:** 5-10% I/O reduction
**Effort:** 15 minutes

```python
# File: python/core/unified_api_server.py:1278-1286
# BEFORE: Fetching 100 records just to calculate stats
response = await asyncio.to_thread(
    lambda: db_client.table('unified_analyses')
    .select('*')
    .eq('user_id', canonical_user_id)
    .eq('platform', platform)
    .order('analysis_date', desc=True)
    .limit(100)
    .execute()
)

# AFTER: Use database aggregation
response = await asyncio.to_thread(
    lambda: db_client.rpc('get_analysis_stats', {
        'p_user_id': canonical_user_id,
        'p_platform': platform
    }).execute()
)
```

**Note:** Requires creating a PostgreSQL function for aggregation

---

### Phase 3: Advanced Optimizations (60 minutes) - **Expected 10-15% Additional Reduction**

#### ⚙️ Fix #6: Implement Smart Polling (Progressive Backoff)
**Impact:** 8-12% I/O reduction
**Effort:** 30 minutes

```typescript
// File: src/pages/SimpleAnalyticsPage.tsx:407
// Progressive backoff: Start fast, slow down over time
let pollInterval = 2000  // Start at 2s
let pollCount = 0

const pollWithBackoff = () => {
  // Increase interval after 10 polls: 2s → 3s → 5s → 10s
  if (pollCount === 10) pollInterval = 3000
  if (pollCount === 20) pollInterval = 5000
  if (pollCount === 30) pollInterval = 10000

  pollCount++
  return pollInterval
}
```

---

#### ⚙️ Fix #7: Optimize Stats Query with Database Function
**Impact:** 5-8% I/O reduction
**Effort:** 30 minutes

Create a PostgreSQL function that calculates stats in the database instead of fetching all records and calculating in Python.

---

## 📈 Expected Results

### Current State (Estimated)
- **Page Load Queries:**
  - 10,000 games × ~2KB = ~20 MB
  - 100 analyses = ~1 MB
  - Total: ~21 MB per page load
- **Poll Queries (per minute during import):**
  - 30 polls × ~10 KB = ~300 KB/min
- **Cache Hit Rate:** ~40% (5-minute TTL)

### After Phase 1 Optimizations
- **Page Load Queries:**
  - 500 games × ~2KB = ~1 MB ✅ **95% reduction**
  - 100 analyses = ~1 MB
  - Total: ~2 MB per page load
- **Poll Queries:**
  - 12 polls × ~10 KB = ~120 KB/min ✅ **60% reduction**
- **Cache Hit Rate:** ~80% (30-minute TTL) ✅ **2x improvement**

### Total Expected I/O Reduction: **75-85%** 🎉

---

## 🚀 Implementation Priority

### Immediate (Do Now) - 15 minutes
1. ✅ Reduce comprehensive analytics query (10000 → 500)
2. ✅ Increase cache TTL (5min → 30min)
3. ✅ Optimize polling interval (2s → 5s)

### Short-term (This Week) - 30 minutes
4. ✅ Create optimized indexes
5. ✅ Use database aggregation for stats

### Optional (Future Enhancement) - 60 minutes
6. ⚙️ Progressive polling backoff
7. ⚙️ Database-side stats calculation

---

## 🔧 Testing Plan

### Before Changes
1. Note current Supabase disk I/O metrics
2. Record page load time
3. Check cache hit rate

### After Each Phase
1. Monitor Supabase dashboard for 1 hour
2. Compare disk I/O bandwidth usage
3. Verify burst time remaining
4. Test analytics accuracy (ensure results still correct)

### Success Criteria
- ✅ Stay within 30-minute daily burst limit
- ✅ < 2s page load time
- ✅ No accuracy loss in analytics
- ✅ Disk I/O reduced by at least 70%

---

## 📝 Rollback Plan

All changes are easily reversible:

1. **Comprehensive Analytics Query:** Just change limit back to 10000
2. **Cache TTL:** Change constant back to 300
3. **Polling Interval:** Change timeout back to 2000
4. **Indexes:** Can be dropped without affecting functionality
5. **Database Functions:** Optional enhancement, can be removed

---

## 🎯 Next Steps

**READY TO IMPLEMENT?**

I can make all Phase 1 changes (Quick Wins) right now, which will give you **70-80% I/O reduction** in about 15 minutes.

Would you like me to:
1. ✅ **Implement Phase 1 immediately** (recommended - takes 15 min)
2. 📋 **Review the plan first** (if you want to discuss)
3. 🔧 **Implement all phases** (takes 2 hours total)

---

## 💡 Alternative: If Optimizations Aren't Enough

If after these optimizations you still hit limits:

### Cheaper Alternatives to $25/month Pro Plan
1. **Upgrade to Small instance ($10/month)**
   - 86 Mbps baseline (2x free tier)
   - May be enough with optimizations

2. **Implement request throttling**
   - Rate limit: 1 request per user per 5 seconds
   - Use browser-side throttling

3. **Add Redis caching layer**
   - Can be done cheaply with Upstash (free tier: 10k requests/day)
   - Reduces Supabase queries by 90%+

But I'm confident **Phase 1 optimizations will keep you on the free tier** ✅
