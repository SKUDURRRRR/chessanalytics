# Import Games Feature - Investigation Summary

## Overview
The Chess Analytics application has two types of import functionality:
1. **Import Games Button** - Smart import of ~100 recent games
2. **Import More Games Button** - Large batch import of up to 5,000 games

---

## How It Works

### 1. Import Games Button (Smart Import)

**Location:** `SimpleAnalyticsPage.tsx` lines 232-265
- **Trigger:** Shows when user has NO games imported yet
- **Label:** "Import Games (100)"
- **Behavior:** Smart import that prioritizes new games

#### Process Flow:
1. User clicks "Import Games (100)"
2. Frontend calls `AutoImportService.importSmartGames()`
3. Backend endpoint: `POST /api/v1/import-games-smart`
4. Backend checks for new games (last 200 for Chess.com, 100 for Lichess)
5. Compares with existing games in database
6. Imports up to 100 new or next available games
7. Updates analytics after completion

**Smart Import Logic:**
- **If new games found:** Import up to 100 newest games
- **If no new games:** Import the next 100 games from where we left off
- **Duplicate Detection:** Compares `provider_game_id` against database

### 2. Import More Games Button (Large Import)

**Location:** `SimpleAnalyticsPage.tsx` lines 688-709
- **Trigger:** Shows AFTER user has games imported
- **Label:** "Import More Games"
- **Capacity:** Up to 5,000 games per import
- **Features:** Date range filtering, real-time progress, cancellation support

#### Process Flow:
1. User clicks "Import More Games"
2. If user has 5000+ games, shows date range picker modal
3. Otherwise, directly starts import with 5000 limit
4. Frontend calls `AutoImportService.importMoreGames()`
5. Backend endpoint: `POST /api/v1/import-more-games`
6. Backend starts background import task
7. Frontend polls for progress every 2 seconds (`GET /api/v1/import-progress/{user_id}/{platform}`)
8. Analytics refresh triggered every 500 games
9. Final refresh on completion

**Background Import Process:**
- Imports in batches of 100 games
- Uses pagination to fetch progressively older games
- **Lichess:** Uses `until_timestamp` parameter
- **Chess.com:** Uses month-by-month archives
- Filters duplicates automatically
- Stops after 3 consecutive batches with no new games

---

## Data We Import

### From Lichess

**API Source:** Lichess Games Export API (`https://lichess.org/api/games/user/{username}`)
- **Format:** PGN (Portable Game Notation) text stream
- **Parameters:**
  - `max`: Number of games (up to 100)
  - `until`: Timestamp for pagination (fetch games before this time)
  - `pgnInJson`: Returns PGN in JSON format
  - `opening`: Include opening names

**Parsed from PGN Headers:**
```python
# Game Identification
- game_id: From Site header (e.g., "https://lichess.org/abc123" → "abc123")
- provider_game_id: Same as game_id

# Players
- White: White player username
- Black: Black player username
- opponent_name: Opponent's username

# Ratings
- WhiteElo: White player rating
- BlackElo: Black player rating
- my_rating: User's rating in this game
- opponent_rating: Opponent's rating

# Game Details
- Result: "1-0", "0-1", "1/2-1/2"
- Opening: Opening name (e.g., "Sicilian Defense: Najdorf Variation")
- ECO: Opening ECO code (e.g., "B90")
- TimeControl: Time control string (e.g., "600+0")
- UTCDate + UTCTime: When game was played

# Moves
- pgn: Full PGN text with all moves
- total_moves: Count of moves in the game
```

### From Chess.com

**API Source:** Chess.com Archives API (`https://api.chess.com/pub/player/{username}/games/archives`)
- **Format:** JSON with array of games
- **Parameters:**
  - Month-by-month archive URLs
  - Date range filtering for targeted imports

**Extracted from JSON Response:**
```python
# Game Identification
- url: Game URL (e.g., "https://www.chess.com/game/live/12345")
- game_id: Extracted from URL

# Players
- white.username: White player username
- black.username: Black player username
- white.rating: White player rating
- black.rating: Black player rating
- white.result: White's result (e.g., "win", "checkmated")
- black.result: Black's result

# Game Details
- pgn: Full PGN text
- time_control: Time control string (e.g., "600+5")
- time_class: Time class (bullet/blitz/rapid/classical)
- end_time: Unix timestamp of game end
- rules: Chess variant (standard/chess960/etc)

# Parsed from PGN
- Opening: Opening name from PGN header
- total_moves: Count of moves
```

**Time Control Classification:**
Chess.com time controls are converted to standard categories:
- **Bullet:** ≤ 3 minutes total time
- **Blitz:** ≤ 10 minutes total time
- **Rapid:** ≤ 30 minutes total time
- **Classical:** > 30 minutes total time

---

## Where Data Is Saved

### Database Tables (Supabase PostgreSQL)

#### 1. `games` Table
**Location:** `supabase/migrations/20240101000000_initial_schema.sql`

Stores main game metadata:

```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('lichess', 'chess.com')),
  provider_game_id TEXT NOT NULL,  -- Unique game ID from platform
  result TEXT NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  color TEXT CHECK (color IN ('white', 'black')),
  opening TEXT,
  opening_family TEXT,
  opening_normalized TEXT,  -- For efficient filtering
  opponent_rating INTEGER CHECK (opponent_rating > 0 AND opponent_rating < 4000),
  my_rating INTEGER CHECK (my_rating > 0 AND my_rating < 4000),
  time_control TEXT,
  total_moves INTEGER,
  opponent_name TEXT,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform, provider_game_id)  -- Prevents duplicates
);
```

