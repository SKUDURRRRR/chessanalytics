# Database Schema Documentation

## Overview
The Chess Analytics database uses PostgreSQL with Supabase, implementing a comprehensive schema for storing chess game data, user profiles, and personality analysis results.

## Database Connection
- **Host**: `nkeaifrhtyigfmicfwch.supabase.co`
- **Database**: PostgreSQL 15+
- **Authentication**: Supabase service role key

## Tables

### games
Core table storing basic chess game information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique game identifier |
| user_id | TEXT | NOT NULL | Username of the player |
| platform | TEXT | NOT NULL, CHECK IN ('lichess', 'chess.com') | Chess platform |
| result | TEXT | NOT NULL, CHECK IN ('win', 'loss', 'draw') | Game result |
| opening | TEXT | | Opening name |
| accuracy | FLOAT | CHECK (0 <= accuracy <= 100) | Move accuracy percentage |
| opponent_rating | INTEGER | CHECK (0 < rating < 4000) | Opponent's rating |
| my_rating | INTEGER | CHECK (0 < rating < 4000) | Player's rating |
| time_control | TEXT | | Time control format |
| played_at | TIMESTAMP WITH TIME ZONE | NOT NULL | Game date/time |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation time |

**Indexes:**
- `idx_games_user_id` ON (user_id)
- `idx_games_played_at` ON (played_at)
- `idx_games_platform` ON (platform)
- `idx_games_result` ON (result)

### user_profiles
User profile information and statistics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique profile identifier |
| user_id | TEXT | NOT NULL | Username |
| platform | TEXT | NOT NULL, CHECK IN ('lichess', 'chess.com') | Chess platform |
| display_name | TEXT | NOT NULL | Display name |
| current_rating | INTEGER | DEFAULT 1200 | Current rating |
| total_games | INTEGER | DEFAULT 0 | Total games played |
| win_rate | REAL | DEFAULT 0 | Win rate percentage |
| most_played_time_control | TEXT | | Most played time control |
| most_played_opening | TEXT | | Most played opening |
| last_accessed | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last access time |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Profile creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

**Constraints:**
- UNIQUE(user_id, platform)

**Indexes:**
- `idx_user_profiles_user_id` ON (user_id)
- `idx_user_profiles_platform` ON (platform)
- `idx_user_profiles_last_accessed` ON (last_accessed)

### game_analyses
Personality analysis results for individual games.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique analysis identifier |
| user_id | TEXT | NOT NULL | Username |
| platform | TEXT | NOT NULL, CHECK IN ('lichess', 'chess.com') | Chess platform |
| game_id | TEXT | NOT NULL | Game identifier |
| tactical_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Tactical ability score |
| positional_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Positional understanding score |
| aggressive_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Aggressiveness score |
| patient_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Patience score |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Analysis creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

**Constraints:**
- UNIQUE(user_id, platform, game_id)

**Indexes:**
- `idx_game_analyses_user_id` ON (user_id)
- `idx_game_analyses_platform` ON (platform)
- `idx_game_analyses_game_id` ON (game_id)
- `idx_game_analyses_personality_scores` ON (tactical_score, positional_score, aggressive_score, patient_score, novelty_score, staleness_score)

