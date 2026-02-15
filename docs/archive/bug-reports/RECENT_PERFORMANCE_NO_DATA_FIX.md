# Recent Performance "No Data" Fix

**Date:** October 19, 2025
**Issue:** Recent Performance section showing "No data" for win rate and "--" for current rating despite having game data

## Problem Analysis

### Symptoms
- Recent Win Rate: `--% No data`
- Current Rating: `--` (showing only "No data" below)
- ELO trend graph showing data (e.g., "RAPID (372 GAMES)")
- Most played opening showing data (e.g., "Italian Game 156 games • Rapid")

### Root Causes

#### Issue 1: Missing `performanceTrends` ❌
The frontend component `SimpleAnalytics.tsx` was expecting a `performanceTrends` object from the backend API `/api/v1/comprehensive-analytics`, but the backend was **not computing or returning this data**.

The frontend code (lines 45-66 in `SimpleAnalytics.tsx`) was checking:
```typescript
const activePerformance = useMemo(() => {
  if (!comprehensiveData?.performanceTrends) {
    return null  // This caused "No data" to display
  }
  // ... use performanceTrends data
}, [comprehensiveData?.performanceTrends, selectedTimeControl, eloGraphGamesUsed])
```

#### Issue 2: Missing `currentElo` and `currentEloPerTimeControl` ❌
The frontend was also expecting `currentElo` and `currentEloPerTimeControl` to display the current rating number, but these were missing from the backend response.

The frontend code (lines 903-906 in `SimpleAnalytics.tsx`):
```typescript
{selectedTimeControl && comprehensiveData?.currentEloPerTimeControl?.[selectedTimeControl]
  ? safeComprehensive.currentEloPerTimeControl[selectedTimeControl]
  : (comprehensiveData?.currentElo || '--')}
```

The backend API response (from `python/core/unified_api_server.py`) was missing these fields:
```python
return {
    'total_games': total_games_count,
    'totalGames': len(games),
    'winRate': round(win_rate, 1),
    'colorStats': color_stats,
    'openingStats': opening_stats,
    # ... other fields ...
    # ❌ performanceTrends was missing!
    # ❌ currentElo was missing!
    # ❌ currentEloPerTimeControl was missing!
}
```

## Solution Implemented

### 1. Added `_get_time_control_category` Helper Function

**File:** `python/core/unified_api_server.py` (lines 1115-1131)

Created a helper function to categorize time controls consistently:

```python
def _get_time_control_category(time_control: str) -> str:
    """Helper function to categorize time controls."""
    if not time_control:
        return 'Unknown'
    tc = time_control.lower()
    if 'bullet' in tc or ('180' in tc and '+0' in tc) or ('60' in tc):
        return 'Bullet'
    elif 'blitz' in tc or ('300' in tc) or ('180' in tc):
        return 'Blitz'
    elif 'rapid' in tc or ('600' in tc) or ('900' in tc) or ('1800' in tc):
        return 'Rapid'
    elif 'classical' in tc or 'standard' in tc:
        return 'Classical'
    elif 'correspondence' in tc or 'daily' in tc:
        return 'Correspondence'
    else:
        return 'Other'
```

### 2. Added `_calculate_performance_trends` Function

**File:** `python/core/unified_api_server.py` (lines 1134-1254)

Created a new helper function that mirrors the TypeScript `calculatePerformanceTrends` logic:

```python
def _calculate_performance_trends(games: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate performance trends similar to TypeScript calculatePerformanceTrends function.

    Returns:
        - recentWinRate: Win rate from recent 50 games
        - recentAverageElo: Average ELO from recent 50 games
        - eloTrend: 'improving', 'declining', or 'stable'
        - timeControlUsed: Most played time control
        - sampleSize: Number of games in sample
        - perTimeControl: Dict with stats per time control
    """
```

**Key Features:**
- Groups games by time control (Bullet, Blitz, Rapid, Classical, etc.)
- Calculates stats for the most played time control
- Computes per-time-control stats for filtering in the UI
- Uses recent 50 games for win rate and average ELO
- Determines ELO trend by comparing first 20 vs. last 20 games

### 3. Added Current ELO Calculations

**File:** `python/core/unified_api_server.py` (lines 1565-1590)

Added code to calculate `currentElo` and `currentEloPerTimeControl`:

