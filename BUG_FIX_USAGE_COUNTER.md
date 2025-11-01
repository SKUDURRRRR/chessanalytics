# Bug Fix: Usage Counter Not Updating After Batch Analysis

## Problem

User `skalbiankee@gmail.com` (and potentially other registered users) analyzed 4+ games through the "Analyze games" button, but the UI still shows "Analyses 5/5" at the top, indicating that the usage counter is not being decremented.

## Root Cause

The batch analysis flow was **not incrementing the usage counter** when analyses completed. The issue occurred because:

1. **Batch analysis is asynchronous**: When a user clicks "Analyze games", the analysis is submitted to a queue and runs in the background.

2. **No usage tracking on completion**: The queue completion handler (`analysis_queue.py`) was updating progress state but **never called** `usage_tracker.increment_usage()`.

3. **Comment without implementation**: In `unified_api_server.py` line 1193, there was a comment saying "Usage tracking for batch analysis is handled in the queue completion handler" - but this was **NOT implemented**.

4. **Frontend correctly refreshes**: The frontend (`SimpleAnalyticsPage.tsx` line 614-615) correctly calls `refreshUsageStats()` after analysis completes, but since the backend never incremented the counter, the stats remained unchanged (5/5).

## Solution

The fix involves passing the authenticated user ID through the entire batch analysis pipeline and incrementing usage when the queue job completes:

### Changes Made

#### 1. **python/core/analysis_queue.py**

- **Line 36**: Added `auth_user_id: Optional[str] = None` field to `AnalysisJob` dataclass to track the authenticated user.

- **Lines 273-282**: Updated `submit_job()` method to accept `auth_user_id` parameter.

- **Lines 178-200**: Added usage tracking in the job completion handler:
  ```python
  # Increment usage for authenticated users
  if job.auth_user_id:
      try:
          from .unified_api_server import usage_tracker
          if usage_tracker:
              # Increment by the number of games actually analyzed
              games_analyzed = job.analyzed_games
              if games_analyzed > 0:
                  success = await usage_tracker.increment_usage(
                      job.auth_user_id,
                      'analyze',
                      count=games_analyzed
                  )
                  if success:
                      print(f"[QUEUE] Incremented usage for user {job.auth_user_id}: {games_analyzed} analyses")
                  else:
                      print(f"[QUEUE] Warning: Failed to increment usage for user {job.auth_user_id}")
              else:
                  print(f"[QUEUE] No games analyzed, skipping usage increment")
      except Exception as e:
          print(f"[QUEUE] Warning: Could not increment usage tracking: {e}")
          import traceback
          traceback.print_exc()
  ```

#### 2. **python/core/unified_api_server.py**

- **Line 1195**: Updated call to `_handle_batch_analysis()` to pass `auth_user_id`.

- **Lines 7896-7901**: Updated `_handle_batch_analysis()` function signature to accept `auth_user_id` parameter.

- **Line 7923**: Pass `auth_user_id` to `queue.submit_job()`.

## How It Works Now

1. **User clicks "Analyze games"** → Frontend calls `/api/v1/analyze` endpoint
2. **Backend authenticates user** → Extracts `auth_user_id` from JWT token (line 1129)
3. **Check usage limit** → Verifies user hasn't exceeded limit (line 1132-1138)
4. **Submit to queue** → Pass `auth_user_id` to queue (line 7923)
5. **Analysis runs** → Queue processes games in background
6. **Completion** → Queue handler increments usage counter (line 186-190)
7. **Frontend refreshes** → Calls `refreshUsageStats()` and displays updated counter

## Testing

To verify the fix:

1. **Before**: User analyzes games → Counter stays at "5/5"
2. **After**: User analyzes games → Counter updates to "4/5" (or appropriate value based on games analyzed)

## Important Notes

- The usage counter increments by the **actual number of games analyzed**, not just 1 per batch.
- If a batch analysis analyzes 3 games, the counter increments by 3.
- Anonymous users are **not affected** - they continue to use localStorage-based tracking.
- The fix is **backwards compatible** - if `auth_user_id` is None, no usage tracking occurs.

## Related Code

- **Frontend display**: `src/components/Navigation.tsx` lines 88-106
- **Frontend refresh**: `src/pages/SimpleAnalyticsPage.tsx` lines 614-615
- **Usage tracking service**: `python/core/usage_tracker.py`
- **Auth flow**: `src/contexts/AuthContext.tsx` lines 93-137

## Issue Resolved

✅ Registered users' analysis counter now correctly decrements after each batch analysis
✅ Usage stats refresh properly shows remaining analyses
✅ No impact on single-game analysis or anonymous users
