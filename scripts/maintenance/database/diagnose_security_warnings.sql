-- Diagnostic Script: Find all functions and views that need security fixes
-- Date: 2025-11-02
-- Purpose: Identify which functions and materialized views from linter warnings actually exist
--
-- INSTRUCTIONS:
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Review the results to see what exists
-- 3. For any functions found, add SET search_path = public to them
-- 4. For any materialized views found, review and restrict access if needed

-- ============================================================================
-- Part 1: Check for Missing Functions
-- ============================================================================

SELECT
    '=== FUNCTIONS FROM LINTER WARNINGS ===' as section,
    '' as function_name,
    '' as has_search_path_set,
    '' as function_type,
    '' as security_type;

SELECT
    routine_name as function_name,
    CASE
        WHEN routine_definition LIKE '%search_path%' THEN '✓ YES'
        ELSE '✗ NO - NEEDS FIX'
    END as has_search_path_set,
    routine_type as function_type,
    CASE
        WHEN security_type = 'DEFINER' THEN '⚠️ SECURITY DEFINER (HIGH PRIORITY)'
        ELSE security_type
    END as security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
    'track_player_search',
    'track_game_analysis',
    'track_pricing_page_view',
    'get_dashboard_metrics',
    'get_analyzed_players_stats',
    'get_registration_details',
    'get_user_analysis_stats',
    'refresh_analytics_views',
    'get_registration_stats',
    'get_player_search_stats',
    'update_updated_at_column',
    'validate_subscription_data'
)
ORDER BY
    CASE WHEN security_type = 'DEFINER' THEN 0 ELSE 1 END,
    routine_name;

-- ============================================================================
-- Part 2: Check for All Functions Without search_path
-- ============================================================================

SELECT
    '' as separator,
    '=== ALL FUNCTIONS MISSING search_path ===' as section;

SELECT
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    CASE
        WHEN prosecdef THEN '⚠️ SECURITY DEFINER (HIGH PRIORITY)'
        ELSE 'INVOKER'
    END as security_type,
    CASE
        WHEN proconfig IS NOT NULL AND proconfig::text LIKE '%search_path%' THEN '✓ Has search_path'
        ELSE '✗ MISSING search_path - NEEDS FIX'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (proconfig IS NULL OR proconfig::text NOT LIKE '%search_path%')
ORDER BY
    CASE WHEN prosecdef THEN 0 ELSE 1 END,
    p.proname;

-- ============================================================================
-- Part 3: Check for Materialized Views from Warnings
-- ============================================================================

SELECT
    '' as separator,
    '=== MATERIALIZED VIEWS FROM LINTER WARNINGS ===' as section;

SELECT
    schemaname as schema_name,
    matviewname as view_name,
    matviewowner as owner,
    'Materialized View' as object_type
FROM pg_matviews
WHERE schemaname = 'public'
AND matviewname IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly');

-- ============================================================================
-- Part 4: Check Permissions on Materialized Views (if they exist)
-- ============================================================================

SELECT
    '' as separator,
    '=== PERMISSIONS ON MATERIALIZED VIEWS ===' as section;

SELECT
    table_schema as schema_name,
    table_name as view_name,
    grantee as role,
    string_agg(privilege_type, ', ') as permissions,
    CASE
        WHEN grantee = 'anon' AND privilege_type LIKE '%SELECT%' THEN '⚠️ ANONYMOUS ACCESS - REVIEW NEEDED'
        WHEN grantee = 'authenticated' AND privilege_type LIKE '%SELECT%' THEN '⚠️ AUTHENTICATED ACCESS - REVIEW NEEDED'
        ELSE 'OK'
    END as security_note
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly')
GROUP BY table_schema, table_name, grantee, security_note
ORDER BY
    table_name,
    CASE
        WHEN grantee = 'anon' THEN 0
        WHEN grantee = 'authenticated' THEN 1
        ELSE 2
    END;

-- ============================================================================
-- Part 5: Summary and Recommendations
-- ============================================================================

SELECT
    '' as separator,
    '=== SUMMARY ===' as section;

-- Count functions without search_path
WITH function_counts AS (
    SELECT
        COUNT(*) FILTER (WHERE proconfig IS NULL OR proconfig::text NOT LIKE '%search_path%') as missing_search_path,
        COUNT(*) FILTER (WHERE prosecdef AND (proconfig IS NULL OR proconfig::text NOT LIKE '%search_path%')) as security_definer_missing,
        COUNT(*) as total_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
),
view_counts AS (
    SELECT
        COUNT(*) as total_matviews
    FROM pg_matviews
    WHERE schemaname = 'public'
    AND matviewname IN ('analytics_hourly', 'analytics_daily', 'analytics_weekly', 'analytics_monthly')
)
SELECT
    fc.total_functions as total_public_functions,
    fc.missing_search_path as functions_missing_search_path,
    fc.security_definer_missing as high_priority_functions,
    vc.total_matviews as materialized_views_found,
    CASE
        WHEN fc.security_definer_missing > 0 THEN '⚠️ HIGH - Security Definer functions without search_path'
        WHEN fc.missing_search_path > 0 THEN '⚠️ MEDIUM - Regular functions without search_path'
        WHEN vc.total_matviews > 0 THEN '⚠️ MEDIUM - Materialized views exposed to API'
        ELSE '✓ ALL GOOD'
    END as risk_level
FROM function_counts fc, view_counts vc;

-- ============================================================================
-- Part 6: Generate Fix Scripts
-- ============================================================================

SELECT
    '' as separator,
    '=== AUTO-GENERATED FIX SCRIPT ===' as section;

SELECT
    format(
        E'-- Fix function: %s\nCREATE OR REPLACE FUNCTION %s(%s)\nRETURNS %s\nSET search_path = public  -- Added for security\nLANGUAGE %s\nAS $function$\n-- TODO: Copy original function body here\n$function$;\n',
        p.proname,
        p.proname,
        pg_get_function_arguments(p.oid),
        pg_get_function_result(p.oid),
        l.lanname
    ) as fix_script
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN pg_language l ON p.prolang = l.oid
WHERE n.nspname = 'public'
AND (proconfig IS NULL OR proconfig::text NOT LIKE '%search_path%')
AND p.proname IN (
    'track_player_search',
    'track_game_analysis',
    'track_pricing_page_view',
    'get_dashboard_metrics',
    'get_analyzed_players_stats',
    'get_registration_details',
    'get_user_analysis_stats',
    'refresh_analytics_views',
    'get_registration_stats',
    'get_player_search_stats'
)
ORDER BY
    CASE WHEN prosecdef THEN 0 ELSE 1 END,
    p.proname;

-- ============================================================================
-- NOTES:
-- 1. Functions with SECURITY DEFINER are HIGH PRIORITY
-- 2. All functions should have SET search_path = public for security
-- 3. Materialized views exposed to 'anon' or 'authenticated' should be reviewed
-- 4. Use the generated fix scripts as templates, then add the original function body
-- ============================================================================
