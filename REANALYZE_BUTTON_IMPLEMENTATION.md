# Re-analyze Button Implementation

## Overview

Added a **Re-analyze** button to the Game Analysis page that allows users to re-analyze games with the latest move evaluation logic.

---

## Features

### 1. **Re-analyze Button**
- Located in the top-right corner next to "Download PGN" button
- Uses DEEP analysis (more accurate than standard) for re-analysis
- Shows loading state with spinner during analysis
- Shows success state with checkmark when complete
- Automatically reloads updated data after re-analysis

### 2. **Visual States**

| State | Appearance | Description |
|-------|-----------|-------------|
| **Normal** | Purple border, purple background | Ready to re-analyze |
| **Loading** | Purple with spinner icon | Currently re-analyzing |
| **Success** | Green border, checkmark icon | Re-analysis complete |
| **Error** | Red banner below header | Error message displayed |
| **Disabled** | Grayed out | No PGN available |

### 3. **Error Handling**
- Shows error banner if re-analysis fails
- Error message is dismissible
- Prevents multiple simultaneous re-analysis requests

---

## How It Works

### User Flow

1. **User clicks "Re-analyze" button**
   - Button shows loading spinner
   - Text changes to "Re-analyzing..."
   
2. **Backend processes the game**
   - Sends PGN to unified analysis API
   - Uses DEEP analysis type (depth=18+, time=2.0s+)
   - Applies new move evaluation thresholds
   
3. **UI updates automatically**
   - Button shows checkmark and "Updated!" text
   - Data reloads after 2 seconds
   - Page refreshes with new classifications
   
4. **User sees corrected move evaluations**
   - Simple captures no longer labeled "Brilliant"
   - Move categories aligned with Chess.com standards
   - Statistics updated (e.g., "BRILLIANTS: 0" instead of "2")

---

## Technical Implementation

### Files Modified

**`src/pages/GameAnalysisPage.tsx`**

#### 1. Added State Variables

```typescript
const [isReanalyzing, setIsReanalyzing] = useState(false)
const [reanalyzeSuccess, setReanalyzeSuccess] = useState(false)
```

#### 2. Added Import

```typescript
import UnifiedAnalysisService from '../services/unifiedAnalysisService'
```

#### 3. Added Re-analyze Handler

```typescript
const handleReanalyze = async () => {
  if (!pgn || !platform || !decodedUserId) {
    console.error('Missing required data for re-analysis')
    return
  }

  setIsReanalyzing(true)
  setReanalyzeSuccess(false)
  setAnalysisError(null)

  try {
    console.log('🔄 Starting re-analysis...', {
      user: decodedUserId,
      platform,
      gameId: decodedGameId
    })

    // Call the analyzeGame API with DEEP analysis for better results
    const response = await UnifiedAnalysisService.analyzeGame(
      pgn,
      decodedUserId,
      platform,
      'deep'  // Use DEEP analysis for re-analysis
    )

    if (response.success) {
      console.log('✅ Re-analysis successful!')
      setReanalyzeSuccess(true)
      
      // Wait a moment for the backend to save, then reload the data
      setTimeout(async () => {
        const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)
        setGameRecord(prev => prev ?? result.game)
        setAnalysisRecord(result.analysis)
        setPgn(result.pgn)
        setReanalyzeSuccess(false)
      }, 2000)
    } else {
      throw new Error('Re-analysis failed')
    }
  } catch (error) {
    console.error('❌ Re-analysis error:', error)
    setAnalysisError('Failed to re-analyze game. Please try again.')
  } finally {
    setIsReanalyzing(false)
  }
}
```

#### 4. Added UI Button

```typescript
<button
  onClick={handleReanalyze}
  disabled={isReanalyzing || !pgn}
  className={`
    rounded-full border px-4 py-1.5 font-medium transition
    ${isReanalyzing 
      ? 'border-purple-400/30 bg-purple-500/10 text-purple-300 cursor-wait' 
      : reanalyzeSuccess
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      : 'border-purple-400/30 bg-purple-500/10 text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/20'
    }
    ${!pgn ? 'opacity-50 cursor-not-allowed' : ''}
  `}
  title="Re-analyze this game with the latest move evaluation logic"
>
  {isReanalyzing ? (
    <span className="flex items-center gap-2">
      <svg className="animate-spin h-4 w-4" ...>...</svg>
      Re-analyzing...
    </span>
  ) : reanalyzeSuccess ? (
    <span className="flex items-center gap-2">
      <svg className="h-4 w-4" ...>...</svg>
      Updated!
    </span>
  ) : (
    <span className="flex items-center gap-2">
      <svg className="h-4 w-4" ...>...</svg>
      Re-analyze
    </span>
  )}
</button>
```

#### 5. Added Error Banner

