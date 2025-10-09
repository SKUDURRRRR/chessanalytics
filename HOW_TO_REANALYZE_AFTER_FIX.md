# How to Re-analyze Games After Move Classification Fix

## Why Re-analyze?

The move classification thresholds were incorrect, causing:
- **Mistakes** (100-200cp) to be labeled as **inaccuracies**
- **Blunders** (200+cp) to be labeled as **mistakes** or even missed entirely (if <400cp)
- Games showing **0 mistakes** when they actually had mistakes

All games analyzed **before October 8, 2025** need to be re-analyzed with the corrected thresholds.

## Quick Re-analysis Guide

### Option 1: Re-analyze from UI (Recommended)

1. Open any game in the Chess Analytics app
2. Click the **"Re-analyze"** button at the top
3. Wait for the analysis to complete
4. The game will now show correct mistake/blunder counts

### Option 2: Re-analyze via API

Use the re-analysis endpoint for each game:

```bash
curl -X POST http://localhost:8000/api/analyze/reanalyze \
  -H "Content-Type: application/json" \
  -d '{
    "game_id": "YOUR_GAME_ID",
    "user_id": "YOUR_USER_ID",
    "platform": "chess.com"
  }'
```

### Option 3: Bulk Re-analysis (Python Script)

Create a script to re-analyze all games:

```python
import requests

# Get all games
games_response = requests.get(
    "http://localhost:8000/api/games",
    params={"user_id": "YOUR_USER_ID", "platform": "chess.com"}
)

games = games_response.json()

# Re-analyze each game
for game in games:
    print(f"Re-analyzing game {game['game_id']}...")
    response = requests.post(
        "http://localhost:8000/api/analyze/reanalyze",
        json={
            "game_id": game["game_id"],
            "user_id": "YOUR_USER_ID",
            "platform": "chess.com"
        }
    )
    print(f"Status: {response.status_code}")
```

## What Changed

### Before Fix (WRONG)
```
Centipawn Loss Range → Classification
0-100 cp    → Various good moves
100-200 cp  → Inaccuracy ❌ (should be Mistake)
200-400 cp  → Mistake ❌ (should be Blunder)
400+ cp     → Blunder
```

### After Fix (CORRECT - Chess.com Standard)
```
Centipawn Loss Range → Classification
0-5 cp      → Best
5-15 cp     → Great
15-25 cp    → Excellent
25-50 cp    → Good
50-100 cp   → Inaccuracy ✅
100-200 cp  → Mistake ✅
200+ cp     → Blunder ✅
```

## Expected Changes After Re-analysis

For a typical game, you should see:

**Before Fix:**
- Mistakes: 0-1 (underreported)
- Inaccuracies: 5-10 (inflated)
- Blunders: 0-1 (underreported)

**After Fix:**
- Mistakes: 1-3 (accurate)
- Inaccuracies: 2-5 (accurate)
- Blunders: 1-2 (accurate)

## Verification

After re-analysis, verify:

1. ✅ Games no longer show 0 mistakes (unless actually perfect)
2. ✅ Accuracy scores match the move quality distribution
3. ✅ Blunders are detected at 200+cp, not just 400+cp
4. ✅ Results are closer to Chess.com's analysis

## Questions?

- **Q: Do I need to re-import games?**  
  A: No, just re-analyze them. The PGN data is already in the database.

- **Q: Will this affect my rating history?**  
  A: No, only the analysis/statistics will change. Your actual game results remain the same.

- **Q: How long does re-analysis take?**  
  A: About 30-60 seconds per game with Stockfish analysis.

- **Q: Can I compare with Chess.com?**  
  A: Yes! The thresholds now match Chess.com standards, so results should be very similar.

---

**Note:** Games analyzed after October 8, 2025 will automatically use the correct thresholds.