```python
# Calculate current ELO (most recent rating across all games)
current_elo = None
games_sorted_by_date = sorted(games, key=lambda g: g.get('played_at', ''), reverse=True)
for game in games_sorted_by_date:
    if game.get('my_rating'):
        current_elo = game['my_rating']
        break

# Calculate current ELO per time control (most recent rating for each time control)
current_elo_per_time_control = {}
games_by_tc = {}
for game in games:
    tc = game.get('time_control', '')
    if tc:
        tc_category = _get_time_control_category(tc)
        if tc_category not in games_by_tc:
            games_by_tc[tc_category] = []
        games_by_tc[tc_category].append(game)

for tc_category, tc_games in games_by_tc.items():
    tc_sorted = sorted(tc_games, key=lambda g: g.get('played_at', ''), reverse=True)
    for game in tc_sorted:
        if game.get('my_rating'):
            current_elo_per_time_control[tc_category] = game['my_rating']
            break
```

### 4. Updated API Response to Include All Missing Fields

**File:** `python/core/unified_api_server.py` (lines 1592-1616)

```python
# Calculate performance trends (for Recent Performance section)
performance_trends = _calculate_performance_trends(games)

return {
    # ... existing fields ...
    'currentElo': current_elo,  # ✅ Now included!
    'currentEloPerTimeControl': current_elo_per_time_control,  # ✅ Now included!
    'performanceTrends': performance_trends,  # ✅ Now included!
    # ... other fields ...
}
```

## Implementation Details

### Performance Trends Calculation

1. **Time Control Categorization:**
   - Bullet: < 3 min
   - Blitz: 3-10 min
   - Rapid: 10-30 min
   - Classical/Standard: > 30 min
   - Correspondence/Daily: correspondence games

2. **Recent Win Rate:**
   - Uses most recent 50 games for the most played time control
   - Calculates: `(wins / total games) * 100`

3. **Recent Average ELO:**
   - Averages ELO ratings from recent 50 games
   - Filters out null ratings

4. **ELO Trend Detection:**
   - Requires at least 40 games
   - Compares average ELO of games -40 to -20 vs. -20 to 0
   - "Improving": +10 or more ELO
   - "Declining": -10 or more ELO
   - "Stable": Within ±10 ELO

5. **Per Time Control Stats:**
   - Calculates separate stats for each time control category
   - Allows UI to filter by time control using the dropdown

### Current ELO Calculation

1. **Overall Current ELO:**
   - Finds the most recent game across ALL time controls
   - Returns that game's rating

2. **Per Time Control Current ELO:**
   - Finds the most recent game for EACH time control category
   - Returns a dictionary mapping time control to rating
   - Example: `{'Blitz': 1052, 'Rapid': 1442}`

## Testing

To verify the fix:

1. **Backend Check:**
   ```bash
   # Restart backend server
   python python/main.py
   ```

2. **API Response Check:**
   ```bash
   curl http://localhost:8000/api/v1/comprehensive-analytics/{user_id}/lichess
   # Should now include "performanceTrends", "currentElo", and "currentEloPerTimeControl" fields
   ```

3. **Frontend Check:**
   - Open the analytics page
   - Verify "Recent Win Rate" shows a percentage (e.g., "52.0%")
   - Verify "Current Rating" shows a number (e.g., "1052")
   - Verify subtitle shows average ELO (e.g., "Avg: 1052 • 50 games")
   - Test time control filter dropdown to ensure stats update correctly

## Expected Behavior After Fix

### Recent Performance Section
- **Recent Win Rate:** Displays percentage with sample size
  - Example: `52.0%` with `50 games • Blitz`
- **Current Rating:** Shows current rating for selected time control
  - Example: `1052` with `Avg: 1052 • 50 games`
- **Most Played Opening:** Already working, unchanged

### Time Control Filtering
- Dropdown allows filtering by time control (Bullet, Blitz, Rapid, etc.)
- Stats update to show performance for selected time control
- ELO trend graph updates to match selected time control
- Current rating updates to show most recent rating for that time control

## Related Files Changed

1. `python/core/unified_api_server.py`:
   - Added `_get_time_control_category()` helper function (lines 1115-1131)
   - Added `_calculate_performance_trends()` helper function (lines 1134-1254)
   - Added current ELO calculations (lines 1565-1590)
   - Updated API response to include all missing fields (lines 1592-1616)

2. `docs/RECENT_PERFORMANCE_NO_DATA_FIX.md`:
   - This documentation file

## Notes

- The frontend code in `SimpleAnalytics.tsx` did not need changes
- The TypeScript types in `src/utils/comprehensiveGameAnalytics.ts` already defined the expected structure
- This fix ensures backend and frontend are properly synchronized
- All three missing fields (`performanceTrends`, `currentElo`, `currentEloPerTimeControl`) are now provided by the backend
