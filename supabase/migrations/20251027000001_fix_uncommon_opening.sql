-- Fix games showing "Uncommon Opening" by using actual opening name instead of ECO code
-- This addresses the bug where opening_family (ECO code) was prioritized over opening (actual name)

-- Strategy:
-- 1. Find all games with opening_normalized = 'Uncommon Opening' (ECO code A00)
-- 2. Update them to use the actual opening name from the 'opening' field if available
-- 3. Only keep "Uncommon Opening" if no better name exists

BEGIN;

-- Update games that have 'Uncommon Opening' as normalized name
-- but have a proper opening name in the 'opening' field
UPDATE public.games
SET opening_normalized = opening
WHERE opening_normalized = 'Uncommon Opening'
  AND opening IS NOT NULL
  AND opening != 'Unknown'
  AND opening != 'Uncommon Opening'
  AND opening != '';

-- Log the changes
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % games from "Uncommon Opening" to their actual opening names', updated_count;
END $$;

COMMIT;
