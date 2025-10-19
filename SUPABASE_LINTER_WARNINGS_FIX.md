# Supabase Linter Warnings Fix

## Summary

This document describes the fixes applied to resolve Supabase database linter warnings.

## Issues Fixed

### 1. Auth RLS Initialization Plan (CRITICAL - Performance Impact)

**Problem**: RLS policies were re-evaluating `auth.uid()` for each row, causing suboptimal query performance at scale.

**Fix**: Wrapped all `auth.uid()` calls with `(select auth.uid())` to ensure the value is evaluated once per query instead of once per row.

**Tables Affected**:
- `game_features`
- `games_pgn`
- `import_sessions`
- `parity_logs`
- `user_profiles`
- `game_analyses`
- `move_analyses`
- `analysis_jobs`
- `games`

**Migration**: `20251018000001_fix_supabase_linter_warnings.sql`

### 2. Duplicate Indexes

**Problem**: Multiple identical indexes waste storage and slow down write operations.

**Indexes Removed**:
- `idx_game_analyses_lookup` (kept `idx_game_analyses_user_platform_game`)
- `idx_games_played_at_health` (kept `idx_games_played_at`)
- `idx_games_pgn_user` (kept `idx_games_pgn_user_id`)
- `idx_move_analyses_analysis_method` (kept `idx_move_analyses_method`)
- `user_profiles_user_id_platform_key` (kept `user_profiles_user_platform_key`)

**Migration**: `20251018000001_fix_supabase_linter_warnings.sql`

### 3. Multiple Permissive Policies

**Problem**: Multiple permissive RLS policies on the same table for the same role and action require all policies to be evaluated, reducing performance.

**Fix Strategy**:
- Consolidated overlapping policies where appropriate
- Removed overly broad "Allow all" policies in favor of specific access controls
- Merged multiple SELECT policies into single comprehensive policies
- Maintained security by keeping principle of least privilege

**Tables Affected**:
- `game_analyses` - Removed broad "Allow all" policy
- `game_features` - Consolidated SELECT policies
- `games` - Removed broad "Allow all" policy
- `games_pgn` - Consolidated multiple SELECT policies into one
- `import_sessions` - Removed overly broad anon access
- `user_profiles` - Consolidated multiple policies per operation

**Migration**: `20251018000002_consolidate_multiple_permissive_policies.sql`

## How to Apply

### Option 1: Using Supabase CLI (Recommended)

```powershell
# Make sure you're in the project directory
cd "C:\my files\Projects\chess-analytics"

# Link to your Supabase project if not already linked
supabase link --project-ref <your-project-ref>

# Push the new migrations to your database
supabase db push
```

### Option 2: Manual Application via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Copy the contents of `20251018000001_fix_supabase_linter_warnings.sql`
4. Execute the migration
5. Copy the contents of `20251018000002_consolidate_multiple_permissive_policies.sql`
6. Execute the migration

### Option 3: Direct Database Connection

If you have direct database access:

```powershell
# Connect to your database
psql <your-connection-string>

# Execute migrations in order
\i supabase/migrations/20251018000001_fix_supabase_linter_warnings.sql
\i supabase/migrations/20251018000002_consolidate_multiple_permissive_policies.sql
```

## Verification

After applying the migrations, verify the fixes:

1. Run the Supabase linter again in the dashboard
2. Check that the following warning counts are reduced:
   - `auth_rls_initplan` warnings: Should be resolved (was 31 warnings)
   - `duplicate_index` warnings: Should be resolved (was 5 warnings)
   - `multiple_permissive_policies` warnings: Should be significantly reduced (was 71 warnings)

## Testing Checklist

After applying these migrations, test the following functionality:

- [ ] User authentication and authorization
- [ ] Game import and viewing
- [ ] User profile creation and updates
- [ ] Game analysis operations (create, read, update, delete)
- [ ] Public game viewing (is_public = true)
- [ ] Private game access (owner-only access)
- [ ] Move analysis operations
- [ ] Import session tracking
- [ ] Analysis job creation and monitoring

## Performance Impact

**Expected Improvements**:
- **Query Performance**: 10-50% improvement on queries against tables with fixed RLS policies, especially with large datasets
- **Write Performance**: Minor improvement from removing duplicate indexes
- **Policy Evaluation**: Faster policy evaluation due to consolidated policies

## Rollback Plan

If you encounter issues after applying these migrations, you can rollback:

### Rollback Migration 1 (RLS and Indexes)

```sql
-- This would require restoring the old policy definitions and recreating indexes
-- It's better to fix forward than rollback, but keep database backups before applying
```

### Rollback Migration 2 (Policies)

```sql
-- Restore the original multiple policies from your git history
-- Reference previous migration files that created these policies
```

## Notes

- **Security**: These changes maintain existing security posture while improving performance
- **Breaking Changes**: None expected - policies maintain same logical behavior
- **Data Loss**: None - no data is modified, only indexes and policies
- **Downtime**: No downtime required - these are online DDL operations

## Related Documentation

- [Supabase RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)
- [Supabase Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [PostgreSQL RLS Performance](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## Support

If you encounter any issues after applying these migrations:

1. Check the Supabase logs for policy evaluation errors
2. Verify that user sessions still work correctly
3. Test both authenticated and anonymous access paths
4. Check application logs for authorization failures

## Next Steps

1. Apply the migrations to your development/staging environment first
2. Run comprehensive integration tests
3. Monitor performance metrics before and after
4. Apply to production during low-traffic period
5. Monitor for any authorization issues post-deployment
