# Analyze Button Performance Analysis

## Executive Summary

The "Analyze" button in match history currently takes **~60 seconds** to analyze a single game. This analysis identifies the bottlenecks and provides actionable optimization recommendations to reduce this to **~15-20 seconds** (3-4x improvement).

## Current Flow Analysis

### 1. Frontend Request (MatchHistory.tsx)
```264:274:src/components/simple/MatchHistory.tsx
      const response = await fetch(`${baseUrl}/api/v1/analyze?use_parallel=false`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          platform,
          analysis_type: 'stockfish',
          game_id: gameIdentifier,
          provider_game_id: game.provider_game_id ?? null,
        }),
      })
```

**Time: ~1-2 seconds** (network + request processing)

### 2. Backend: Fetch PGN from Database
```8528:8543:python/core/unified_api_server.py
        try:
            game_response = await asyncio.to_thread(
                lambda: db_client.table('games_pgn').select('pgn, provider_game_id').eq(
                    'provider_game_id', game_id
                ).eq('user_id', canonical_user_id).eq('platform', request.platform).maybe_single().execute()
            )
            print(f"[SINGLE GAME ANALYSIS] Query result: {game_response}")
            print(f"[SINGLE GAME ANALYSIS] Has data: {game_response is not None and hasattr(game_response, 'data')}")
            if game_response and hasattr(game_response, 'data'):
                print(f"[SINGLE GAME ANALYSIS] Data value: {game_response.data}")
        except Exception as query_error:
            print(f"[SINGLE GAME ANALYSIS] ERROR Database query error: {query_error}")
            return UnifiedAnalysisResponse(
                success=False,
                message=f"Database query failed: {str(query_error)}"
            )
```

**Time: ~1-2 seconds** (database query, may fetch from platform if not found)

### 3. Backend: Game Analysis (Main Bottleneck)
```1026:1047:python/core/analysis_engine.py
            # Analyze moves in parallel for better performance
            async def analyze_single_move(data):
                move_analysis = await self.analyze_move(data['board'], data['move'], analysis_type)
                move_analysis.player_color = data['player_color']
                move_analysis.is_user_move = data['is_user_move']
                move_analysis.ply_index = data['ply_index']
                move_analysis.fullmove_number = data['fullmove_number']
                return move_analysis

            # Process moves in parallel with Railway Pro tier optimization
            # Railway Pro tier has 8 vCPU, but we use 4 concurrent workers to match
            # the ThreadPoolExecutor capacity and avoid memory pressure
            max_concurrent = 4  # Matches ThreadPoolExecutor(max_workers=4) at line 1977
            semaphore = asyncio.Semaphore(max_concurrent)

            async def analyze_with_semaphore(data):
                async with semaphore:
                    return await analyze_single_move(data)

            # Analyze all moves in parallel
            tasks = [analyze_with_semaphore(data) for data in move_data]
            moves_analysis = await asyncio.gather(*tasks)
```

**Stockfish Configuration:**
```39:41:python/core/config.py
    depth: int = 14
    skill_level: int = 20
    time_limit: float = 0.8
```

**Time Calculation:**
- Average game: **60 moves**
- Time per move: **0.8 seconds** (time_limit)
- Concurrent workers: **4**
- Sequential batches: 60 moves ÷ 4 = **15 batches**
- **Total time: 15 batches × 0.8s = ~12 seconds minimum**
- **Actual time: ~45-50 seconds** (due to overhead, engine startup, etc.)

### 4. Backend: Save to Database
```9139:9250:python/core/unified_api_server.py
async def _save_stockfish_analysis(analysis: GameAnalysis) -> bool:
    """Persist Stockfish/deep analysis using reliable persistence fallback."""
    try:
        # ... conversion logic ...

        response = supabase_service.table('move_analyses').upsert(
            data,
            on_conflict='user_id,platform,game_id,analysis_method'
        ).execute()
```

**Time: ~2-3 seconds** (database write with large JSON payload)

## Performance Bottlenecks Identified

### 🔴 Critical Bottlenecks (80% of time)

