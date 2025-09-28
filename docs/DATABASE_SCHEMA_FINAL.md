# Database Schema Documentation

This document provides comprehensive documentation for the Chess Analytics database schema.

## 📊 Schema Overview

The database is designed with a clean, normalized structure that supports both basic and advanced chess analysis features.

### Core Architecture
```
games (main games table)
├── user_profiles (user information)
├── game_analyses (basic analysis data)
├── move_analyses (detailed Stockfish analysis)
└── game_features (calculated features)
```

## 🗃️ Table Definitions

### 1. Games Table
**Purpose**: Stores basic chess game information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique game identifier |
| user_id | TEXT | NOT NULL | User identifier |
| platform | TEXT | NOT NULL, CHECK | Platform: 'lichess' or 'chess.com' |
| result | TEXT | NOT NULL, CHECK | Game result: 'win', 'loss', or 'draw' |
| color | TEXT | CHECK | Player color: 'white' or 'black' |
| provider_game_id | TEXT | | Platform-specific game ID |
| opening | TEXT | | Opening name |
| opening_family | TEXT | | Opening family |
| accuracy | FLOAT | CHECK (0-100) | Overall game accuracy |
| opponent_rating | INTEGER | CHECK (0-4000) | Opponent's rating |
| my_rating | INTEGER | CHECK (0-4000) | Player's rating |
| time_control | TEXT | | Time control string |
| total_moves | INTEGER | DEFAULT 0 | Total moves in game |
| played_at | TIMESTAMP | NOT NULL | When the game was played |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Record update time |

**Indexes**:
- `idx_games_user_platform` (user_id, platform)
- `idx_games_played_at` (played_at DESC)
- `idx_games_result` (result)
- `idx_games_provider_game_id` (provider_game_id)

### 2. User Profiles Table
**Purpose**: Stores user profile information

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique profile identifier |
| user_id | TEXT | UNIQUE, NOT NULL | User identifier |
| platform | TEXT | NOT NULL, CHECK | Platform: 'lichess' or 'chess.com' |
| username | TEXT | | Display username |
| display_name | TEXT | | Display name |
| rating | INTEGER | | Current rating |
| total_games | INTEGER | DEFAULT 0 | Total games played |
| win_rate | FLOAT | CHECK (0-1) | Win rate percentage |
| last_accessed | TIMESTAMP | DEFAULT NOW() | Last access time |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Record update time |

**Indexes**:
- `idx_user_profiles_user_id` (user_id)
- `idx_user_profiles_platform` (platform)
- `idx_user_profiles_rating` (rating DESC)

### 3. Game Analyses Table
**Purpose**: Stores basic analysis data from simple analysis engine

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique analysis identifier |
| user_id | TEXT | NOT NULL | User identifier |
| platform | TEXT | NOT NULL, CHECK | Platform |
| game_id | TEXT | NOT NULL | Game identifier |
| total_moves | INTEGER | DEFAULT 0 | Total moves analyzed |
| accuracy | FLOAT | CHECK (0-100) | Overall accuracy |
| blunders | INTEGER | DEFAULT 0 | Number of blunders |
| mistakes | INTEGER | DEFAULT 0 | Number of mistakes |
| inaccuracies | INTEGER | DEFAULT 0 | Number of inaccuracies |
| brilliant_moves | INTEGER | DEFAULT 0 | Number of brilliant moves |
| opening_accuracy | FLOAT | CHECK (0-100) | Opening phase accuracy |
| middle_game_accuracy | FLOAT | CHECK (0-100) | Middle game accuracy |
| endgame_accuracy | FLOAT | CHECK (0-100) | Endgame accuracy |
| average_evaluation | FLOAT | | Average position evaluation |
| time_management_score | FLOAT | CHECK (0-100) | Time management score |
| tactical_score | FLOAT | CHECK (0-100) | Tactical ability score |
| positional_score | FLOAT | CHECK (0-100) | Positional understanding score |
| aggressive_score | FLOAT | CHECK (0-100) | Aggressiveness score |
| patient_score | FLOAT | CHECK (0-100) | Patience score |
| novelty_score | FLOAT | CHECK (0-100) | Novelty/creativity score |
| staleness_score | FLOAT | CHECK (0-100) | Staleness/repetitiveness score |
| tactical_patterns | JSONB | DEFAULT '[]' | Tactical patterns found |
| positional_patterns | JSONB | DEFAULT '[]' | Positional patterns found |
| moves_analysis | JSONB | DEFAULT '[]' | Move-by-move analysis |
| analysis_date | TIMESTAMP | DEFAULT NOW() | Analysis completion time |
| analysis_method | TEXT | DEFAULT 'basic' | Analysis method used |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Record update time |

**Foreign Keys**:
- `fk_game_analyses_user_profile` → user_profiles(user_id, platform)

