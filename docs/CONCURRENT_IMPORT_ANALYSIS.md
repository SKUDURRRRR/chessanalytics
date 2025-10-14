# Concurrent Import Issue Analysis

## Problem
When two users pressed "Import More Games" simultaneously:
- User 1 (krecetas): Import timed out after 60 seconds
- User 2 (skudurelis): Import also timed out after 60 seconds

## Root Cause Analysis

### 1. **No Global Concurrency Control**
The current implementation only prevents a single user from running multiple imports:
```python
if key in large_import_progress and large_import_progress[key].get('status') == 'importing':
    raise HTTPException(status_code=409, detail="Import already in progress")
```
**Problem**: Multiple different users can run imports simultaneously, overwhelming system resources.

### 2. **No HTTP Connection Pooling**
Each API call creates a new `aiohttp.ClientSession()`:
```python
async with aiohttp.ClientSession() as session:
    # Makes request
```
**Problem**: When multiple imports run, this creates many concurrent HTTP connections to external APIs (Lichess/Chess.com), which can hit rate limits or exhaust connection pools.

### 3. **Database Query Contention**
Each import queries all existing games:
```python
existing_games = supabase_service.table('games').select('provider_game_id').eq(
    'user_id', canonical_user_id
).eq('platform', platform).limit(10000).execute()
```
**Problem**: Multiple concurrent imports create competing database queries, slowing everything down.

### 4. **No External API Rate Limiting**
The code makes direct API calls without rate limiting:
- Lichess API: Has rate limits per IP
- Chess.com API: Has rate limits and requires user-agent
**Problem**: Concurrent imports can trigger rate limiting, causing timeouts.

### 5. **Resource Constraints on Railway Hobby Tier**
Railway Hobby tier has limited:
- CPU: Shared vCPU
- Memory: 512MB-1GB
- Network: Limited bandwidth
**Problem**: Two concurrent imports can exhaust available resources.

## Current Capacity
**Answer**: Currently, the system can theoretically handle **unlimited concurrent imports** from different users, but in practice:
- On Railway Hobby tier: **1-2 concurrent imports** before timeouts occur
- On higher tiers with better resources: Could handle **3-5 concurrent imports**

## Impact of Concurrent Imports

### What Happens with 2 Concurrent Imports:
1. Both create background async tasks
2. Both query database for existing games (competing for DB connections)
3. Both make HTTP requests to external APIs (competing for network)
4. Both parse large PGN responses (competing for CPU/memory)
5. Both write batches to database (competing for DB write locks)
6. System resources get exhausted → both timeout

## Solutions

### Solution 1: Global Import Semaphore (Recommended)
Limit total concurrent imports across all users:
```python
MAX_CONCURRENT_IMPORTS = 2  # For Railway Hobby tier
import_semaphore = asyncio.Semaphore(MAX_CONCURRENT_IMPORTS)
```

### Solution 2: HTTP Connection Pooling
Reuse HTTP clients instead of creating new ones. **Important**: Always manage the session lifecycle properly to avoid resource leaks:

#### Option A: Application Lifecycle Management (Recommended for FastAPI)
```python
# Create at module level
http_client = None

async def startup():
    global http_client
    http_client = aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit=10, limit_per_host=2),
        timeout=aiohttp.ClientTimeout(total=120)
    )

async def shutdown():
    global http_client
    if http_client:
        await http_client.close()

# Register with FastAPI app
app.add_event_handler("startup", startup)
app.add_event_handler("shutdown", shutdown)
```

#### Option B: Async Context Manager (Recommended for scripts)
```python
# In your main async entrypoint
async def main():
    async with aiohttp.ClientSession(
        connector=aiohttp.TCPConnector(limit=10, limit_per_host=2),
        timeout=aiohttp.ClientTimeout(total=120)
    ) as http_client:
        # Use http_client here
        pass
    # Session automatically closed when exiting context
```

#### Option C: AsyncExitStack (For complex scenarios)
```python
from contextlib import AsyncExitStack

async def main():
    async with AsyncExitStack() as stack:
        http_client = await stack.enter_async_context(
            aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(limit=10, limit_per_host=2),
                timeout=aiohttp.ClientTimeout(total=120)
            )
        )
        # Use http_client here
        pass
    # All contexts automatically cleaned up
```

### Solution 3: Queue-Based Import System
Queue imports and process them sequentially or with limited concurrency:
```python
import_queue = asyncio.Queue()
# Process queue with max 2 concurrent workers
```

### Solution 4: Increase Timeout
Change frontend timeout from 60s to 120s for large imports.

### Solution 5: Better Progress Feedback
Return immediate response and poll for progress more frequently.

## Recommended Implementation
Implement Solution 1 (Global Semaphore) + Solution 2 (Connection Pooling) + Solution 4 (Longer Timeout):
- Allow max 2 concurrent imports on Railway Hobby tier
- Third user gets queued or receives "import in progress" message
- Reuse HTTP connections to reduce overhead
- Increase timeout to 120 seconds
- Add better progress updates every 10 seconds

## Expected Results After Fix
- **Concurrent Import Capacity**: 2 users (Railway Hobby), 4-5 users (higher tiers)
- **Timeout Rate**: < 5% (down from current ~100% with 2+ concurrent)
- **User Experience**: Clear queue position, better progress updates
- **Resource Usage**: More efficient, less connection overhead