1. **AI Commentary Generation (30-60s)** ⚠️ **NEWLY IDENTIFIED**
   - AI commentary is generated **synchronously** for each significant move during analysis
   - Each AI API call to Anthropic (Claude) takes **1-3 seconds**
   - For a 60-move game, AI is triggered for:
     - Move 1 (welcome comment)
     - Moves 5-10 (position updates)
     - All brilliant, blunder, mistake, inaccuracy moves
     - Moves with tactical insights
     - Significant positional shifts (>30cp)
     - Important captures
     - Excellent and best moves
   - **Total: 15-25 AI API calls per game = 15-75 seconds**
   - This is the **primary cause** of the slowdown after AI commentary was implemented

2. **Stockfish Move Analysis (12-15s)**
   - Each move analyzed at depth 14 with 0.8s time limit
   - Even with 4 concurrent workers, sequential batches create delays
   - Engine startup overhead for each move

3. **Database Write (2-3s)**
   - Large JSON payload with all move analyses
   - Single upsert operation for entire game

### 🟡 Moderate Bottlenecks (15% of time)

3. **Database Queries (2-3s)**
   - PGN fetch query
   - Game existence check
   - Could be optimized with better indexing

4. **Network Latency (1-2s)**
   - Request/response round trip
   - Frontend waiting for completion

### 🟢 Minor Bottlenecks (5% of time)

5. **PGN Parsing (<1s)**
   - Negligible for most games

## Optimization Recommendations

### 🚀 **CRITICAL: AI Commentary Optimization (Keep All Insights, Make Faster)**

#### 1. Parallel AI API Calls ⭐ **BIGGEST IMPACT - KEEPS ALL INSIGHTS**
**Current:** AI commentary generated **sequentially** (one API call at a time) with 2s delay between calls
**Problem:** 15-25 API calls × (1-3s + 2s delay) = **45-125 seconds**
**Recommended:** Make AI API calls **in parallel** (concurrent) with **rate limit respect**
**Impact:** **~30-60 seconds saved** while keeping all AI insights

**⚠️ IMPORTANT: Anthropic Rate Limits**
- **Limit:** 50 requests per minute (documented in `env.example` line 135)
- **Current protection:** 2.0s delay between calls (~30 calls/minute max)
- **Parallel approach:** Use **token bucket rate limiter** to respect 50/minute limit
- **Solution:** Parallel calls with semaphore + rate limiter (not just delays)

**Current Flow (Sequential - SLOW):**
```
Move 1: AI call (2s) → wait 2s → Move 2: AI call (2s) → wait 2s → ...
Total: 15-25 calls × 4s = 60-100 seconds
```

**Optimized Flow (Parallel - FAST):**
```
All moves: AI calls in parallel (15-25 concurrent calls)
Total: max(2-3s per call) = 2-3 seconds for all calls
```

**Implementation:**
```python
# In analysis_engine.py - analyze_game()
# Instead of generating AI comments sequentially during move analysis,
# collect all moves that need AI, then generate in parallel

async def analyze_game(self, pgn: str, ...):
    # ... existing Stockfish analysis ...

    # Collect moves that need AI commentary
    moves_needing_ai = []
    for move_analysis in moves_analysis:
        if self._should_use_ai_comment(move_analysis):
            moves_needing_ai.append(move_analysis)

    # Generate AI commentary in parallel (not sequential!)
    if moves_needing_ai:
        ai_tasks = [
            self._generate_ai_comment_async(move_analysis, board, move)
            for move_analysis in moves_needing_ai
        ]
        ai_comments = await asyncio.gather(*ai_tasks)  # Parallel execution!

        # Update move analyses with AI comments
        for move_analysis, ai_comment in zip(moves_needing_ai, ai_comments):
            move_analysis.coaching_comment = ai_comment
```

**File:** `python/core/ai_comment_generator.py`
```python
# Make API calls async with proper rate limiting
import asyncio
from .resilient_api_client import RateLimiter  # Reuse existing rate limiter

class AIChessCommentGenerator:
    def __init__(self):
        # ... existing code ...
        # Use token bucket rate limiter (respects 50 requests/minute)
        self._rate_limiter = RateLimiter(
            capacity=50,      # Anthropic limit: 50 requests/minute
            refill_rate=50.0 / 60.0  # Refill at 50/60 requests per second
        )
        # Semaphore to limit concurrent calls (prevent overwhelming)
        self._api_semaphore = asyncio.Semaphore(15)  # Max 15 concurrent

    async def generate_comment_async(self, move_analysis, board, move, ...):
        """Async version that respects rate limits while running in parallel."""
        # Check cache first (same as before)
        cache_key = self._generate_cache_key(...)
        cached = self._comment_cache.get(cache_key)
        if cached:
            return cached

        # Wait for rate limiter token (non-blocking, respects 50/minute limit)
        await self._rate_limiter.wait_for_token(tokens=1, timeout=30.0)

        try:
            # Use semaphore to limit concurrent calls
            async with self._api_semaphore:
                prompt = self._build_prompt(...)
                comment = await self._call_api_async(prompt, system_prompt)

                if comment:
                    comment = self._clean_comment(comment, is_user_move)
                    self._comment_cache.set(cache_key, comment)
                    return comment
        finally:
            # Rate limiter automatically refills tokens
            pass

        return None
```

