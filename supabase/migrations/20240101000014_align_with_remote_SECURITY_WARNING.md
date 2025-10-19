# SECURITY WARNING: 20240101000014_align_with_remote.sql

## Critical Security Issues

This migration file grants **ALL permissions to anonymous users** on multiple tables and functions. This is a **CRITICAL SECURITY VULNERABILITY**.

### Affected Lines

Lines 335-367 contain insecure GRANT statements:

```sql
GRANT ALL ON FUNCTION "public"."cleanup_old_parity_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_games_batch"("games_data" "jsonb"[]) TO "anon";
GRANT ALL ON TABLE "public"."game_analyses" TO "anon";
GRANT ALL ON TABLE "public"."analysis_summary" TO "anon";
GRANT ALL ON TABLE "public"."app_admins" TO "anon";           -- ⚠️ EXTREMELY DANGEROUS
GRANT ALL ON TABLE "public"."games_pgn" TO "anon";
GRANT ALL ON TABLE "public"."import_sessions" TO "anon";
GRANT ALL ON TABLE "public"."parity_logs" TO "anon";
GRANT ALL ON SEQUENCE "public"."parity_logs_id_seq" TO "anon";
```

### Security Implications

| Table/Function | Current Access | Risk Level | Impact |
|----------------|----------------|------------|---------|
| `app_admins` | ALL to anon | **CRITICAL** | Anonymous users can grant themselves admin privileges |
| `game_analyses` | ALL to anon | **HIGH** | Anonymous users can modify/delete all game analyses |
| `games_pgn` | ALL to anon | **HIGH** | Anonymous users can modify/delete all PGN data |
| `import_sessions` | ALL to anon | **MEDIUM** | Anonymous users can interfere with imports |
| `parity_logs` | ALL to anon | **MEDIUM** | Anonymous users can tamper with logs |
| Functions | ALL to anon | **HIGH** | Anonymous users can execute administrative functions |

### Immediate Action Required

#### Option 1: Create a Secure Replacement (Recommended)

Create a new migration file `20240101000014_align_with_remote_SECURE.sql` that:

1. Grants only **SELECT** to anon for read-only tables
2. Grants **NOTHING** to anon for sensitive tables like `app_admins`
3. Grants **EXECUTE** only for safe, read-only functions
4. Uses proper RLS policies instead of blanket grants

#### Option 2: Revoke Insecure Grants

Run the following to revoke dangerous permissions:

```sql
-- Revoke ALL from anon (use SELECT where appropriate)
REVOKE ALL ON TABLE public.app_admins FROM anon;
REVOKE ALL ON TABLE public.game_analyses FROM anon;
REVOKE ALL ON TABLE public.games_pgn FROM anon;
REVOKE ALL ON TABLE public.import_sessions FROM anon;
REVOKE ALL ON TABLE public.parity_logs FROM anon;
REVOKE ALL ON SEQUENCE public.parity_logs_id_seq FROM anon;

REVOKE ALL ON FUNCTION public.cleanup_old_parity_logs() FROM anon;
REVOKE ALL ON FUNCTION public.upsert_games_batch(jsonb[]) FROM anon;
REVOKE ALL ON FUNCTION public.update_game_analyses_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.update_user_profile_updated_at() FROM anon;

-- Grant only SELECT where needed (if at all)
GRANT SELECT ON TABLE public.analysis_summary TO anon;

-- app_admins should have NO anonymous access at all
-- Rely on RLS policies for proper access control
```

### Proper Permissions Model

**General Principle**: Use RLS policies for access control, not blanket GRANT statements.

```sql
-- SECURE PATTERN:
-- 1. Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- 2. Create specific policies
CREATE POLICY "policy_name" ON table_name
  FOR SELECT
  USING (auth.uid()::text = user_id OR is_public = true);

-- 3. Grant minimal table-level permissions
GRANT SELECT ON table_name TO anon;  -- Only if truly needed
GRANT ALL ON table_name TO authenticated;
GRANT ALL ON table_name TO service_role;
```

### Migration Path

1. **Immediate**: Document this issue (this file)
2. **Next**: Run revocation script above
3. **Then**: Apply proper RLS policies from `RESTORE_SECURE_RLS_POLICIES.sql`
4. **Finally**: Test that application still works with restricted permissions

### Testing

After revoking permissions:

```sql
-- Test 1: Verify anonymous cannot access app_admins
SET ROLE anon;
SELECT * FROM app_admins;  -- Should fail or return 0 rows
RESET ROLE;

-- Test 2: Verify anonymous cannot execute admin functions
SET ROLE anon;
SELECT cleanup_old_parity_logs();  -- Should fail
RESET ROLE;

-- Test 3: Verify authenticated users can still access their own data
-- (Test with actual authenticated session)
```

## Status

- [ ] Security issue documented
- [ ] Revocation script prepared
- [ ] New secure migration created
- [ ] Revocations applied to database
- [ ] Application tested with new permissions
- [ ] RLS policies verified working

## References

- See `RESTORE_SECURE_RLS_POLICIES.sql` for secure policy examples
- See `RLS_SECURITY_FIX_COMPLETE.md` for overall security strategy
- PostgreSQL RLS documentation: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

