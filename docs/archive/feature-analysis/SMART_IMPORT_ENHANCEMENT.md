# Smart Import Enhancement

## Overview

The smart import functionality has been enhanced to provide more intelligent game importing behavior. When a user presses the "Import Game" button, the system now:

1. **Checks for new games first** - Scans the platform APIs for games that aren't in our database
2. **Imports new games** - If new games are found, imports up to 100 of them
3. **Falls back to next batch** - If no new games are found, imports the next 100 games from where we left off

## How It Works

### Step 1: Check for New Games
- Fetches recent games from the platform API (200 for Chess.com, 100 for Lichess)
- Compares against existing games in the database
- Identifies games that are new (not in our database)

### Step 2: Import Strategy
- **If new games found**: Import up to 100 new games
- **If no new games**: Import the next 100 games from the last imported position

### Step 3: Platform-Specific Handling

#### Chess.com
- Can fetch up to 300 games efficiently by going back in time
- Uses month-by-month fetching to get more games
- Better at finding the next batch of games

#### Lichess
- Limited by API `max` parameter (typically 100 games)
- Uses `since` parameter to fetch older games when needed
- More sophisticated approach to get the next batch

## API Endpoint

### POST `/api/v1/import-games-smart`

**Request:**
```json
{
  "user_id": "username",
  "platform": "lichess" | "chess.com"
}
```

**Response:**
```json
{
  "success": true,
  "imported_games": 25,
  "new_games_count": 25,
  "had_existing_games": true,
  "message": "Imported 25 new games (found 25 new games)"
}
```

## Frontend Integration

The frontend automatically uses the smart import when the "Import Games" button is pressed:

```typescript
// In SimpleAnalyticsPage.tsx
const result = await AutoImportService.importSmartGames(userId, platform, progress => {
  setImportStatus(progress.message)
})
```

## User Experience

### Progress Messages
- "Checking for new games..." - Initial check
- "Imported X new games" - When new games are found
- "Imported X additional games (no new games found, imported next batch)" - When importing older games

### Success Feedback
- Shows detailed message about what was imported
- Automatically refreshes analytics after import
- Displays success message for 5 seconds

## Database Schema

The system uses the existing database schema:

- `games` table - stores game metadata
- `games_pgn` table - stores PGN data
- `user_profiles` table - tracks user information

## Error Handling

- Graceful fallback if API calls fail
- Detailed error messages for debugging
- Continues with available data if some operations fail

## Testing

Run the test script to verify functionality:

```bash
python scripts/test_smart_import.py
```

## Benefits

1. **Efficient**: Only imports what's needed
2. **Smart**: Automatically detects new vs. old games
3. **User-friendly**: Clear feedback about what's happening
4. **Robust**: Handles edge cases and API limitations
5. **Scalable**: Works with both platforms' API constraints

## Future Enhancements

- Track import history to avoid re-importing the same games
- Implement pagination for very large game histories
- Add support for date range imports
- Cache API responses to reduce external calls