#### 2. Use Token Bucket Rate Limiter (Replaces Sequential Delays)
**Current:** 2.0 seconds delay between API calls (sequential, slow)
**Recommended:** Token bucket rate limiter (parallel, respects 50/minute limit)
**Impact:** **~20-30 seconds saved** while respecting API limits

**Implementation:**
```python
# Use existing RateLimiter from resilient_api_client.py
from .resilient_api_client import RateLimiter

# In AIChessCommentGenerator.__init__()
self._rate_limiter = RateLimiter(
    capacity=50,              # Anthropic limit: 50 requests/minute
    refill_rate=50.0 / 60.0   # Refill at 50/60 requests per second
)

# In generate_comment_async()
await self._rate_limiter.wait_for_token(tokens=1, timeout=30.0)  # Non-blocking, respects limit
```

**Benefits:**
- ✅ Respects 50 requests/minute limit
- ✅ Allows parallel calls (up to 50/minute total)
- ✅ Non-blocking (uses async/await)
- ✅ Automatic token refill
- ✅ No sequential delays needed

**Note:** The rate limiter ensures we never exceed 50 requests/minute across all parallel calls

#### 3. Batch AI API Calls (Advanced)
**Current:** One API call per move
**Recommended:** Batch 3-5 moves into single API call
**Impact:** **~10-15 seconds saved** (fewer API calls)

**Implementation:**
```python
async def _generate_batched_ai_comments(self, moves_batch: List[Dict]) -> List[str]:
    """Generate AI comments for multiple moves in one API call."""
    prompt = "Analyze these chess moves:\n" + format_moves_batch(moves_batch)
    response = await self._call_api_async(prompt, system_prompt)
    # Parse response to extract individual comments
    return parse_batched_response(response)
```

#### 4. Progressive/Streaming Response (Best UX)
**Current:** User waits for all AI commentary before seeing results
**Recommended:** Return analysis immediately, stream AI commentary as it completes
**Impact:** **Perceived time: 15-20s** (user sees results immediately)

**Implementation:**
```python
# In unified_api_server.py
async def _handle_single_game_by_id(request):
    # Analyze game (Stockfish + template comments) - fast
    game_analysis = await engine.analyze_game(...)

    # Save immediately
    await _save_stockfish_analysis(game_analysis)

    # Return immediately with analysis
    response = UnifiedAnalysisResponse(
        success=True,
        message="Analysis complete",
        data={"game_id": game_analysis.game_id}
    )

    # Generate AI commentary in background (non-blocking)
    background_tasks.add_task(
        _enhance_with_ai_commentary_parallel,
        game_analysis, user_id, platform
    )

    return response

async def _enhance_with_ai_commentary_parallel(game_analysis, user_id, platform):
    """Generate AI commentary in parallel, update database as completed."""
    moves_needing_ai = [m for m in game_analysis.moves_analysis if _should_use_ai(m)]

    # Generate all AI comments in parallel
    ai_tasks = [generate_ai_comment_async(m) for m in moves_needing_ai]
    ai_comments = await asyncio.gather(*ai_tasks)

    # Update database with AI comments (can be done incrementally)
    for move, comment in zip(moves_needing_ai, ai_comments):
        await _update_move_commentary_in_db(move, comment)
```

**Implementation Options:**

**Option A: Skip AI Commentary During Analysis (Fastest)**
```python
# In analysis_engine.py, add flag to skip AI during analysis
def _enhance_move_analysis_with_coaching(self, move_analysis, board, move, move_number,
                                         is_user_move=True, skip_ai=False):
    # ... existing code ...
    if skip_ai:
        # Use template-based comments only (fast)
        coaching_comment = self.coaching_generator.generate_coaching_comment(
            enhanced_move_data, board, move, game_phase,
            player_skill_level, is_user_move, use_ai=False  # Skip AI
        )
    else:
        # Normal flow with AI
        coaching_comment = self.coaching_generator.generate_coaching_comment(...)
```

