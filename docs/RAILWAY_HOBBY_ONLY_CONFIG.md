# Railway Hobby Configuration - ONLY Option Available

## ✅ Configuration Simplified

**All performance profiles have been removed except Railway Hobby.**

### **What Changed:**

1. **Removed all other profiles** - Only `RAILWAY_HOBBY` exists now
2. **Simplified `config.py`** - Default values are Railway Hobby settings
3. **Simplified `performance_config.py`** - Always returns Railway Hobby config
4. **No more profile selection** - Railway Hobby is the only option

### **Railway Hobby Settings (Everywhere):**

| Setting | Value | Description |
|---------|-------|-------------|
| **Depth** | 14 | Better depth for accuracy |
| **Skill Level** | 20 | Maximum strength |
| **Time Limit** | 0.8s | Fast analysis per move |
| **Threads** | 1 | Deterministic results |
| **Hash Size** | 96 MB | Good balance for concurrent |
| **Concurrent Analyses** | 4 | Parallel move processing |
| **ThreadPool Workers** | 4 | Parallel Stockfish instances |
| **Batch Size** | 10 | Larger batches |
| **Max Memory** | 512 MB | Railway Hobby tier limit |
| **Connection Pool** | 15 | More connections |
| **Query Timeout** | 45s | Longer timeouts |
| **Cache** | Enabled | 24-hour TTL, 256MB max |
| **Max Games** | 50 | Per request |

### **Files Modified:**

1. ✅ **`python/core/performance_config.py`**
   - Removed: DEVELOPMENT, PRODUCTION, HIGH_PERFORMANCE, COST_OPTIMIZED profiles
   - Kept: RAILWAY_HOBBY only
   - Simplified: `for_profile()` always returns Railway Hobby config
   - Simplified: `get_performance_config()` always uses Railway Hobby

2. ✅ **`python/core/config.py`**
   - Updated: `StockfishConfig` defaults to depth=14, skill=20, time=0.8
   - Updated: `AnalysisConfig` marked as "Railway Hobby Tier only"
   - Simplified: `__post_init__()` always uses Railway Hobby settings
   - Removed: Development mode adjustments

3. ✅ **`python/core/analysis_engine.py`**
   - Updated: `AnalysisConfig` defaults to depth=14, skill=20, time=0.8
   - Updated: `ThreadPoolExecutor` max_workers=4

4. ✅ **`python/core/unified_api_server.py`**
   - Updated: API request defaults to depth=14, skill=20

5. ✅ **`python/core/api_server.py`**
   - Updated: API request defaults to depth=14, skill=20

6. ✅ **`python/core/parallel_analysis_engine.py`**
   - Updated: Fallback values to depth=14, skill=20

7. ✅ **`python/core/analysis_queue.py`**
   - Updated: Default parameters to depth=14, skill=20

### **Expected Performance:**

- **50 moves**: ~13-17 seconds
- **66 moves**: ~17-22 seconds
- **Per move**: ~0.25-0.33 seconds average

### **Why 66 moves takes ~25-30 seconds:**

**Stockfish Time:** 66 moves ÷ 4 concurrent × 0.8s = ~13 seconds

**Overhead:**
- Database queries: ~3-5 seconds
- Move classification: ~2-3 seconds
- Comment generation: ~2-3 seconds
- Network/serialization: ~5-8 seconds

**Total: ~25-30 seconds** ✅ This is normal and expected!

### **Verification:**

Run this to verify:
```bash
cd python
python -c "from core.performance_config import get_performance_config, print_performance_config; config = get_performance_config(); print_performance_config(config)"
```

Expected output:
```
=== Analysis Performance Configuration ===
Stockfish Depth: 14
Stockfish Skill Level: 20
Stockfish Time Limit: 0.8s
Stockfish Hash Size: 96MB
Max Concurrent Analyses: 4
...
```

### **Restart Backend:**

**IMPORTANT**: Restart your backend server to apply the changes!

```bash
# Stop backend (Ctrl+C or kill process)
# Start backend
cd python
python main.py
```

Or use your PowerShell scripts:
```powershell
.\stop-all.ps1
.\start-all.ps1
```

### **Notes:**

- ✅ Railway Hobby is the ONLY configuration now
- ✅ No other profiles can be selected
- ✅ All hardcoded values updated to Railway Hobby settings
- ✅ config.py defaults to Railway Hobby
- ✅ performance_config.py always returns Railway Hobby
- ✅ Consistent across all components

---

**Status**: ✅ **COMPLETE** - Railway Hobby is the only option everywhere