**Indexes**:
- `idx_game_analyses_user_platform` (user_id, platform)
- `idx_game_analyses_game_id` (game_id)
- `idx_game_analyses_analysis_date` (analysis_date DESC)
- `idx_game_analyses_personality_scores` (tactical_score, positional_score, aggressive_score)
- `idx_game_analyses_novelty_staleness` (novelty_score, staleness_score)

### 4. Move Analyses Table
**Purpose**: Stores detailed move-by-move analysis from Stockfish engine

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique analysis identifier |
| user_id | TEXT | NOT NULL | User identifier |
| platform | TEXT | NOT NULL, CHECK | Platform |
| game_id | TEXT | NOT NULL | Game identifier |
| game_analysis_id | UUID | | Reference to basic analysis |
| average_centipawn_loss | FLOAT | DEFAULT 0 | Average centipawn loss |
| worst_blunder_centipawn_loss | FLOAT | DEFAULT 0 | Worst blunder in centipawns |
| best_move_percentage | FLOAT | CHECK (0-100) | Percentage of best moves |
| middle_game_accuracy | FLOAT | CHECK (0-100) | Middle game accuracy |
| endgame_accuracy | FLOAT | CHECK (0-100) | Endgame accuracy |
| time_management_score | FLOAT | CHECK (0-100) | Time management score |
| material_sacrifices | INTEGER | DEFAULT 0 | Number of material sacrifices |
| aggressiveness_index | FLOAT | DEFAULT 0 | Aggressiveness index |
| average_evaluation | FLOAT | | Average position evaluation |
| tactical_score | FLOAT | CHECK (0-100) | Tactical ability score |
| positional_score | FLOAT | CHECK (0-100) | Positional understanding score |
| aggressive_score | FLOAT | CHECK (0-100) | Aggressiveness score |
| patient_score | FLOAT | CHECK (0-100) | Patience score |
| novelty_score | FLOAT | CHECK (0-100) | Novelty/creativity score |
| staleness_score | FLOAT | CHECK (0-100) | Staleness/repetitiveness score |
| tactical_patterns | JSONB | DEFAULT '[]' | Tactical patterns found |
| positional_patterns | JSONB | DEFAULT '[]' | Positional patterns found |
| strategic_themes | JSONB | DEFAULT '[]' | Strategic themes identified |
| moves_analysis | JSONB | DEFAULT '[]' | Detailed move analysis |
| analysis_method | TEXT | DEFAULT 'stockfish' | Analysis method used |
| stockfish_depth | INTEGER | DEFAULT 15 | Stockfish analysis depth |
| analysis_date | TIMESTAMP | DEFAULT NOW() | Analysis completion time |
| processing_time_ms | INTEGER | | Processing time in milliseconds |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Record update time |

**Foreign Keys**:
- `fk_move_analyses_game_analysis` → game_analyses(id)
- `fk_move_analyses_user_profile` → user_profiles(user_id, platform)

**Indexes**:
- `idx_move_analyses_user_platform` (user_id, platform)
- `idx_move_analyses_game_analysis_id` (game_analysis_id)
- `idx_move_analyses_analysis_date` (analysis_date DESC)
- `idx_move_analyses_analysis_method` (analysis_method)
- `idx_move_analyses_personality_scores` (tactical_score, positional_score, aggressive_score)
- `idx_move_analyses_novelty_staleness` (novelty_score, staleness_score)

### 5. Game Features Table
**Purpose**: Stores calculated game features and patterns for personality analysis

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique feature identifier |
| user_id | TEXT | NOT NULL | User identifier |
| platform | TEXT | NOT NULL, CHECK | Platform |
| game_id | TEXT | NOT NULL | Game identifier |
| game_analysis_id | UUID | | Reference to basic analysis |
| opening_variation_count | INTEGER | DEFAULT 0 | Number of different openings |
| time_control_variation_count | INTEGER | DEFAULT 0 | Number of different time controls |
| game_length_variation | FLOAT | DEFAULT 0 | Variation in game length |
| tactical_score | FLOAT | CHECK (0-100) | Calculated tactical score |
| positional_score | FLOAT | CHECK (0-100) | Calculated positional score |
| aggressive_score | FLOAT | CHECK (0-100) | Calculated aggressiveness score |
| patient_score | FLOAT | CHECK (0-100) | Calculated patience score |
| novelty_score | FLOAT | CHECK (0-100) | Calculated novelty score |
| staleness_score | FLOAT | CHECK (0-100) | Calculated staleness score |
| calculated_at | TIMESTAMP | DEFAULT NOW() | Feature calculation time |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Record update time |

**Foreign Keys**:
- `fk_game_features_game_analysis` → game_analyses(id)
- `fk_game_features_user_profile` → user_profiles(user_id, platform)