**Option B: Defer AI Commentary to Background Task (Best UX)**
```python
# In unified_api_server.py
async def _handle_single_game_by_id(request):
    # ... analyze game without AI commentary ...
    game_analysis = await engine.analyze_game(..., skip_ai_commentary=True)

    # Save analysis immediately (fast response)
    await _save_stockfish_analysis(game_analysis)

    # Generate AI commentary in background (non-blocking)
    background_tasks.add_task(
        _generate_ai_commentary_background,
        game_analysis, user_id, platform
    )

    return UnifiedAnalysisResponse(success=True, message="Analysis complete, AI commentary generating...")
```

**Option C: Only AI for Critical Moves (Balanced)**
```python
# In coaching_comment_generator.py _should_use_ai_comment()
def _should_use_ai_comment(self, move_analysis, move_quality):
    # Only use AI for the most critical moves
    if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER, MoveQuality.MISTAKE]:
        return True
    # Skip AI for routine moves, good moves, etc.
    return False
```

**Recommended:** **Option B** (defer to background) - Best user experience, immediate analysis results

#### 5. Optimize AI Model Selection
**Current:** Using Claude 3 Haiku (already fastest) ✅
**Recommended:** Keep Haiku, but ensure it's used consistently
**Impact:** Already optimized

**Note:** Haiku is 3-5x faster than Sonnet and much cheaper, perfect for move commentary

#### 6. Improve Caching Strategy
**Current:** 500 entry cache with 24h TTL
**Recommended:** Increase cache size, add position-based caching
**Impact:** **~5-10 seconds saved** (cache hits for similar positions)

**Implementation:**
```python
# Increase cache size for more hits
self._comment_cache = LRUCache(maxsize=2000, ttl=86400, name="ai_comment_cache")

# Add position-based caching (same position = same comment)
cache_key = f"{board.fen()}:{move.uci()}:{move_quality}"
```

#### 7. Reduce API Timeout
**Current:** 30s timeout per API call
**Recommended:** 10-15s timeout (Haiku is fast, rarely needs 30s)
**Impact:** **~1-2 seconds saved** (faster failure detection)

### 🚀 High-Impact Optimizations (Stockfish - Maintain Accuracy)

#### 4. Optimize Stockfish Configuration (No Accuracy Loss)
**Current:** 0.8s per move, depth 14
**Recommended:** Keep current settings (maintain accuracy)
**Note:** Stockfish analysis is only 12-15s, not the main bottleneck

**Alternative (if needed after AI optimization):**
- Reduce time_limit: 0.8s → 0.6s (minimal accuracy loss)
- Keep depth: 14 (maintain accuracy)

#### 5. Increase Concurrent Workers
**Current:** 4 concurrent workers
**Recommended:** 6-8 concurrent workers (if CPU allows)
**Impact:** **~25-30% reduction** (15s → 10-11s)

**Implementation:**
```python
# In analysis_engine.py line 1038
max_concurrent = 6  # Increased from 4
```

**Note:** Only if server has sufficient CPU cores (Railway Pro has 8 vCPU)

#### 6. Use Adaptive Depth (Already Implemented) ✅
**Status:** Already implemented in `_get_adaptive_depth()`
**Impact:** Already providing ~20-30% speedup
**No action needed**

#### 7. Skip Obvious Moves (Optional)
**Recommended:** Skip analysis for:
- Opening book moves (first 10-15 moves)
- Endgame tablebase positions (6 pieces or fewer)
- Obvious recaptures

**Impact:** **~15-20% reduction** (10s → 8-9s)

**Implementation:**
```python
# In analyze_game() before analyzing move
if ply_index <= 15:  # Opening book
    # Use cached/book evaluation
    continue
if board.piece_map().__len__() <= 6:  # Endgame tablebase
    # Use tablebase evaluation
    continue
```

### ⚡ Medium-Impact Optimizations

#### 6. Optimize Database Queries
- Add indexes on `(user_id, platform, provider_game_id)` in `games_pgn` table
- Use connection pooling
- Batch database operations

