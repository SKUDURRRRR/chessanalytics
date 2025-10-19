-- Check what constraints exist on game_analyses table
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.game_analyses'::regclass
    AND contype = 'u' -- unique constraints only
ORDER BY conname;
