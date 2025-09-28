# Data Dictionary

## Overview
This document provides detailed information about all tables, columns, and relationships in the Chess Analytics database.

## Table: games
Core table storing basic chess game information.

| Column | Type | Null | Default | Description | PII | Index | FK |
|--------|------|------|---------|-------------|-----|-------|-----|
| id | UUID | No | gen_random_uuid() | Unique game identifier | No | PK | - |
| user_id | TEXT | No | - | Username of the player | Yes | Yes | - |
| platform | TEXT | No | - | Chess platform (lichess/chess.com) | No | Yes | - |
| result | TEXT | No | - | Game result (win/loss/draw) | No | Yes | - |
| opening | TEXT | Yes | - | Opening name | No | No | - |
| accuracy | FLOAT | Yes | - | Move accuracy percentage (0-100) | No | No | - |
| opponent_rating | INTEGER | Yes | - | Opponent's rating (0-4000) | No | No | - |
| my_rating | INTEGER | Yes | - | Player's rating (0-4000) | No | No | - |
| time_control | TEXT | Yes | - | Time control format | No | No | - |
| played_at | TIMESTAMP WITH TIME ZONE | No | - | Game date/time | No | Yes | - |
| created_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Record creation time | No | No | - |

## Table: user_profiles
User profile information and statistics.

| Column | Type | Null | Default | Description | PII | Index | FK |
|--------|------|------|---------|-------------|-----|-------|-----|
| id | UUID | No | gen_random_uuid() | Unique profile identifier | No | PK | - |
| user_id | TEXT | No | - | Username | Yes | Yes | - |
| platform | TEXT | No | - | Chess platform (lichess/chess.com) | No | Yes | - |
| display_name | TEXT | No | - | Display name | Yes | No | - |
| current_rating | INTEGER | No | 1200 | Current rating | No | No | - |
| total_games | INTEGER | No | 0 | Total games played | No | No | - |
| win_rate | REAL | No | 0 | Win rate percentage | No | No | - |
| most_played_time_control | TEXT | Yes | - | Most played time control | No | No | - |
| most_played_opening | TEXT | Yes | - | Most played opening | No | No | - |
| last_accessed | TIMESTAMP WITH TIME ZONE | No | NOW() | Last access time | No | Yes | - |
| created_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Profile creation time | No | No | - |
| updated_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Last update time | No | No | - |

## Table: game_analyses
Personality analysis results for individual games.

| Column | Type | Null | Default | Description | PII | Index | FK |
|--------|------|------|---------|-------------|-----|-------|-----|
| id | UUID | No | gen_random_uuid() | Unique analysis identifier | No | PK | - |
| user_id | TEXT | No | - | Username | Yes | Yes | - |
| platform | TEXT | No | - | Chess platform (lichess/chess.com) | No | Yes | - |
| game_id | TEXT | No | - | Game identifier | No | Yes | - |
| tactical_score | REAL | No | 50 | Tactical ability score (0-100) | No | Yes | - |
| positional_score | REAL | No | 50 | Positional understanding score (0-100) | No | Yes | - |
| aggressive_score | REAL | No | 50 | Aggressiveness score (0-100) | No | Yes | - |
| patient_score | REAL | No | 50 | Patience score (0-100) | No | Yes | - |
| created_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Analysis creation time | No | No | - |
| updated_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Last update time | No | No | - |

## Table: game_features
Detailed game feature extraction for personality analysis.