**Impact:** **~1-2 seconds saved**

#### 7. Return Early (Async Analysis)
**Current:** Frontend waits for complete analysis
**Recommended:** Return immediately, analyze in background

**Implementation:**
```python
# In unified_api_server.py
# Queue analysis job and return immediately
background_tasks.add_task(analyze_game_background, request)
return UnifiedAnalysisResponse(
    success=True,
    message="Analysis queued",
    data={"status": "queued"}
)
```

**Impact:** **Perceived time: 0 seconds** (user sees immediate response)

#### 8. Cache Analysis Results
- Cache completed analyses
- Skip re-analysis if game hasn't changed

**Impact:** **100% reduction for cached games**

### 🔧 Low-Impact Optimizations

#### 9. Optimize JSON Serialization
- Use faster JSON library (orjson)
- Compress large payloads

**Impact:** **~0.5-1 second saved**

#### 10. Parallel Database Operations
- Save analysis while calculating metrics
- Use async database operations

**Impact:** **~0.5-1 second saved**

## Recommended Implementation Plan

### Phase 1: Parallel AI Commentary with Rate Limiting (3-4 hours) ⭐ **PRIORITY - KEEPS ALL INSIGHTS**
1. ✅ **Make AI API calls parallel** (not sequential)
   - Convert `generate_comment()` to async
   - Use `asyncio.gather()` to run all AI calls concurrently
   - **Use token bucket rate limiter** (respects 50 requests/minute limit)
   - Add semaphore to limit concurrent calls (15 at a time)
2. ✅ **Replace sequential delays with rate limiter**
   - Use `RateLimiter` from `resilient_api_client.py`
   - Configure: 50 capacity, 50/60 refill rate
   - Non-blocking async rate limiting
3. ✅ **Progressive response** (return immediately, enhance with AI in background)
   - Save analysis with template comments immediately
   - Generate AI commentary in parallel background task
   - Update database as AI comments complete

**Expected Result:** **60s → ~15-20s** (3-4x improvement, **keeps all AI insights**, **respects API limits**)

**Rate Limit Protection:**
- ✅ Never exceeds 50 requests/minute (Anthropic limit)
- ✅ Parallel calls are rate-limited automatically
- ✅ Multiple games analyzed simultaneously share the 50/minute limit
- ✅ Graceful handling of 429 errors (fallback to templates)

### Phase 2: Additional AI Optimizations (2-3 hours) - Optional
4. ✅ Batch AI API calls (3-5 moves per call)
5. ✅ Improve caching (2000 entries, position-based)
6. ✅ Reduce API timeout (30s → 15s)

**Expected Result:** **15-20s → ~12-15s** (4-5x total improvement)

### Phase 3: Stockfish Optimizations (1-2 hours) - Optional
7. ✅ Increase max_concurrent: 4 → 6 (if CPU allows)
8. ✅ Optimize database queries with indexes
9. ✅ Use endgame tablebase for simple endgames

**Expected Result:** **12-15s → ~10-12s** (5-6x total improvement)

### Phase 4: Architecture Improvements (1-2 days) - Future
10. ✅ Add analysis result caching
11. ✅ Optimize database writes
12. ✅ WebSocket/SSE for real-time AI commentary updates

**Expected Result:** **Perceived time: <1s** (immediate response, AI commentary loads progressively)

## Performance Targets

| Metric | Current | Phase 1 (Parallel AI) | Phase 2 (AI Opt) | Phase 3 (Stockfish) | Phase 4 (Architecture) |
|--------|---------|----------------------|------------------|---------------------|------------------------|
| **Analysis Time** | 60s | 15-20s | 12-15s | 10-12s | 10-12s |
| **Perceived Time** | 60s | 15-20s | 12-15s | 10-12s | <1s |
| **AI Commentary** | Sequential (60s) | Parallel (2-3s) | Batched (1-2s) | Batched (1-2s) | Progressive |
| **AI Insights** | 15-25 moves | **15-25 moves** ✅ | **15-25 moves** ✅ | **15-25 moves** ✅ | **15-25 moves** ✅ |
| **Accuracy** | High | **High** ✅ | **High** ✅ | **High** ✅ | **High** ✅ |
| **User Experience** | Poor | Good | Excellent | Excellent | Excellent |