**Indexes:**
- `idx_games_user_id` on `user_id`
- `idx_games_played_at` on `played_at`
- `idx_games_platform` on `platform`
- `idx_games_result` on `result`
- Composite indexes on `(user_id, platform)`

#### 2. `games_pgn` Table
**Location:** `supabase/migrations/20241220000003_create_games_pgn_table.sql`

Stores full PGN data (separated for performance):

```sql
CREATE TABLE games_pgn (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  provider_game_id TEXT NOT NULL,
  pgn TEXT NOT NULL,  -- Full PGN text with moves
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, platform, provider_game_id)
);
```

**Why Separate Table?**
- PGN text can be large (several KB per game)
- Keeps `games` table fast for queries
- PGN only loaded when needed (e.g., for analysis)

#### 3. `user_profiles` Table

Stores user metadata:

```sql
user_profiles (
  user_id TEXT,
  platform TEXT,
  display_name TEXT,
  total_games INTEGER,
  current_rating INTEGER,  -- For Chess.com: highest rating
  last_accessed TIMESTAMP,
  UNIQUE(user_id, platform)
)
```

---

## Import Process Details

### Backend Implementation
**File:** `python/core/unified_api_server.py`

#### Key Functions:

**1. `_fetch_games_from_platform()`** (lines 1922-1951)
- Routes to platform-specific fetch functions
- Supports pagination with `until_timestamp` or `oldest_game_month`
- Supports date range filtering

**2. `_fetch_lichess_games()`** (lines 1953-2000)
- Fetches games from Lichess API
- Returns PGN text stream
- Uses `until` parameter for pagination

**3. `_fetch_chesscom_games()`** (lines 2002-2180)
- Fetches from Chess.com monthly archives
- Iterates through month archives
- Supports continuing from oldest_game_month

**4. `_parse_lichess_pgn()`** (lines 1813-1920)
- Parses PGN text using `chess.pgn` library
- Extracts headers and metadata
- Counts moves
- Determines user color and result

**5. `_parse_chesscom_game()`** (lines 2228-2355)
- Parses Chess.com JSON game data
- Extracts ratings from player objects
- Converts time control to standard format
- Parses PGN for opening and moves

**6. `import_games()`** (lines 2677-2777)
- Core import function
- Inserts into `games` table (upsert on conflict)
- Inserts into `games_pgn` table (upsert on conflict)
- Updates `user_profiles` table
- Returns import statistics

### Duplicate Prevention

**Method:** Unique constraint on `(user_id, platform, provider_game_id)`
- **Action:** `UPSERT` with `on_conflict` clause
- **Result:** Updates existing games if re-imported
- **Performance:** Database-level deduplication (fast)

### Data Flow Diagram

```
User clicks button
    ↓
Frontend (SimpleAnalyticsPage.tsx)
    ↓
Service Layer (autoImportService.ts)
    ↓
Backend API (unified_api_server.py)
    ↓
Platform API (Lichess/Chess.com)
    ↓
Parse & Transform (PGN/JSON parsing)
    ↓
Database (Supabase)
    ├─ games table (metadata)
    ├─ games_pgn table (full PGN)
    └─ user_profiles table (stats)
    ↓
Frontend refresh (analytics update)
```

---

## Smart Import vs Large Import Comparison

| Feature | Smart Import | Large Import |
|---------|--------------|--------------|
| **Limit** | 100 games | Up to 5,000 games |
| **When shown** | No games yet | After first import |
| **Strategy** | Prioritize newest | Import in bulk |
| **Date filtering** | No | Yes (optional) |
| **Progress tracking** | Simple status | Real-time with % |
| **Cancellation** | No | Yes |
| **Analytics refresh** | Once at end | Every 500 games |
| **Endpoint** | `/api/v1/import-games-smart` | `/api/v1/import-more-games` |
| **Execution** | Synchronous | Background task |

---

## Key Files Reference

### Frontend
- **UI Component:** `src/pages/SimpleAnalyticsPage.tsx`
- **Service Layer:** `src/services/autoImportService.ts`
- **Documentation:** `IMPORT_MORE_GAMES_IMPLEMENTATION.md`

### Backend
- **API Server:** `python/core/unified_api_server.py`
  - Lines 1813-1920: Lichess parsing
  - Lines 2228-2355: Chess.com parsing
  - Lines 2375-2586: Smart import endpoint
  - Lines 2588-2675: Simple import endpoint
  - Lines 2677-2777: Core import function
  - Lines 2784-2900: Large import endpoints

### Database
- **Schema:** `supabase/migrations/20240101000000_initial_schema.sql`
- **PGN Table:** `supabase/migrations/20241220000003_create_games_pgn_table.sql`

---

## Summary

The import system is a **two-tiered approach**:

1. **Initial Import:** Smart import of 100 games to get user started quickly
2. **Bulk Import:** Large-scale import of up to 5,000 games for comprehensive analysis

**Data Sources:**
- Lichess: PGN text stream via API
- Chess.com: JSON monthly archives

**Data Stored:**
- Game metadata in `games` table
- Full PGN text in `games_pgn` table
- User statistics in `user_profiles` table

**Key Features:**
- Automatic duplicate detection
- Real-time progress tracking
- Platform-specific optimizations
- Date range filtering
- Cancellation support
- Incremental analytics refresh

The system is designed to be **efficient**, **user-friendly**, and **scalable** for users with large game histories.

