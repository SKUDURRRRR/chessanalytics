# How to Re-analyze Games with New Move Evaluation Logic

## Why Do I Need to Re-analyze?

**The Problem:** You updated the code, but you're still seeing old classifications like "Brilliant" for simple moves (Nxd3, cxd3).

**The Reason:** Analysis results are **stored in the database**. The moves you're seeing were analyzed with the **old buggy logic** before the fix.

**The Solution:** **Re-analyze** the games to use the **new corrected logic**.

---

## Understanding the Issue

### What Happened

1. ✅ **Before Fix:** Game was analyzed → Nxd3/cxd3 labeled "Brilliant" (wrong) → Saved to database
2. ✅ **We Fixed Code:** Move evaluation logic updated with correct thresholds
3. ❌ **Database Still Has Old Data:** Your game still shows "Brilliant" because it's using old saved results
4. ✅ **After Re-analysis:** Game will be re-analyzed → Nxd3/cxd3 labeled "Best/Good" (correct) → Updated in database

### Analogy

Think of it like this:
- **Code = Recipe** (we fixed the recipe)
- **Database = Cooked meal** (still the old meal from the old recipe)
- **Re-analyze = Cook again** (make a new meal with the fixed recipe)

---

## Option 1: Re-analyze via Frontend (Easiest)

### If Re-analyze Button Exists

1. Go to the game analysis page
2. Look for a **"Re-analyze"** or **"Refresh Analysis"** button
3. Click it
4. Wait for analysis to complete
5. Refresh the page

### If No Re-analyze Button

You'll need to use one of the backend methods below.

---

## Option 2: Re-analyze via API Call

### Using the Unified API Endpoint

```bash
# Re-analyze a specific game
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "analysis_type": "game_analysis",
    "user_id": "YOUR_USERNAME",
    "platform": "lichess",
    "game_id": "YOUR_GAME_ID",
    "pgn": "YOUR_GAME_PGN",
    "player_color": "white"
  }'
```

### Parameters

- `analysis_type`: `"game_analysis"` or `"deep_analysis"`
- `user_id`: Your username (e.g., "skudurelis10")
- `platform`: `"lichess"` or `"chess.com"`
- `game_id`: The game ID from the URL
- `pgn`: The full PGN of the game
- `player_color`: `"white"` or `"black"`

---

## Option 3: Re-analyze via Python Script

### Method A: Re-analyze Specific Game

Create a script `reanalyze_specific_game.py`:

```python
#!/usr/bin/env python3
"""Re-analyze a specific game with new logic."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'python'))

import asyncio
from python.core.analysis_engine import ChessAnalysisEngine, AnalysisType
from python.core.reliable_analysis_persistence import ReliableAnalysisPersistence
import chess.pgn
from io import StringIO


async def reanalyze_game(pgn_text: str, user_id: str, platform: str, game_id: str):
    """Re-analyze a game with the new logic."""
    print(f"Re-analyzing game {game_id} for {user_id}@{platform}...")
    
    # Parse PGN
    pgn = StringIO(pgn_text)
    game = chess.pgn.read_game(pgn)
    
    if not game:
        print("❌ Failed to parse PGN")
        return False
    
    # Initialize engine and persistence
    engine = ChessAnalysisEngine()
    persistence = ReliableAnalysisPersistence()
    
    # Analyze game with new logic
    print("Analyzing with new move evaluation logic...")
    analysis = await engine.analyze_game(
        game,
        analysis_type=AnalysisType.DEEP  # or AnalysisType.STOCKFISH
    )
    
    # Save to database (this will overwrite old analysis)
    print("Saving to database...")
    success = await persistence.save_game_analysis(
        analysis,
        user_id=user_id,
        platform=platform,
        game_id=game_id
    )
    
    if success:
        print("✅ Re-analysis completed successfully!")
        print(f"Game {game_id} now has updated move classifications")
        return True
    else:
        print("❌ Failed to save analysis")
        return False


async def main():
    # Replace with your game details
    PGN = """
    [Event "Your Game"]
    [White "Player1"]
    [Black "Player2"]
    
    1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6
    """  # Your full PGN here
    
    USER_ID = "your_username"
    PLATFORM = "lichess"  # or "chess.com"
    GAME_ID = "your_game_id"
    
    result = await reanalyze_game(PGN, USER_ID, PLATFORM, GAME_ID)
    return result


if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)
```