### game_features
Detailed game feature extraction for personality analysis.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique feature identifier |
| user_id | TEXT | NOT NULL | Username |
| platform | TEXT | NOT NULL, CHECK IN ('lichess', 'chesscom') | Chess platform |
| game_id | TEXT | NOT NULL | Game identifier |
| forcing_rate | REAL | DEFAULT 0, CHECK (0 <= rate <= 1) | Rate of forcing moves |
| quiet_rate | REAL | DEFAULT 0, CHECK (0 <= rate <= 1) | Rate of quiet moves |
| early_queen | INTEGER | DEFAULT 0 | Early queen moves count |
| castle_move | INTEGER | DEFAULT 12, CHECK (1 <= move <= 20) | Move number when castled |
| opposite_castle | BOOLEAN | DEFAULT false | Opposite side castling |
| long_game | BOOLEAN | DEFAULT false | Game longer than 40 moves |
| piece_trades_early | INTEGER | DEFAULT 0 | Early piece trades count |
| sac_events | INTEGER | DEFAULT 0 | Sacrifice events count |
| king_attack_moves | INTEGER | DEFAULT 0 | King attack moves count |
| double_checks | INTEGER | DEFAULT 0 | Double check count |
| first_to_give_check | BOOLEAN | DEFAULT false | First to give check |
| non_pawn_developments | INTEGER | DEFAULT 0 | Non-pawn developments count |
| minor_developments | INTEGER | DEFAULT 0 | Minor piece developments count |
| castled_by_move_10 | BOOLEAN | DEFAULT false | Castled by move 10 |
| opening_ply | INTEGER | DEFAULT 8, CHECK (0 <= ply <= 30) | Opening phase length |
| total_moves | INTEGER | DEFAULT 0, CHECK (moves >= 0) | Total moves in game |
| queenless | BOOLEAN | DEFAULT false | Queenless position reached |
| quiet_move_streaks | INTEGER | DEFAULT 0 | Quiet move streaks count |
| queenless_conv | REAL | DEFAULT 0.5 | Queenless conversion rate |
| rook_endgames | INTEGER | DEFAULT 0 | Rook endgame count |
| endgame_reach | BOOLEAN | DEFAULT false | Reached endgame phase |
| tactical_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Tactical ability score |
| positional_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Positional understanding score |
| aggressive_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Aggressiveness score |
| patient_score | REAL | DEFAULT 50, CHECK (0 <= score <= 100) | Patience score |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Feature creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update time |

**Constraints:**
- UNIQUE(user_id, platform, game_id)

**Indexes:**
- `idx_game_features_user_platform` ON (user_id, platform)
- `idx_game_features_created_at` ON (created_at)
- `idx_game_features_personality_scores` ON (tactical_score, positional_score, aggressive_score, patient_score, novelty_score, staleness_score)

## Row Level Security (RLS)

All tables have RLS enabled with the following policies:

### games
- **Users can see their own games**: `auth.uid()::text = user_id`

### user_profiles
- **Users can view all profiles**: `true`
- **Users can insert own profiles**: `auth.uid()::text = user_id`
- **Users can update own profiles**: `auth.uid()::text = user_id`

### game_analyses
- **Users can view all game analyses**: `true`
- **Users can insert own game analyses**: `auth.uid()::text = user_id`
- **Users can update own game analyses**: `auth.uid()::text = user_id`

### game_features
- **Users can view own game features**: `auth.uid()::text = user_id`
- **Users can insert own game features**: `auth.uid()::text = user_id`
- **Users can update own game features**: `auth.uid()::text = user_id`
- **Users can delete own game features**: `auth.uid()::text = user_id`

## Functions and Triggers

### update_game_features_updated_at()
Automatically updates the `updated_at` timestamp when game_features records are modified.

```sql
CREATE OR REPLACE FUNCTION update_game_features_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### update_game_features_updated_at Trigger
```sql
CREATE TRIGGER update_game_features_updated_at
  BEFORE UPDATE ON game_features
  FOR EACH ROW
  EXECUTE FUNCTION update_game_features_updated_at();
```

## 2025-09-17 — Schema Deltas

### New Tables Created
1. **games** - Core chess game data storage
2. **user_profiles** - User profile management
3. **game_analyses** - Personality analysis results
4. **game_features** - Detailed game feature extraction

### Key Features Added
- **Personality Scoring System**: 6-dimensional personality analysis (tactical, positional, aggressive, patient, endgame, opening)
- **Comprehensive Indexing**: Performance-optimized indexes for all major query patterns
- **Data Validation**: Extensive CHECK constraints for data integrity
- **RLS Security**: Row-level security policies for data protection
- **Audit Trail**: Created/updated timestamps with automatic triggers

### Migration Files
- `20240101000000_initial_schema.sql` - Core games table
- `20240101000001_game_features.sql` - Game features table
- `20240101000002_user_profiles.sql` - User profiles table
- `20240101000003_create_game_features.sql` - Game features table (duplicate)
- `20240101000004_add_personality_scores.sql` - Personality score columns
- `20240101000005_create_game_analyses.sql` - Game analyses table

### Sample Data
Initial schema includes sample data for testing:
- 8 sample games for 'testuser' on Lichess
- Various openings and time controls
- Different game results and ratings


