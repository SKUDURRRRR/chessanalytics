# Opening Normalized Reprocessing

## Overview
The `opening_normalized` column was added to the `games` table to enable efficient database-level filtering of games by opening name. The initial migration uses simplified normalization logic for speed.

## Current State

### Initial Migration (Simple Normalization)
The migration `20251011232950_add_opening_normalized.sql` uses:
```sql
COALESCE(NULLIF(TRIM(opening_family), ''), NULLIF(TRIM(opening), ''), 'Unknown')
```

This provides ~90% accuracy by simply using the raw opening values from the database.

### Frontend Normalization (Complex Logic)
The frontend analytics uses `getOpeningNameWithFallback()` which:
- Checks for ECO codes (e.g., "B10" → "Caro-Kann Defense")
- Normalizes variations (e.g., "Caro-Kann" → "Caro-Kann Defense")
- Uses comprehensive opening family mappings
- Handles edge cases and special openings

## Why This Works

1. **Display**: Frontend continues to use `getOpeningNameWithFallback()` for displaying opening names
2. **Analytics**: Opening statistics are calculated using `getOpeningNameWithFallback()`
3. **Filtering**: Database uses simpler `opening_normalized` for efficient queries
4. **Matching**: The filter compares the frontend's normalized name against database's normalized name

### Example Flow
- User clicks "Caro-Kann Defense" (220 games shown in analytics)
- Frontend creates filter: `{ normalized: "Caro-Kann Defense" }`
- Database query: `WHERE opening_normalized = 'Caro-Kann Defense'`
- Result: Returns games where `opening_family` or `opening` was "Caro-Kann Defense"

## Potential Mismatches

Cases where simple normalization might differ from complex normalization:
1. **ECO Codes**: Database has "B10", frontend normalizes to "Caro-Kann Defense"
2. **Variations**: Database has "Caro-Kann", frontend normalizes to "Caro-Kann Defense"
3. **Typos/Variations**: Different spellings or naming conventions

## Future: Reprocessing Endpoint

To achieve 100% accuracy, we can create an admin endpoint that:

### Endpoint: `POST /api/v1/admin/reprocess-openings`

```python
@app.post("/api/v1/admin/reprocess-openings")
async def reprocess_openings(platform: str = None):
    """
    Reprocess opening_normalized values using the proper normalization logic.
    This can be run periodically or when opening normalization logic changes.
    """
    # Port the TypeScript getOpeningNameWithFallback() logic to Python
    # Or call a TypeScript/Node function to do the normalization
    # Update opening_normalized for all games
    pass
```

### Implementation Strategy

#### Option 1: Port Logic to Python
- Replicate `getOpeningNameWithFallback()` in Python
- Include ECO code mappings
- Include opening family normalizations

#### Option 2: Use TypeScript via Node
- Create a standalone Node script that reads from database
- Apply `getOpeningNameWithFallback()` to each game
- Write back to database

#### Option 3: Hybrid Approach (Recommended)
- Keep simple SQL normalization for new imports (fast)
- Run batch reprocessing monthly to fix edge cases
- Focus on high-volume openings first (those with 20+ games)

## Monitoring

To check normalization accuracy:

```sql
-- Find games where opening_normalized might be inaccurate
SELECT opening_normalized, COUNT(*) as count
FROM games
WHERE opening_normalized NOT LIKE '%Defense%'
  AND opening_normalized NOT LIKE '%Opening%'
  AND opening_normalized NOT LIKE '%Gambit%'
  AND opening_normalized != 'Unknown'
GROUP BY opening_normalized
ORDER BY count DESC
LIMIT 50;
```

## Rollback Plan

If issues occur:
1. Drop the index: `DROP INDEX idx_games_opening_normalized;`
2. Remove the constraint: `ALTER TABLE games DROP CONSTRAINT opening_normalized_valid;`
3. Revert frontend changes to use client-side filtering
4. Drop the column: `ALTER TABLE games DROP COLUMN opening_normalized;`