### Method B: Use Existing Script

If you have a re-analysis script:

```bash
cd python
python scripts/reanalyze_sample_games.py
```

---

## Option 4: Delete and Re-import Game

### Via Database

1. **Delete old analysis** from Supabase:
   ```sql
   DELETE FROM game_analyses 
   WHERE user_id = 'your_username' 
   AND game_id = 'your_game_id';
   
   DELETE FROM moves_analysis
   WHERE game_analysis_id = 'your_analysis_id';
   ```

2. **Re-import game** via frontend or API

### Via Frontend

1. Delete the game from your games list (if possible)
2. Re-import the game from Lichess/Chess.com
3. Analysis will run with new logic

---

## Option 5: Clear All Old Analyses (Nuclear Option)

⚠️ **WARNING:** This will delete ALL analysis data!

### Via Database

```sql
-- Backup first!
-- Then delete all analyses
DELETE FROM moves_analysis;
DELETE FROM game_analyses;
```

### Re-import All Games

After clearing, re-import all your games and they'll be analyzed with the new logic.

---

## Verification: How to Know It Worked

After re-analyzing, check the game again. You should see:

### Before Re-analysis (Old Logic)
- ❌ Nxd3 → "Brilliant" (wrong)
- ❌ cxd3 → "Brilliant" (wrong)

### After Re-analysis (New Logic)
- ✅ Nxd3 → "Best" or "Good" (correct)
- ✅ cxd3 → "Best" or "Good" (correct)

### Other Signs It Worked
- Fewer "Brilliant" moves overall (should be 0-2 per game)
- More "Great" and "Excellent" categories visible
- Move classifications feel more accurate

---

## Quick Test: Verify New Logic Works

Run this script to confirm the new logic is correct:

```bash
python verify_nxd3_classification.py
```

This will show that:
1. ✅ The code is fixed (new analysis uses correct logic)
2. ⚠️ Your game still shows old data (needs re-analysis)
3. 📋 Instructions on how to fix it

---

## Recommended Approach

### For One Game (Your Current Game)

**Use Option 2 (API Call)** or **Option 3A (Python Script)**
- Fastest for a single game
- Immediate results
- No impact on other games

### For All Your Games

**Use Option 3B (Existing Script)** or **Option 4 (Re-import)**
- Re-analyze everything at once
- Ensures all games have updated classifications
- May take longer depending on number of games

### For Production System

**Use Option 4 (Delete and Re-import)** or create a migration script
- Clean slate with new logic
- Ensures consistency
- Good for deployment

---

## Expected Timeline

| Method | Time for 1 Game | Time for 100 Games |
|--------|-----------------|-------------------|
| Frontend Re-analyze | ~30 seconds | N/A (one at a time) |
| API Call | ~30 seconds | ~50 minutes |
| Python Script | ~30 seconds | ~50 minutes |
| Delete & Re-import | ~1 minute | ~1-2 hours |

---

## Troubleshooting

### Still Seeing "Brilliant" After Re-analysis

1. **Check you're viewing the right game** - Make sure you refreshed the page
2. **Verify analysis completed** - Check backend logs for errors
3. **Check database** - Query the database to see if it updated
4. **Clear browser cache** - Sometimes the frontend caches data

### Re-analysis Fails

1. **Check Stockfish is running** - Make sure engine is accessible
2. **Check database connection** - Verify Supabase is connected
3. **Check logs** - Look in `python/backend.out.log` for errors
4. **Verify PGN is valid** - Make sure game PGN is correct

### New Classifications Still Look Wrong

1. **Verify code was updated** - Check `python/core/analysis_engine.py` has the fixes
2. **Restart backend** - Stop and start the backend server
3. **Check for errors** - Look for undefined variable errors in logs

---

## Summary

### The Issue
- ✅ Code is fixed
- ❌ Database has old data
- ⏳ Need to re-analyze

### The Solution
1. Choose a re-analysis method (API, script, or re-import)
2. Re-analyze the game(s)
3. Verify the results

### Expected Result
- Simple captures (Nxd3, cxd3) → "Best" or "Good" (not "Brilliant")
- Brilliant moves are rare (0-2 per game)
- Overall more accurate classifications

---

## Need Help?

If you're still having issues after re-analyzing, please provide:
1. The game ID or PGN
2. Which re-analysis method you used
3. Any error messages from logs
4. Screenshots of before/after

We can then debug the specific issue!