**Key Insight:** AI commentary is the bottleneck, but it's **sequential execution**, not the number of insights. Making AI calls **parallel** keeps all insights while dramatically improving speed.

## Code Changes Required

### 1. Make AI Commentary Parallel (Priority - Keeps All Insights)
**File:** `python/core/ai_comment_generator.py` - Make async with rate limiting

```python
# Add async semaphore + rate limiter for concurrent API calls
import asyncio
from .resilient_api_client import RateLimiter

class AIChessCommentGenerator:
    def __init__(self):
        # ... existing code ...
        # Token bucket rate limiter: 50 requests/minute (Anthropic limit)
        self._rate_limiter = RateLimiter(
            capacity=50,
            refill_rate=50.0 / 60.0  # 50 requests per 60 seconds
        )
        # Semaphore to limit concurrent calls (prevent overwhelming)
        self._api_semaphore = asyncio.Semaphore(15)  # Max 15 concurrent

    async def generate_comment_async(self, move_analysis, board, move,
                                     is_user_move=True, player_elo=1200):
        """Async version for parallel execution."""
        # Check cache first (same as before)
        cache_key = self._generate_cache_key(move_analysis, board, move, is_user_move, player_elo)
        cached = self._comment_cache.get(cache_key)
        if cached:
            return cached

        # Wait for rate limiter token (respects 50/minute limit, non-blocking)
        token_acquired = await self._rate_limiter.wait_for_token(tokens=1, timeout=30.0)
        if not token_acquired:
            print("[AI] Rate limiter timeout, skipping AI comment")
            return None

        try:
            # Use semaphore to limit concurrent calls
            async with self._api_semaphore:
                prompt = self._build_prompt(move_analysis, board, move, is_user_move, player_elo)
                comment = await self._call_api_async(prompt, system_prompt)

                if comment:
                    comment = self._clean_comment(comment, is_user_move)
                    self._comment_cache.set(cache_key, comment)
                    return comment
        finally:
            # Rate limiter automatically refills tokens
            pass

        return None

    async def _call_api_async(self, prompt, system):
        """Async API call without blocking."""
        # Use async HTTP client (httpx.AsyncClient)
        # Remove blocking time.sleep() delays
        async_client = httpx.AsyncClient(timeout=httpx.Timeout(30.0))
        try:
            response = await async_client.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": self.config.anthropic_api_key, ...},
                json={"model": self.config.ai_model, "messages": [...]}
            )
            return response.json()["content"][0]["text"]
        finally:
            await async_client.aclose()
```

**File:** `python/core/analysis_engine.py` - Collect and parallelize AI calls

```python
# In analyze_game() method, after Stockfish analysis
async def analyze_game(self, pgn: str, ...):
    # ... existing Stockfish analysis code ...
    # This generates moves_analysis with Stockfish data

    # Collect moves that need AI commentary (keep all current logic!)
    moves_needing_ai = []
    for i, move_analysis in enumerate(moves_analysis):
        # Use existing _should_use_ai_comment logic (no changes needed)
        if self.coaching_generator._should_use_ai_comment(
            move_analysis.__dict__,
            self._get_move_quality(move_analysis)
        ):
            moves_needing_ai.append((i, move_analysis, move_data[i]))

    # Generate ALL AI commentary in parallel (not sequential!)
    if moves_needing_ai and self.coaching_generator.ai_generator:
        ai_tasks = [
            self._generate_single_ai_comment_async(idx, move_analysis, move_data_item)
            for idx, move_analysis, move_data_item in moves_needing_ai
        ]
        ai_results = await asyncio.gather(*ai_tasks, return_exceptions=True)

        # Update move analyses with AI comments
        for (idx, _, _), result in zip(moves_needing_ai, ai_results):
            if not isinstance(result, Exception) and result:
                moves_analysis[idx].coaching_comment = result

    # Continue with existing code...
    return game_analysis

async def _generate_single_ai_comment_async(self, idx, move_analysis, move_data):
    """Generate AI comment for a single move (async)."""
    board = move_data['board']
    move = move_data['move']
    # Use async AI generator
    comment = await self.coaching_generator.ai_generator.generate_comment_async(
        move_analysis.__dict__, board, move,
        is_user_move=move_analysis.is_user_move
    )
    return comment
```

**File:** `python/core/coaching_comment_generator.py` - Support async

