-- Check if unified_analyses view has SECURITY DEFINER
SELECT
    schemaname,
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE viewname = 'unified_analyses'
AND schemaname = 'public';

-- Also check pg_class for security properties
SELECT
    c.relname,
    c.relkind,
    c.relacl,
    pg_get_viewdef(c.oid, true) as view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'unified_analyses'
AND n.nspname = 'public';
