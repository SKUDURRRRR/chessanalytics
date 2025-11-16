-- Check what the on_user_registration trigger does
SELECT
    trigger_name,
    event_object_table,
    action_statement,
    pg_get_triggerdef(t.oid) as trigger_definition
FROM information_schema.triggers tr
JOIN pg_trigger t ON t.tgname = tr.trigger_name
WHERE trigger_name = 'on_user_registration';

-- Also check if there's a function for it
SELECT
    routine_name,
    pg_get_functiondef(p.oid) as function_definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
AND routine_name LIKE '%registration%';