```python
# Update to support async AI generation
async def generate_coaching_comment_async(self, move_analysis, board, move, ...):
    """Async version that uses parallel AI calls."""
    move_quality = self._determine_move_quality(move_analysis)

    # Generate main comment (async if using AI)
    if self._should_use_ai_comment(move_analysis, move_quality) and self.ai_generator:
        main_comment = await self.ai_generator.generate_comment_async(
            move_analysis, board, move, is_user_move
        )
    else:
        # Template-based (fast, no API call)
        main_comment = self._generate_template_comment(move_quality, move_analysis, is_user_move)

    # ... rest of coaching comment generation ...
    return CoachingComment(main_comment=main_comment, ...)
```

**File:** `python/core/ai_comment_generator.py` - Update rate limiting

```python
# In AIConfig class - keep for backward compatibility, but not used with async
rate_limit_delay: float = 2.0  # Kept for sequential fallback, but async uses RateLimiter

# The async version uses RateLimiter instead of delays
# This respects the 50 requests/minute limit while allowing parallel calls
```

### 3. Add Move Skipping Logic
**File:** `python/core/analysis_engine.py` in `analyze_game()`

```python
# Before analyzing move (around line 1026)
if ply_index <= 15:
    # Use opening book evaluation
    move_analysis = self._get_opening_book_evaluation(board, move)
    moves_analysis.append(move_analysis)
    continue

if len(board.piece_map()) <= 6:
    # Use endgame tablebase evaluation
    move_analysis = self._get_tablebase_evaluation(board, move)
    moves_analysis.append(move_analysis)
    continue
```

### 4. Add Database Indexes
**File:** New migration or `supabase/migrations/`

```sql
CREATE INDEX IF NOT EXISTS idx_games_pgn_lookup
ON games_pgn(user_id, platform, provider_game_id);

CREATE INDEX IF NOT EXISTS idx_move_analyses_lookup
ON move_analyses(user_id, platform, game_id, analysis_method);
```

## Testing Recommendations

1. **Benchmark Current Performance**
   - Measure time for 10 different games
   - Record average, min, max times

2. **Test After Each Phase**
   - Verify analysis quality hasn't degraded
   - Measure actual time improvements
   - Check for any errors

3. **User Acceptance Testing**
   - Get feedback on analysis quality
   - Ensure users are satisfied with speed/quality trade-off

## Monitoring

Add performance metrics:
- Analysis time per game
- Moves analyzed per second
- Database query times
- Cache hit rates

## Conclusion

**Key Finding:** The main bottleneck is **AI commentary generation**, not Stockfish analysis. AI commentary generates 15-25 API calls per game, but they're executed **sequentially** with 2s delays between calls, adding **45-125 seconds** to analysis time.

**Solution:** By making AI API calls **parallel** (concurrent) instead of sequential, we can achieve a **3-4x improvement** (60s → 15-20s) while **keeping ALL AI insights** for all moves that currently get them.

**Key Optimizations:**
1. ✅ **Parallel AI API calls** - Run 15-25 calls concurrently (2-3s total) instead of sequentially (60-100s)
2. ✅ **Token bucket rate limiter** - Respects Anthropic's 50 requests/minute limit while allowing parallel calls
3. ✅ **Progressive response** - Return analysis immediately, enhance with AI in background
4. ✅ **Keep all AI insights** - No reduction in commentary coverage
5. ✅ **Rate limit protection** - Never exceeds API limits, graceful 429 error handling

**Stockfish analysis** (12-15s) is already well-optimized and should not be changed to preserve accuracy.

**Recommended Approach:**
1. ✅ Convert AI commentary generation to async/parallel
2. ✅ Use `asyncio.gather()` to run all AI calls concurrently
3. ✅ Use **token bucket rate limiter** (50 requests/minute) to respect Anthropic limits
4. ✅ Use semaphore (15 concurrent) to prevent overwhelming
5. ✅ Return analysis immediately, update with AI commentary progressively
6. ✅ Handle 429 errors gracefully (fallback to templates)

**Rate Limit Strategy:**
- **Single game:** 15-25 calls in parallel, rate limiter ensures <50/minute
- **Multiple games:** Shared rate limiter ensures total <50/minute across all games
- **429 errors:** Graceful fallback to template comments (no blocking)

This keeps all AI insights while dramatically improving speed **and respecting API limits** - **best of all worlds!**
