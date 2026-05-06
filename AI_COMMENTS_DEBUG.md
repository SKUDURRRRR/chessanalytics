# AI Comments Debugging Guide

## What to Check

### 1. Backend Logs After Analysis Completes

After analyzing a game, you should see these log messages in order:

```
[SINGLE GAME ANALYSIS] 🔄 Creating background task for AI comments...
[SINGLE GAME ANALYSIS] ✅ Background task created: <Task>
[AI_COMMENTS] ========================================
[AI_COMMENTS] 🚀 Starting background AI comment generation
[AI_COMMENTS] Game ID: <game_id>
[AI_COMMENTS] ✅ AI comments enabled, initializing generator...
[AI_COMMENTS] ✅ AI generator ready: enabled=True, model=claude-3-haiku-20240307
[AI_COMMENTS] Generating AI comments for X moves (out of Y total)
```

### 2. If You DON'T See These Logs

**Problem**: Background task not starting

**Possible Causes**:
- Backend not restarted after code changes
- Analysis endpoint not calling background task
- FastAPI BackgroundTasks not working

**Solution**:
- Restart backend: `cd python/core && python unified_api_server.py`
- Check if you see the "Creating background task" message

### 3. If You See "AI comments disabled"

**Problem**: AI not configured

**Check**:
- Environment variable `AI_ANTHROPIC_API_KEY` is set
- Or `ANTHROPIC_API_KEY` is set
- Check logs for: `[AI_COMMENTS] ❌ AI generator disabled`

**Solution**:
- Set `AI_ANTHROPIC_API_KEY` in your `.env.local` file
- Restart backend

### 4. If You See "No moves require AI comments"

**Problem**: Selective mode filtering out all moves

**Check**:
- Are there any blunders, mistakes, brilliant moves, or inaccuracies in the game?
- Check log: `[AI_COMMENTS] No moves require AI comments (selective mode: True)`

**Solution**:
- This is normal if the game has no significant moves
- To generate for all moves, set `AI_COMMENTS_SELECTIVE=false`

### 5. If You See Errors

**Check the error logs**:
- Look for `[AI_COMMENTS] ❌❌❌ ERROR` messages
- Check the full traceback

**Common Issues**:
- Missing Anthropic API key
- Rate limiting (429 errors)
- Network issues

## Quick Test

1. **Restart backend** (important!)
2. **Analyze a game** that has at least one blunder/mistake
3. **Watch backend logs** for `[AI_COMMENTS]` messages
4. **Check frontend** - comments should appear after ~15-30 seconds

## Environment Variables

Make sure these are set in `python/.env.local`:

```bash
AI_ANTHROPIC_API_KEY=your_key_here
AI_COMMENTS_ENABLED=true
AI_COMMENTS_SELECTIVE=true
AI_COMMENTS_BATCH_SIZE=8
```

## Frontend Polling

The frontend polling is implemented but needs to be integrated into the game analysis component. Currently, it's available as:

```typescript
UnifiedAnalysisService.pollForAIComments(userId, platform, gameId)
```

This will:
- Poll every 5 seconds
- Show toast notification when ready
- Stop after 12 attempts (60 seconds)
