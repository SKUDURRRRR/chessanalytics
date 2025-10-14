-- Check if opening_normalized column exists
-- Run this in Supabase SQL Editor

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'games' 
  AND column_name = 'opening_normalized';

-- If above returns 0 rows, the column doesn't exist
-- If above returns 1 row, the column exists

-- Also check what columns DO exist in games table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'games'
ORDER BY ordinal_position;

