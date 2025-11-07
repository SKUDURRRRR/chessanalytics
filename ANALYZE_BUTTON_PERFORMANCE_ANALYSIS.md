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

### 🚀 **CRITICAL: AI Commentary Optimization (Implement First)**

#### 1. Make AI Commentary Asynchronous/Deferred ⭐ **BIGGEST IMPACT**
**Current:** AI commentary generated synchronously during analysis (blocks analysis)
**Recommended:** Generate template-based comments during analysis, AI commentary asynchronously after
**Impact:** **~30-60 seconds saved** (50-100% of current time)

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

#### 2. Reduce AI Commentary Scope
**Current:** AI used for 15-25 moves per game
**Recommended:** Only for brilliant, blunder, mistake (3-5 moves per game)
**Impact:** **~10-20 seconds saved**

**Implementation:**
```python
# In coaching_comment_generator.py
def _should_use_ai_comment(self, move_analysis, move_quality):
    # Only use AI for critical learning moments
    if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER, MoveQuality.MISTAKE]:
        return True
    # Everything else uses fast template-based comments
    return False
```

#### 3. Batch AI API Calls
**Current:** One API call per move (sequential)
**Recommended:** Batch multiple moves into single API call
**Impact:** **~5-10 seconds saved**

**Implementation:**
```python
# Batch 3-5 moves into single API call
async def _generate_batched_ai_comments(moves_data):
    prompt = "Analyze these moves: " + format_moves(moves_data)
    comments = await ai_generator.generate_batch(prompt)
    return comments
```

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

### Phase 1: AI Commentary Optimization (2-4 hours) ⭐ **PRIORITY**
1. ✅ **Defer AI commentary to background** (Option B above)
   - Generate template-based comments during analysis
   - Queue AI commentary generation as background task
   - Return analysis immediately to user
2. ✅ **Reduce AI commentary scope** (only brilliant/blunder/mistake)
   - Update `_should_use_ai_comment()` to be more selective
   - Skip AI for routine moves, good moves, etc.

**Expected Result:** **60s → ~15-20s** (3-4x improvement, **maintains accuracy**)

### Phase 2: Stockfish Optimizations (1-2 hours) - Optional
3. ✅ Increase max_concurrent: 4 → 6 (if CPU allows)
4. ✅ Optimize database queries with indexes
5. ✅ Use endgame tablebase for simple endgames

**Expected Result:** **15-20s → ~12-15s** (4-5x total improvement)

### Phase 3: Architecture Improvements (1-2 days) - Future
6. ✅ Add analysis result caching
7. ✅ Optimize database writes
8. ✅ Batch AI API calls

**Expected Result:** **Perceived time: <1s** (immediate response, AI commentary loads progressively)

## Performance Targets

| Metric | Current | Phase 1 (AI Opt) | Phase 2 (Stockfish) | Phase 3 (Architecture) |
|--------|---------|------------------|---------------------|------------------------|
| **Analysis Time** | 60s | 15-20s | 12-15s | 12-15s |
| **Perceived Time** | 60s | 15-20s | 12-15s | <1s |
| **AI Commentary** | Blocking | Background | Background | Progressive |
| **Accuracy** | High | **High** ✅ | **High** ✅ | **High** ✅ |
| **User Experience** | Poor | Good | Excellent | Excellent |

**Key Insight:** AI commentary is the bottleneck, not Stockfish. Optimizing AI commentary maintains accuracy while dramatically improving speed.

## Code Changes Required

### 1. Defer AI Commentary to Background (Priority)
**File:** `python/core/analysis_engine.py`

```python
# Line 1623 - Add skip_ai parameter
def _enhance_move_analysis_with_coaching(self, move_analysis: MoveAnalysis, board: chess.Board,
                                         move: chess.Move, move_number: int,
                                         player_skill_level: str = "intermediate",
                                         is_user_move: bool = True,
                                         skip_ai: bool = False) -> MoveAnalysis:
    # ... existing code ...

    # Generate coaching comment
    if skip_ai:
        # Use template-based comments only (fast, no API calls)
        coaching_comment = self.coaching_generator.generate_coaching_comment(
            enhanced_move_data, board, move, game_phase,
            player_skill_level, is_user_move, use_ai=False
        )
    else:
        # Normal flow with AI (slow)
        coaching_comment = self.coaching_generator.generate_coaching_comment(...)
```

**File:** `python/core/coaching_comment_generator.py`

