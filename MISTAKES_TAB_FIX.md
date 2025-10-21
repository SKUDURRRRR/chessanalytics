# Mistakes Tab Fix - Chess.com Users

## Problem

The "Mistakes" tab in the Enhanced Opening Analysis was showing "No Major Mistakes Found!" for chess.com users (e.g., `skudurrrrr`), even when they had mistakes in their games. However, it was working correctly for lichess users (e.g., `skudurelis`).

## Root Cause

The issue was caused by **game ID mismatch** between the `games` table and the `analyses` tables. Here's what was happening:

### The Flow

1. **`get_deep_analysis` endpoint** (line 1236) fetches games from the database:
   ```python
   games_response = db_client.table('games').select(
       'provider_game_id, result, opening, opening_family, time_control, my_rating, played_at'
   ).eq('user_id', canonical_user_id).eq('platform', platform)...
   ```

   ❌ **Problem**: The `id` field (internal UUID) was NOT being fetched

2. **`_extract_opening_mistakes` function** (line 2557) builds a game_map:
   ```python
   game_map = {}
   for game in games:
       game_id = game.get('id') or game.get('provider_game_id')
       if game_id:
           game_map[game_id] = game
   ```

   Since `id` wasn't fetched, it fell back to `provider_game_id`

3. **Matching analyses to games** (line 2567):
   ```python
   for analysis in analyses:
       game_id = analysis.get('game_id', '')
       game = game_map.get(game_id, {})
   ```

   ❌ **Problem**: If the analyses stored `game_id` as the internal UUID (not `provider_game_id`), the lookup would fail!

### Why Chess.com Was Affected More

The database stores games with:
- `id`: Internal UUID (e.g., `"550e8400-e29b-41d4-a716-446655440000"`)
- `provider_game_id`: External game ID from the platform
  - Chess.com: URL-based ID (e.g., `"12345678901"`)
  - Lichess: Short game ID (e.g., `"abc123XY"`)

When analyses were stored, the `game_id` field could be set to either:
- The internal UUID `id`, OR
- The external `provider_game_id`

Since chess.com uses longer, URL-based IDs that differ more from UUIDs, the mismatch was more common, causing the lookup to fail and preventing mistakes from being extracted.

## Solution

### 1. Fetch Both ID Fields (Line 1236)
```python
games_response = db_client.table('games').select(
    'id, provider_game_id, result, opening, opening_family, opening_normalized, time_control, my_rating, played_at'
).eq('user_id', canonical_user_id).eq('platform', platform)...
```

✅ Now fetches both `id` and `provider_game_id`
✅ Also added `opening_normalized` for better opening name display

### 2. Build Game Map with Both Keys (Line 2557)
```python
game_map = {}
for game in games:
    # Add entry for internal UUID 'id'
    game_id = game.get('id')
    if game_id:
        game_map[game_id] = game

    # Add entry for 'provider_game_id'
    provider_id = game.get('provider_game_id')
    if provider_id:
        game_map[provider_id] = game
```

✅ Game map now has entries for BOTH the UUID and the external ID
✅ Analyses can match using either field

### 3. Added Detailed Debug Logging
```python
print(f"[Mistake Extraction] Built game_map with {len(game_map)} total entries")
print(f"[Mistake Extraction] Game {game_id}: Found {len(opening_moves)} user opening moves in {display_name}")
print(f"[Mistake Extraction] Added {classification}: {mistake_desc} ({notation}), CPL={cpl}")
```

✅ Helps diagnose future issues with game matching

### 4. Fixed `_generate_improvement_trend` (Line 3026)
Also updated the improvement trend calculation to try both ID fields:
```python
analysis = None
if game.get('id') and game.get('id') in analysis_map:
    analysis = analysis_map[game.get('id')]
elif game.get('provider_game_id') and game.get('provider_game_id') in analysis_map:
    analysis = analysis_map[game.get('provider_game_id')]
```

✅ Ensures trend calculations work for all users

## Files Changed

1. **`python/core/unified_api_server.py`**
   - Line 1236-1241: Updated games query to fetch `id` and `opening_normalized`
   - Line 2553-2659: Updated `_extract_opening_mistakes` with dual-key game_map
   - Line 2994-3050: Updated `_generate_improvement_trend` with dual-key matching

## Testing

To verify the fix works:

1. Navigate to the Enhanced Opening Analysis page for a chess.com user
2. Click on the "Mistakes" tab
3. You should now see specific opening mistakes listed (if the user has any)

Example users to test:
- ✅ Chess.com: `skudurrrrr` (should now show mistakes)
- ✅ Lichess: `skudurelis` (should continue to work)

## Impact

- ✅ Chess.com users will now see their opening mistakes correctly
- ✅ Lichess users continue to work as before
- ✅ Improved game-analysis matching reliability across all platforms
- ✅ Better debug logging for future troubleshooting

## Additional Notes

This fix also improves other features that rely on game-analysis matching:
- Opening accuracy calculations
- Improvement trend charts
- Repertoire analysis

The root cause was a subtle data modeling issue where different parts of the codebase used different ID fields (`id` vs `provider_game_id`) for matching. The fix ensures both fields are available and matched correctly.
