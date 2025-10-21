-- Check for security options on the view
SELECT
    c.relname,
    c.reloptions,
    CASE
        WHEN c.reloptions::text LIKE '%security_invoker%' THEN 'SECURITY INVOKER'
        WHEN c.reloptions IS NULL THEN 'SECURITY DEFINER (default)'
        ELSE c.reloptions::text
    END as security_setting
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'unified_analyses'
AND n.nspname = 'public'
AND c.relkind = 'v';