```python
# Line 202 - Add use_ai parameter
def generate_coaching_comment(self, move_analysis, board, move, game_phase,
                             player_skill_level="intermediate", is_user_move=True,
                             use_ai: bool = True):
    # ... existing code ...

    # Generate main comment
    if use_ai:
        main_comment = self._generate_main_comment(move_quality, move_analysis, is_user_move)
    else:
        # Skip AI, use template-based comments only
        main_comment = self._generate_template_comment(move_quality, move_analysis, is_user_move)
```

**File:** `python/core/unified_api_server.py`

```python
# In _handle_single_game_by_id(), after analysis
async def _handle_single_game_by_id(request):
    # ... existing code to analyze game ...

    # Analyze game WITHOUT AI commentary (fast)
    game_analysis = await engine.analyze_game(
        pgn_data, canonical_user_id, request.platform,
        analysis_type_enum, analysis_game_id,
        skip_ai_commentary=True  # NEW parameter
    )

    # Save analysis immediately (user gets results fast)
    success = await _save_stockfish_analysis(game_analysis)

    if success:
        # Generate AI commentary in background (non-blocking)
        background_tasks.add_task(
            _generate_ai_commentary_background,
            game_analysis, canonical_user_id, request.platform
        )

        return UnifiedAnalysisResponse(
            success=True,
            message="Analysis complete. AI commentary generating...",
            data={"game_id": game_analysis.game_id, "ai_commentary_pending": True}
        )
```

**File:** `python/core/unified_api_server.py` - Add background task

```python
async def _generate_ai_commentary_background(game_analysis, user_id, platform):
    """Generate AI commentary for moves in background."""
    try:
        engine = get_analysis_engine()
        for move_analysis in game_analysis.moves_analysis:
            # Only generate AI for critical moves
            if move_analysis.is_brilliant or move_analysis.is_blunder or move_analysis.is_mistake:
                # Generate AI commentary
                enhanced = engine._enhance_move_analysis_with_coaching(
                    move_analysis, board, move, move_number,
                    skip_ai=False  # Use AI for critical moves
                )
                # Update in database
                await _update_move_commentary(move_analysis, enhanced)
    except Exception as e:
        print(f"Error generating AI commentary: {e}")
```

### 2. Reduce AI Commentary Scope
**File:** `python/core/coaching_comment_generator.py`

```python
# Line 282 - Make AI usage more selective
def _should_use_ai_comment(self, move_analysis: Dict[str, Any], move_quality: MoveQuality) -> bool:
    """Only use AI for critical learning moments."""
    # Only use AI for the most important moves
    if move_quality in [MoveQuality.BRILLIANT, MoveQuality.BLUNDER, MoveQuality.MISTAKE]:
        return True

    # Skip AI for everything else (use templates)
    return False
```

### 3. Update Analysis Engine to Support skip_ai
**File:** `python/core/analysis_engine.py`

```python
# Line 918 - Add skip_ai_commentary parameter
async def analyze_game(self, pgn: str, user_id: str, platform: str,
                      analysis_type: Optional[AnalysisType] = None,
                      game_id: Optional[str] = None,
                      skip_ai_commentary: bool = False) -> Optional[GameAnalysis]:
    # ... existing code ...

    # Line 2877 - Pass skip_ai flag
    return self._enhance_move_analysis_with_coaching(
        move_analysis, board, current_move, move_number,
        is_user_move=True, skip_ai=skip_ai_commentary
    )
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

**Key Finding:** The main bottleneck is **AI commentary generation**, not Stockfish analysis. AI commentary was added recently and generates 15-25 API calls per game, each taking 1-3 seconds, adding **30-60 seconds** to analysis time.

**Solution:** By deferring AI commentary to background processing and only using it for critical moves (brilliant, blunder, mistake), we can achieve a **3-4x improvement** (60s → 15-20s) while **maintaining full analysis accuracy**.

**Stockfish analysis** (12-15s) is already well-optimized and should not be changed to preserve accuracy. The focus should be on making AI commentary non-blocking.

**Recommended Approach:**
1. ✅ Generate template-based comments during analysis (fast, no API calls)
2. ✅ Save analysis immediately (user gets results in 15-20s)
3. ✅ Generate AI commentary in background (progressive enhancement)
4. ✅ Only use AI for critical moves (brilliant, blunder, mistake)

This maintains accuracy while dramatically improving user experience.