| Column | Type | Null | Default | Description | PII | Index | FK |
|--------|------|------|---------|-------------|-----|-------|-----|
| id | UUID | No | gen_random_uuid() | Unique feature identifier | No | PK | - |
| user_id | TEXT | No | - | Username | Yes | Yes | - |
| platform | TEXT | No | - | Chess platform (lichess/chesscom) | No | Yes | - |
| game_id | TEXT | No | - | Game identifier | No | No | - |
| forcing_rate | REAL | No | 0 | Rate of forcing moves (0-1) | No | No | - |
| quiet_rate | REAL | No | 0 | Rate of quiet moves (0-1) | No | No | - |
| early_queen | INTEGER | No | 0 | Early queen moves count | No | No | - |
| castle_move | INTEGER | No | 12 | Move number when castled (1-20) | No | No | - |
| opposite_castle | BOOLEAN | No | false | Opposite side castling | No | No | - |
| long_game | BOOLEAN | No | false | Game longer than 40 moves | No | No | - |
| piece_trades_early | INTEGER | No | 0 | Early piece trades count | No | No | - |
| sac_events | INTEGER | No | 0 | Sacrifice events count | No | No | - |
| king_attack_moves | INTEGER | No | 0 | King attack moves count | No | No | - |
| double_checks | INTEGER | No | 0 | Double check count | No | No | - |
| first_to_give_check | BOOLEAN | No | false | First to give check | No | No | - |
| non_pawn_developments | INTEGER | No | 0 | Non-pawn developments count | No | No | - |
| minor_developments | INTEGER | No | 0 | Minor piece developments count | No | No | - |
| castled_by_move_10 | BOOLEAN | No | false | Castled by move 10 | No | No | - |
| opening_ply | INTEGER | No | 8 | Opening phase length (0-30) | No | No | - |
| total_moves | INTEGER | No | 0 | Total moves in game (>=0) | No | No | - |
| queenless | BOOLEAN | No | false | Queenless position reached | No | No | - |
| quiet_move_streaks | INTEGER | No | 0 | Quiet move streaks count | No | No | - |
| queenless_conv | REAL | No | 0.5 | Queenless conversion rate | No | No | - |
| rook_endgames | INTEGER | No | 0 | Rook endgame count | No | No | - |
| endgame_reach | BOOLEAN | No | false | Reached endgame phase | No | No | - |
| tactical_score | REAL | No | 50 | Tactical ability score (0-100) | No | Yes | - |
| positional_score | REAL | No | 50 | Positional understanding score (0-100) | No | Yes | - |
| aggressive_score | REAL | No | 50 | Aggressiveness score (0-100) | No | Yes | - |
| patient_score | REAL | No | 50 | Patience score (0-100) | No | Yes | - |
| created_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Feature creation time | No | No | - |
| updated_at | TIMESTAMP WITH TIME ZONE | No | NOW() | Last update time | No | No | - |

## Relationships

### Primary Relationships
- **games.user_id** → **user_profiles.user_id** (Many-to-One)
- **games.user_id** → **game_analyses.user_id** (Many-to-One)
- **games.user_id** → **game_features.user_id** (Many-to-One)
- **game_analyses.game_id** → **games.id** (One-to-One, logical)
- **game_features.game_id** → **games.id** (One-to-One, logical)

### Unique Constraints
- **user_profiles**: (user_id, platform)
- **game_analyses**: (user_id, platform, game_id)
- **game_features**: (user_id, platform, game_id)

## Data Types

### UUID
- **Format**: 8-4-4-4-12 hexadecimal digits
- **Example**: `550e8400-e29b-41d4-a716-446655440000`
- **Usage**: Primary keys for all tables

### TIMESTAMP WITH TIME ZONE
- **Format**: ISO 8601 with timezone
- **Example**: `2025-09-17T21:00:00Z`
- **Usage**: All datetime fields

### REAL
- **Range**: Single precision floating point
- **Usage**: Percentages, rates, and scores

### INTEGER
- **Range**: 32-bit signed integer
- **Usage**: Counts, ratings, and move numbers

### TEXT
- **Length**: Variable length string
- **Usage**: Names, identifiers, and descriptions

### BOOLEAN
- **Values**: true/false
- **Usage**: Flags and binary states

## Constraints

### Check Constraints
- **accuracy**: 0 <= accuracy <= 100
- **ratings**: 0 < rating < 4000
- **platform**: IN ('lichess', 'chess.com', 'chesscom')
- **result**: IN ('win', 'loss', 'draw')
- **personality_scores**: 0 <= score <= 100
- **forcing_rate/quiet_rate**: 0 <= rate <= 1
- **castle_move**: 1 <= move <= 20
- **opening_ply**: 0 <= ply <= 30
- **total_moves**: moves >= 0

### Not Null Constraints
- All primary keys
- All foreign key references
- All required business fields
- All timestamp fields

## Indexes

### Primary Indexes
- All tables have UUID primary key indexes

### Secondary Indexes
- **games**: user_id, played_at, platform, result
- **user_profiles**: user_id, platform, last_accessed
- **game_analyses**: user_id, platform, game_id, personality_scores
- **game_features**: (user_id, platform), created_at, personality_scores

### Composite Indexes
- **game_features**: (user_id, platform) for efficient user queries

## Data Privacy

### PII (Personally Identifiable Information)
- **user_id**: Username (considered PII)
- **display_name**: Display name (considered PII)

### Non-PII
- All game data (moves, results, ratings)
- All analysis results and scores
- All timestamps and metadata

### Data Retention
- No automatic data retention policies implemented
- Consider implementing based on business requirements

## Performance Considerations

### Query Optimization
- Indexes designed for common query patterns
- Composite indexes for multi-column queries
- Partial indexes could be added for filtered queries

### Storage Optimization
- UUID primary keys provide good distribution
- Appropriate data types for each field
- No redundant data storage

### Scalability
- Schema designed to handle large datasets
- Proper indexing for performance
- RLS policies for security at scale