```typescript
{analysisError && (
  <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-rose-300">
    <div className="flex items-center gap-2">
      <svg className="h-5 w-5" ...>...</svg>
      <span className="font-medium">{analysisError}</span>
    </div>
  </div>
)}
```

---

## API Integration

### Endpoint Used

**`POST /api/v1/analyze`**

The re-analyze button calls the unified analysis endpoint:

```typescript
UnifiedAnalysisService.analyzeGame(
  pgn,           // Full PGN of the game
  decodedUserId, // User ID
  platform,      // 'lichess' or 'chess.com'
  'deep'         // Analysis type (DEEP for higher quality)
)
```

### Request Body

```json
{
  "user_id": "user123",
  "platform": "lichess",
  "analysis_type": "deep",
  "pgn": "[Event \"...\"]\n\n1. e4 e5 2. Nf3 ...",
  "depth": 18
}
```

### Response

```json
{
  "success": true,
  "message": "Game analysis completed successfully",
  "analysis_id": "abc123",
  "data": { ... }
}
```

---

## Use Cases

### 1. **After Code Updates**
When the move evaluation logic is updated (like the recent fix), users can re-analyze their games to get corrected classifications.

**Example:**
- Old: Qxe5+ labeled as "Brilliant" ❌
- Click "Re-analyze"
- New: Qxe5+ labeled as "Best" ✅

### 2. **Higher Quality Analysis**
Re-analyze with DEEP analysis for more accurate move evaluations.

**Improvement:**
- Original: STOCKFISH (depth 12, 0.5s)
- Re-analysis: DEEP (depth 18+, 2.0s+)
- Result: More accurate classifications

### 3. **Fix Incomplete Analysis**
If a game was analyzed with an error or incomplete data, re-analyzing can fix it.

---

## User Benefits

### 1. **Immediate Feedback**
- Click button → See results in ~30-60 seconds
- No need to delete and re-import game
- No need to use terminal or scripts

### 2. **Visual Feedback**
- Clear loading state
- Success confirmation
- Error messages if something goes wrong

### 3. **Data Freshness**
- Always uses latest evaluation logic
- Gets benefits of code improvements immediately
- Ensures consistency across all games

---

## Testing

### Manual Test Steps

1. **Navigate to a game analysis page**
   - Go to any analyzed game
   - Look for "Re-analyze" button in top-right

2. **Click "Re-analyze"**
   - Button should show spinner
   - Text should change to "Re-analyzing..."
   - Button should be disabled during analysis

3. **Wait for completion**
   - Should take 30-60 seconds
   - Button shows checkmark and "Updated!"
   - Page refreshes with new data

4. **Verify results**
   - Move classifications updated
   - Simple captures no longer "Brilliant"
   - Statistics corrected

### Test Cases

| Test | Expected Result |
|------|----------------|
| Click re-analyze on valid game | ✅ Analysis starts, completes, data updates |
| Click re-analyze without PGN | ✅ Button disabled |
| Click re-analyze while already running | ✅ Button disabled during analysis |
| Backend error during re-analysis | ✅ Error banner shows |
| Successfully complete re-analysis | ✅ Green checkmark, data reloads |

---

## Troubleshooting

### Button is Grayed Out

**Cause:** No PGN data available for the game

**Solution:**
- Check if game has PGN in database
- Try re-importing the game from Lichess/Chess.com

### Re-analysis Fails with Error

**Cause:** Backend not running or API error

**Solution:**
1. Check backend is running: `Get-Process python`
2. Check backend logs: `cat python/backend.out.log`
3. Restart backend if needed: `.\start-all.ps1`

### Data Doesn't Update After Re-analysis

**Cause:** Frontend didn't reload data

**Solution:**
1. Wait a few more seconds (it reloads after 2s)
2. Manually refresh the page
3. Check browser console for errors

### Still See Old Classifications

**Cause:** Backend still running old code

**Solution:**
1. **Restart backend**: `.\stop-all.ps1` then `.\start-all.ps1`
2. Wait 10-20 seconds for full restart
3. Try re-analyze again

---

## Future Enhancements

### Planned Improvements

1. **Batch Re-analyze**
   - Add "Re-analyze All Games" button
   - Show progress bar for multiple games

2. **Analysis Type Selection**
   - Let user choose STOCKFISH or DEEP
   - Show estimated time for each

3. **Analysis Comparison**
   - Show "before" vs "after" comparison
   - Highlight what changed

4. **Smart Re-analysis**
   - Only re-analyze if code was updated
   - Skip games already using latest logic

---

## Summary

The re-analyze button provides a **quick and easy way** for users to update their game analyses with the latest move evaluation logic without needing to:

- Delete and re-import games
- Use terminal commands
- Run Python scripts
- Understand database queries

**Just one click** and the game is re-analyzed with all the latest improvements! 🎉