**Indexes**:
- `idx_game_features_user_platform` (user_id, platform)
- `idx_game_features_game_analysis_id` (game_analysis_id)
- `idx_game_features_personality_scores` (tactical_score, positional_score, aggressive_score)
- `idx_game_features_novelty_staleness` (novelty_score, staleness_score)

## 🔒 Row Level Security (RLS)

### Security Model
All tables have Row Level Security enabled with the following policies:

#### Games Table
- **Select**: Users can only view their own games
- **Insert**: Users can only insert games for themselves
- **Update**: Users can only update their own games
- **Delete**: Users can only delete their own games

#### User Profiles Table
- **Select**: All users can view profiles (for search functionality)
- **Insert**: Users can only insert their own profile
- **Update**: Users can only update their own profile
- **Delete**: Users can only delete their own profile

#### Analysis Tables (game_analyses, move_analyses, game_features)
- **Select**: All users can view analyses (for public analytics)
- **Insert**: Users can only insert analyses for their own games
- **Update**: Users can only update their own analyses
- **Delete**: Users can only delete their own analyses

## 🔗 Foreign Key Relationships

### Relationship Diagram
```
user_profiles (user_id, platform)
    ↓
games (user_id, platform)
    ↓
game_analyses (user_id, platform, game_id)
    ↓
move_analyses (game_analysis_id)
    ↓
game_features (game_analysis_id)
```

### Referential Integrity
- All foreign key constraints are set to `ON DELETE CASCADE`
- This ensures data consistency when users or analyses are deleted
- Prevents orphaned records in the database

## 📈 Performance Optimization

### Indexing Strategy
1. **Primary Keys**: All tables have UUID primary keys
2. **Foreign Keys**: Indexed for efficient joins
3. **Query Patterns**: Indexes on frequently queried columns
4. **Composite Indexes**: Multi-column indexes for complex queries
5. **Partial Indexes**: Specialized indexes for specific use cases

### Query Optimization
- All queries use parameterized statements (Supabase client)
- Proper indexing on join columns
- Efficient data types and constraints
- Regular VACUUM and ANALYZE operations

## 🛠️ Maintenance Scripts

### Available Scripts
- `npm run db:validate` - Validate database schema
- `npm run db:monitor` - Monitor database performance
- `npm run db:reset` - Reset database (development)
- `npm run db:push` - Push migrations to database
- `npm run db:diff` - Show database differences

### Monitoring
- Table statistics monitoring
- Index usage analysis
- Slow query detection
- Performance recommendations
- Automated maintenance suggestions

## 📚 Migration History

### Migration Files
1. `20240101000000_initial_schema.sql` - Initial games table
2. `20240101000002_user_profiles.sql` - User profiles
3. `20240101000006_fix_platform_consistency.sql` - Platform fixes
4. `20240101000007_add_missing_columns.sql` - Additional columns
5. `20240101000009_cleanup_and_optimize.sql` - Cleanup
6. `20240101000010_fix_rls_policy.sql` - RLS fixes
7. `20240101000011_fix_user_profiles_rls.sql` - User profiles RLS
8. `20240101000012_fix_user_profiles_rls_final.sql` - Final RLS
9. `20240101000013_add_performance_indexes.sql` - Performance indexes
10. `20240101000014_align_with_remote.sql` - Remote alignment
11. `20240101000020_create_move_analyses_clean.sql` - Move analyses
12. `20240101000021_add_missing_fields_to_move_analyses.sql` - Missing fields
13. `20240101000022_add_novelty_staleness_traits.sql` - Novelty/staleness
14. `20241220_fix_missing_game_analyses_table.sql` - Missing game_analyses
15. `20241220_create_game_features_table.sql` - Game features
16. `20241220_consolidate_schema_final.sql` - Schema consolidation
17. `20241220_create_unified_analyses_view.sql` - Unified view
18. `20241220_consolidate_schema_comprehensive.sql` - Comprehensive consolidation
19. `20241220_complete_rls_policies.sql` - Complete RLS policies

## 🔍 Troubleshooting

### Common Issues
1. **Missing Tables**: Run `npm run db:validate` to check schema
2. **Performance Issues**: Run `npm run db:monitor` for analysis
3. **RLS Problems**: Check policy definitions and user context
4. **Foreign Key Violations**: Ensure referential integrity

### Debugging Tools
- Schema validation script
- Performance monitoring script
- RLS policy testing functions
- Query execution analysis

## 📋 Best Practices

### Data Management
1. Always use parameterized queries
2. Respect RLS policies
3. Maintain referential integrity
4. Regular performance monitoring
5. Proper indexing strategy

### Security
1. Never bypass RLS policies
2. Validate all inputs
3. Use proper authentication
4. Regular security audits
5. Monitor access patterns

### Performance
1. Monitor query performance
2. Regular VACUUM and ANALYZE
3. Optimize indexes based on usage
4. Use appropriate data types
5. Plan for scalability
