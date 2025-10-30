# Security Fix: Hardcoded User IDs Removed

**Date**: 2025-10-30
**Severity**: Major (Privacy & Security Risk)
**Status**: ✅ Fixed

## Issue

CodeRabbit identified hardcoded production user IDs in SQL files committed to version control. This poses both privacy and security risks by exposing real user identifiers.

## Files Fixed

### 1. `upgrade_current_logged_in_user.sql` (DELETED)
- **Action**: File deleted entirely
- **Reason**: Ad-hoc script that should never have been committed
- **Contained**: 2 production user UUIDs
  - `2c002b04-2389-42b1-9d66-2f8d521861a9`
  - `194590d4-8d56-44b2-872a-e3e514a7eed6`

### 2. `supabase/migrations/20251030000005_fix_account_tier_constraint.sql`
- **Action**: Removed manual user upgrade section
- **Before**: Contained hardcoded UPDATE and SELECT statements with production user ID
- **After**: Clean migration file with only schema changes
- **Removed**: Manual upgrade section referencing `194590d4-8d56-44b2-872a-e3e514a7eed6`

## Prevention Measures

### Added to `.gitignore`:
```gitignore
# Ad-hoc SQL scripts (may contain sensitive data)
# Use manual_upgrade_user.sql or similar template scripts instead
upgrade_*.sql
fix_user_*.sql
*_adhoc.sql
```

### Best Practices Going Forward:

1. **Use Template Scripts**: Always use `manual_upgrade_user.sql` with placeholders (`:user_email`) instead of hardcoded IDs
2. **Ad-hoc Scripts**: Create temporary SQL scripts outside the repository when dealing with specific user data
3. **Migration Files**: Keep migration files focused on schema changes only, never include production data
4. **Code Review**: Watch for UUID patterns in code reviews before merging

## Proper Way to Upgrade Users Manually

✅ **Correct** - Use the template script:
```sql
-- manual_upgrade_user.sql
WHERE u.email = :user_email;
```

❌ **Incorrect** - Hardcoded IDs:
```sql
WHERE id = '194590d4-8d56-44b2-872a-e3e514a7eed6';
```

## Impact

- **Privacy**: Production user identifiers no longer exposed in version control
- **Security**: Reduced attack surface by not providing real user IDs to potential attackers
- **Compliance**: Better alignment with data protection best practices

## Verification

All hardcoded UUIDs have been removed from SQL files:
```bash
grep -r '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' *.sql
# Result: No matches found ✅
```
