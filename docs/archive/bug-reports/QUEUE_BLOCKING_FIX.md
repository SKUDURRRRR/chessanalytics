# Queue Blocking Bug - Critical Fix

## Problem Description

When one user clicked "Analyze My Games", other users could NOT analyze their games simultaneously. Additionally, clicking "Analyze Games" multiple times would cause 500 errors and CORS failures.

### Symptoms
1. User A starts game analysis → works fine
2. User B tries to analyze → job submitted but never starts processing
3. User B's progress shows "No in-memory progress found"
4. Clicking "Analyze Games" multiple times → 500 Internal Server Error
5. Console shows: "Access to fetch at '...api/v1/analyze' blocked by CORS policy"

### From Logs
```
[QUEUE] Analysis job 7a21fbd7-058e-4b9b-b05d-3c309dd7ba4c submitted for rafas33 on chess.com
No in-memory progress found for any of the possible keys: ['rafas33_chess.com', 'rafas33_chess.com', 'Rafas33_chess.com']
```

The job was submitted but never processed!

## Root Cause

### Issue 1: Queue Processor Blocking (CRITICAL)

In `python/core/analysis_queue.py`, the `_process_queue()` method was **blocking**:

```python
# OLD CODE - BLOCKING ❌
async def _process_queue(self):
    while True:
        job = await self.queue.get()

        if len(self.running_jobs) >= self.max_concurrent_jobs:
            await self.queue.put(job)
            await asyncio.sleep(1)
            continue

        # This BLOCKS the queue processor!
        await self._start_job(job)  # ❌ Waits for entire job to complete
```

**The Problem:**
1. ✅ Queue processor picks up Job A for User 1
2. ❌ **`await self._start_job(job)` blocks until Job A fully completes**
3. ❌ Queue processor loop doesn't continue
4. ❌ Job B for User 2 sits in queue, never picked up
5. ❌ User 2 can't start analysis - stuck forever
6. ❌ Multiple clicks create more jobs that pile up
7. ❌ Eventually system crashes → 500 error

### Issue 2: No Duplicate Job Prevention

When users clicked "Analyze Games" multiple times (due to slow response or impatience):
- Each click created a new job
- Multiple jobs for same user piled up in queue
- System became overloaded
- Caused 500 errors and crashes

## The Solution

### Fix 1: Non-Blocking Queue Processing

Changed `_process_queue()` to start jobs in the **background**:

```python
# NEW CODE - NON-BLOCKING ✅
async def _process_queue(self):
    while True:
        job = await self.queue.get()

        if len(self.running_jobs) >= self.max_concurrent_jobs:
            await self.queue.put(job)
            await asyncio.sleep(1)
            continue

        # Start job in background - don't wait for it!
        asyncio.create_task(self._start_job(job))  # ✅ Returns immediately
        print(f"[QUEUE] Started job {job.job_id} in background, continuing queue processing...")
```

**How It Works:**
1. ✅ Queue processor picks up Job A
2. ✅ **`asyncio.create_task()` starts Job A in background**
3. ✅ Queue processor **immediately continues loop**
4. ✅ Queue processor picks up Job B
5. ✅ Job B starts in background too
6. ✅ **Both jobs run concurrently!**
7. ✅ Multiple users can analyze simultaneously

### Fix 2: Duplicate Job Prevention

Added check in `submit_job()`:

```python
async def submit_job(self, user_id: str, platform: str, ...):
    # Check for existing pending or running jobs
    with self.lock:
        for existing_job in self.jobs.values():
            if (existing_job.user_id == user_id and
                existing_job.platform == platform and
                existing_job.status in [AnalysisStatus.PENDING, AnalysisStatus.RUNNING]):
                print(f"[QUEUE] Job already exists for {user_id} on {platform}")
                return existing_job.job_id  # Return existing job

    # Create new job only if none exists
    job_id = str(uuid.uuid4())
    # ...
```

**How It Works:**
1. User clicks "Analyze Games" → Job A created
2. User clicks again (impatiently) → Checks for existing job
3. ✅ **Returns Job A's ID instead of creating duplicate**
4. ✅ No duplicate jobs pile up
5. ✅ System stays stable

## Benefits

### Before Fix
- ❌ Only ONE user could analyze at a time
- ❌ Queue processor blocked by first job
- ❌ Other users' jobs never processed
- ❌ Multiple clicks crashed system
- ❌ 500 errors and CORS failures
- ❌ Poor user experience

### After Fix
- ✅ **Multiple users can analyze simultaneously**
- ✅ Queue processor handles all jobs concurrently
- ✅ Jobs start immediately (up to max_concurrent_jobs limit)
- ✅ Multiple clicks handled gracefully (no duplicates)
- ✅ No more 500 errors from duplicate jobs
- ✅ Excellent user experience

## Technical Details

### Concurrency Control

The queue still respects `max_concurrent_jobs` limit:
- Default: 4 concurrent jobs
- Queue processor checks `len(self.running_jobs)` before starting new job
- If at limit, puts job back in queue and waits
- Once a job completes, slot opens for next job

### Thread Safety

- Uses `threading.Lock()` for thread-safe access to shared state
- All modifications to `self.jobs` and `self.running_jobs` protected by lock
- Duplicate check is atomic

### Event Loop Yielding

Using `asyncio.create_task()` ensures:
- Queue processor yields control back to event loop
- Other async tasks (API requests, progress polling) can run
- True concurrent execution

## Testing

### Test 1: Single User
1. User A clicks "Analyze My Games"
2. ✅ Analysis starts immediately
3. ✅ Progress updates appear in real-time

### Test 2: Multiple Users Simultaneously
1. User A clicks "Analyze My Games" (lichess)
2. While User A analyzing, User B clicks "Analyze My Games" (chess.com)
3. ✅ **Both analyses start and run concurrently**
4. ✅ Both users see progress updates
5. ✅ Neither user is blocked

### Test 3: Multiple Clicks
1. User A clicks "Analyze My Games"
2. User A clicks again (3 more times rapidly)
3. ✅ **Only one job created**
4. ✅ No 500 errors
5. ✅ Analysis completes normally

### Test 4: Capacity Limit
1. Start 4 analysis jobs (at max_concurrent_jobs limit)
2. User E tries to start 5th job
3. ✅ Job E queued (not started yet)
4. ✅ Once Job 1 completes, Job E starts automatically
5. ✅ System stays stable

## Monitoring

Check backend logs for:
```
[QUEUE] Analysis job <job_id> submitted for <user> on <platform>
[QUEUE] Started job <job_id> in background, continuing queue processing...
[QUEUE] Job <job_id> starting for user <user> on <platform>
[QUEUE] Progress update for job <job_id>
[QUEUE] Job <job_id> complete
```

For duplicate prevention:
```
[QUEUE] Job already exists for <user> on <platform> (job_id: <existing_id>, status: running)
[QUEUE] Returning existing job_id instead of creating duplicate
```

## Related Files

- `python/core/analysis_queue.py` - Main fix location (lines 84-110, 254-298)
- `python/core/unified_api_server.py` - Calls queue.submit_job()
- `docs/CONCURRENCY_FIX_ANALYSIS_BLOCKING.md` - Related to parallel analysis engine fix

## Key Differences from Parallel Engine Fix

The parallel engine fix (`CONCURRENCY_FIX_ANALYSIS_BLOCKING.md`) addressed blocking within a single analysis job. This fix addresses blocking at the **queue level** - ensuring multiple jobs can be processed concurrently.

Both fixes were necessary for true multi-user concurrency!
